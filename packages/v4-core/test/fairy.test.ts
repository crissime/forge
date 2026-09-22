import { describe, expect, it } from "vitest";
import {
  adaptProfileToV4, buildPlayerCombatProfile, evaluateCombatVerdict, evaluatePvpVerdict,
  F64_SCALE, FD6_SCALE, f64FromNumber, resolveProfileFairy,
  type FairyId, type FairySeasonConfig, type NormalizedProfile, type V4GameDataInput
} from "../src/index";

// Candidate transcription only, deliberately not a production default.
const season: FairySeasonConfig = {
  gameVersion: "2.9.0", seasonId: "test-2026-09-09",
  provenance: { source: "v4/fees-2.9.0.md", observedAt: "2026-09-09", status: "community_transcription" },
  fairies: {
    Mira: { divisor: 15, baseBonus: 1, gainPerLevel: 1, cap: 80, maxLevel: 20 },
    Tira: { divisor: 1, baseBonus: 0.25, gainPerLevel: 0.25, cap: 30, maxLevel: 20 },
    Lora: { divisor: 10, baseBonus: 0.75, gainPerLevel: 0.75, cap: 30, maxLevel: 20 }
  }
};
const cases = [
  { id: "Mira", required: "skillDamage", target: "critChance", chance: "criticalChance", baseQ: 42949672n },
  { id: "Tira", required: "skillCooldown", target: "block", chance: "blockChance", baseQ: 10737418n },
  { id: "Lora", required: "health", target: "reflectChance", chance: "reflectChance", baseQ: 32212254n }
] as const;
const quantumPoints = 100 / Number(F64_SCALE);

describe.each(cases)("$id native fairy calculation", ({ id, required, target, chance, baseQ }) => {
  it.each([1, 20])("checks thresholds one ratio quantum apart at level %s", (level) => {
    const divisor = season.fairies[id].divisor;
    for (const [total, steps] of [[divisor - quantumPoints, 0n], [divisor, 1n],
      [divisor + quantumPoints, 1n], [2 * divisor, 2n]] as const) {
      const source = profile(id);
      source.fairy!.level = level;
      source.secondaryStatsBeforeFairy![required] = total;
      // Global totals must not be used as the conversion input.
      source.stats[required] = 900;
      const fairy = calculate(source);
      expect(fairy.steps).toBe(steps);
      expect(fairy.bonusPerStep).toBe(baseQ * BigInt(level));
      expect(fairy.rawBonus).toBe(steps * baseQ * BigInt(level));
    }
  });

  it("floors signed ratios before abs, rather than flooring abs", () => {
    const source = profile(id);
    source.secondaryStatsBeforeFairy![required] = -season.fairies[id].divisor / 2;
    expect(calculate(source).steps).toBe(1n);
  });

  it("caps raw secondary targets, preserving other contributions and raw bonus", () => {
    const source = profile(id);
    const cap = season.fairies[id].cap;
    source.fairy!.level = 20;
    source.secondaryStatsBeforeFairy![required] = 10 * season.fairies[id].divisor;
    for (const targetBefore of [cap - 1, cap, cap + 10]) {
      source.secondaryStatsBeforeFairy![target] = targetBefore;
      source.stats[target] = targetBefore + 5; // Other layers, e.g. talents.
      const fairy = calculate(source);
      expect(fairy.rawBonus).toBe(200n * baseQ);
      expect(fairy.targetRawAfter).toBe(fairy.targetBefore + fairy.rawBonus);
      expect(fairy.targetEffectiveAfter).toBe(f64FromNumber(cap / 100));
      expect(fairy.effectiveBonus).toBe(f64FromNumber(cap / 100) - fairy.targetBefore);
      const result = buildPlayerCombatProfile(source, data().tables, "2.9.0");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.profile[chance]).toBe(fairy.combatTargetAfter * FD6_SCALE / F64_SCALE);
    }
    source.secondaryStatsBeforeFairy![required] = 0;
    const noBonus = calculate(source);
    expect(noBonus.rawBonus).toBe(0n);
    expect(noBonus.effectiveBonus).toBe(0n);
    expect(noBonus.targetEffectiveAfter).toBe(noBonus.targetBefore);
  });

  it("recalculates candidates, remains replayable and never mutates input or config", () => {
    const source = profile(id);
    const copy = structuredClone(source);
    const config = structuredClone(season);
    const first = calculate(source);
    expect(calculate(source)).toEqual(first);
    expect(source).toEqual(copy);
    expect(season).toEqual(config);
    first.coefficients.cap = 0;
    first.provenance.source = "changed";
    expect(season).toEqual(config);
    source.secondaryStatsBeforeFairy![required] = source.secondaryStatsBeforeFairy![required]! * 2;
    expect(calculate(source).rawBonus).toBe(2n * first.rawBonus);
    source.fairy!.statsState = "included";
    expect(resolveProfileFairy(source, season, "2.9.0")).toMatchObject({
      ok: false, issue: { code: "invalid_profile_fairy_stats_state" }
    });
  });

  it("uses the same adjusted profile in PvE and on either PvP side", () => {
    const source = profile(id);
    source.fairy!.level = 20;
    source.secondaryStatsBeforeFairy![required] = 6 * season.fairies[id].divisor;
    const fairy = calculate(source);
    const manual = structuredClone(source);
    delete manual.fairy;
    manual.stats[target] = Number(fairy.combatTargetAfter) / Number(F64_SCALE) * 100;
    const point = { age: 1, combat: 1, difficulty: "normal" } as const;
    const options = { blockMode: "rng", seed: 42 } as const;
    const pve = evaluateCombatVerdict(source, data(), point, { ...options, maxSeconds: 10 });
    const expectedPve = evaluateCombatVerdict(manual, data(), point, { ...options, maxSeconds: 10 });
    expect(pve.reason).not.toMatch(/invalid_input|missing_data/);
    expect(pve).toEqual({ ...expectedPve, issues: pve.issues, metrics: pve.metrics });
    expect(pve.issues).toContainEqual({ severity: "warning", code: "fairy_community_transcription", path: "profile.fairy" });
    expect(pve.metrics).toMatchObject({ fairyId: id, fairyLevel: 20, fairySeasonId: season.seasonId });
    expect(pve.metrics.playerMaxHealth).toBe(11000);
    const opponent = profile();
    for (const side of ["player", "opponent"] as const) {
      const pvp = side === "player" ? evaluatePvpVerdict(source, opponent, data(), options)
        : evaluatePvpVerdict(opponent, source, data(), options);
      const expected = side === "player" ? evaluatePvpVerdict(manual, opponent, data(), options)
        : evaluatePvpVerdict(opponent, manual, data(), options);
      expect(pvp.reason).not.toMatch(/invalid_input|missing_data/);
      expect(pvp).toEqual({ ...expected, issues: pvp.issues, metrics: pvp.metrics });
      expect(pvp.issues).toContainEqual({ severity: "warning", code: "fairy_community_transcription", path: `${side}.fairy` });
      expect(pvp.metrics[`${side}FairyId`]).toBe(id);
      expect(pvp.metrics[`${side}FairyLevel`]).toBe(20);
      expect(pvp.metrics[`${side}FairySeasonId`]).toBe(season.seasonId);
    }
  });
});

describe("fairy contract diagnostics and compatibility", () => {
  it("quantizes ratios, not percentage points, at a strict Tira boundary", () => {
    const source = profile("Tira");
    source.secondaryStatsBeforeFairy!.skillCooldown = 0.99999999;
    expect(calculate(source).steps).toBe(1n);
    source.secondaryStatsBeforeFairy!.skillCooldown = 1 - quantumPoints;
    expect(calculate(source).steps).toBe(0n);
  });

  it.each([
    ["invalid selection", (s: any) => { s.fairy = false; }, "invalid_profile_fairy"],
    ["unknown id", (s: any) => { s.fairy.id = "Other"; }, "invalid_profile_fairy"],
    ["unknown state", (s: any) => { delete s.fairy.statsState; }, "invalid_profile_fairy_stats_state"],
    ["inactive event", (s: any) => { s.fairy.eventState = "expired"; }, "invalid_profile_fairy_event"],
    ["wrong season", (s: any) => { s.fairy.seasonId = "old"; }, "invalid_profile_fairy_season"],
    ...[0, 21, 1.5, NaN].map((level) => [String(level), (s: any) => { s.fairy.level = level; }, "invalid_profile_fairy_level"] as const),
    ["missing secondary", (s: any) => { delete s.secondaryStatsBeforeFairy; }, "invalid_profile_fairy_secondary_total"],
    ["missing raw target", (s: any) => { delete s.secondaryStatsBeforeFairy.critChance; }, "invalid_profile_fairy_secondary_total"],
    ["missing global target", (s: any) => { delete s.stats.critChance; }, "invalid_profile_fairy_target_total"],
    ["NaN", (s: any) => { s.secondaryStatsBeforeFairy.skillDamage = NaN; }, "invalid_profile_fairy_secondary_total"],
    ["string", (s: any) => { s.secondaryStatsBeforeFairy.skillDamage = "15"; }, "invalid_profile_fairy_secondary_total"],
    ["overflow", (s: any) => { s.secondaryStatsBeforeFairy.skillDamage = 2e11; }, "invalid_profile_fairy_overflow"]
  ] as const)("rejects %s", (_, modify, code) => {
    const source = profile("Mira");
    modify(source);
    expect(resolveProfileFairy(source, season, "2.9.0")).toMatchObject({ ok: false, issue: { code } });
  });

  it.each([undefined, "2.8.2"])("never silently uses version %s for a fairy", (version) => {
    expect(resolveProfileFairy(profile("Mira"), season, version)).toMatchObject({
      ok: false, issue: { code: "unsupported_fairy_game_version" }
    });
  });

  it.each([
    (c: any) => { c.fairies.Mira.divisor = 0; },
    (c: any) => { c.fairies.Mira.divisor = 1e-12; },
    (c: any) => { c.fairies.Mira.baseBonus = -1; },
    (c: any) => { c.fairies.Mira.gainPerLevel = Infinity; },
    (c: any) => { delete c.fairies.Mira.cap; },
    (c: any) => { c.fairies.Mira.maxLevel = 2.5; }
  ])("rejects incomplete or invalid coefficients", (modify) => {
    const config = structuredClone(season);
    modify(config);
    expect(resolveProfileFairy(profile("Mira"), config, "2.9.0")).toMatchObject({
      ok: false, issue: { code: "invalid_fairy_coefficients" }
    });
  });

  it("requires configuration and provenance and accepts explicit new coefficients", () => {
    const source = profile("Mira");
    expect(resolveProfileFairy(source, undefined, "2.9.0")).toMatchObject({ ok: false });
    expect(resolveProfileFairy(source, { ...season, provenance: {} }, "2.9.0")).toMatchObject({
      ok: false, issue: { code: "invalid_fairy_provenance" }
    });
    const config = structuredClone(season);
    config.fairies.Mira.baseBonus = 2;
    source.fairy!.level = 3;
    const result = resolveProfileFairy(source, config, "2.9.0");
    expect(result.ok && result.fairy!.rawBonus).toBe(85899345n + 2n * 42949672n);
  });

  it("does not label a verified season as a community transcription", () => {
    const verified = data();
    const config = structuredClone(season);
    config.provenance.status = "verified_in_game";
    verified.tables.FairySeasonConfig = config;
    const result = evaluateCombatVerdict(profile("Mira"), verified,
      { age: 1, combat: 1, difficulty: "normal" }, { maxSeconds: 5 });
    expect(result.issues).toEqual([]);
    expect(result.metrics.fairyProvenanceStatus).toBe("verified_in_game");
  });

  it("propagates malformed requests as diagnostics in both verdicts", () => {
    const source = profile("Mira");
    source.fairy!.statsState = "included";
    const pve = evaluateCombatVerdict(source, data(), { age: 1, combat: 1, difficulty: "normal" });
    expect(pve.reason).toBe("invalid_input");
    const pvp = evaluatePvpVerdict(profile(), source, data());
    expect(pvp.reason).toBe("invalid_input");
    expect(pvp.issues[0].path).toBe("opponent.fairy.statsState");
    const legacyData = data();
    legacyData.version = "2.8.2";
    expect(evaluatePvpVerdict(profile("Tira"), profile(), legacyData).reason).toBe("missing_data");
  });

  it("preserves old profiles and adapts enriched profiles non-destructively", () => {
    const source = profile();
    const before = structuredClone(source);
    expect(buildPlayerCombatProfile(source, data().tables)).toEqual(buildPlayerCombatProfile(source, data().tables, "2.9.0"));
    expect(source).toEqual(before);
    const enriched = profile("Lora");
    for (const input of [enriched, { schema: "forge-master-v2-profile", profile: enriched },
      { normalized: enriched }, { rawProfile: JSON.stringify(enriched) }, { state: { profile: enriched } }]) {
      expect(adaptProfileToV4(input).profile).toEqual(enriched);
    }
  });

  it("distinguishes unspecified and explicitly absent fairies without changing combat", () => {
    const legacy = profile();
    const explicit = { ...legacy, fairy: null };
    const point = { age: 1, combat: 1, difficulty: "normal" } as const;
    const unknownPve = evaluateCombatVerdict(legacy, data(), point, { maxSeconds: 5 });
    const noFairyPve = evaluateCombatVerdict(explicit, data(), point, { maxSeconds: 5 });
    expect(unknownPve.issues).toEqual([
      { severity: "warning", code: "fairy_state_unspecified", path: "profile.fairy" }
    ]);
    expect(noFairyPve.issues).toEqual([]);
    expect(unknownPve).toEqual({ ...noFairyPve, issues: unknownPve.issues });
    const unknownPvp = evaluatePvpVerdict(legacy, legacy, data());
    const noFairyPvp = evaluatePvpVerdict(explicit, explicit, data());
    expect(unknownPvp.issues).toEqual([
      { severity: "warning", code: "fairy_state_unspecified", path: "player.fairy" },
      { severity: "warning", code: "fairy_state_unspecified", path: "opponent.fairy" }
    ]);
    expect(noFairyPvp.issues).toEqual([]);
    expect(unknownPvp).toEqual({ ...noFairyPvp, issues: unknownPvp.issues });
    const oldData = data();
    oldData.version = "2.8.2";
    expect(evaluateCombatVerdict(legacy, oldData, point, { maxSeconds: 5 }).issues).toEqual([]);
    expect(evaluatePvpVerdict(legacy, legacy, oldData).issues).toEqual([]);
    expect(buildPlayerCombatProfile(explicit, data().tables)).toEqual(buildPlayerCombatProfile(legacy, data().tables));
    expect(adaptProfileToV4(explicit).profile?.fairy).toBeNull();
  });
});

function calculate(source: NormalizedProfile) {
  const result = resolveProfileFairy(source, season, "2.9.0");
  expect(result.ok).toBe(true);
  if (!result.ok || !result.fairy) throw new Error(JSON.stringify(result));
  return result.fairy;
}

function profile(id?: FairyId): NormalizedProfile {
  return {
    base: { attack: 50, health: 10000 }, equipment: { Weapon: { age: 0, idx: 0 } },
    stats: { skillDamage: 15, skillCooldown: 1, health: 10, critChance: 0, block: 0, reflectChance: 0 },
    secondaryStatsBeforeFairy: { skillDamage: 15, skillCooldown: 1, health: 10, critChance: 0, block: 0, reflectChance: 0 },
    ...(id ? { fairy: { id, level: 1, seasonId: season.seasonId, eventState: "active" as const, statsState: "excluded" as const } } : {}),
    breakdown: {}, talentTree: {}, pets: [], spells: []
  };
}

function data(): V4GameDataInput {
  return { version: "2.9.0", tables: {
    FairySeasonConfig: season,
    MainBattleLibrary: [{ BattleId: { AgeIdx: 0, BattleIdx: 0 }, Waves: [{ WaveIdx: 0, Enemies: [{ Id: 1, Count: 1 }] }] }],
    EnemyAgeScalingLibrary: [{ AgeIdx: 0, Health: { Raw: 1_000_000 }, Damage: { Raw: 5_000 } }],
    EnemyLibrary: [{ EnemyIdx: 1, WeaponId: { Age: 0, Idx: 0 } }],
    WeaponLibrary: [{ ItemId: { Age: 0, Idx: 0 }, AttackRange: 1, WindupTime: 0.1, AttackDuration: 1, IsRanged: false, ProjectileId: -1 }],
    MainBattleConfig: { EnemyHpDifficultyMulti: 6_000_000, EnemyDmgDifficultyMulti: 6_000_000 },
    ItemBalancingConfig: { EnemyRangedDamageMultiplier: 0.67, PlayerBaseCritDamage: 0.2 },
    PvpBaseConfig: { PvpHpBaseMultiplier: 1, PvpHpPetMultiplier: 0, PvpHpSkillMultiplier: 0, PvpHpMountMultiplier: 0, PvpMatchTimerSeconds: 10 }
  } };
}
