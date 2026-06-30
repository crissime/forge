import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { loadGameData } from "../packages/game-data/dist/index.js";
import { createEmptyStats, evaluateProfileSnapshot } from "../packages/simulator/dist/index.js";

const OUTPUT = path.resolve(process.env.FM_BIS_OUTPUT || "apps/web/src/features/simulation/simulatedBis.json");
const CHECKPOINT = process.env.FM_BIS_CHECKPOINT ? path.resolve(process.env.FM_BIS_CHECKPOINT) : null;
const OBJECTIVES = ["progress", "damage", "survival"];
const SLOTS = ["Weapon", "Helmet", "Body", "Gloves", "Belt", "Necklace", "Ring", "Shoe"];
const RARITIES = ["Common", "Rare", "Epic", "Legendary", "Ultimate", "Mythic"];
const MIN_EQUIPMENT_AGE = Math.max(0, Math.round(Number(process.env.FM_BIS_MIN_EQUIPMENT_AGE ?? 4)));
const QUANTUM_AGE = 7;
const LEGENDARY_RARITY = "Legendary";
const SKIP_QUANTUM_LEGENDARY = process.env.FM_BIS_SKIP_QUANTUM_LEGENDARY !== "0";
const BUILD_MODEL = { damageStacking: "additive", blockMode: "average", trials: 1, seed: 1337 };
const TOP_N = Math.max(1, Math.round(Number(process.env.FM_BIS_TOP_N || 10)));
const SMOKE = process.env.FM_BIS_SMOKE === "1";
const CHOICE_LIMIT = SMOKE ? Math.max(1, Math.round(Number(process.env.FM_BIS_CHOICE_LIMIT || 1))) : Infinity;
const STAT_ALLOCATION_LIMIT = process.env.FM_BIS_STAT_ALLOCATIONS
  ? Math.max(1, Math.round(Number(process.env.FM_BIS_STAT_ALLOCATIONS)))
  : SMOKE ? 4 : Infinity;
const BEAM_WIDTH = Math.max(1, Math.round(Number(process.env.FM_BIS_BEAM || 64)));
const EXHAUSTIVE_STATS = process.env.FM_BIS_EXHAUSTIVE_STATS === "1";
const CONTROLLED_EXHAUSTIVE = process.env.FM_BIS_CONTROLLED === "1";
const PET_MODE = process.env.FM_BIS_PET_MODE || (CONTROLLED_EXHAUSTIVE ? "type-archetypes" : "all");
const STAT_RULES = process.env.FM_BIS_STAT_RULES || (CONTROLLED_EXHAUSTIVE ? "controlled" : "none");
const WEAPON_STYLE = process.env.FM_BIS_WEAPON_STYLE || "any";
const CASE_SHARDS = Math.max(1, Math.round(Number(process.env.FM_BIS_CASE_SHARDS || 1)));
const requestedWorkers = Number(process.env.FM_BIS_WORKERS || Math.max(1, availableParallelism() - 1));
const maxWorkers = Number(process.env.FM_BIS_MAX_WORKERS || 9);
const WORKERS = Math.max(1, Math.min(
  Math.floor(Number.isFinite(requestedWorkers) ? requestedWorkers : 1),
  Math.max(1, Math.floor(Number.isFinite(maxWorkers) ? maxWorkers : 9))
));
const SCRIPT = fileURLToPath(import.meta.url);

if (isMainThread && path.resolve(process.argv[1] || "") === SCRIPT) {
  await main();
} else if (!isMainThread) {
  const data = await loadGameData();
  for (const job of workerData.jobs) {
    parentPort.postMessage({ type: "result", result: exhaustiveCase(job, data, workerData.options) });
  }
}

async function main() {
  const data = await loadGameData();
  const completed = CHECKPOINT && process.env.FM_BIS_RESUME === "1" ? await readCheckpoint(CHECKPOINT) : new Map();
  let jobs = caseJobs(data).filter((job) => !completed.has(job.key));
  const explicitCases = String(process.env.FM_BIS_CASES || "").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (explicitCases.length) jobs = jobs.filter((job) => explicitCases.includes(job.key));
  jobs = shardJobs(jobs, CASE_SHARDS).filter((job) => !completed.has(checkpointKey(job)));
  const limitCases = Number(process.env.FM_BIS_LIMIT_CASES || (SMOKE ? 4 : 0));
  if (limitCases > 0) jobs = jobs.slice(0, limitCases);

  if (CHECKPOINT) await mkdir(path.dirname(CHECKPOINT), { recursive: true });
  await mkdir(path.dirname(OUTPUT), { recursive: true });

  const options = {
    topN: TOP_N,
    choiceLimit: CHOICE_LIMIT,
    statAllocationLimit: STAT_ALLOCATION_LIMIT,
    beamWidth: BEAM_WIDTH,
    exhaustiveStats: EXHAUSTIVE_STATS,
    petMode: PET_MODE,
    statRules: STAT_RULES,
    weaponStyle: WEAPON_STYLE,
    smoke: SMOKE
  };
  const results = new Map(completed);
  const chunks = splitJobs(jobs, Math.min(WORKERS, jobs.length || 1));

  if (chunks.length <= 1) {
    for (const job of jobs) {
      const result = exhaustiveCase(job, data, options);
      results.set(result.checkpointKey || result.key, result);
      if (CHECKPOINT) await appendCheckpoint(CHECKPOINT, result);
      console.log(`BIS ${result.key}: ${result.winner.score.toFixed(4)} from ${result.candidateCount} candidates`);
    }
  } else {
    await Promise.all(chunks.map((chunk) => runWorker(chunk, options, async (result) => {
      results.set(result.checkpointKey || result.key, result);
      if (CHECKPOINT) await appendCheckpoint(CHECKPOINT, result);
      console.log(`BIS ${result.key}: ${result.winner.score.toFixed(4)} from ${result.candidateCount} candidates`);
    })));
  }

  const output = buildOutput(data, mergeShardResults(data, results, options), options);
  const tmp = `${OUTPUT}.tmp`;
  await writeFile(tmp, `${JSON.stringify(output, null, 2)}\n`);
  await rename(tmp, OUTPUT);
  console.log(`Wrote ${results.size} BIS case(s) to ${OUTPUT}`);
}

export function caseJobs(data) {
  const jobs = [];
  for (const age of data.normalized.ageOptions.map((entry) => entry.value).filter((value) => value >= MIN_EQUIPMENT_AGE)) {
    for (const petRarity of RARITIES) {
      for (const mountRarity of RARITIES) {
        if (skipAccessCase(age, petRarity, mountRarity)) continue;
        for (const spellRarity of RARITIES) {
          for (const objective of OBJECTIVES) {
            const key = caseKey(age, petRarity, mountRarity, spellRarity, objective);
            jobs.push({ key, age, petRarity, mountRarity, spellRarity, objective });
          }
        }
      }
    }
  }
  return jobs;
}

function shardJobs(jobs, shardCount) {
  if (shardCount <= 1) return jobs;
  return jobs.flatMap((job) => Array.from({ length: shardCount }, (_, shardIndex) => ({
    ...job,
    shardIndex,
    shardCount
  })));
}

function checkpointKey(job) {
  return job.shardCount > 1 ? `${job.key}#${job.shardIndex + 1}-${job.shardCount}` : job.key;
}

export function exhaustiveCase(job, data, options = {}) {
  const topN = options.topN || TOP_N;
  const choiceLimit = options.choiceLimit ?? Infinity;
  const statAllocationLimit = options.statAllocationLimit ?? Infinity;
  const beamWidth = options.beamWidth || (options.smoke ? 1 : BEAM_WIDTH);
  const frontier = options.smoke ? smokeFrontier(job) : frontierFor(job, data, options);
  const stats = statChoices(data.normalized.stats, options);
  const top = [];
  let candidateCount = 0;
  let statAllocationCount = 0;
  let groupIndex = 0;

  for (const equipment of equipmentCombos(job.age, data, choiceLimit, options)) {
    for (const pets of bestPetTriples(job.petRarity, data, choiceLimit, options.petMode)) {
      for (const mount of limited(bestMountChoices(job.mountRarity, data), choiceLimit)) {
        for (const spells of bestSpellSets(job.spellRarity, data, choiceLimit)) {
          if (job.shardCount > 1 && groupIndex++ % job.shardCount !== job.shardIndex) continue;
          const base = buildProfile(job, data, equipment, pets, mount, spells);
          const carrierCount = SLOTS.length + pets.length + (mount ? 1 : 0);
          const lineCount = secondaryLineCount(equipment, pets, mount);
          const countVectors = options.exhaustiveStats
            ? Array.from(statCountVectors(stats, lineCount, carrierCount, statAllocationLimit, options))
            : optimizedStatCountVectors(base, stats, lineCount, carrierCount, data, job, frontier, beamWidth, statAllocationLimit, options);
          statAllocationCount = Math.max(statAllocationCount, countVectors.length);
          for (const counts of countVectors) {
            const profile = applyStatCounts(base, stats, counts);
            const result = evaluateProfileSnapshot(profile, data, job.objective, 60, { levelRange: frontier, model: BUILD_MODEL });
            candidateCount += 1;
            pushTop(top, {
              score: result.score,
              stats: summarizeStats(stats, counts),
              equipment: equipment.map(publicItem),
              pets: pets.map(publicCompanion),
              mount: publicCompanion(mount),
              spells: spells.map((spell) => ({ id: spell.id, name: spell.name, rarity: spell.rarity, level: 100 })),
              scenarios: result.scenarios.map((scenario) => ({
                id: scenario.id,
                score: round(scenario.score, 6),
                success: scenario.success,
                summary: scenario.summary
              }))
            }, topN);
          }
        }
      }
    }
  }

  const winner = top[0] || emptyWinner();
  const reach = !options.smoke && winner.equipment.length && !(job.shardCount > 1)
    ? reachFor(profileFromWinner(job, data, winner), data, job.objective)
    : null;
  return {
    key: job.key,
    checkpointKey: checkpointKey(job),
    shardIndex: job.shardIndex,
    shardCount: job.shardCount,
    objective: job.objective,
    access: {
      equipmentAge: job.age,
      petRarity: job.petRarity,
      mountRarity: job.mountRarity,
      spellRarity: job.spellRarity
    },
    frontier,
    reach,
    lineCount: winner.stats.reduce((sum, stat) => sum + stat.count, 0),
    candidateCount,
    statAllocationCount,
    exhaustive: !options.smoke,
    winner,
    top
  };
}

export function* statCountVectors(stats, lineCount, carrierCount, limit = Infinity, options = {}) {
  const ids = stats.map((stat) => stat.id);
  const counts = Object.fromEntries(ids.map((id) => [id, 0]));
  let yielded = 0;

  function* visit(index, remaining) {
    if (yielded >= limit) return;
    if (index === ids.length - 1) {
      if (remaining <= carrierCount) {
        counts[ids[index]] = remaining;
        if (validStatCounts(counts, options)) {
          yielded += 1;
          yield { ...counts };
        }
      }
      return;
    }
    const max = Math.min(carrierCount, remaining);
    for (let count = 0; count <= max; count += 1) {
      counts[ids[index]] = count;
      yield* visit(index + 1, remaining - count);
      if (yielded >= limit) return;
    }
  }

  yield* visit(0, lineCount);
}

export function optimizedStatCountVectors(base, stats, lineCount, carrierCount, data, job, frontier, beamWidth = BEAM_WIDTH, limit = Infinity, options = {}) {
  const ids = stats.map((stat) => stat.id);
  const zero = Object.fromEntries(ids.map((id) => [id, 0]));
  let beam = [{ counts: zero, score: scoreCounts(base, stats, zero, data, job, frontier) }];

  for (let line = 0; line < lineCount; line += 1) {
    const candidates = new Map();
    for (const entry of beam) {
      for (const id of ids) {
        if (entry.counts[id] >= carrierCount) continue;
        const counts = { ...entry.counts, [id]: entry.counts[id] + 1 };
        const key = countKey(ids, counts);
        if (candidates.has(key)) continue;
        candidates.set(key, {
          counts,
          score: scoreCounts(base, stats, counts, data, job, frontier)
        });
      }
    }
    beam = Array.from(candidates.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, beamWidth);
  }

  const improved = new Map(beam.map((entry) => [countKey(ids, entry.counts), entry]));
  for (const counts of archetypeCountVectors(ids, lineCount, carrierCount, job)) {
    const key = countKey(ids, counts);
    if (!improved.has(key)) {
      improved.set(key, {
        counts,
        score: scoreCounts(base, stats, counts, data, job, frontier)
      });
    }
  }
  for (const entry of beam) {
    for (const from of ids) {
      if (!entry.counts[from]) continue;
      for (const to of ids) {
        if (from === to || entry.counts[to] >= carrierCount) continue;
        const counts = { ...entry.counts, [from]: entry.counts[from] - 1, [to]: entry.counts[to] + 1 };
        const key = countKey(ids, counts);
        if (improved.has(key)) continue;
        improved.set(key, {
          counts,
          score: scoreCounts(base, stats, counts, data, job, frontier)
        });
      }
    }
  }

  return Array.from(improved.values())
    .sort((left, right) => right.score - left.score)
    .filter((entry) => validStatCounts(entry.counts, options))
    .slice(0, limit)
    .map((entry) => entry.counts);
}

function archetypeCountVectors(ids, lineCount, carrierCount, job) {
  const archetypes = [
    ["health", "regen", "block", "lifesteal"],
    ["health", "regen", "damage", "attackSpeed"],
    ["health", "regen", "meleeDamage", "attackSpeed"],
    ["health", "regen", "rangedDamage", "attackSpeed"],
    ["health", "regen", "skillDamage", "cooldown"],
    ["damage", "attackSpeed", "doubleChance", "critChance"],
    ["meleeDamage", "attackSpeed", "doubleChance", "critChance"],
    ["rangedDamage", "attackSpeed", "doubleChance", "critChance"],
    ["skillDamage", "cooldown", "damage", "critChance"]
  ];
  if (rarityRank(job.spellRarity) >= rarityRank("Legendary")) {
    archetypes.push(
      ["skillDamage"],
      ["skillDamage", "cooldown"],
      ["skillDamage", "damage"],
      ["skillDamage", "cooldown", "damage"],
      ["skillDamage", "cooldown", "health", "regen"],
      ["skillDamage", "cooldown", "lifesteal", "attackSpeed"]
    );
  }
  return archetypes.map((wanted) => distributeLines(ids, wanted.filter((id) => ids.includes(id)), lineCount, carrierCount));
}

function distributeLines(ids, wanted, lineCount, carrierCount) {
  const counts = Object.fromEntries(ids.map((id) => [id, 0]));
  if (!wanted.length) return counts;
  let remaining = lineCount;
  while (remaining > 0) {
    let changed = false;
    for (const id of wanted) {
      if (remaining <= 0) break;
      if (counts[id] >= carrierCount) continue;
      counts[id] += 1;
      remaining -= 1;
      changed = true;
    }
    if (!changed) break;
  }
  return counts;
}

function scoreCounts(base, stats, counts, data, job, frontier) {
  const profile = applyStatCounts(base, stats, counts);
  return evaluateProfileSnapshot(profile, data, job.objective, 60, { levelRange: frontier, model: BUILD_MODEL }).score;
}

function countKey(ids, counts) {
  return ids.map((id) => counts[id] || 0).join(",");
}

function statChoices(stats, options = {}) {
  if (options.statRules !== "controlled") return stats;
  return stats.filter((stat) => stat.id !== "rangedDamage");
}

function validStatCounts(counts, options = {}) {
  if (options.statRules !== "controlled") return true;
  if (Number(counts.cooldown || 0) > 0 && Number(counts.skillDamage || 0) <= 0) return false;
  if (Number(counts.doubleChance || 0) > 0 && Number(counts.attackSpeed || 0) <= 0) return false;
  if (Number(counts.critDamage || 0) > 0 && Number(counts.critChance || 0) <= 0) return false;
  if (Number(counts.lifesteal || 0) > 0) {
    const weaponDps = ["damage", "meleeDamage", "attackSpeed", "doubleChance", "critChance"]
      .some((id) => Number(counts[id] || 0) > 0);
    if (!weaponDps) return false;
  }
  return true;
}

export function petTriples(maxRarity, data, limit = Infinity) {
  const pets = data.normalized.petModels
    .filter((pet) => rarityRank(pet.rarity) <= rarityRank(maxRarity))
    .sort((left, right) => rarityRank(left.rarity) - rarityRank(right.rarity) || left.id - right.id);
  const triples = [];
  for (let a = 0; a < pets.length; a += 1) {
    for (let b = a; b < pets.length; b += 1) {
      for (let c = b; c < pets.length; c += 1) {
        triples.push([pets[a], pets[b], pets[c]].map((pet) => petCard(pet, data)));
        if (triples.length >= limit) return triples;
      }
    }
  }
  return triples;
}

export function spellSets(maxRarity, data, limit = Infinity) {
  const spells = data.normalized.spells
    .filter((spell) => rarityRank(spell.rarity) <= rarityRank(maxRarity))
    .sort((left, right) => rarityRank(left.rarity) - rarityRank(right.rarity) || left.id.localeCompare(right.id));
  const sets = [[]];
  for (let size = 1; size <= 3; size += 1) {
    choose(spells, size, (picked) => sets.push(picked.map((spell) => ({ ...spell, level: 100 }))), limit - sets.length);
    if (sets.length >= limit) return sets.slice(0, limit);
  }
  return sets;
}

export function bestPetTriples(rarity, data, limit = Infinity, mode = PET_MODE) {
  const pets = data.normalized.petModels
    .filter((pet) => pet.rarity === rarity)
    .sort((left, right) => petTypeRank(left.type) - petTypeRank(right.type) || left.id - right.id);
  if (mode === "type-archetypes") return petTypeArchetypes(pets).slice(0, limit).map((triple) => triple.map((pet) => petCard(pet, data)));
  const triples = [];
  for (let a = 0; a < pets.length; a += 1) {
    for (let b = a; b < pets.length; b += 1) {
      for (let c = b; c < pets.length; c += 1) {
        triples.push([pets[a], pets[b], pets[c]].map((pet) => petCard(pet, data)));
        if (triples.length >= limit) return triples;
      }
    }
  }
  return triples;
}

function petTypeArchetypes(pets) {
  const byType = Object.fromEntries(["Damage", "Health", "Balanced"].map((type) => [type, pets.find((pet) => pet.type === type)]));
  const d = byType.Damage;
  const h = byType.Health;
  const b = byType.Balanced;
  return [
    [d, d, d],
    [h, h, h],
    [b, b, b],
    [d, d, h],
    [d, d, b],
    [h, h, d],
    [h, h, b],
    [d, h, b]
  ].filter((triple) => triple.every(Boolean));
}

export function bestSpellSets(rarity, data, limit = Infinity) {
  const spells = data.normalized.spells
    .filter((spell) => spell.rarity === rarity)
    .sort((left, right) => spellRank(left) - spellRank(right) || left.id.localeCompare(right.id))
    .slice(0, 3)
    .map((spell) => ({ ...spell, level: 100 }));
  return [spells].slice(0, limit);
}

function* equipmentCombos(maxAge, data, limit = Infinity, options = {}) {
  const choices = SLOTS.map((slot) => limited(itemChoices(slot, maxAge, data, options), limit));
  const picked = [];
  let yielded = 0;

  function* visit(index) {
    if (yielded >= limit) return;
    if (index === choices.length) {
      yielded += 1;
      yield picked.slice();
      return;
    }
    for (const choice of choices[index]) {
      picked[index] = choice;
      yield* visit(index + 1);
      if (yielded >= limit) return;
    }
  }

  yield* visit(0);
}

export function itemChoices(slot, maxAge, data, options = {}) {
  const bases = data.normalized.itemBases.filter((item) => item.slot === slot && item.age === maxAge);
  if (slot === "Weapon") {
    const choices = bestWeaponChoices(bases, data).map((base) => itemCard(base, data));
    if (options.weaponStyle === "melee") return choices.filter((item) => item.isRanged === false);
    if (options.weaponStyle === "ranged") return choices.filter((item) => item.isRanged === true);
    return choices;
  }
  return bases
    .sort((left, right) => itemPower(right) - itemPower(left) || left.idx - right.idx)
    .slice(0, 1)
    .map((base) => itemCard(base, data));
}

function bestWeaponChoices(bases, data) {
  const buckets = ["melee", "hybrid", "ranged"];
  const picked = buckets
    .map((bucket) => bases
      .filter((base) => weaponBucket(base, data) === bucket)
      .sort((left, right) => itemCardPower(right, data) - itemCardPower(left, data) || left.idx - right.idx)
      .at(0))
    .filter(Boolean);
  return Array.from(new Map(picked.map((base) => [base.idx, base])).values());
}

function weaponBucket(base, data) {
  if (isRangedWeapon(base, data)) return "ranged";
  return Number(base.health || 0) > 0 ? "hybrid" : "melee";
}

function itemCardPower(base, data) {
  return itemPower(itemCard(base, data));
}

function mountChoices(maxRarity, data) {
  return data.normalized.mountModels
    .filter((mount) => rarityRank(mount.rarity) <= rarityRank(maxRarity))
    .sort((left, right) => rarityRank(left.rarity) - rarityRank(right.rarity) || left.id - right.id)
    .map((mount) => mountCard(mount, data));
}

function bestMountChoices(rarity, data) {
  return data.normalized.mountModels
    .filter((mount) => mount.rarity === rarity)
    .sort((left, right) => left.id - right.id)
    .slice(0, 1)
    .map((mount) => mountCard(mount, data));
}

function buildProfile(job, data, equipment, pets, mount, spells) {
  const baseConfig = data.raw["ItemBalancingConfig.json"] || {};
  const baseAttack = Number(baseConfig.PlayerBaseDamage || 10);
  const baseHealth = Number(baseConfig.PlayerBaseHealth || 80);
  const equipmentAttack = sum(equipment, "attack");
  const equipmentHealth = sum(equipment, "health");
  const petAttack = sum(pets, "attack");
  const petHealth = sum(pets, "health");
  const mountAttack = Number(mount?.attack || 0);
  const mountHealth = Number(mount?.health || 0);
  const weapon = equipment.find((item) => item.slot === "Weapon");
  const secondaryStats = createEmptyStats();
  const talentStats = createEmptyStats();

  return {
    name: `BIS ${job.key}`,
    source: "manual",
    dataVersion: data.normalized.version,
    confidence: "complete",
    base: {
      attack: baseAttack + equipmentAttack + petAttack + mountAttack,
      health: baseHealth + equipmentHealth + petHealth + mountHealth,
      weaponStyle: weapon?.isRanged === false ? "melee" : "ranged"
    },
    equipment: Object.fromEntries(equipment.map((item) => [item.slot, { ...item, secondaryStats: [] }])),
    pets: pets.map((pet) => ({ ...pet, secondaryStats: [] })),
    mount: mount ? { ...mount, secondaryStats: [], skills: [] } : null,
    spells: spells.map((spell) => ({ id: spell.id, level: 100, rarity: spell.rarity })),
    talentTree: { Forge: {}, Power: {}, SkillsPetTech: {} },
    stats: createEmptyStats(),
    breakdown: {
      baseAttack,
      baseHealth,
      equipmentAttack,
      equipmentHealth,
      petAttack,
      petHealth,
      mountAttack,
      mountHealth,
      secondaryStats,
      talentStats
    },
    audit: []
  };
}

function profileFromWinner(job, data, winner) {
  const equipment = SLOTS
    .map((slot) => winner.equipment.find((item) => item.slot === slot))
    .filter(Boolean)
    .map((item) => ({
      ...item,
      isRanged: item.slot === "Weapon" ? item.weaponStyle !== "melee" : undefined
    }));
  const profile = buildProfile(
    job,
    data,
    equipment,
    winner.pets || [],
    winner.mount,
    winner.spells || []
  );
  const totals = createEmptyStats();
  for (const stat of winner.stats || []) totals[stat.stat] = Number(stat.total || 0);
  profile.stats = totals;
  profile.breakdown.secondaryStats = totals;
  return profile;
}

function reachFor(profile, data, objective) {
  let best = null;
  for (let age = 1; age <= 11; age += 1) {
    for (let combat = 1; combat <= 20; combat += 1) {
      const levelRange = { age, combat, min: age, max: combat, difficulty: 0 };
      const result = evaluateProfileSnapshot(profile, data, objective, 60, { levelRange, model: BUILD_MODEL });
      const successCount = result.scenarios.filter((scenario) => scenario.success).length;
      if (successCount >= 2) {
        best = {
          ...levelRange,
          successCount,
          scenarioCount: result.scenarios.length,
          score: round(result.score, 6)
        };
      }
    }
  }
  return best;
}

function applyStatCounts(base, stats, counts) {
  const profile = structuredClone(base);
  const totals = createEmptyStats();
  for (const stat of stats) totals[stat.id] = Number(counts[stat.id] || 0) * Number(stat.max || 0);
  profile.stats = totals;
  profile.breakdown.secondaryStats = totals;
  return profile;
}

function itemCard(base, data) {
  const config = data.normalized.itemConfig;
  const level = config.maxLevel;
  const levelMultiplier = Math.pow(Number(config.levelScalingBase || 1.01), level - 1);
  const isRanged = base.slot === "Weapon" ? isRangedWeapon(base, data) : undefined;
  const meleeMultiplier = base.slot === "Weapon" && isRanged === false ? Number(config.meleeDamageMultiplier || 1) : 1;
  return {
    slot: base.slot,
    name: `${base.slot} ${base.age}:${base.idx}`,
    age: base.age,
    idx: base.idx,
    level,
    attack: Number(base.attack || 0) * levelMultiplier * meleeMultiplier,
    health: Number(base.health || 0) * levelMultiplier,
    isRanged,
    recognized: true
  };
}

function petCard(model, data) {
  const level = levelAt(data.normalized.petLevels, model.rarity, 100);
  const multiplier = model.type === "Damage"
    ? { attack: 1.5, health: 0.5 }
    : model.type === "Health"
      ? { attack: 0.5, health: 1.5 }
      : { attack: 1, health: 1 };
  return {
    name: model.name,
    rarity: model.rarity,
    id: model.id,
    type: model.type,
    level: 100,
    attack: Number(level?.attack || 0) * multiplier.attack,
    health: Number(level?.health || 0) * multiplier.health,
    recognized: true
  };
}

function mountCard(model, data) {
  const level = levelAt(data.normalized.mountLevels, model.rarity, 100);
  return {
    name: model.name,
    rarity: model.rarity,
    id: model.id,
    level: 100,
    attack: Number(level?.attack || 0),
    health: Number(level?.health || 0),
    recognized: true,
    skills: []
  };
}

function secondaryLineCount(equipment, pets, mount) {
  return equipment.reduce((total, item) => total + (item.age >= 7 ? 2 : 1), 0)
    + pets.reduce((total, pet) => total + (rarityRank(pet.rarity) >= rarityRank("Legendary") ? 2 : 1), 0)
    + (mount ? rarityRank(mount.rarity) >= rarityRank("Legendary") ? 2 : 1 : 0);
}

function summarizeStats(stats, counts) {
  return stats
    .filter((stat) => Number(counts[stat.id] || 0) > 0)
    .map((stat) => ({
      stat: stat.id,
      label: stat.label,
      count: Number(counts[stat.id] || 0),
      valuePerLine: round(stat.max, 4),
      total: round(Number(counts[stat.id] || 0) * Number(stat.max || 0), 4)
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function publicItem(item) {
  return {
    slot: item.slot,
    age: item.age,
    idx: item.idx,
    level: item.level,
    attack: round(item.attack, 4),
    health: round(item.health, 4),
    weaponStyle: item.slot === "Weapon" ? item.isRanged === false ? "melee" : "ranged" : undefined
  };
}

function publicCompanion(companion) {
  if (!companion) return null;
  return {
    name: companion.name,
    rarity: companion.rarity,
    id: companion.id,
    type: companion.type,
    level: companion.level,
    attack: round(companion.attack, 4),
    health: round(companion.health, 4)
  };
}

function frontierFor(job, data, options = {}) {
  const profile = buildProfile(
    job,
    data,
    SLOTS.map((slot) => itemChoices(slot, job.age, data, options).at(-1)),
    bestPetTriples(job.petRarity, data, Infinity, options.petMode).at(-1) || [],
    bestMountChoices(job.mountRarity, data).at(-1),
    bestSpellSets(job.spellRarity, data).at(-1) || []
  );
  let fallback;
  let frontier;
  for (let age = 1; age <= 11; age += 1) {
    for (let combat = 1; combat <= 20; combat += 1) {
      const levelRange = { age, combat, min: age, max: combat, difficulty: 0 };
      const result = evaluateProfileSnapshot(profile, data, "progress", 60, { levelRange, model: BUILD_MODEL });
      fallback ||= levelRange;
      if (result.scenarios.filter((scenario) => scenario.success).length >= 2) frontier = levelRange;
    }
  }
  return frontier || fallback || { age: 1, combat: 1, min: 1, max: 1, difficulty: 0 };
}

function smokeFrontier(job) {
  const age = Math.max(1, Number(job.age || 1));
  return { age, combat: 1, min: age, max: 1, difficulty: 0 };
}

function isRangedWeapon(base, data) {
  const directKey = `{'Age': ${base.age}, 'Type': 'Weapon', 'Idx': ${base.idx}}`;
  const weapon = data.raw["WeaponLibrary.json"]?.[directKey] || Object.values(data.raw["WeaponLibrary.json"] || {}).find((entry) =>
    Number(entry.ItemId?.Age) === Number(base.age) &&
    String(entry.ItemId?.Type || "") === "Weapon" &&
    Number(entry.ItemId?.Idx) === Number(base.idx)
  );
  if (!weapon) return base.isRanged !== false;
  return Number(weapon.AttackRange || 0) >= 1 || weapon.IsRanged === true;
}

function choose(values, size, visit, limit = Infinity) {
  const picked = [];
  let visited = 0;
  const walk = (start) => {
    if (visited >= limit) return;
    if (picked.length === size) {
      visited += 1;
      visit(picked.slice());
      return;
    }
    for (let index = start; index < values.length; index += 1) {
      picked.push(values[index]);
      walk(index + 1);
      picked.pop();
      if (visited >= limit) return;
    }
  };
  walk(0);
}

function pushTop(top, candidate, limit) {
  top.push(candidate);
  top.sort((left, right) => right.score - left.score);
  if (top.length > limit) top.pop();
}

function emptyWinner() {
  return { score: 0, stats: [], equipment: [], pets: [], mount: null, spells: [], scenarios: [] };
}

function mergeShardResults(data, results, options) {
  const groups = new Map();
  for (const result of results.values()) {
    const group = groups.get(result.key) || [];
    group.push(result);
    groups.set(result.key, group);
  }

  const merged = new Map();
  for (const [key, group] of groups.entries()) {
    if (!group.some((result) => result.shardCount > 1)) {
      merged.set(key, group.at(-1));
      continue;
    }
    const first = group[0];
    const top = group.flatMap((result) => result.top || [])
      .sort((left, right) => right.score - left.score)
      .slice(0, options.topN || TOP_N);
    const winner = top[0] || emptyWinner();
    const job = {
      key,
      age: first.access.equipmentAge,
      petRarity: first.access.petRarity,
      mountRarity: first.access.mountRarity,
      spellRarity: first.access.spellRarity,
      objective: first.objective
    };
    merged.set(key, {
      ...first,
      checkpointKey: key,
      shardIndex: undefined,
      shardCount: group.length,
      candidateCount: group.reduce((sum, result) => sum + Number(result.candidateCount || 0), 0),
      statAllocationCount: Math.max(...group.map((result) => Number(result.statAllocationCount || 0))),
      lineCount: winner.stats.reduce((sum, stat) => sum + stat.count, 0),
      winner,
      top,
      reach: !options.smoke && winner.equipment.length
        ? reachFor(profileFromWinner(job, data, winner), data, first.objective)
        : null
    });
  }
  return merged;
}

function buildOutput(data, results, options) {
  const cases = Object.fromEntries(Array.from(results.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, result]) => [key, compactCase(result)]));
  return {
    schema: "forge-master-exhaustive-bis-v1",
    gameDataVersion: data.normalized.version,
    sourceGeneratedAt: data.manifest.generatedAt,
    generatedAt: new Date().toISOString(),
    method: options.smoke
      ? "smoke-limited BIS optimizer path"
      : options.exhaustiveStats
        ? "canonical best accessible build per case, exhaustive secondary stat count vectors"
        : "canonical best accessible build per case, beam search plus local swaps for secondary stat count vectors",
    assumptions: {
      equipmentLevel: data.normalized.itemConfig.maxLevel,
      companionLevel: 100,
      spellLevel: 100,
      minimumEquipmentAge: MIN_EQUIPMENT_AGE,
      skippedAccess: SKIP_QUANTUM_LEGENDARY ? "equipment age Quantum+ with pet or mount Legendary+" : "none",
      buildCarrierSelection: "highest selected equipment age/rarity only; one canonical item per non-weapon slot, best melee/hybrid/ranged weapon variants, pet trio, mount and spell trio",
      weaponStyle: options.weaponStyle || WEAPON_STYLE,
      petSelection: options.petMode || PET_MODE,
      caseShards: CASE_SHARDS,
      talents: "none",
      secondaryValues: "maximum values from SecondaryStatLibrary.json",
      secondaryStatRules: options.statRules || STAT_RULES,
      secondaryPlacement: options.exhaustiveStats
        ? "collapsed by equivalent stat totals; counts are capped by carrier count"
        : `beam search width ${options.beamWidth || BEAM_WIDTH}, then one-line local swaps; counts are capped by carrier count`,
      objectives: OBJECTIVES
    },
    cases
  };
}

function compactCase(result) {
  const weapon = result.winner?.equipment?.find((item) => item.slot === "Weapon");
  return {
    objective: result.objective,
    access: result.access,
    frontier: result.frontier,
    reach: result.reach,
    lineCount: result.lineCount,
    candidateCount: result.candidateCount,
    statAllocationCount: result.statAllocationCount,
    shardCount: result.shardCount,
    exhaustive: result.exhaustive,
    winner: {
      weaponStyle: weapon?.weaponStyle,
      stats: result.winner?.stats || [],
      pets: result.winner?.pets || []
    }
  };
}

async function readCheckpoint(file) {
  const out = new Map();
  if (!existsSync(file)) return out;
  const text = await readFile(file, "utf8");
  for (let line of text.split(/\r?\n/)) {
    line = line.replace(/^\uFEFF/, "");
    if (!line.trim()) continue;
    const result = JSON.parse(line);
    out.set(result.checkpointKey || result.key, result);
  }
  return out;
}

async function appendCheckpoint(file, result) {
  await appendFile(file, `${JSON.stringify(result)}\n`);
}

function runWorker(jobs, options, onResult) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { jobs, options } });
    const pending = [];
    worker.on("message", (message) => {
      if (message?.type === "result") pending.push(onResult(message.result));
    });
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code) reject(new Error(`BIS worker exited with code ${code}`));
      else Promise.all(pending).then(resolve, reject);
    });
  });
}

function splitJobs(jobs, workerCount) {
  const size = Math.ceil(jobs.length / Math.max(1, workerCount));
  return Array.from({ length: workerCount }, (_, index) => jobs.slice(index * size, (index + 1) * size)).filter((chunk) => chunk.length);
}

function limited(values, limit = Infinity) {
  return Number.isFinite(limit) ? values.slice(0, limit) : values;
}

function caseKey(age, petRarity, mountRarity, spellRarity, objective) {
  return [age, petRarity, mountRarity, spellRarity, objective].join("|");
}

function skipAccessCase(age, petRarity, mountRarity) {
  if (!SKIP_QUANTUM_LEGENDARY) return false;
  return age >= QUANTUM_AGE && (
    rarityRank(petRarity) >= rarityRank(LEGENDARY_RARITY) ||
    rarityRank(mountRarity) >= rarityRank(LEGENDARY_RARITY)
  );
}

function rarityRank(rarity) {
  return RARITIES.indexOf(rarity);
}

function levelAt(groups, rarity, level) {
  return groups.find((group) => group.rarity === rarity)?.levels.find((entry) => entry.level === level);
}

function itemPower(item) {
  return Number(item.attack || 0) + Number(item.health || 0);
}

function petTypeRank(type) {
  if (type === "Damage") return 0;
  if (type === "Health") return 1;
  return 2;
}

function spellRank(spell) {
  if (spell.mechanics?.targetMode === "all") return 0;
  if (spell.mechanics?.kind === "damage") return 1;
  return 2;
}

function sum(values, key) {
  return values.reduce((total, value) => total + Number(value?.[key] || 0), 0);
}

function round(value, digits) {
  const multiplier = 10 ** digits;
  return Math.round(Number(value || 0) * multiplier) / multiplier;
}
