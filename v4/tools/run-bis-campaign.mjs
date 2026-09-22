import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, openSync, closeSync, unlinkSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFamilyPilotContext } from "./run-bis-family-pilot.mjs";
import { run, compare, combatKey } from "./run-bis-batch.mjs";
import { buildBisProfile } from "../../packages/v4-bis/src/index.ts";
import { buildBattleDefinition } from "../../packages/v4-core/src/index.ts";
import { sourceFingerprint } from "./prepare-bis-batch.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
function save(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(`${path}.tmp`, JSON.stringify(value)); renameSync(`${path}.tmp`, path); }

export function campaignPoints(tables, start, end) {
  assert.equal(start.difficulty, "hard");
  assert.equal(end.difficulty, "hard");
  const points = tables.MainBattleLibrary.map(({ BattleId }) => ({ age: BattleId.AgeIdx + 1, combat: BattleId.BattleIdx + 1, difficulty: "hard" }))
    .sort((a, b) => a.age - b.age || a.combat - b.combat);
  const from = points.findIndex((p) => p.age === start.age && p.combat === start.combat);
  const to = points.findIndex((p) => p.age === end.age && p.combat === end.combat);
  assert.ok(from >= 0 && to >= from, "Campaign endpoints missing or reversed");
  const selected = points.slice(from, to + 1);
  for (const point of selected) { const result = buildBattleDefinition(tables, point); assert.ok(result.ok, JSON.stringify(result.issue)); }
  return selected;
}

export function keepFamilies(entries, count) {
  const unique = new Map();
  for (const entry of entries) if (!unique.has(entry.candidate.id)) unique.set(entry.candidate.id, entry);
  const counts = new Map();
  return [...unique.values()].sort(compare).filter((entry) => {
    const key = `${entry.candidate.dimensions.fairy}/${entry.candidate.dimensions.style}`;
    const n = counts.get(key) ?? 0; counts.set(key, n + 1); return n < count;
  });
}

export async function campaign(configPath, output, initialReport) {
  const cfg = read(configPath);
  assert.equal(cfg.schema, "forge-master-v4-bis-campaign-v1");
  assert.ok(Number.isFinite(cfg.hours) && cfg.hours > 0);
  for (const key of ["workers", "waveCandidates", "maxWaves", "refinementRounds", "refinementCandidates", "elitePerFamily", "finalistsPerFamily", "rngScreenSeeds", "finalRngPerFamily", "rngSeeds"]) assert.ok(Number.isSafeInteger(cfg[key]) && cfg[key] > 0, `invalid ${key}`);
  assert.ok(cfg.workers <= 40 && cfg.finalRngPerFamily <= cfg.finalistsPerFamily && cfg.finalistsPerFamily <= cfg.elitePerFamily);
  const context = loadFamilyPilotContext(resolve(root, cfg.baseConfig), false);
  const points = campaignPoints(context.data.tables, cfg.start, cfg.end);
  const fingerprint = hash(JSON.stringify({ cfg, base: context.config, source: sourceFingerprint().sha256,
    season: hash(context.seasonBytes), manifest: hash(readFileSync(join(root, "packages/v4-game-data/data/2.9.0/manifest.json"))) }));
  mkdirSync(output, { recursive: true });
  const lockPath = join(output, "campaign.lock"), lock = openSync(lockPath, "wx");
  try {
    writeFileSync(lock, String(process.pid));
    const statePath = join(output, "campaign.json");
    const state = existsSync(statePath) ? read(statePath) : { fingerprint, startedAt: Date.now(), elapsedBudgetHours: cfg.hours, waves: [], best: [], initial: [] };
    assert.equal(state.fingerprint, fingerprint, "Campaign code/config changed: use a new output folder");
    if (!existsSync(statePath) && initialReport) {
      for (const entry of read(initialReport).finalists) {
        const built = buildBisProfile(entry.candidate.build, context.data, context.config.buildRules);
        assert.ok(built.ok, JSON.stringify(built.issue));
        state.initial.push({ ...entry.candidate, profile: built.profile, id: combatKey(built.profile, context.data) });
      }
    }
    save(statePath, state);
    const deadlineMs = state.startedAt + cfg.hours * 3600000;
    console.log(`Campaign: ${cfg.hours}h wall-clock budget, ${cfg.workers} workers, ${points.length} fights through hard ${cfg.end.age}-${cfg.end.combat}`);
    for (let wave = state.waves.length; wave < cfg.maxWaves && Date.now() < deadlineMs; wave++) {
      const folder = join(output, `wave-${String(wave + 1).padStart(4, "0")}`);
      const seedPath = join(folder, "seeds.json"), waveConfig = join(folder, "config.json");
      if (!existsSync(waveConfig)) {
        save(seedPath, [...state.initial, ...state.best.map((entry) => entry.candidate)]);
        save(waveConfig, { ...context.config, points, seed: cfg.seed + wave * 1000003,
          maxCandidates: cfg.waveCandidates, maxAttempts: cfg.waveCandidates * 10,
          expandEquipment: true, deadlineMs, seedCandidates: seedPath,
          refinementRounds: cfg.refinementRounds, refinementCandidates: cfg.refinementCandidates,
          elitePerFamily: cfg.elitePerFamily, finalistsPerFamily: cfg.finalistsPerFamily,
          rngScreenSeeds: cfg.rngScreenSeeds, finalRngPerFamily: cfg.finalRngPerFamily, rngSeeds: cfg.rngSeeds });
      }
      console.log(`Wave ${wave + 1}: new seed, ${cfg.waveCandidates} exploration target; ${Math.ceil((deadlineMs - Date.now()) / 60000)} min remaining`);
      const resultPath = join(folder, "report.json");
      try { if (!existsSync(resultPath)) await run(waveConfig, folder, cfg.workers); }
      catch (error) {
        if (Date.now() < deadlineMs) throw error;
        state.partialWave = folder;
        console.log("Time budget reached. Completed waves and partial checkpoints retained.");
        break;
      }
      const report = read(resultPath);
      state.best = keepFamilies([...state.best, ...report.finalists], cfg.finalRngPerFamily);
      state.waves.push({ wave: wave + 1, evaluated: report.uniqueEvaluated, phases: report.history.map(({ phase, evaluated, eliteSetChanged }) => ({ phase, evaluated, eliteSetChanged })), report: resultPath });
      save(statePath, state);
      publish(state, points, output, "running");
      // Completed wave inputs are reproducible; keep results and configs, release disk space.
      for (const entry of readdirSync(folder, { withFileTypes: true })) if (entry.isDirectory()) {
        for (const name of readdirSync(join(folder, entry.name))) if (/^input-\d+\.json$/.test(name)) unlinkSync(join(folder, entry.name, name));
      }
    }
    save(statePath, state);
    publish(state, points, output, Date.now() >= deadlineMs ? "time_budget" : "wave_limit");
    console.log(`Campaign report: ${join(output, "report.json")}`);
  } finally { closeSync(lock); unlinkSync(lockPath); }
}

function publish(state, points, output, stopReason) {
  const bestByFairy = Object.fromEntries(["Mira", "Tira", "Lora"].map((fairy) => [fairy, state.best.filter((entry) => entry.candidate.dimensions.fairy === fairy)]));
  save(join(output, "report.json"), { schema: "forge-master-v4-bis-campaign-report-v1", publishableBis: false,
    fingerprint: state.fingerprint, points, stopReason, waves: state.waves, partialWave: state.partialWave ?? null,
    completedWaveEvaluations: state.waves.reduce((sum, wave) => sum + wave.evaluated, 0),
    countingPolicy: "Unique within each wave; retained champions and cross-wave duplicates may be evaluated again.",
    bestByFairy, finalists: state.best });
  save(join(output, "pvp-candidates.json"), { schema: "forge-master-v4-pvp-candidate-transfer-v1",
    evaluatedInPvp: false, gameVersion: "2.9.0", sourceFingerprint: state.fingerprint,
    note: "PvE-selected builds only. Rebuild and evaluate against PvP opponents with the official PvP engine.",
    candidates: state.best.map((entry) => ({ ...entry.candidate, pveEvidence: { points, rng: entry.rng } })) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), arg = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  try { await campaign(resolve(root, arg("--config", "v4/config/bis-overnight-2.9.0.json")), resolve(root, arg("--output", "artifacts/bis-overnight")), args.includes("--seed-report") ? resolve(root, arg("--seed-report")) : undefined); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
