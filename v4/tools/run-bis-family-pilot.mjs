import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCombatVerdict } from "../../packages/v4-core/src/index.ts";
import { loadV4GameData } from "../../packages/v4-game-data/src/index.ts";
import { BIS_EQUIPMENT_SLOTS, buildBisProfile, searchBis } from "../../packages/v4-bis/src/index.ts";
import { sourceFingerprint } from "./prepare-bis-batch.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const slotType = { Weapon: "Weapon", Helmet: "Helmet", Body: "Armour", Gloves: "Gloves", Belt: "Belt", Necklace: "Necklace", Ring: "Ring", Shoe: "Shoes" };

export function runFamilyPilot(configPath, outputPath) {
  const { configBytes, config, seasonBytes, season, data, candidates } = loadFamilyPilotContext(configPath);
  assert.ok(candidates.length > 0 && candidates.length <= config.maxCandidates, "candidate budget exceeded");
  const result = searchBis({
    context: { kind: "family_pilot_not_publishable", configSha256: sha(configBytes), seasonId: season.seasonId },
    data, point: config.point, options: config.options, candidates,
    exactCandidateCount: candidates.length, budget: { maxEvaluations: candidates.length + 1 }
  });
  assert.equal(result.exhaustive, true);
  assert.equal(result.excluded.length, 0);
  const replayed = result.ranked.slice(0, 12).map((entry) => {
    const replay = evaluateCombatVerdict(entry.candidate.profile, data, config.point, config.options);
    assert.deepEqual(replay, entry.verdict, `non-deterministic replay: ${entry.candidate.id}`);
    return entry.candidate.id;
  });
  const passes = result.ranked.filter((entry) => entry.verdict.passed).length;
  const report = {
    schema: "forge-master-v4-bis-family-pilot-report-v1", generatedAt: new Date().toISOString(),
    publishableBis: false, gameVersion: config.gameVersion, config, configSha256: sha(configBytes),
    seasonSha256: sha(seasonBytes), manifestSha256: sha(readFileSync(join(root, "packages/v4-game-data/data/2.9.0/manifest.json"))),
    fingerprint: sourceFingerprint(), candidateCount: candidates.length, replayed,
    verdictSpread: { passes, failures: result.ranked.length - passes, usefulForFamilyComparison: passes > 0 && passes < result.ranked.length },
    result: { ...result, ranked: result.ranked.map(summary), excluded: result.excluded.map(summary), best: result.best ? summary(result.best) : null }
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(`${outputPath}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
  renameSync(`${outputPath}.tmp`, outputPath);
  return { report, output: outputPath };
}

export function loadFamilyPilotContext(configPath, generate = true) {
  const configBytes = readFileSync(configPath);
  const config = JSON.parse(configBytes);
  assert.equal(config.schema, "forge-master-v4-bis-family-pilot-v1");
  assert.equal(config.gameVersion, "2.9.0");
  const seasonBytes = readFileSync(resolve(root, config.seasonConfig));
  const season = JSON.parse(seasonBytes);
  const loaded = loadV4GameData(join(root, "packages/v4-game-data/data/2.9.0"), "2.9.0");
  const data = { version: loaded.version, tables: { ...loaded.tables, FairySeasonConfig: season } };
  return { configBytes, config, seasonBytes, season, data, candidates: generate ? generateCandidates(config, data, season) : [] };
}

export function generateCandidates(config, data, season) {
  const tables = data.tables;
  const definitions = new Map(tables.SecondaryStatLibrary.map((entry) => [entry.Stat, entry.UpperRange * 100]));
  const line = (stat) => {
    const value = definitions.get(stat);
    if (!(value > 0)) throw new Error(`Missing positive secondary stat: ${stat}`);
    return { stat, value };
  };
  const item = (type, ranged) => tables.ItemBalancingLibrary.find((entry) => {
    const id = entry.ItemId;
    if (id.Age !== config.buildRules.maxEquipmentAge || id.Type !== type) return false;
    if (type !== "Weapon") return true;
    return tables.WeaponLibrary.some((weapon) => weapon.ItemId.Age === id.Age && weapon.ItemId.Idx === id.Idx && weapon.IsRanged === ranged);
  });
  const pet = (type) => tables.PetLibrary.find((entry) => entry.PetId.Rarity === "Mythic" && entry.Type === type);
  const mount = (id) => tables.MountLibrary.find((entry) => entry.MountId.Rarity === "Mythic" && entry.MountId.Id === id);
  const candidates = [];
  for (const fairyId of config.fairies) for (const style of config.styles) for (const petStyle of config.petCompositions)
    for (const mountId of config.mountIds) for (const variant of config.allocationVariants) {
      const ranged = style === "ranged";
      const samples = config.allocationSamples ?? 1;
      for (let sample = 0; sample < samples; sample++) {
      const pairs = allocation(fairyId, style, variant, sample).map(([left, right]) => [line(left), line(right)]);
      const equipment = Object.fromEntries(BIS_EQUIPMENT_SLOTS.map((slot, index) => {
        const selected = item(slotType[slot], ranged);
        if (!selected) throw new Error(`Missing canonical ${style} ${slot}`);
        return [slot, { age: selected.ItemId.Age, idx: selected.ItemId.Idx, level: config.buildRules.itemLevel, secondaryStats: pairs[index] }];
      }));
      const selectedPet = pet(petStyle[0].toUpperCase() + petStyle.slice(1));
      const selectedMount = mount(mountId);
      if (!selectedPet || !selectedMount) throw new Error(`Missing mythic ${petStyle} pet or mount ${mountId}`);
      const build = {
        name: `${fairyId}/${style}/${petStyle}/mount-${mountId}/${variant}/sample-${sample}`,
        equipment,
        pets: [0, 1, 2].map((offset) => ({ id: selectedPet.PetId.Id, rarity: "Mythic", level: config.buildRules.petLevel, secondaryStats: pairs[8 + offset] })),
        mount: { id: selectedMount.MountId.Id, rarity: "Mythic", level: config.buildRules.mountLevel, secondaryStats: pairs[11] },
        spells: [], fixedStats: {}, fairy: { id: fairyId, level: 20, seasonId: season.seasonId, eventState: "active", statsState: "excluded" }
      };
      const built = buildBisProfile(build, data, config.buildRules);
      if (!built.ok) throw new Error(`${build.name}: ${built.issue.code} at ${built.issue.path}`);
      candidates.push({
        id: build.name, build, profile: built.profile,
        dimensions: { fairy: fairyId, style, petComposition: petStyle, mountId, allocation: variant }
      });
      }
    }
  return candidates.slice(0, config.maxCandidates);
}

function allocation(fairy, style, variant, sample) {
  const weapon = style === "ranged" ? "RangedDamageMulti" : "MeleeDamageMulti";
  const core = {
    Mira: [["SkillDamageMulti", "CriticalChance"], ["SkillDamageMulti", "CriticalMulti"], ["SkillDamageMulti", weapon], ["AttackSpeed", "DoubleDamageChance"], ["DamageMulti", "LifeSteal"], ["HealthMulti", "HealthRegen"]],
    Tira: [["SkillCooldownMulti", "BlockChance"], ["SkillCooldownMulti", "HealthMulti"], ["SkillCooldownMulti", "LifeSteal"], ["AttackSpeed", weapon], ["DamageMulti", "DoubleDamageChance"], ["CriticalChance", "CriticalMulti"]],
    Lora: [["HealthMulti", "LifeSteal"], ["HealthMulti", "BlockChance"], ["HealthMulti", "HealthRegen"], ["AttackSpeed", weapon], ["DamageMulti", "DoubleDamageChance"], ["SkillDamageMulti", "CriticalChance"]]
  };
  const hybrid = {
    Mira: [["SkillDamageMulti", "CriticalChance"], ["SkillDamageMulti", "HealthMulti"], ["AttackSpeed", weapon], ["DamageMulti", "LifeSteal"], ["DoubleDamageChance", "CriticalMulti"], ["HealthRegen", "BlockChance"]],
    Tira: [["SkillCooldownMulti", "BlockChance"], ["SkillCooldownMulti", "LifeSteal"], ["HealthMulti", "HealthRegen"], ["AttackSpeed", weapon], ["DamageMulti", "DoubleDamageChance"], ["SkillDamageMulti", "CriticalChance"]],
    Lora: [["HealthMulti", "LifeSteal"], ["HealthMulti", "BlockChance"], ["SkillDamageMulti", "CriticalChance"], ["AttackSpeed", weapon], ["DamageMulti", "DoubleDamageChance"], ["SkillCooldownMulti", "CriticalMulti"]]
  };
  const selected = (variant === "hybrid" ? hybrid : core)[fairy];
  if (!selected) throw new Error(`Unknown family: ${fairy}/${variant}`);
  const pool = [...new Set(selected.flat())];
  const pairs = [...selected, ...selected];
  return pairs.map(([left, right], index) => {
    if (style === "melee_plus_health" && index < 6) return ["HealthMulti", right === "HealthMulti" ? weapon : right];
    if (sample === 0) return [left, right];
    const bytes = createHash("sha256").update(`${fairy}/${style}/${variant}/${sample}/${index}`).digest();
    const first = pool[bytes.readUInt32LE(0) % pool.length];
    const remaining = pool.filter((stat) => stat !== first);
    return [first, remaining[bytes.readUInt32LE(4) % remaining.length]];
  });
}

function summary(entry) {
  return { id: entry.candidate.id, build: entry.candidate.build, relativeHealth: entry.relativeHealth, verdict: entry.verdict };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  try {
    const { report, output } = runFamilyPilot(resolve(root, value("--config", "v4/config/bis-family-pilot-2.9.0.json")), resolve(root, value("--output", "v4/generated/bis-family-pilot.json")));
    console.log(JSON.stringify({ candidateCount: report.candidateCount, outcome: report.result.outcome, best: report.result.best?.id ?? null, verdictSpread: report.verdictSpread, output }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
