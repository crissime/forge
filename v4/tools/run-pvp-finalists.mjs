import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, openSync, closeSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { loadFamilyPilotContext } from "./run-bis-family-pilot.mjs";
import { sourceFingerprint } from "./prepare-bis-batch.mjs";
import { buildBisProfile } from "../../packages/v4-bis/src/index.ts";
import { evaluatePvpVerdict } from "../../packages/v4-core/src/index.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const self = fileURLToPath(import.meta.url);
const hash = (s) => createHash("sha256").update(s).digest("hex");
const read = (path) => JSON.parse(readFileSync(path));
function save(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(`${path}.tmp`, JSON.stringify(value)); renameSync(`${path}.tmp`, path); }

export function playPair(a, b, data, seeds) {
  const result = { a: a.id, b: b.id, aWins: 0, bWins: 0, draws: 0, byPosition: [], seconds: 0 };
  for (const reverse of [false, true]) {
    const counts = { aAsPlayer: !reverse, aWins: 0, bWins: 0, draws: 0 };
    for (let seed = 200001; seed < 200001 + seeds; seed++) {
      const v = evaluatePvpVerdict(reverse ? b.profile : a.profile, reverse ? a.profile : b.profile, data,
        { blockMode: "rng", seed, skillActivationPolicy: "disabled" });
      assert.ok(["player", "opponent", "draw"].includes(v.winner), JSON.stringify(v));
      const key = v.winner === "draw" ? "draws" : ((v.winner === "player") !== reverse ? "aWins" : "bWins");
      result[key]++; counts[key]++; result.seconds += v.timeSeconds;
    }
    result.byPosition.push(counts);
  }
  return result;
}

export function standings(candidates, matches) {
  const rows = new Map(candidates.map((c) => [c.id, { candidate: c, wins: 0, losses: 0, draws: 0, opponents: [] }]));
  for (const match of matches) for (const side of ["a", "b"]) {
    const row = rows.get(match[side]), other = side === "a" ? "b" : "a";
    const wins = match[`${side}Wins`], losses = match[`${other}Wins`];
    row.wins += wins; row.losses += losses; row.draws += match.draws;
    row.opponents.push({ id: match[other], wins, losses, draws: match.draws });
  }
  return [...rows.values()].map((r) => ({ ...r, fights: r.wins + r.losses + r.draws,
    score: (r.wins + r.draws / 2) / (r.wins + r.losses + r.draws),
    winRate: r.wins / (r.wins + r.losses + r.draws) }))
    .sort((a, b) => b.score - a.score || b.wins - a.wins || a.candidate.id.localeCompare(b.candidate.id));
}

export async function tournament(input, output, seeds = 256, workers = 4, shard) {
  assert.ok(Number.isSafeInteger(seeds) && seeds > 0 && seeds <= 10000);
  assert.ok(Number.isSafeInteger(workers) && workers > 0 && workers <= 40);
  const context = loadFamilyPilotContext(join(root, "v4/config/bis-large-batch-2.9.0.json"), false);
  const bytes = readFileSync(input), report = JSON.parse(bytes);
  const candidates = (report.finalists?.map((e) => e.candidate) ?? report.candidates).map((c) => {
    const built = buildBisProfile(c.build, context.data, context.config.buildRules);
    assert.ok(built.ok, JSON.stringify(built.issue));
    assert.equal(c.build.spells.length, 0, "Weapon-only tournament");
    return { id: c.id, dimensions: c.dimensions, build: c.build, profile: built.profile };
  });
  assert.ok(candidates.length >= 2);
  assert.equal(new Set(candidates.map((c) => c.id)).size, candidates.length);
  const runId = hash(JSON.stringify({ input: hash(bytes), seeds, source: sourceFingerprint().sha256,
    season: hash(context.seasonBytes), manifest: hash(readFileSync(join(root, "packages/v4-game-data/data/2.9.0/manifest.json"))) }));
  const pairs = [];
  for (let a = 0; a < candidates.length; a++) for (let b = a + 1; b < candidates.length; b++) pairs.push([a, b]);
  const pathFor = (i) => join(output, "pairs", `${i}.json`);
  if (shard !== undefined) {
    assert.ok(Number.isInteger(shard) && shard >= 0 && shard < workers);
    for (let i = shard; i < pairs.length; i += workers) {
      if (existsSync(pathFor(i))) { assert.equal(read(pathFor(i)).runId, runId); continue; }
      const [a, b] = pairs[i];
      const match = playPair(candidates[a], candidates[b], context.data, seeds);
      save(pathFor(i), { runId, ...match });
      console.log(`PvP worker ${shard + 1}: pair ${i + 1}/${pairs.length}`);
    }
    return;
  }
  mkdirSync(output, { recursive: true });
  const lockPath = join(output, "running.lock"), lock = openSync(lockPath, "wx");
  const children = [];
  try {
    writeFileSync(lock, String(process.pid));
    const manifest = join(output, "run.json");
    if (existsSync(manifest)) assert.equal(read(manifest).runId, runId, "Changed inputs/code: use a new output folder");
    save(manifest, { runId, seeds, candidates: candidates.length, pairs: pairs.length, workers });
    console.log(`PvP: ${candidates.length} finalists, ${pairs.length * seeds * 2} fights, ${workers} workers`);
    await Promise.all(Array.from({ length: Math.min(workers, pairs.length) }, (_, index) => new Promise((done, fail) => {
      const child = spawn(process.execPath, ["--import", "tsx", self, "--input", input, "--output", output,
        "--seeds", String(seeds), "--workers", String(workers), "--shard", String(index)], { cwd: root, windowsHide: true, stdio: "inherit" });
      children.push(child); child.on("error", fail); child.on("exit", (code) => code === 0 ? done() : fail(new Error(`PvP worker ${index}: exit ${code}`)));
    })));
    const matches = pairs.map((_, i) => { const m = read(pathFor(i)); assert.equal(m.runId, runId); assert.equal(m.aWins + m.bWins + m.draws, seeds * 2); return m; });
    const ranking = standings(candidates, matches);
    const bestByFairy = Object.fromEntries(["Mira", "Tira", "Lora"].map((f) => [f, ranking.filter((r) => r.candidate.dimensions.fairy === f)]));
    save(join(output, "report.json"), { schema: "forge-master-v4-pvp-tournament-v1", validation: "unverified_in_game",
      runId, seedsPerPosition: seeds, seedStart: 200001, totalFights: pairs.length * seeds * 2,
      scoring: "Win=1, draw=0.5, loss=0; all other finalists equally weighted; both positions.", ranking, bestByFairy, matches });
    console.log(`PvP report: ${join(output, "report.json")}`);
  } catch (error) {
    for (const child of children) child.kill();
    await Promise.all(children.filter((c) => c.exitCode === null && c.signalCode === null).map((c) => new Promise((done) => c.once("exit", done))));
    throw error;
  } finally { closeSync(lock); unlinkSync(lockPath); }
}

if (process.argv[1] && resolve(process.argv[1]) === self) {
  const args = process.argv.slice(2), arg = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  try { await tournament(resolve(root, arg("--input", "report.json")), resolve(root, arg("--output", "artifacts/pvp-finalists")),
    Number(arg("--seeds", "256")), Number(arg("--workers", "4")), args.includes("--shard") ? Number(arg("--shard")) : undefined); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
