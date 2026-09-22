import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCombatVerdict } from "../../packages/v4-core/src/index.ts";
import { loadFamilyPilotContext } from "./run-bis-family-pilot.mjs";
import { sourceFingerprint } from "./prepare-bis-batch.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha = (value) => createHash("sha256").update(value).digest("hex");

export function runFamilyCalibration(configPath, outputPath) {
  const configBytes = readFileSync(configPath);
  const config = JSON.parse(configBytes);
  assert.equal(config.schema, "forge-master-v4-bis-family-calibration-v1");
  assert.equal(config.gameVersion, "2.9.0");
  assert.ok(Number.isInteger(config.maxStages) && config.maxStages > 0, "maxStages must be positive");
  const pilot = loadFamilyPilotContext(resolve(root, config.pilotConfig));
  const points = availablePoints(pilot.data.tables.MainBattleLibrary, config.startPoint);
  assert.ok(points.length > 0, "startPoint is not available in MainBattleLibrary");
  const stages = [];
  for (const point of points.slice(0, config.maxStages)) {
    const verdicts = pilot.candidates.map((candidate) => ({ candidate, verdict: evaluateCombatVerdict(candidate.profile, pilot.data, point, pilot.config.options) }));
    const passes = verdicts.filter(({ verdict }) => verdict.passed).length;
    stages.push({ point, passes, failures: verdicts.length - passes, byDimension: summarize(verdicts) });
    if (config.stopWhenAllFail && passes === 0) break;
  }
  const report = {
    schema: "forge-master-v4-bis-family-calibration-report-v1",
    generatedAt: new Date().toISOString(), publishableBis: false,
    gameVersion: config.gameVersion, config, configSha256: sha(configBytes),
    pilotConfigSha256: sha(pilot.configBytes), seasonSha256: sha(pilot.seasonBytes),
    manifestSha256: sha(readFileSync(join(root, "packages/v4-game-data/data/2.9.0/manifest.json"))),
    fingerprint: sourceFingerprint(), candidateCount: pilot.candidates.length,
    stages,
    firstMixedStage: stages.find((stage) => stage.passes > 0 && stage.failures > 0)?.point ?? null,
    passCountsAreMonotonic: stages.every((stage, index) => index === 0 || stage.passes <= stages[index - 1].passes),
    stoppedBecause: stages.at(-1)?.passes === 0 ? "all_candidates_failed" : "stage_limit_reached"
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(`${outputPath}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
  renameSync(`${outputPath}.tmp`, outputPath);
  return { report, output: outputPath };
}

function availablePoints(battles, start) {
  const points = battles.map(({ BattleId }) => ({ age: BattleId.AgeIdx + 1, combat: BattleId.BattleIdx + 1, difficulty: start.difficulty }));
  points.sort((left, right) => left.age - right.age || left.combat - right.combat);
  const first = points.findIndex((point) => point.age === start.age && point.combat === start.combat);
  return first < 0 ? [] : points.slice(first);
}

function summarize(verdicts) {
  const dimensions = ["fairy", "style", "petComposition", "mountId", "allocation"];
  return Object.fromEntries(dimensions.map((dimension) => [dimension, group(verdicts, dimension)]));
}

function group(verdicts, dimension) {
  const result = {};
  for (const { candidate, verdict } of verdicts) {
    const key = String(candidate.dimensions[dimension]);
    if (!result[key]) result[key] = { passes: 0, failures: 0 };
    result[key][verdict.passed ? "passes" : "failures"] += 1;
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  try {
    const { report, output } = runFamilyCalibration(
      resolve(root, value("--config", "v4/config/bis-family-calibration-2.9.0.json")),
      resolve(root, value("--output", "v4/generated/bis-family-calibration.json"))
    );
    const last = report.stages.at(-1);
    console.log(JSON.stringify({ candidateCount: report.candidateCount, stages: report.stages.length, stoppedBecause: report.stoppedBecause, lastStage: last && { point: last.point, passes: last.passes, failures: last.failures }, output }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
