import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { loadFamilyPilotContext, generateCandidates } from "./run-bis-family-pilot.mjs";
import { combatKey, explore, variant, compare, run } from "./run-bis-batch.mjs";
import { buildBisProfile } from "../../packages/v4-bis/src/index.ts";
import { evaluateCombatVerdict } from "../../packages/v4-core/src/index.ts";

const configPath = resolve("v4/config/bis-large-batch-2.9.0.json");
const context = loadFamilyPilotContext(configPath, false);
assert.deepEqual(context.config.styles, ["ranged", "melee"]);
const templates = generateCandidates(context.config, context.data, context.season);

test("probabilities above 100 percent do not add extra damage in average or RNG mode", () => {
  for (const stat of ["doubleChance", "critChance", "block"]) for (const blockMode of ["average", "rng"]) {
    const profile = structuredClone(templates[0].profile);
    profile.fairy = null;
    profile.stats[stat] = 100;
    const options = { ...context.config.options, blockMode, seed: 42 };
    const capped = evaluateCombatVerdict(profile, context.data, context.config.point, options);
    assert.ok(!["invalid_input", "missing_data"].includes(capped.reason));
    profile.stats[stat] = 120;
    assert.deepEqual(evaluateCombatVerdict(profile, context.data, context.config.point, options), capped, `${stat}/${blockMode}`);
  }
});

test("weapon attack+health means primary stats, never forced secondary lines", () => {
  const melee = templates.find((c) => c.dimensions.style === "melee");
  const config = { ...context.config, styles: ["melee_plus_health"] };
  assert.throws(() => generateCandidates(config, context.data, context.season), /Missing base-stat catalog entry/);
  const data = structuredClone(context.data);
  const weapon = data.tables.ItemBalancingLibrary.find((entry) => entry.ItemId.Age === 9 && entry.ItemId.Type === "Weapon" && entry.ItemId.Idx === 1);
  const health = structuredClone(weapon.EquipmentStats[0]);
  health.StatNode.UniqueStat.StatType = "Health";
  health.Value = 12345;
  weapon.EquipmentStats.push(health);
  const hp = generateCandidates(config, data, context.season)[0];
  assert.equal(hp.build.equipment.Weapon.idx, 1);
  assert.ok(hp.profile.base.health > melee.profile.base.health);
  assert.deepEqual(hp.profile.stats, melee.profile.stats);
  assert.notEqual(combatKey(melee.profile, context.data), combatKey(hp.profile, context.data));
  const renamed = structuredClone(melee.profile);
  renamed.name = "another name";
  assert.equal(combatKey(melee.profile, context.data), combatKey(renamed, context.data));
  const swapped = structuredClone(melee.build);
  [swapped.equipment.Helmet.secondaryStats, swapped.equipment.Body.secondaryStats] =
    [swapped.equipment.Body.secondaryStats, swapped.equipment.Helmet.secondaryStats];
  const rebuilt = buildBisProfile(swapped, context.data, context.config.buildRules);
  assert.ok(rebuilt.ok);
  assert.equal(combatKey(rebuilt.profile, context.data), combatKey(melee.profile, context.data));
  for (let i = 1; i <= 200; i++) {
    const candidate = variant(hp, i, { ...context, data });
    const carriers = [...Object.values(candidate.build.equipment), ...candidate.build.pets, candidate.build.mount];
    assert.ok(carriers.every((c) => c.secondaryStats[0].stat !== c.secondaryStats[1].stat));
  }
});

test("exploration is repeatable, unique, diverse and bounded", () => {
  const small = { ...context, config: { ...context.config, maxCandidates: 1000, maxAttempts: 10000 } };
  const first = [], second = [];
  const stats = explore(small, (c) => first.push(c.id));
  explore(small, (c) => second.push(c.id));
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 1000);
  assert.equal(Object.keys(stats.coverage).length, 6);
  assert.ok(Object.values(stats.coverage).every((n) => n > 50));
});

test("curve ranking prefers more successful combats over speed", () => {
  const a = { candidate: { id: "a" }, verdicts: [{ passed: true, timeSeconds: 899 }, { passed: true, timeSeconds: 899 }] };
  const b = { candidate: { id: "b" }, verdicts: [{ passed: true, timeSeconds: 1 }, { passed: false, timeSeconds: 1 }] };
  assert.ok(compare(a, b) < 0);
});

test("two-process campaign replays, resumes, and refuses mixed configurations", async () => {
  const directory = mkdtempSync(join(tmpdir(), "forge-bis-test-"));
  const config = { ...context.config, maxCandidates: 216, maxAttempts: 1000,
    refinementCandidates: 90, refinementRounds: 2, elitePerFamily: 1, finalistsPerFamily: 1, rngSeeds: 2 };
  const path = join(directory, "config.json"), output = join(directory, "output");
  writeFileSync(path, JSON.stringify(config));
  await run(path, output, 2);
  const first = JSON.parse(readFileSync(join(output, "report.json")));
  assert.equal(first.actualExploration, 216);
  assert.equal(first.finalists.length, 6);
  assert.equal(first.uniqueEvaluated, first.history.reduce((sum, phase) => sum + phase.evaluated, 0));
  assert.equal(Object.values(first.history[0].curves).reduce((sum, stages) => sum + stages[0].passes + stages[0].failures, 0), 216);
  assert.ok(first.finalists.every((entry) => entry.verdicts.length === 4 && entry.rng.every((r) => r.seeds === 2)));
  const checkpointPath = join(output, "exploration", "result-0.json");
  const checkpoint = JSON.parse(readFileSync(checkpointPath));
  // Simulate a lost shard checkpoint while keeping other completed shards.
  writeFileSync(checkpointPath, JSON.stringify({ ...checkpoint, done: 0, best: [], curves: {} }));
  await run(path, output, 2);
  assert.deepEqual(JSON.parse(readFileSync(join(output, "report.json"))), first);
  writeFileSync(path, JSON.stringify({ ...config, seed: 12 }));
  await assert.rejects(run(path, output, 2), /Code\/config changed/);
  assert.ok(!readdirSync(output).includes("running.lock"));
});
