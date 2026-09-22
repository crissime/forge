import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  adaptProfileToV4,
  evaluateCombatVerdict,
  evaluatePvpVerdict,
  type FightPoint,
  type NormalizedProfile,
  type V4GameDataInput
} from "../src/index";

const point: FightPoint = { age: 1, combat: 1, difficulty: "normal" };
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("pure v4 combat verdict", () => {
  it("does not depend on the v2/v3 packages", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "packages/v4-core/package.json"), "utf8"));
    expect(packageJson.dependencies).toBeUndefined();
  });

  it("returns missing_data instead of inventing a battle", () => {
    const data = fixtureData();
    data.tables.MainBattleLibrary = [];
    const verdict = evaluateCombatVerdict(profile(100, 100), data, point);

    expect(verdict.reason).toBe("missing_data");
    expect(verdict.issues[0].code).toBe("missing_battle_data");
  });

  it("refuses a skill whose APK behavior is not implemented", () => {
    const player = profile(100, 100);
    player.spells = [{ id: "UnknownSkill", level: 1, rarity: "Rare" }];
    const data = fixtureData();
    (data.tables.SkillLibrary as any).UnknownSkill = skill("UnknownSkill", 0, 4, 50, 0);
    const verdict = evaluateCombatVerdict(player, data, point);

    expect(verdict.reason).toBe("missing_data");
    expect(verdict.issues[0].code).toBe("unsupported_skill");
  });

  it("marks a weak profile as dead", () => {
    const verdict = evaluateCombatVerdict(
      profile(1, 50),
      fixtureData({ enemyHealth: 100, enemyDamage: 10_000 }),
      point,
      { maxSeconds: 30 }
    );

    expect(verdict).toMatchObject({ passed: false, reason: "dead", clearedWaves: 0, remainingHealth: 0 });
  });

  it("marks a living low-damage profile as timeout", () => {
    const verdict = evaluateCombatVerdict(
      profile(0.1, 1_000_000),
      fixtureData({ enemyHealth: 1_000_000, enemyDamage: 0 }),
      point,
      { maxSeconds: 5 }
    );

    expect(verdict.reason).toBe("timeout");
    expect(verdict.timeSeconds).toBe(5);
    expect(verdict.remainingHealth).toBeGreaterThan(0);
  });

  it("marks a valid profile as cleared", () => {
    const verdict = evaluateCombatVerdict(
      profile(1_000, 1_000),
      fixtureData({ enemyHealth: 100, enemyDamage: 0 }),
      point,
      { maxSeconds: 30 }
    );

    expect(verdict.passed).toBe(true);
    expect(verdict.reason).toBe("cleared");
    expect(verdict.clearedWaves).toBe(verdict.waveCount);
    expect(verdict.metrics.engine).toBe("v4-spatial-skills-11");
  });

  it("activates Rain of Arrows after frame 41 and starts its effects on the next frame", () => {
    const player = profile(0.001, 1_000_000);
    player.spells = [{ id: "RainOfArrows", level: 1, rarity: "Epic" }];
    const verdict = evaluateCombatVerdict(
      player,
      fixtureData({ enemyHealth: 1_000, enemyDamage: 0, windup: 100, duration: 100 }),
      point,
      { maxSeconds: 5 }
    );

    expect(verdict.reason).toBe("timeout");
    expect(verdict.metrics.skillActivations).toBe(1);
    expect(verdict.metrics.skillHits).toBe(2);
    expect(verdict.damageDone).toBeCloseTo(20, 5);
  });

  it("applies two Thorns pulses and its final impact", () => {
    const player = profile(0.001, 1_000_000);
    player.spells = [{ id: "Thorns", level: 1, rarity: "Epic" }];
    const verdict = evaluateCombatVerdict(
      player,
      fixtureData({ enemyHealth: 1_000, enemyDamage: 0, windup: 100, duration: 100 }),
      point,
      { maxSeconds: 6 }
    );

    expect(verdict.reason).toBe("timeout");
    expect(verdict.metrics.skillActivations).toBe(1);
    expect(verdict.metrics.skillHits).toBe(3);
    expect(verdict.damageDone).toBeCloseTo(90, 5);
  });

  it.each([
    ["Arrows", 3],
    ["Shuriken", 5]
  ])("launches the exact projectile count for %s", (skillId, count) => {
    const player = profile(0.001, 1_000_000);
    player.spells = [{ id: skillId, level: 1, rarity: "Rare" }];
    const verdict = evaluateCombatVerdict(
      player,
      fixtureData({ enemyHealth: 1_000, enemyDamage: 0, windup: 100, duration: 100 }),
      point,
      { maxSeconds: 8 }
    );

    expect(verdict.reason).toBe("timeout");
    expect(verdict.metrics.skillActivations).toBe(1);
    expect(verdict.metrics.projectiles).toBe(count);
    expect(verdict.metrics.skillHits).toBe(count);
    expect(verdict.damageDone).toBeCloseTo(50, 5);
  });

  it.each([
    ["Meteorite", 5],
    ["Lightning", 5],
    ["CannonBarrage", 3]
  ])("applies every random strike for %s", (skillId, hitCount) => {
    const player = profile(0.001, 1_000_000);
    player.spells = [{ id: skillId, level: 1, rarity: "Rare" }];
    const verdict = evaluateCombatVerdict(
      player,
      fixtureData({ enemyHealth: 1_000, enemyDamage: 0, windup: 100, duration: 100 }),
      point,
      { maxSeconds: 7 }
    );

    expect(verdict.reason).toBe("timeout");
    expect(verdict.metrics.skillActivations).toBe(1);
    expect(verdict.metrics.skillHits).toBe(hitCount);
    expect(verdict.damageDone).toBeCloseTo(50, 5);
  });

  it.each([
    ["Stampede", 2],
    ["StrafeRun", 3]
  ])("applies the APK mobile area sequence for %s", (skillId, hitCount) => {
    const player = profile(0.001, 1_000_000);
    player.spells = [{ id: skillId, level: 1, rarity: "Rare" }];
    const verdict = evaluateCombatVerdict(
      player,
      fixtureData({ enemyHealth: 10_000, enemyDamage: 0, windup: 100, duration: 100 }),
      point,
      { maxSeconds: 12 }
    );

    expect(verdict.reason).toBe("timeout");
    expect(verdict.metrics.skillActivations).toBe(1);
    expect(verdict.metrics.skillHits).toBe(hitCount);
  });

  it("runs Drone as a temporary non-targetable ranged unit", () => {
    const player = profile(0.001, 1_000_000);
    player.spells = [{ id: "Drone", level: 1, rarity: "Rare" }];
    const verdict = evaluateCombatVerdict(
      player,
      fixtureData({
        enemyHealth: 10_000,
        enemyDamage: 0,
        playerAttackRange: 20,
        windup: 100,
        duration: 100
      }),
      point,
      { maxSeconds: 15 }
    );

    expect(verdict.reason).toBe("timeout");
    expect(verdict.metrics.skillActivations).toBe(1);
    expect(verdict.metrics.projectiles).toBeGreaterThan(0);
    expect(verdict.metrics.skillHits).toBeGreaterThan(0);
  });

  it("routes every APK buff through the shared buff mechanic", () => {
    for (const skillId of ["Meat", "Morale", "Berserk", "Buff", "HigherMorale"]) {
      const player = profile(0.001, 1_000_000);
      player.spells = [{ id: skillId, level: 1, rarity: "Rare" }];
      const data = fixtureData({ enemyHealth: 1_000, enemyDamage: 0, windup: 100, duration: 100 });
      const config = (data.tables.SkillLibrary as any)[skillId];
      if (skillId === "Meat") config.DamagePerLevel = [];

      const verdict = evaluateCombatVerdict(player, data, point, { maxSeconds: 5 });
      expect(verdict.reason, skillId).toBe("timeout");
      expect(verdict.metrics.skillActivations, skillId).toBe(1);
    }
  });

  it.each([
    ["Bomb", 1],
    ["Worm", 1],
    ["Shout", 8]
  ])("applies the exact area sequence for %s", (skillId, hitCount) => {
    const player = profile(0.001, 1_000_000);
    player.spells = [{ id: skillId, level: 1, rarity: "Rare" }];
    const verdict = evaluateCombatVerdict(
      player,
      fixtureData({ enemyHealth: 1_000, enemyDamage: 0, windup: 100, duration: 100 }),
      point,
      { maxSeconds: 7 }
    );

    expect(verdict.reason).toBe("timeout");
    expect(verdict.metrics.skillActivations).toBe(1);
    expect(verdict.metrics.skillHits).toBe(hitCount);
    expect(verdict.damageDone).toBeCloseTo(50, 5);
  });

  it("makes the recovered auto-activation assumption visible", () => {
    const player = profile(0.001, 1_000_000);
    player.spells = [{ id: "RainOfArrows", level: 1, rarity: "Epic" }];
    const verdict = evaluateCombatVerdict(player, fixtureData(), point, { maxSeconds: 5 });

    expect(verdict.metrics.skillActivationPolicy).toBe("auto_when_ready");
    expect(verdict.issues).toContainEqual({
      severity: "warning",
      code: "assumed_skill_auto_activation",
      path: "options.skillActivationPolicy"
    });
  });

  it("can disable automatic skill activation explicitly", () => {
    const player = profile(0.001, 1_000_000);
    player.spells = [{ id: "RainOfArrows", level: 1, rarity: "Epic" }];
    const verdict = evaluateCombatVerdict(player, fixtureData(), point, {
      maxSeconds: 5,
      skillActivationPolicy: "disabled"
    });

    expect(verdict.metrics.skillActivationPolicy).toBe("disabled");
    expect(verdict.metrics.skillActivations).toBe(0);
    expect(verdict.issues).toEqual([]);
  });

  it("treats a kill exactly at maxSeconds as cleared", () => {
    const data = fixtureData({ enemyHealth: 100, enemyDamage: 0, attackRange: 20, windup: 4.899951, duration: 6 });
    const verdict = evaluateCombatVerdict(profile(100, 1_000), data, point, { maxSeconds: 5 });

    expect(verdict.reason).toBe("cleared");
    expect(verdict.timeSeconds).toBe(5);
  });

  it("is deterministic for a seeded RNG verdict", () => {
    const data = fixtureData({ enemyCount: 3, enemyHealth: 100, enemyDamage: 100 });
    const player = profile(100, 1_000);
    player.stats.block = 50;
    const first = evaluateCombatVerdict(player, data, point, { blockMode: "rng", seed: 42 });
    const second = evaluateCombatVerdict(player, data, point, { blockMode: "rng", seed: 42 });

    expect(second).toEqual(first);
    expect(first.seed).toBe(42);
  });

  it("simulates a projectile instead of a fixed ranged delay", () => {
    const data = fixtureData({ enemyHealth: 100, enemyDamage: 0, attackRange: 20, projectileId: 1 });
    const verdict = evaluateCombatVerdict(profile(100, 1_000), data, point, { maxSeconds: 10 });

    expect(verdict.reason).toBe("cleared");
    expect(verdict.metrics.projectiles).toBeGreaterThan(0);
    expect(verdict.timeSeconds).toBeGreaterThan(0.5);
  });

  it("applies lifesteal to resolved overkill damage before the max-health cap", () => {
    const data = fixtureData({ enemyHealth: 1, enemyDamage: 10, windup: 0.5, duration: 1 });
    const weapons = data.tables.WeaponLibrary as any[];
    weapons[0].WindupTime = 1;
    const player = profile(1_000, 100);
    player.stats.lifesteal = 100;

    const verdict = evaluateCombatVerdict(player, data, point, { maxSeconds: 10 });

    expect(verdict.reason).toBe("cleared");
    expect(verdict.remainingHealth).toBe(100);
  });

  it("applies reflected damage only with the 2.9.0 combat rules", () => {
    const player = profile(0.001, 1_000);
    player.stats.reflectChance = 100;
    const data = fixtureData({ enemyHealth: 100, enemyDamage: 100 });
    data.version = "2.9.0";
    const reflected = evaluateCombatVerdict(player, data, point, { maxSeconds: 30 });
    data.version = "2.8.2";
    const previous = evaluateCombatVerdict(player, data, point, { maxSeconds: 30 });

    expect(reflected).toMatchObject({ reason: "cleared", passed: true });
    expect(reflected.damageDone).toBeGreaterThan(100);
    expect(previous.reason).toBe("dead");
  });

  it("reports mixed enemy weapon styles from IsRanged", () => {
    const data = fixtureData();
    (data.tables.MainBattleLibrary as any)[0].Waves[0].Enemies.push({ Id: 2, Count: 1 });
    (data.tables.EnemyLibrary as any).push({ EnemyIdx: 2, WeaponId: { Age: 0, Idx: 2 } });
    (data.tables.WeaponLibrary as any).push(weapon(2, true, 1, 7));
    const verdict = evaluateCombatVerdict(profile(1_000, 1_000), data, point, { maxSeconds: 30 });

    expect(verdict.metrics.enemyMode).toBe("mixed");
    expect(verdict.metrics.meleeEnemyCount).toBe(1);
    expect(verdict.metrics.rangedEnemyCount).toBe(1);
  });

  it("validates options before running the engine", () => {
    const verdict = evaluateCombatVerdict(profile(100, 100), fixtureData(), point, { maxSeconds: 1 });
    expect(verdict.reason).toBe("invalid_input");
    expect(verdict.issues[0].code).toBe("invalid_max_seconds");
  });

  it("rejects an unknown skill activation policy", () => {
    const verdict = evaluateCombatVerdict(profile(100, 100), fixtureData(), point, {
      skillActivationPolicy: "manual" as any
    });
    expect(verdict.reason).toBe("invalid_input");
    expect(verdict.issues[0].code).toBe("invalid_skill_activation_policy");
  });
});

describe("v4 profile adapter", () => {
  it("accepts all recovered exports and db profiles without re-entry", () => {
    const exportFiles = readdirSync(profileFile())
      .filter((name) => name.endsWith(".forge-master.json"))
      .sort();
    const dbRows = JSON.parse(readFileSync(profileFile("profiles.prod.raw.json"), "utf8"));

    expect(exportFiles).toHaveLength(14);
    expect(dbRows).toHaveLength(14);
    for (const fileName of exportFiles) {
      const entry = adaptProfileToV4(JSON.parse(readFileSync(profileFile(fileName), "utf8")));
      expect(entry.decisionComplete, fileName).toBe(true);
      expect(entry.sourceKind, fileName).toBe("export-v2");
    }
    for (const [index, row] of dbRows.entries()) {
      const entry = adaptProfileToV4(row);
      expect(entry.decisionComplete, `db row ${index}`).toBe(true);
      expect(entry.sourceKind, `db row ${index}`).toBe("db-normalized");
    }
  });

  it("rejects invalid json without throwing", () => {
    const entry = adaptProfileToV4("{");
    expect(entry.decisionComplete).toBe(false);
    expect(entry.profile).toBeNull();
  });
});

describe("v4 standard PvP duel", () => {
  it("uses the APK health multiplier from the richer profile for both fighters", () => {
    const player = profile(1, 100);
    player.pets = [{}];
    player.spells = [{ id: "Buff", level: 1, rarity: "Rare" }];
    player.mount = { id: 0, rarity: "Common" };
    const verdict = evaluatePvpVerdict(
      player,
      profile(1, 100),
      fixtureData({ windup: 100, duration: 100 }),
      { skillActivationPolicy: "disabled" }
    );

    expect(verdict).toMatchObject({
      winner: "draw",
      reason: "timeout",
      maxSeconds: 60,
      playerMaxHealth: 400,
      opponentMaxHealth: 400
    });
    expect(verdict.metrics).toMatchObject({
      playerMultiplier: 4,
      opponentMultiplier: 1,
      healthMultiplier: 4
    });
  });

  it("gives a knockout to the surviving fighter in either seat", () => {
    const strong = profile(1_000, 1_000);
    const weak = profile(1, 100);
    const data = fixtureData();

    expect(evaluatePvpVerdict(strong, weak, data).winner).toBe("player");
    expect(evaluatePvpVerdict(weak, strong, data).winner).toBe("opponent");
  });

  it("lets the right-hand fighter hit with a mirrored ranged projectile", () => {
    const data = fixtureData({ projectileId: 1 });
    const verdict = evaluatePvpVerdict(profile(1, 100), profile(1_000, 1_000), data);

    expect(verdict.winner).toBe("opponent");
    expect(verdict.metrics.projectiles).toBeGreaterThan(0);
    expect(verdict.opponentDamageDone).toBeGreaterThan(0);
  });

  it("draws when both remaining health ratios match at the official time limit", () => {
    const fighter = profile(1, 100);
    const verdict = evaluatePvpVerdict(
      fighter,
      fighter,
      fixtureData({ windup: 100, duration: 100 })
    );

    expect(verdict).toMatchObject({ winner: "draw", reason: "timeout", timeSeconds: 60 });
    expect(verdict.validation).toBe("unverified_in_game");
  });

  it("compares health fractions rather than absolute health at timeout", () => {
    const data = fixtureData({ windup: 100, duration: 100 });
    (data.tables.WeaponLibrary as any[])[1].WindupTime = 0.1;
    (data.tables.WeaponLibrary as any[])[1].AttackDuration = 1;
    const opponent = profile(1, 1_000_000);
    opponent.equipment.Weapon = { age: 0, idx: 0 };
    const verdict = evaluatePvpVerdict(
      profile(1, 100),
      opponent,
      data
    );

    expect(verdict.reason).toBe("timeout");
    expect(verdict.winner).toBe("player");
    expect(verdict.playerRemainingHealth).toBeLessThan(verdict.opponentRemainingHealth);
  });

  it("activates each fighter's skills without sharing a side or slot", () => {
    const left = profile(0.001, 1_000_000);
    const right = profile(0.001, 1_000_000);
    left.spells = [{ id: "Buff", level: 1, rarity: "Rare" }];
    right.spells = [{ id: "Buff", level: 1, rarity: "Rare" }];
    const verdict = evaluatePvpVerdict(
      left,
      right,
      fixtureData({ windup: 100, duration: 100 }),
      { skillActivationPolicy: "auto_when_ready" }
    );

    expect(verdict.metrics.playerSkillActivations).toBeGreaterThan(0);
    expect(verdict.metrics.opponentSkillActivations).toBeGreaterThan(0);
    expect(verdict.winner).toBe("draw");
  });

  it("reports a simultaneous knockout as a draw", () => {
    const left = profile(0.001, 10);
    const right = profile(0.001, 10);
    left.spells = [{ id: "Bomb", level: 1, rarity: "Rare" }];
    right.spells = [{ id: "Bomb", level: 1, rarity: "Rare" }];
    const verdict = evaluatePvpVerdict(
      left,
      right,
      fixtureData({ windup: 100, duration: 100 }),
      { skillActivationPolicy: "auto_when_ready" }
    );

    expect(verdict).toMatchObject({
      winner: "draw",
      reason: "knockout",
      playerRemainingHealth: 0,
      opponentRemainingHealth: 0
    });
  });

  it("lets an opponent win by reflecting a 2.9.0 PvP attack", () => {
    const player = profile(100, 50);
    const opponent = profile(1, 1_000);
    opponent.stats.reflectChance = 100;
    const data = fixtureData();
    data.version = "2.9.0";

    const verdict = evaluatePvpVerdict(player, opponent, data, { blockMode: "rng", seed: 42 });
    expect(verdict).toMatchObject({ winner: "opponent", reason: "knockout", playerRemainingHealth: 0 });
    expect(verdict.opponentDamageDone).toBeGreaterThanOrEqual(100);
  });

  it("rejects incomplete profiles, missing config, and a custom time limit", () => {
    const fighter = profile(1, 100);
    const data = fixtureData();
    expect(evaluatePvpVerdict({ ...fighter, pets: undefined }, fighter, data).issues[0].code)
      .toBe("incomplete_pvp_profile");
    delete data.tables.PvpBaseConfig;
    expect(evaluatePvpVerdict(fighter, fighter, data).reason).toBe("missing_data");
    expect(evaluatePvpVerdict(fighter, fighter, fixtureData(), { maxSeconds: 5 } as any).issues[0].code)
      .toBe("fixed_pvp_duration");
  });

  it("does not simulate an unknown opponent skill", () => {
    const opponent = profile(1, 100);
    opponent.spells = [{ id: "UnknownSkill", level: 1, rarity: "Rare" }];
    const data = fixtureData();
    (data.tables.SkillLibrary as any).UnknownSkill = skill("UnknownSkill", 0, 4, 10, 0);
    const verdict = evaluatePvpVerdict(profile(1, 100), opponent, data);

    expect(verdict).toMatchObject({ winner: null, reason: "missing_data" });
    expect(verdict.issues[0]).toMatchObject({ code: "unsupported_skill", path: "opponent.spells.0.id" });
  });

  it("repeats a seeded duel exactly", () => {
    const player = profile(10, 1_000);
    const opponent = profile(10, 1_000);
    player.stats.block = 50;
    opponent.stats.block = 50;
    const data = fixtureData();
    const first = evaluatePvpVerdict(player, opponent, data, { blockMode: "rng", seed: 42 });
    const second = evaluatePvpVerdict(player, opponent, data, { blockMode: "rng", seed: 42 });

    expect(first).toEqual(second);
    expect(first.seed).toBe(42);
  });
});

type FixtureOptions = {
  enemyHealth?: number;
  enemyDamage?: number;
  enemyCount?: number;
  attackRange?: number;
  playerAttackRange?: number;
  windup?: number;
  duration?: number;
  projectileId?: number;
};

function fixtureData(options: FixtureOptions = {}): V4GameDataInput {
  const enemyHealth = options.enemyHealth ?? 100;
  const enemyDamage = options.enemyDamage ?? 10;
  const attackRange = options.attackRange ?? 0.3;
  const projectileId = options.projectileId ?? -1;
  return {
    version: "fixture",
    tables: {
      MainBattleLibrary: [{
        BattleId: { AgeIdx: 0, BattleIdx: 0 },
        Waves: [{ WaveIdx: 0, Enemies: [{ Id: 1, Count: options.enemyCount ?? 1 }] }]
      }],
      EnemyAgeScalingLibrary: [{
        AgeIdx: 0,
        Health: { Raw: enemyHealth * 100 },
        Damage: { Raw: enemyDamage * 100 }
      }],
      EnemyLibrary: [{ EnemyIdx: 1, WeaponId: { Age: 0, Idx: 0 } }],
      WeaponLibrary: [
        weapon(0, projectileId >= 0, projectileId, attackRange, options.windup, options.duration),
        weapon(
          1,
          projectileId >= 0,
          projectileId,
          options.playerAttackRange ?? attackRange,
          options.windup,
          options.duration
        )
      ],
      ProjectilesLibrary: [{ Id: 1, Speed: 15, CollisionRadius: 0.3, AffectedByGravity: true }],
      MainBattleConfig: { EnemyHpDifficultyMulti: 6_000_000, EnemyDmgDifficultyMulti: 6_000_000 },
      ItemBalancingConfig: { EnemyRangedDamageMultiplier: 0.67, PlayerBaseCritDamage: 0.2 },
      StatConfigLibrary: [],
      SecondaryStatLibrary: [],
      SkillBaseConfig: { SkillsCount: 18, SkillSlotsCount: 3 },
      PvpBaseConfig: {
        PvpHpBaseMultiplier: 1,
        PvpHpPetMultiplier: 0.5,
        PvpHpSkillMultiplier: 0.5,
        PvpHpMountMultiplier: 2,
        PvpMatchTimerSeconds: 60
      },
      MountLibrary: [{
        MountId: { Id: 0, Rarity: "Common" },
        ColliderRadius: 0.7,
        CenterOfMass: { X: 0, Y: 0.285 },
        UnitOffset: { X: 0, Y: 0 }
      }],
      SkillLibrary: {
        RainOfArrows: skill("RainOfArrows", 0, 10, 150, 0),
        Shout: skill("Shout", 0, 4, 50, 0),
        Meteorite: skill("Meteorite", 0, 4, 50, 0),
        Bomb: skill("Bomb", 0, 4, 50, 0),
        Worm: skill("Worm", 0, 4, 50, 0),
        Lightning: skill("Lightning", 0, 4, 50, 0),
        CannonBarrage: skill("CannonBarrage", 0, 4, 50, 0),
        Stampede: skill("Stampede", 0, 20, 50, 0),
        StrafeRun: skill("StrafeRun", 0, 10, 50, 0),
        Drone: skill("Drone", 10, 8, 50, 0),
        Thorns: skill("Thorns", 0, 5, 30, 0),
        Meat: skill("Meat", 10, 8, 0, 100),
        Buff: skill("Buff", 10, 8, 100, 1_000),
        Morale: skill("Morale", 10, 8, 200, 2_000),
        Berserk: skill("Berserk", 10, 8, 100, 0),
        HigherMorale: skill("HigherMorale", 8, 8, 300, 3_000),
        Arrows: skill("Arrows", 0, 4, 50, 0),
        Shuriken: skill("Shuriken", 0, 4, 50, 0)
      }
    }
  };
}

function skill(type: string, activeDuration: number, cooldown: number, damage: number, health: number) {
  return {
    Type: type,
    Rarity: "Epic",
    ActiveDuration: activeDuration,
    Cooldown: cooldown,
    DamagePerLevel: Array(100).fill(damage),
    HealthPerLevel: health ? Array(100).fill(health) : []
  };
}

function weapon(
  idx: number,
  isRanged: boolean,
  projectileId: number,
  attackRange: number,
  windup = 0.1,
  duration = 1
) {
  return {
    ItemId: { Age: 0, Idx: idx, Type: "Weapon" },
    AttackRange: attackRange,
    WindupTime: windup,
    AttackDuration: duration,
    IsRanged: isRanged,
    ProjectileId: projectileId
  };
}

function profile(attack: number, health: number): NormalizedProfile {
  return {
    name: "fixture",
    base: { attack, health, weaponStyle: "melee" },
    equipment: { Weapon: { age: 0, idx: 1 } },
    stats: {},
    spells: [],
    pets: [],
    breakdown: {},
    talentTree: {}
  };
}

function profileFile(name = ""): string {
  return join(repoRoot, "profile", name);
}
