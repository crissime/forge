import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, unlinkSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { buildPlayerCombatProfile, evaluateCombatVerdict } from "../../packages/v4-core/src/index.ts";
import { buildBisProfile, BIS_EQUIPMENT_SLOTS } from "../../packages/v4-bis/src/index.ts";
import { loadFamilyPilotContext, generateCandidates } from "./run-bis-family-pilot.mjs";
import { sourceFingerprint } from "./prepare-bis-batch.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const self = fileURLToPath(import.meta.url);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const encode = (value) => JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v);
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
function save(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, JSON.stringify(value));
  renameSync(`${path}.tmp`, path);
}
const carriers = (build) => [...BIS_EQUIPMENT_SLOTS.map((slot) => build.equipment[slot]), ...build.pets, build.mount];
const family = (candidate) => `${candidate.dimensions.fairy}/${candidate.dimensions.style}`;

export function combatKey(profile, data) {
  assert.equal(profile.spells.length, 0, "This search space excludes spells");
  const built = buildPlayerCombatProfile(profile, data.tables, data.version);
  assert.ok(built.ok, JSON.stringify(built.issue));
  // Fairy provenance and names are not used by the combat loop; resolved stats are.
  const { name, fairy, ...effective } = built.profile;
  return hash(encode(effective));
}

function rebuild(build, dimensions, context) {
  const result = buildBisProfile(build, context.data, context.config.buildRules);
  assert.ok(result.ok, JSON.stringify(result.issue));
  const id = combatKey(result.profile, context.data);
  return { id, build, profile: result.profile, dimensions };
}

function random(seed) {
  let counter = 0;
  return () => createHash("sha256").update(`${seed}/${counter++}`).digest().readUInt32LE(0) / 4294967296;
}

function statPool(context, style) {
  const excluded = style === "ranged" ? "MeleeDamageMulti" : "RangedDamageMulti";
  return context.data.tables.SecondaryStatLibrary
    .filter((entry) => entry.UpperRange > 0 && entry.Stat !== excluded)
    .map((entry) => ({ stat: entry.Stat, value: entry.UpperRange * 100 }));
}

export function variant(template, index, context) {
  const build = structuredClone(template.build);
  const rng = random(`${context.config.seed}/${index}/${family(template)}`);
  const pool = statPool(context, template.dimensions.style);
  const boosted = { Mira: "SkillDamageMulti", Tira: "SkillCooldownMulti", Lora: "HealthMulti" }[template.dimensions.fairy];
  // Vary concentration as well as individual rolls to cover distinct archetypes.
  const weights = pool.map((line) => ({ line, weight: 0.1 + rng() ** 3 * 8 + (line.stat === boosted ? rng() * 4 : 0) }));
  function pick(excluded) {
    const choices = weights.filter(({ line }) => line.stat !== excluded);
    let value = rng() * choices.reduce((sum, entry) => sum + entry.weight, 0);
    return choices.find((entry) => (value -= entry.weight) < 0)?.line ?? choices.at(-1).line;
  }
  carriers(build).forEach((carrier) => {
    const first = pick();
    carrier.secondaryStats = [first, pick(first.stat)];
  });
  return rebuild(build, template.dimensions, context);
}

export function explore(context, accept) {
  const templates = generateCandidates({ ...context.config, allocationSamples: 1 }, context.data, context.season);
  const seen = new Set();
  const coverage = {};
  let attempts = 0;
  for (; attempts < context.config.maxAttempts && seen.size < context.config.maxCandidates; attempts++) {
    const template = templates[attempts % templates.length];
    const candidate = attempts < templates.length ? rebuild(template.build, template.dimensions, context) : variant(template, attempts, context);
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    coverage[family(candidate)] = (coverage[family(candidate)] ?? 0) + 1;
    accept(candidate);
  }
  return { seen, attempts, coverage };
}

function verdict(profile, context, point, options = context.config.options) {
  const result = evaluateCombatVerdict(profile, context.data, point, options);
  assert.ok(!["missing_data", "invalid_input"].includes(result.reason), encode(result));
  return { passed: result.passed, reason: result.reason, timeSeconds: result.timeSeconds,
    clearedWaves: result.clearedWaves, damageDone: result.damageDone,
    relativeHealth: result.remainingHealth / Number(result.metrics.playerMaxHealth) };
}

export function compare(a, b) {
  const count = (entry) => entry.verdicts.filter((v) => v.passed).length;
  let diff = count(b) - count(a);
  if (diff) return diff;
  for (let i = a.verdicts.length - 1; i >= 0; i--) {
    const av = a.verdicts[i], bv = b.verdicts[i];
    diff = Number(bv.passed) - Number(av.passed);
    if (!diff) diff = av.passed ? av.timeSeconds - bv.timeSeconds || bv.relativeHealth - av.relativeHealth : bv.clearedWaves - av.clearedWaves || bv.damageDone - av.damageDone;
    if (diff) return diff;
  }
  return a.candidate.id.localeCompare(b.candidate.id);
}

function elites(results, perFamily) {
  const counts = new Map();
  return results.toSorted(compare).filter((entry) => {
    const key = family(entry.candidate), count = counts.get(key) ?? 0;
    counts.set(key, count + 1);
    return count < perFamily;
  });
}

async function worker(inputPath, outputPath, configPath) {
  const inputBytes = readFileSync(inputPath);
  const input = JSON.parse(inputBytes);
  const signature = hash(inputBytes);
  const context = loadFamilyPilotContext(configPath, false);
  const checkpoint = existsSync(outputPath) ? read(outputPath) : { signature, done: 0, best: [], curves: {} };
  assert.equal(checkpoint.signature, signature, "incompatible checkpoint");
  assert.ok(checkpoint.done >= 0 && checkpoint.done <= input.candidates.length);
  for (let i = checkpoint.done; i < input.candidates.length; i++) {
    const candidate = input.candidates[i];
    const entry = { candidate, verdicts: context.config.points.map((point) => verdict(candidate.profile, context, point)) };
    const key = family(candidate);
    checkpoint.curves[key] ??= context.config.points.map((point) => ({ point, passes: 0, failures: 0 }));
    entry.verdicts.forEach((v, index) => checkpoint.curves[key][index][v.passed ? "passes" : "failures"]++);
    checkpoint.best = elites([...checkpoint.best, entry], context.config.elitePerFamily);
    checkpoint.done = i + 1;
    if (checkpoint.done % 100 === 0) save(outputPath, checkpoint);
  }
  save(outputPath, checkpoint);
}

async function phase(candidates, directory, context, workers, runId, configPath) {
  mkdirSync(directory, { recursive: true });
  const inputs = Array.from({ length: workers }, () => []);
  candidates.forEach((candidate, index) => inputs[index % workers].push(candidate));
  const children = [];
  try {
    await Promise.all(inputs.map(async (list, index) => {
      const input = join(directory, `input-${index}.json`), output = join(directory, `result-${index}.json`);
      save(input, { runId, candidates: list });
      await new Promise((success, failure) => {
        const child = spawn(process.execPath, ["--import", "tsx", self, "--worker", input, "--output", output, "--config", configPath], { cwd: root, windowsHide: true, stdio: "inherit" });
        children.push(child);
        child.on("error", failure);
        child.on("exit", (code) => code === 0 ? success() : failure(new Error(`Worker ${index} failed (${code})`)));
      });
      const result = read(output);
      assert.equal(result.signature, hash(readFileSync(input)));
      assert.equal(result.done, list.length, "incomplete worker");
      console.log(`${directory.split(/[\\/]/).at(-1)}: shard ${index + 1}/${workers} complete (${list.length})`);
    }));
  } catch (error) {
    for (const child of children) child.kill();
    await Promise.all(children.filter((c) => c.exitCode === null && c.signalCode === null).map((c) => new Promise((done) => c.once("exit", done))));
    throw error;
  }
  const shards = inputs.map((_, index) => read(join(directory, `result-${index}.json`)));
  const curves = {};
  for (const shard of shards) for (const [key, stages] of Object.entries(shard.curves)) {
    curves[key] ??= stages.map(({ point }) => ({ point, passes: 0, failures: 0 }));
    stages.forEach((stage, index) => {
      curves[key][index].passes += stage.passes;
      curves[key][index].failures += stage.failures;
    });
  }
  return { best: elites(shards.flatMap((shard) => shard.best), context.config.elitePerFamily), curves };
}

export async function run(configPath, output, workers) {
  assert.ok(Number.isInteger(workers) && workers > 0 && workers <= 40, "workers must be 1..40");
  const context = loadFamilyPilotContext(configPath, false);
  const cfg = context.config;
  for (const key of ["maxCandidates", "maxAttempts", "elitePerFamily", "finalistsPerFamily", "rngSeeds", "refinementCandidates", "refinementRounds"]) assert.ok(Number.isSafeInteger(cfg[key]) && cfg[key] > 0, `invalid ${key}`);
  assert.equal(cfg.options.blockMode, "average");
  assert.equal(cfg.options.skillActivationPolicy, "disabled");
  assert.ok(cfg.points.length >= 4 && cfg.finalistsPerFamily <= cfg.elitePerFamily);
  const runId = hash(encode({ config: cfg, workers, source: sourceFingerprint().sha256,
    season: hash(context.seasonBytes), manifest: hash(readFileSync(join(root, "packages/v4-game-data/data/2.9.0/manifest.json"))) }));
  mkdirSync(output, { recursive: true });
  const manifestPath = join(output, "run.json");
  const lockPath = join(output, "running.lock");
  const lock = openSync(lockPath, "wx");
  try {
    writeFileSync(lock, String(process.pid));
    if (existsSync(manifestPath)) assert.equal(read(manifestPath).runId, runId, "Code/config changed: use a new output directory");
    save(manifestPath, { runId, config: cfg, workers, publishableBis: false });
    const candidates = [];
    const exploration = explore(context, (candidate) => candidates.push(candidate));
    console.log(`Exploration: ${candidates.length} unique combat profiles / ${exploration.attempts} attempts`);
    assert.ok(candidates.length > 0);
    const initial = await phase(candidates, join(output, "exploration"), context, workers, runId, configPath);
    let best = initial.best;
    const history = [{ phase: "exploration", evaluated: candidates.length, coverage: exploration.coverage, curves: initial.curves }];
    const seen = exploration.seen;
    for (let round = 1; round <= cfg.refinementRounds; round++) {
      const next = [];
      // One legal secondary-line replacement explores each elite's local neighbourhood.
      for (let offset = 0; offset < 24; offset++) for (const elite of best) {
        for (const line of statPool(context, elite.candidate.dimensions.style)) {
          const build = structuredClone(elite.candidate.build), carrier = carriers(build)[Math.floor(offset / 2)], slot = offset % 2;
          if (carrier.secondaryStats[1 - slot].stat === line.stat) continue;
          carrier.secondaryStats[slot] = line;
          const candidate = rebuild(build, elite.candidate.dimensions, context);
          if (seen.has(candidate.id) || next.length >= cfg.refinementCandidates) continue;
          seen.add(candidate.id); next.push(candidate);
        }
      }
      if (!next.length) break;
      const improved = await phase(next, join(output, `refinement-${round}`), context, workers, runId, configPath);
      const merged = elites([...best, ...improved.best], cfg.elitePerFamily);
      const changed = merged.some((entry, index) => entry.candidate.id !== best[index]?.candidate.id);
      history.push({ phase: `refinement-${round}`, evaluated: next.length, eliteSetChanged: changed, curves: improved.curves });
      best = merged;
      if (!changed) break;
    }
    const finalists = elites(best, cfg.finalistsPerFamily);
    for (const entry of finalists) {
      const rebuilt = rebuild(entry.candidate.build, entry.candidate.dimensions, context);
      assert.equal(rebuilt.id, entry.candidate.id);
      assert.deepEqual(cfg.points.map((point) => verdict(rebuilt.profile, context, point)), entry.verdicts, "finalist replay mismatch");
      const rngPath = join(output, "rng", `${entry.candidate.id}.json`);
      if (existsSync(rngPath)) {
        const cached = read(rngPath);
        assert.equal(cached.runId, runId);
        entry.rng = cached.rng;
        continue;
      }
      entry.rng = cfg.points.map((point) => {
        let wins = 0;
        for (let seed = 1; seed <= cfg.rngSeeds; seed++) if (verdict(rebuilt.profile, context, point, { ...cfg.options, blockMode: "rng", seed }).passed) wins++;
        const n = cfg.rngSeeds, p = wins / n, z = 1.96, denom = 1 + z * z / n;
        const center = (p + z * z / (2 * n)) / denom, half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom;
        return { point, seeds: n, wins, rate: p, interval95: [center - half, center + half] };
      });
      save(rngPath, { runId, rng: entry.rng });
      console.log(`RNG validated: ${family(entry.candidate)} ${entry.candidate.id.slice(0, 10)}`);
    }
    save(join(output, "report.json"), { runId, publishableBis: false, uniqueEvaluated: seen.size,
      requestedExploration: cfg.maxCandidates, actualExploration: candidates.length,
      stopReason: history.at(-1).eliteSetChanged === false ? "local_elites_stable" : "configured_budget_reached",
      history, finalists, note: "Bounded max-roll, weapon-only scenario. RNG validates selected finalists, not global optimality or in-game accuracy." });
    console.log(`Report: ${join(output, "report.json")}`);
  } finally { closeSync(lock); unlinkSync(lockPath); }
}

if (process.argv[1] && resolve(process.argv[1]) === self) {
  const args = process.argv.slice(2);
  const arg = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  const config = resolve(root, arg("--config", "v4/config/bis-large-batch-2.9.0.json"));
  try {
    if (args.includes("--worker")) await worker(arg("--worker"), arg("--output"), config);
    else await run(config, resolve(root, arg("--output", "artifacts/bis-batch-v2")), Number(arg("--workers", "40")));
  } catch (error) { console.error(error); process.exitCode = 1; }
}
