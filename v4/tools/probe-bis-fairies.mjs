import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlayerCombatProfile, evaluateCombatVerdict, f64ToNumber } from "../../packages/v4-core/src/index.ts";
import { loadV4GameData } from "../../packages/v4-game-data/src/index.ts";
import { searchBis } from "../../packages/v4-bis/src/index.ts";
import { sourceFingerprint } from "./prepare-bis-batch.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function runFairyProbe() {
  const seasonBytes = readFileSync(join(root, "v4/config/fairy-season-2.9.0.candidate.json"));
  const season = JSON.parse(seasonBytes);
  const loaded = loadV4GameData(join(root, "packages/v4-game-data/data/2.9.0"), "2.9.0");
  const data = { version: loaded.version, tables: { ...loaded.tables, FairySeasonConfig: season } };
  const point = { age: 1, combat: 10, difficulty: "normal" };
  const options = { maxSeconds: 60, blockMode: "average", skillActivationPolicy: "auto_when_ready" };
  // Synthetic, equal six-line totals; no claim that a carrier allocation is legal in game.
  const archetypes = [
    { id: "weapon", stats: { damage: 30, attackSpeed: 80, critChance: 24 } },
    { id: "skills", stats: { skillDamage: 120, skillCooldown: 14 } },
    { id: "health", stats: { health: 60, block: 10 } },
    { id: "mixed", stats: { damage: 15, health: 15, skillDamage: 60, skillCooldown: 7, critChance: 12 } }
  ];
  const reports = [];
  let evaluatedCount = 0;
  const started = performance.now();
  for (const level of [null, 1, 10, 20]) {
    const choices = level === null ? [null] : ["Mira", "Tira", "Lora"];
    const candidates = choices.flatMap((fairyId) => archetypes.map((archetype) => {
      const stats = {
        critChance: 0, block: 0, reflectChance: 0, skillDamage: 0,
        skillCooldown: 0, health: 0, ...archetype.stats
      };
      const profile = {
        name: `Synthetic ${archetype.id}`, base: { attack: 100, health: 800 },
        equipment: { Weapon: { age: 0, idx: 0 } }, pets: [], mount: null,
        spells: [{ id: "Arrows", level: 1, rarity: "Common" }, { id: "Meat", level: 1, rarity: "Common" }],
        stats, secondaryStatsBeforeFairy: { ...stats }, breakdown: {}, talentTree: {},
        fairy: fairyId ? {
          id: fairyId, level, seasonId: season.seasonId, eventState: "active", statsState: "excluded"
        } : null
      };
      return {
        id: `${fairyId || "none"}/${archetype.id}`, profile,
        build: { kind: "synthetic-stat-fixture", archetype: archetype.id, fairy: fairyId, fairyLevel: level }
      };
    }));
    const before = structuredClone(candidates);
    const result = searchBis({
      context: { kind: "synthetic_probe_not_publishable", fairyLevel: level, seasonId: season.seasonId },
      data, point, options, candidates, exactCandidateCount: candidates.length,
      budget: { maxEvaluations: candidates.length + 1, maxTimeMs: 15_000 }
    });
    assert.deepEqual(candidates, before, "Probe mutated a source candidate");
    assert.equal(result.exhaustive, true, "Synthetic space not fully explored");
    assert.equal(result.excluded.length, 0, "Probe contains invalid candidates");
    assert.ok(result.best, "Probe did not produce a valid result");
    assert.deepEqual(
      evaluateCombatVerdict(result.best.candidate.profile, data, point, options),
      result.best.verdict, "Stored winner does not replay exactly"
    );
    evaluatedCount += result.evaluatedCount;
    reports.push({
      fairyLevel: level, result,
      effects: result.ranked.map(({ candidate }) => {
        const combat = buildPlayerCombatProfile(candidate.profile, data.tables, data.version);
        assert.equal(combat.ok, true);
        const fairy = combat.profile.fairy;
        return { id: candidate.id, ...(fairy ? {
          targetStat: fairy.targetStat, steps: Number(fairy.steps),
          rawBonusPoints: 100 * f64ToNumber(fairy.rawBonus),
          effectiveBonusPoints: 100 * f64ToNumber(fairy.effectiveBonus),
          secondaryTargetEffectivePoints: 100 * f64ToNumber(fairy.targetEffectiveAfter)
        } : {}) };
      })
    });
  }
  const elapsedMs = Math.round(performance.now() - started);
  const report = {
    schema: "forge-master-v4-fairy-probe-v1", generatedAt: new Date().toISOString(),
    publishableBis: false, exhaustiveInGame: false, gameVersion: "2.9.0",
    purpose: "Integration et sensibilite sur quatre archetypes synthetiques; ni legalite, ni optimalite en jeu demontrees.",
    point, options, bases: { attack: 100, health: 800 }, archetypes,
    evaluatedCount, replayCount: reports.length, elapsedMs,
    season, seasonSha256: sha(seasonBytes),
    manifestSha256: sha(readFileSync(join(root, "packages/v4-game-data/data/2.9.0/manifest.json"))),
    fingerprint: sourceFingerprint(), reports
  };
  const output = join(root, "v4/generated/bis-fairy-probe.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(`${output}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
  renameSync(`${output}.tmp`, output);
  return { report, output };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { report, output } = runFairyProbe();
    console.log(JSON.stringify({
      publishableBis: report.publishableBis, evaluatedCount: report.evaluatedCount,
      replayCount: report.replayCount, elapsedMs: report.elapsedMs,
      winners: report.reports.map(({ fairyLevel, result }) => ({
        fairyLevel, id: result.best.candidate.id, reason: result.best.verdict.reason,
        timeSeconds: result.best.verdict.timeSeconds
      })), output
    }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
