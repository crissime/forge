import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadV4GameData } from "../../packages/v4-game-data/src/index.ts";

export const requiredGates = [
  "candidate_aggregation", "legal_search_space", "all_stat_sources", "fairy_season",
  "fairy_access_and_aggregation", "search_hypotheses", "batch_replay_and_cost", "in_game_validation"
];
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function assessReadiness(checks, policy, evidenceExists) {
  const blockers = [];
  if (policy?.schema !== "forge-master-v4-bis-gates-v1" || policy.gameVersion !== "2.9.0") {
    blockers.push({ id: "invalid_gate_policy", detail: "Schema/version de la politique invalide." });
  }
  const gates = Array.isArray(policy?.gates) ? policy.gates : [];
  for (const id of requiredGates) {
    const matches = gates.filter((gate) => gate?.id === id);
    const gate = matches[0];
    if (matches.length !== 1) {
      blockers.push({ id, detail: "Gate absent ou duplique." });
    } else if (gate.status !== "verified") {
      blockers.push({ id, owner: gate.owner, detail: gate.detail, status: gate.status });
    } else if (!Array.isArray(gate.evidence) || !gate.evidence.length || !gate.evidence.every(evidenceExists)) {
      blockers.push({ id, detail: "Preuve de validation absente." });
    }
  }
  for (const check of checks) {
    if (!check.passed) blockers.push({ id: check.id, detail: check.detail || "Controle technique en echec." });
  }
  if (!checks.length) blockers.push({ id: "missing_checks", detail: "Aucun controle technique execute." });
  return {
    status: blockers.length ? "blocked" : "ready_for_review",
    // Human approval remains separate; this tool never starts or authorizes a long run.
    batchStarted: false,
    blockers
  };
}

export function sourceFingerprint() {
  const files = [];
  function collect(path) {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) collect(child);
      else if (/\.(ts|json|mjs)$/.test(entry.name)) files.push([relative(root, child).replaceAll("\\", "/"), sha(readFileSync(child))]);
    }
  }
  for (const pkg of ["v4-core", "v4-game-data", "v4-bis"]) {
    for (const dir of ["src", "test"]) collect(join(root, "packages", pkg, dir));
  }
  collect(join(root, "v4/config"));
  collect(join(root, "v4/tools"));
  return { sha256: sha(JSON.stringify(files)), files };
}

function runCheck(id, args) {
  const start = performance.now();
  const result = spawnSync(process.execPath, args, {
    cwd: root, encoding: "utf8", timeout: 120_000, windowsHide: true, maxBuffer: 2_000_000
  });
  return {
    id, passed: result.status === 0 && !result.error,
    command: ["node", ...args], elapsedMs: Math.round(performance.now() - start),
    detail: result.error?.message || `${result.stdout || ""}\n${result.stderr || ""}`.trim().slice(-12_000)
  };
}

export function prepareBatch() {
  const checks = [];
  const snapshots = [];
  for (const version of ["2.8.2", "2.9.0"]) {
    try {
      const path = join(root, "packages/v4-game-data/data", version);
      const data = loadV4GameData(path, version);
      snapshots.push({
        version, manifestSha256: sha(readFileSync(join(path, "manifest.json"))),
        archiveSha256: data.manifest.source.sha256,
        loadedTables: Object.keys(data.tables),
        rawOnlyTables: Object.keys(data.wire).filter((name) => !(name in data.tables))
      });
      checks.push({ id: `snapshot_${version}`, passed: true });
    } catch (error) {
      checks.push({ id: `snapshot_${version}`, passed: false, detail: String(error) });
    }
  }
  for (const pkg of ["v4-core", "v4-game-data", "v4-bis"]) {
    checks.push(runCheck(`typecheck_${pkg}`, [
      "node_modules/typescript/bin/tsc", "-p", `packages/${pkg}/tsconfig.json`, "--noEmit"
    ]));
  }
  checks.push(runCheck("v4_tests", [
    "node_modules/vitest/vitest.mjs", "run", "packages/v4-core/test", "packages/v4-game-data/test",
    "packages/v4-bis/test", "--configLoader", "runner", "--maxWorkers", "2"
  ]));
  checks.push(runCheck("preflight_tests", ["--import", "tsx", "--test", "v4/tools/prepare-bis-batch.test.mjs"]));
  const policy = JSON.parse(readFileSync(join(root, "v4/config/bis-batch-gates.json"), "utf8"));
  const decision = assessReadiness(checks, policy, (path) => {
    if (typeof path !== "string") return false;
    const absolute = resolve(root, path);
    const local = relative(root, absolute);
    return local !== "" && !local.startsWith("..") && existsSync(absolute);
  });
  const report = {
    schema: "forge-master-v4-bis-preflight-v1", generatedAt: new Date().toISOString(),
    gameVersion: policy.gameVersion, ...decision, snapshots, checks, gates: policy.gates,
    fingerprint: sourceFingerprint(),
    note: "Les gates metier sont des decisions documentees, pas une preuve automatique de fidelite au jeu. Aucun batch lance."
  };
  const output = join(root, "v4/generated/bis-preflight.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(`${output}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
  renameSync(`${output}.tmp`, output);
  return { report, output };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { report, output } = prepareBatch();
    console.log(JSON.stringify({ status: report.status, checks: report.checks.map(({ id, passed }) => ({ id, passed })), blockers: report.blockers, output }, null, 2));
    process.exitCode = report.status === "blocked" ? 2 : 0;
  } catch (error) {
    console.error(`Preparation interrompue: ${error}`);
    process.exitCode = 1;
  }
}
