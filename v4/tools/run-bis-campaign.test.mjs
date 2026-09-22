import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { campaign, campaignPoints, keepFamilies } from "./run-bis-campaign.mjs";
import { loadFamilyPilotContext } from "./run-bis-family-pilot.mjs";
import { searchTemplates, compare, run } from "./run-bis-batch.mjs";

const context = loadFamilyPilotContext(resolve("v4/config/bis-large-batch-2.9.0.json"), false);
const cfg = JSON.parse(readFileSync("v4/config/bis-overnight-2.9.0.json"));

test("all 25 actual fights, six weapons and ten pet combinations are available", () => {
  const points = campaignPoints(context.data.tables, cfg.start, cfg.end);
  assert.equal(points.length, 25);
  assert.deepEqual(points.at(-1), cfg.end);
  assert.throws(() => campaignPoints(context.data.tables, cfg.end, cfg.start));
  const templates = searchTemplates({ ...context, config: { ...context.config, expandEquipment: true } });
  assert.equal(new Set(templates.map((t) => t.build.equipment.Weapon.idx)).size, 6);
  assert.equal(new Set(templates.map((t) => t.build.pets.map((p) => p.id).join(","))).size, 10);
  assert.equal(new Set(templates.map((t) => t.dimensions.fairy + t.dimensions.style)).size, 6);
});

test("RNG reliability beats average speed; all fairy/style groups survive", () => {
  const entry = (id, fairy, reliable) => ({ candidate: { id, dimensions: { fairy, style: "melee" } },
    verdicts: [{ passed: true, timeSeconds: reliable ? 99 : 1 }],
    rng: [{ interval95: reliable ? [0.95, 1] : [0.1, 0.3] }] });
  const a = entry("a", "Mira", true), b = entry("b", "Mira", false);
  assert.ok(compare(a, b) < 0);
  const kept = keepFamilies([a, b, entry("c", "Tira", false), entry("d", "Lora", false)], 1);
  assert.deepEqual(kept.map((e) => e.candidate.id), ["a", "c", "d"]);
});

test("two waves carry champions, screen RNG separately and export all fairies for PvP", async () => {
  const dir = mkdtempSync(join(tmpdir(), "forge-campaign-"));
  const path = join(dir, "config.json"), output = join(dir, "campaign");
  writeFileSync(path, JSON.stringify({ ...cfg, hours: 1, workers: 2, waveCandidates: 36, maxWaves: 2,
    elitePerFamily: 1, finalistsPerFamily: 1, finalRngPerFamily: 1, rngSeeds: 3, rngScreenSeeds: 2,
    refinementRounds: 1, refinementCandidates: 12 }));
  await campaign(path, output);
  const report = JSON.parse(readFileSync(join(output, "report.json")));
  assert.equal(report.waves.length, 2);
  assert.equal(report.stopReason, "wave_limit");
  assert.equal(report.finalists.length, 6);
  assert.ok(Object.values(report.bestByFairy).every((entries) => entries.length === 2));
  assert.ok(report.finalists.every((e) => e.rng.length === 25 && e.rng.every((r) => r.seedStart === 100001 && r.seeds === 3)));
  const seeds = JSON.parse(readFileSync(join(output, "wave-0002/seeds.json")));
  assert.equal(seeds.length, 6);
  const pvp = JSON.parse(readFileSync(join(output, "pvp-candidates.json")));
  assert.equal(pvp.evaluatedInPvp, false);
  assert.equal(pvp.candidates.length, 6);
  await campaign(path, output);
  assert.deepEqual(JSON.parse(readFileSync(join(output, "report.json"))), report);
});

test("expired wave stops before work and releases its lock", async () => {
  const dir = mkdtempSync(join(tmpdir(), "forge-deadline-"));
  const path = join(dir, "config.json");
  writeFileSync(path, JSON.stringify({ ...context.config, deadlineMs: Date.now() - 1000 }));
  await assert.rejects(run(path, join(dir, "out"), 2), /time budget reached/);
  assert.equal(existsSync(join(dir, "out", "running.lock")), false);
});
