import { useEffect, useMemo, useRef, useState } from "react";

const PROFILE_VERSION = 5;
const LOCAL_DRAFT_KEY = "forge-master-profile-draft-v2";
const SERVER_AUTOSAVE_DELAY = 1600;
const MAX_SPELLS = 3;
const RARITIES = ["Common", "Rare", "Epic", "Legendary", "Ultimate", "Mythic"];

const STAT_DEFS = [
  { id: "damage", label: "Damage", max: 15, note: "all damage" },
  { id: "health", label: "Health", max: 15, note: "PV" },
  { id: "rangedDamage", label: "Ranged Damage", max: 15, note: "arme distance" },
  { id: "meleeDamage", label: "Melee Damage", max: 50, note: "arme melee" },
  { id: "skillDamage", label: "Skill Damage", max: 30, note: "sorts" },
  { id: "cooldown", label: "Skill Cooldown", max: 7, note: "recharge" },
  { id: "regen", label: "Health Regen", max: 4, note: "PV/s" },
  { id: "lifesteal", label: "Lifesteal", max: 20, note: "soin weapon" },
  { id: "attackSpeed", label: "Attack Speed", max: 40, note: "hits/s" },
  { id: "doubleChance", label: "Double Chance", max: 20, note: "cap utile 100%" },
  { id: "critChance", label: "Crit Chance", max: 12, note: "cap utile 100%" },
  { id: "critDamage", label: "Crit Damage", max: 80, note: "crit multiplier" },
  { id: "block", label: "Block", max: 5, note: "mitigation" }
];

const EQUIPMENT_SLOTS = [
  { id: "weapon", label: "Arme", main: "attack", talent: "WeaponBonus" },
  { id: "helmet", label: "Casque", main: "defense", talent: "HelmetBonus" },
  { id: "gloves", label: "Gants", main: "attack", talent: "GloveBonus" },
  { id: "armor", label: "Armure", main: "defense", talent: "BodyBonus" },
  { id: "necklace", label: "Collier", main: "attack", talent: "NecklaceBonus" },
  { id: "boots", label: "Bottes", main: "defense", talent: "ShoeBonus" },
  { id: "ring", label: "Anneau", main: "attack", talent: "RingBonus" },
  { id: "belt", label: "Ceinture", main: "defense", talent: "BeltBonus" }
];

const ITEM_TYPE_TO_SLOT = {
  weapon: "weapon",
  sword: "weapon",
  bow: "weapon",
  helmet: "helmet",
  helm: "helmet",
  glove: "gloves",
  gloves: "gloves",
  body: "armor",
  armor: "armor",
  chest: "armor",
  necklace: "necklace",
  amulet: "necklace",
  shoe: "boots",
  shoes: "boots",
  boots: "boots",
  ring: "ring",
  belt: "belt",
  0: "helmet",
  1: "armor",
  2: "gloves",
  3: "necklace",
  4: "ring",
  5: "weapon",
  6: "boots",
  7: "belt"
};

const PET_SLOTS = [
  { id: "pet1", label: "Pet 1" },
  { id: "pet2", label: "Pet 2" },
  { id: "pet3", label: "Pet 3" }
];

const SPELLS = [
  { id: "Meat", name: "Meat", rarity: "Common", cooldown: 8, damage1: 0, damage100: 0, health1: 100, health100: 250 },
  { id: "Arrows", name: "Arrows", rarity: "Common", cooldown: 7, damage1: 200, damage100: 500, health1: 0, health100: 0 },
  { id: "Shout", name: "Shout", rarity: "Common", cooldown: 6, damage1: 150, damage100: 375, health1: 0, health100: 0 },
  { id: "Berserk", name: "Berserk", rarity: "Rare", cooldown: 8, damage1: 1280, damage100: 3200, health1: 0, health100: 0 },
  { id: "Shuriken", name: "Shuriken", rarity: "Rare", cooldown: 4, damage1: 1280, damage100: 3200, health1: 0, health100: 0 },
  { id: "CannonBarrage", name: "Cannon Barrage", rarity: "Rare", cooldown: 5, damage1: 1280, damage100: 3200, health1: 0, health100: 0 },
  { id: "Buff", name: "Buff", rarity: "Epic", cooldown: 8, damage1: 13500, damage100: 33756, health1: 108000, health100: 270042 },
  { id: "RainOfArrows", name: "Rain Of Arrows", rarity: "Epic", cooldown: 10, damage1: 135000, damage100: 337552, health1: 0, health100: 0 },
  { id: "Thorns", name: "Thorns", rarity: "Epic", cooldown: 5, damage1: 27648, damage100: 69132, health1: 0, health100: 0 },
  { id: "Morale", name: "Morale", rarity: "Legendary", cooldown: 8, damage1: 150000, damage100: 401707, health1: 1200000, health100: 3213656 },
  { id: "Bomb", name: "Bomb", rarity: "Legendary", cooldown: 6, damage1: 1200000, damage100: 2913449, health1: 0, health100: 0 },
  { id: "Meteorite", name: "Meteorite", rarity: "Legendary", cooldown: 9, damage1: 2000000, damage100: 4855742, health1: 0, health100: 0 },
  { id: "Stampede", name: "Stampede", rarity: "Ultimate", cooldown: 20, damage1: 4000000, damage100: 9711477, health1: 0, health100: 0 },
  { id: "Worm", name: "Worm", rarity: "Ultimate", cooldown: 8, damage1: 8000000, damage100: 19422964, health1: 0, health100: 0 },
  { id: "Lightning", name: "Lightning", rarity: "Ultimate", cooldown: 3, damage1: 4000000, damage100: 9711477, health1: 0, health100: 0 },
  { id: "HigherMorale", name: "Higher Morale", rarity: "Mythic", cooldown: 8, damage1: 8000000, damage100: 19422964, health1: 64000000, health100: 155383712 },
  { id: "StrafeRun", name: "Strafe Run", rarity: "Mythic", cooldown: 10, damage1: 26000000, damage100: 63124624, health1: 0, health100: 0 },
  { id: "Drone", name: "Drone", rarity: "Mythic", cooldown: 8, damage1: 30000000, damage100: 72836106, health1: 0, health100: 0 }
];

const FM_STAT_MAP = {
  CriticalChance: "critChance",
  CriticalMulti: "critDamage",
  BlockChance: "block",
  HealthRegen: "regen",
  LifeSteal: "lifesteal",
  DoubleDamageChance: "doubleChance",
  DamageMulti: "damage",
  MeleeDamageMulti: "meleeDamage",
  RangedDamageMulti: "rangedDamage",
  AttackSpeed: "attackSpeed",
  SkillDamageMulti: "skillDamage",
  SkillCooldownMulti: "cooldown",
  HealthMulti: "health"
};

const HARD_CAPS = { doubleChance: 100, critChance: 100, block: 100, cooldown: 80 };
const TECH_TREE_MAX_LEVEL = 5;
const SECONDARY_LINES_PER_OBJECT = 2;
const EQUIPMENT_OPTIMIZER_LINES = EQUIPMENT_SLOTS.length * SECONDARY_LINES_PER_OBJECT;
const TECH_TREE_NAMES = { Power: "Power", SkillsPetTech: "Skills/Pets" };
const TECH_TREE_TYPES = {
  Power: [
    "WeaponBonus", "HelmetBonus", "GloveBonus", "BodyBonus", "NecklaceBonus", "ShoeBonus", "RingBonus", "BeltBonus", "MountDamage", "MountHealth",
    "WeaponLevelUp", "HelmetLevelUp", "GloveLevelUp", "BodyLevelUp", "NecklaceLevelUp", "ShoeLevelUp", "RingLevelUp", "BeltLevelUp", "MountSummonCost", "ExtraMountChance"
  ],
  SkillsPetTech: [
    "TechResearchTimer", "SkillDamage", "SkillPassiveDamage", "SkillPassiveHealth", "TechNodeUpgradeCost", "PetBonusDamage", "PetBonusHealth", "SkillSummonCost",
    "CommonEggTimer", "RareEggTimer", "EpicEggTimer", "LegendaryEggTimer", "UltimateEggTimer", "MythicEggTimer", "ExtraEggChance", "GhostTownSkillBonus", "ZombieRushTechPotions"
  ]
};
const TECH_TREE_REQS = {
  Power: [[], [], [0], [1], [2], [3], [4], [5], [6, 7], [8], [9], [9], [10], [11], [12], [13], [14], [15], [16, 17], [18]],
  SkillsPetTech: [[], [0], [1], [1], [2, 3], [4], [4], [5, 6], [7], [7], [8], [9], [10], [11], [12, 13], [14], [14]]
};
const TECH_TREE_LABELS = {
  WeaponBonus: "Arme", HelmetBonus: "Casque", GloveBonus: "Gants", BodyBonus: "Armure", NecklaceBonus: "Collier", ShoeBonus: "Bottes", RingBonus: "Anneau", BeltBonus: "Ceinture",
  MountDamage: "Monture degats", MountHealth: "Monture PV", WeaponLevelUp: "Niveau arme", HelmetLevelUp: "Niveau casque", GloveLevelUp: "Niveau gants", BodyLevelUp: "Niveau armure",
  NecklaceLevelUp: "Niveau collier", ShoeLevelUp: "Niveau bottes", RingLevelUp: "Niveau anneau", BeltLevelUp: "Niveau ceinture", MountSummonCost: "Cout monture", ExtraMountChance: "Chance monture",
  TechResearchTimer: "Recherche", SkillDamage: "Sorts actifs", SkillPassiveDamage: "Passifs degats", SkillPassiveHealth: "Passifs PV", TechNodeUpgradeCost: "Cout talent",
  PetBonusDamage: "Pets degats", PetBonusHealth: "Pets PV", SkillSummonCost: "Cout sort", CommonEggTimer: "Oeuf common", RareEggTimer: "Oeuf rare", EpicEggTimer: "Oeuf epic",
  LegendaryEggTimer: "Oeuf legendary", UltimateEggTimer: "Oeuf ultimate", MythicEggTimer: "Oeuf mythic", ExtraEggChance: "Chance oeuf", GhostTownSkillBonus: "Ghost Town", ZombieRushTechPotions: "Potions"
};
const TECH_TREE_BONUSES = {
  SkillDamage: { skillDamage: 2 },
  SkillPassiveDamage: { skillDamage: 2 },
  SkillPassiveHealth: { health: 2 }
};

function buildTechTreeData() {
  const result = {};
  for (const [treeName, types] of Object.entries(TECH_TREE_TYPES)) {
    result[treeName] = [];
    for (let tier = 0; tier < 5; tier += 1) {
      for (let index = 0; index < types.length; index += 1) {
        const id = tier * types.length + index;
        let requirements = TECH_TREE_REQS[treeName][index].map((req) => tier * types.length + req);
        if (tier > 0 && treeName === "Power" && index <= 1) requirements = [tier * types.length - 1];
        if (tier > 0 && treeName === "SkillsPetTech" && index === 0) requirements = [id - 2, id - 1];
        result[treeName].push({
          id,
          tier,
          layer: id,
          type: types[index],
          label: TECH_TREE_LABELS[types[index]] || types[index],
          requirements
        });
      }
    }
  }
  return result;
}
const TECH_TREE_DATA = buildTechTreeData();

const blankStats = () => Object.fromEntries(STAT_DEFS.map((stat) => [stat.id, 0]));
const blankTree = () => ({ Power: {}, SkillsPetTech: {} });
const blankLines = () => Array.from({ length: SECONDARY_LINES_PER_OBJECT }, () => ({ stat: "", value: 0 }));
const blankEquipment = () =>
  Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [
      slot.id,
      { name: slot.label, attack: 0, defense: 0, secondaryStats: blankLines() }
    ])
  );
const blankPets = () =>
  PET_SLOTS.map((slot) => ({
    id: slot.id,
    name: slot.label,
    attack: 0,
    defense: 0,
    secondaryStats: blankLines()
  }));
const blankMount = () => ({ name: "Monture", attack: 0, defense: 0, secondaryStats: blankLines() });
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const format = (value, digits = 0) => Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const formatSigned = (value, digits = 1) => `${value >= 0 ? "+" : ""}${format(value || 0, digits)}`;
const activeValue = (stats, id) => (HARD_CAPS[id] ? Math.min(stats[id] || 0, HARD_CAPS[id]) : stats[id] || 0);
const sumStats = (...sources) => {
  const stats = blankStats();
  for (const source of sources) for (const stat of STAT_DEFS) stats[stat.id] += number(source?.[stat.id]);
  return stats;
};

function normalizeTree(source = {}) {
  const tree = blankTree();
  for (const treeName of Object.keys(tree)) {
    for (const node of TECH_TREE_DATA[treeName]) {
      const level = clamp(Math.round(number(source?.[treeName]?.[node.id])), 0, TECH_TREE_MAX_LEVEL);
      if (level > 0) tree[treeName][node.id] = level;
    }
  }
  return tree;
}

function computeTalentStats(tree) {
  const stats = blankStats();
  const normalized = normalizeTree(tree);
  for (const [treeName, nodes] of Object.entries(normalized)) {
    for (const [nodeId, level] of Object.entries(nodes)) {
      const node = TECH_TREE_DATA[treeName].find((entry) => entry.id === Number(nodeId));
      const bonuses = TECH_TREE_BONUSES[node?.type];
      if (!bonuses) continue;
      for (const [statId, perLevel] of Object.entries(bonuses)) stats[statId] += perLevel * level;
    }
  }
  return stats;
}

function computeTalentEffects(tree) {
  const effects = {
    globalStats: computeTalentStats(tree),
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot.id, { attackPct: 0, defensePct: 0 }])),
    pets: { attackPct: 0, defensePct: 0 },
    mount: { attackPct: 0, defensePct: 0 }
  };
  const normalized = normalizeTree(tree);

  for (const [treeName, nodes] of Object.entries(normalized)) {
    for (const [nodeId, level] of Object.entries(nodes)) {
      const node = TECH_TREE_DATA[treeName].find((entry) => entry.id === Number(nodeId));
      if (!node) continue;

      const slot = EQUIPMENT_SLOTS.find((entry) => entry.talent === node.type);
      if (slot) {
        const key = slot.main === "attack" ? "attackPct" : "defensePct";
        effects.equipment[slot.id][key] += 2 * level;
      }

      if (node.type === "PetBonusDamage") effects.pets.attackPct += 2 * level;
      if (node.type === "PetBonusHealth") effects.pets.defensePct += 2 * level;
      if (node.type === "MountDamage") effects.mount.attackPct += 2 * level;
      if (node.type === "MountHealth") effects.mount.defensePct += 2 * level;
    }
  }

  return effects;
}

function lineStats(lines = []) {
  const stats = blankStats();
  for (const line of lines || []) {
    if (!line?.stat) continue;
    stats[line.stat] += number(line.value);
  }
  return stats;
}

function collectionSecondaryStats(collection) {
  const stats = blankStats();
  const entries = Array.isArray(collection) ? collection : Object.values(collection || {});
  for (const item of entries) {
    const itemStats = lineStats(item?.secondaryStats);
    for (const stat of STAT_DEFS) stats[stat.id] += itemStats[stat.id] || 0;
  }
  return stats;
}

function baseFromObjects(equipment, pets, mount, talentEffects) {
  let attack = 0;
  let defense = 0;

  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipment?.[slot.id] || {};
    const effect = talentEffects.equipment[slot.id] || {};
    attack += number(item.attack) * (1 + number(effect.attackPct) / 100);
    defense += number(item.defense) * (1 + number(effect.defensePct) / 100);
  }

  for (const pet of pets || []) {
    attack += number(pet.attack) * (1 + talentEffects.pets.attackPct / 100);
    defense += number(pet.defense) * (1 + talentEffects.pets.defensePct / 100);
  }

  attack += number(mount?.attack) * (1 + talentEffects.mount.attackPct / 100);
  defense += number(mount?.defense) * (1 + talentEffects.mount.defensePct / 100);

  return { attack, defense };
}

function canUpgradeTalent(tree, treeName, node) {
  const current = number(tree?.[treeName]?.[node.id]);
  if (current >= TECH_TREE_MAX_LEVEL) return false;
  return node.requirements.every((id) => number(tree?.[treeName]?.[id]) > 0);
}

function pruneTree(tree) {
  const next = normalizeTree(tree);
  let changed = true;
  while (changed) {
    changed = false;
    for (const treeName of Object.keys(next)) {
      for (const node of TECH_TREE_DATA[treeName]) {
        if (!next[treeName][node.id]) continue;
        if (!node.requirements.every((id) => number(next[treeName][id]) > 0)) {
          delete next[treeName][node.id];
          changed = true;
        }
      }
    }
  }
  return next;
}

function interpolate(start, end, level) {
  return start + (end - start) * clamp((level - 1) / 99, 0, 1);
}

function spellContribution(selected, stats) {
  const globalDamage = 1 + activeValue(stats, "damage") / 100;
  const skillPower = globalDamage * (1 + activeValue(stats, "skillDamage") / 100);
  const cooldownReduction = activeValue(stats, "cooldown") / 100;
  let damagePerSecond = 0;
  let supportPerSecond = 0;
  for (const entry of selected) {
    const spell = SPELLS.find((item) => item.id === entry.id);
    if (!spell) continue;
    const level = clamp(Math.round(number(entry.level) || 1), 1, 100);
    const cooldown = spell.cooldown * Math.max(0.2, 1 - cooldownReduction);
    damagePerSecond += (interpolate(spell.damage1, spell.damage100, level) * skillPower) / cooldown;
    supportPerSecond += (interpolate(spell.health1, spell.health100, level) * skillPower) / cooldown;
  }
  return { damagePerSecond, supportPerSecond };
}

function combatProfile(stats, config, side = "player") {
  const baseDamage = side === "enemy" ? config.enemyBaseDamage : config.baseDamage;
  const baseHealth = side === "enemy" ? config.enemyBaseHealth : config.baseHealth;
  const weapon = side === "enemy" ? config.enemyWeapon : config.weapon;
  const spells = side === "enemy" ? config.enemySpells : config.playerSpells;
  const globalDamage = 1 + activeValue(stats, "damage") / 100;
  const weaponSpecific = weapon === "ranged" ? 1 + activeValue(stats, "rangedDamage") / 100 : 1 + activeValue(stats, "meleeDamage") / 100;
  const attackSpeed = 1 + activeValue(stats, "attackSpeed") / 100;
  const doubleHit = 1 + activeValue(stats, "doubleChance") / 100;
  const critChance = activeValue(stats, "critChance") / 100;
  const critMultiplier = 1.2 + activeValue(stats, "critDamage") / 100;
  const weaponDps = baseDamage * globalDamage * weaponSpecific * attackSpeed * doubleHit * (1 + critChance * (critMultiplier - 1));
  const skill = spellContribution(spells, stats);
  const maxHealth = baseHealth * (1 + activeValue(stats, "health") / 100);
  const healingHps = maxHealth * (activeValue(stats, "regen") / 100) + weaponDps * (activeValue(stats, "lifesteal") / 100) + skill.supportPerSecond;
  return {
    weaponDps,
    skillDps: skill.damagePerSecond,
    totalDps: weaponDps + skill.damagePerSecond,
    maxHealth,
    block: activeValue(stats, "block") / 100,
    healingHps,
    skillShieldHps: skill.supportPerSecond,
    sustainWindow: maxHealth + healingHps * config.fightDuration
  };
}

function pveScore(profile, objective) {
  const damageScore = Math.log1p(profile.totalDps);
  const sustainScore = Math.log1p(profile.sustainWindow);
  const skillScore = Math.log1p(profile.skillDps + profile.skillShieldHps);
  if (objective === "damage") return damageScore + sustainScore * 0.08 + skillScore * 0.04;
  if (objective === "survival") return sustainScore + damageScore * 0.15 + skillScore * 0.04;
  return damageScore * 0.58 + sustainScore * 0.34 + skillScore * 0.08;
}

function simulatePvP(playerStats, config) {
  const player = combatProfile(playerStats, config, "player");
  const enemy = combatProfile(config.enemyStats || blankStats(), config, "enemy");
  const damageToEnemy = player.totalDps * Math.max(0.05, 1 - enemy.block);
  const damageToPlayer = enemy.totalDps * Math.max(0.05, 1 - player.block);
  const netToEnemy = damageToEnemy - enemy.healingHps;
  const netToPlayer = damageToPlayer - player.healingHps;
  const timeToWin = netToEnemy <= 0 ? Infinity : enemy.maxHealth / netToEnemy;
  const timeToLose = netToPlayer <= 0 ? Infinity : player.maxHealth / netToPlayer;
  const powerDiff =
    Math.log1p(player.totalDps) * 0.56 + Math.log1p(player.sustainWindow) * 0.34 + Math.log1p(player.skillDps + player.skillShieldHps) * 0.1 -
    (Math.log1p(enemy.totalDps) * 0.56 + Math.log1p(enemy.sustainWindow) * 0.34 + Math.log1p(enemy.skillDps + enemy.skillShieldHps) * 0.1);
  let chance;
  if (!Number.isFinite(timeToWin) && !Number.isFinite(timeToLose)) chance = 50 + clamp(powerDiff * 8, -35, 35);
  else if (!Number.isFinite(timeToWin)) chance = clamp(10 + powerDiff * 4, 1, 35);
  else if (!Number.isFinite(timeToLose)) chance = clamp(90 + powerDiff * 4, 65, 99);
  else chance = 50 + ((timeToLose - timeToWin) / Math.max(timeToWin, timeToLose)) * 45 + powerDiff * 3;
  return { player, enemy, timeToWin, timeToLose, chance: clamp(chance, 1, 99), advantage: clamp(chance, 1, 99) - 50 };
}

const usesPvp = (objective) => objective === "pvp" || objective === "balanced";
function scoreBuild(stats, config, objective = config.objective) {
  if (objective === "pvp") return simulatePvP(stats, config).chance / 10;
  if (objective === "balanced") return pveScore(combatProfile(stats, config, "player"), "progress") * 0.55 + (simulatePvP(stats, config).chance / 10) * 0.45;
  return pveScore(combatProfile(stats, config, "player"), objective);
}

function marginalGains(stats, config) {
  const baseScore = scoreBuild(stats, config);
  const baseChance = usesPvp(config.objective) ? simulatePvP(stats, config).chance : null;
  return STAT_DEFS.map((stat) => {
    const next = { ...stats, [stat.id]: (stats[stat.id] || 0) + stat.max };
    const score = scoreBuild(next, config);
    const nextChance = usesPvp(config.objective) ? simulatePvP(next, config).chance : null;
    return { ...stat, add: stat.max, gain: score - baseScore, chanceDelta: nextChance === null ? null : nextChance - baseChance };
  }).sort((a, b) => b.gain - a.gain);
}

function tradeSuggestions(stats, config) {
  const baseScore = scoreBuild(stats, config);
  const baseChance = usesPvp(config.objective) ? simulatePvP(stats, config).chance : null;
  const trades = [];
  for (const down of STAT_DEFS) {
    if ((stats[down.id] || 0) <= 0) continue;
    for (const up of STAT_DEFS) {
      if (up.id === down.id) continue;
      const next = { ...stats, [down.id]: Math.max(0, (stats[down.id] || 0) - down.max), [up.id]: (stats[up.id] || 0) + up.max };
      const score = scoreBuild(next, config);
      const nextChance = usesPvp(config.objective) ? simulatePvP(next, config).chance : null;
      trades.push({ down, up, gain: score - baseScore, chanceDelta: nextChance === null ? null : nextChance - baseChance });
    }
  }
  return trades.filter((trade) => trade.gain > 0.001).sort((a, b) => b.gain - a.gain);
}

function optimizeBuild(config, fixedStats) {
  let beam = [{ stats: blankStats(), counts: {}, score: scoreBuild(fixedStats, config) }];
  for (let roll = 0; roll < config.rolls; roll += 1) {
    const expanded = new Map();
    for (const item of beam) {
      for (const stat of STAT_DEFS) {
        const nextStats = { ...item.stats, [stat.id]: (item.stats[stat.id] || 0) + stat.max };
        const nextCounts = { ...item.counts, [stat.id]: (item.counts[stat.id] || 0) + 1 };
        const key = STAT_DEFS.map((def) => nextCounts[def.id] || 0).join("|");
        const score = scoreBuild(sumStats(fixedStats, nextStats), config);
        if (!expanded.has(key) || expanded.get(key).score < score) expanded.set(key, { stats: nextStats, counts: nextCounts, score });
      }
    }
    beam = [...expanded.values()].sort((a, b) => b.score - a.score).slice(0, 650);
  }
  return beam[0] || { stats: blankStats(), counts: {} };
}

function importProfileJson(profile) {
  if (!profile || typeof profile !== "object" || !profile.items || !profile.skills) throw new Error("JSON non reconnu.");
  const itemStats = blankStats();
  const petStats = blankStats();
  const mountStats = blankStats();
  const equipment = blankEquipment();
  const pets = blankPets();
  const mount = blankMount();
  const unknown = new Set();
  const readSecondaryLines = (source) => {
    const lines = [];
    for (const entry of Array.isArray(source?.secondaryStats) ? source.secondaryStats : []) {
      const sourceId = entry.statId || entry.Stat || entry.stat || entry.id;
      const targetId = FM_STAT_MAP[sourceId] || FM_STAT_MAP[String(sourceId || "").replace(/\s+/g, "")];
      const rawValue = number(entry.value ?? entry.Value ?? entry.statValue);
      if (!targetId) {
        if (sourceId) unknown.add(String(sourceId));
        continue;
      }
      lines.push({ stat: targetId, value: Math.abs(rawValue) <= 1 ? rawValue * 100 : rawValue });
    }
    return lines.slice(0, SECONDARY_LINES_PER_OBJECT);
  };
  const addSecondary = (target, source) => {
    for (const line of readSecondaryLines(source)) target[line.stat] += line.value;
  };
  const addLines = (target, lines) => {
    for (const line of lines) target[line.stat] += line.value;
  };
  for (const [key, item] of Object.entries(profile.items || {})) {
    if (!item) continue;
    const secondaryLines = readSecondaryLines(item);
    const slotId = detectSlot(key, item);
    if (!slotId) {
      addLines(itemStats, secondaryLines);
      continue;
    }
    equipment[slotId] = {
      ...equipment[slotId],
      name: item.name || item.id || equipment[slotId].name,
      attack: readMainValue(item, "attack"),
      defense: readMainValue(item, "defense"),
      secondaryStats: padLines(secondaryLines)
    };
  }
  for (const [index, pet] of (profile.pets?.active || []).entries()) {
    const secondaryLines = readSecondaryLines(pet);
    if (pets[index]) {
      pets[index] = {
        ...pets[index],
        name: pet.name || pet.id || pets[index].name,
        attack: readMainValue(pet, "attack"),
        defense: readMainValue(pet, "defense"),
        secondaryStats: padLines(secondaryLines)
      };
    } else {
      addLines(petStats, secondaryLines);
    }
  }
  if (profile.mount?.active) {
    const secondaryLines = readSecondaryLines(profile.mount.active);
    mount.name = profile.mount.active.name || profile.mount.active.id || mount.name;
    mount.attack = readMainValue(profile.mount.active, "attack");
    mount.defense = readMainValue(profile.mount.active, "defense");
    mount.secondaryStats = padLines(secondaryLines);
  }
  const talentTree = blankTree();
  let talentNodes = 0;
  for (const [treeName, nodes] of Object.entries(profile.techTree || {})) {
    if (!talentTree[treeName]) continue;
    for (const [nodeId, rawLevel] of Object.entries(nodes || {})) {
      const level = clamp(Math.round(number(rawLevel)), 0, TECH_TREE_MAX_LEVEL);
      if (level > 0) {
        talentTree[treeName][nodeId] = level;
        talentNodes += 1;
      }
    }
  }
  const spells = (profile.skills?.equipped || [])
    .filter((skill) => SPELLS.some((spell) => spell.id === skill.id))
    .slice(0, MAX_SPELLS)
    .map((skill) => ({ id: skill.id, level: clamp(Math.round(number(skill.level) || 1), 1, 100) }));
  return { itemStats, petStats, mountStats, equipment, pets, mount, talentTree: normalizeTree(talentTree), spells, forgeLevel: profile.misc?.forgeLevel, unknown: [...unknown], talentNodes };
}

function detectSlot(key, item) {
  const candidates = [
    key,
    item?.slot,
    item?.Slot,
    item?.type,
    item?.Type,
    item?.itemType,
    item?.ItemType,
    item?.equipmentType,
    item?.EquipmentType,
    item?.id
  ];
  for (const candidate of candidates) {
    const normalized = String(candidate ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (ITEM_TYPE_TO_SLOT[normalized]) return ITEM_TYPE_TO_SLOT[normalized];
  }
  return null;
}

function readMainValue(source, kind) {
  const keys =
    kind === "attack"
      ? ["attack", "Attack", "damage", "Damage", "baseAttack", "BaseAttack", "attackValue", "AttackValue", "power", "Power"]
      : ["defense", "Defense", "health", "Health", "hp", "HP", "baseDefense", "BaseDefense", "defenseValue", "DefenseValue"];
  for (const key of keys) {
    if (source?.[key] !== undefined) return number(source[key]);
  }
  return 0;
}

function padLines(lines = []) {
  const padded = lines.slice(0, SECONDARY_LINES_PER_OBJECT);
  while (padded.length < SECONDARY_LINES_PER_OBJECT) padded.push({ stat: "", value: 0 });
  return padded;
}

function StatGrid({ title, stats, onChange, onClear }) {
  return (
    <section className="stat-section">
      <div className="panel-heading">
        <h2>{title}</h2>
        {onClear && <button className="small-button" type="button" onClick={onClear}>Effacer</button>}
      </div>
      <div className="stats-grid">
        {STAT_DEFS.map((stat) => (
          <label className="stat-card" key={stat.id}>
            <span className="stat-title">
              <strong>{stat.label}</strong>
              <span>max ligne {stat.max}% - {stat.note}</span>
            </span>
            <input type="number" min="0" step="0.01" value={stats[stat.id] ?? 0} onChange={(event) => onChange(stat.id, number(event.target.value))} />
          </label>
        ))}
      </div>
    </section>
  );
}

function EquipmentPanel({ equipment, effects, onItemChange, onLineChange }) {
  return (
    <section className="object-panel">
      <div className="panel-heading">
        <h2>Objets equipes</h2>
        <span className="mini-pill">par slot</span>
      </div>
      <div className="object-grid">
        {EQUIPMENT_SLOTS.map((slot) => (
          <ObjectCard
            key={slot.id}
            title={slot.label}
            main={slot.main}
            item={equipment[slot.id]}
            effect={effects[slot.id]}
            onChange={(patch) => onItemChange(slot.id, patch)}
            onLineChange={(index, patch) => onLineChange(slot.id, index, patch)}
          />
        ))}
      </div>
    </section>
  );
}

function PetPanel({ pets, effects, onPetChange, onLineChange }) {
  return (
    <div className="object-grid pet-object-grid">
      {pets.map((pet, index) => (
        <ObjectCard
          key={pet.id || index}
          title={PET_SLOTS[index]?.label || `Pet ${index + 1}`}
          main="both"
          defenseLabel="Sante"
          item={pet}
          effect={{ attackPct: effects.attackPct, defensePct: effects.defensePct }}
          onChange={(patch) => onPetChange(index, patch)}
          onLineChange={(lineIndex, patch) => onLineChange(index, lineIndex, patch)}
        />
      ))}
    </div>
  );
}

function MountPanel({ mount, effects, onMountChange, onLineChange }) {
  return (
    <div className="object-grid single-object-grid">
      <ObjectCard
        title="Monture"
        main="both"
        defenseLabel="Sante"
        item={mount}
        effect={{ attackPct: effects.attackPct, defensePct: effects.defensePct }}
        onChange={onMountChange}
        onLineChange={onLineChange}
      />
    </div>
  );
}

function ObjectCard({ title, main, item, effect = {}, defenseLabel = "Defense", onChange, onLineChange }) {
  const attackBonus = number(item.attack) * number(effect.attackPct) / 100;
  const defenseBonus = number(item.defense) * number(effect.defensePct) / 100;
  return (
    <article className="object-card">
      <div className="object-card-head">
        <strong>{title}</strong>
        {(attackBonus > 0 || defenseBonus > 0) && (
          <span className="mini-pill">talent +{format(attackBonus + defenseBonus)}</span>
        )}
      </div>
      <label className="field compact-field">
        <span>Nom</span>
        <input value={item.name || ""} onChange={(event) => onChange({ name: event.target.value })} />
      </label>
      <div className="object-main-grid">
        {(main === "attack" || main === "both") && (
          <label className="field compact-field">
            <span>Attaque</span>
            <input type="number" min="0" value={item.attack || 0} onChange={(event) => onChange({ attack: number(event.target.value) })} />
          </label>
        )}
        {(main === "defense" || main === "both") && (
          <label className="field compact-field">
            <span>{defenseLabel}</span>
            <input type="number" min="0" value={item.defense || 0} onChange={(event) => onChange({ defense: number(event.target.value) })} />
          </label>
        )}
      </div>
      <div className="secondary-lines">
        {normalizeLines(item.secondaryStats).map((line, index) => (
          <div className="secondary-line" key={index}>
            <select value={line.stat} onChange={(event) => onLineChange(index, { stat: event.target.value })}>
              <option value="">Stat secondaire</option>
              {STAT_DEFS.map((stat) => <option key={stat.id} value={stat.id}>{stat.label}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={line.value || 0} onChange={(event) => onLineChange(index, { value: number(event.target.value) })} />
          </div>
        ))}
      </div>
    </article>
  );
}

function SpellPicker({ title, side, selected, onChange }) {
  const selectedIds = new Set(selected.map((spell) => spell.id));
  const updateSpell = (spellId, checked) => {
    if (checked && selected.length >= MAX_SPELLS) return;
    onChange(checked ? [...selected, { id: spellId, level: 1 }] : selected.filter((spell) => spell.id !== spellId));
  };
  const updateLevel = (spellId, level) => onChange(selected.map((spell) => (spell.id === spellId ? { ...spell, level: clamp(Math.round(number(level) || 1), 1, 100) } : spell)));
  return (
    <section className="spell-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <span className="mini-pill">{selected.length}/3</span>
      </div>
      <div className="spell-list">
        {RARITIES.map((rarity) => (
          <section className="spell-rarity" key={`${side}-${rarity}`}>
            <h3>{rarity}</h3>
            <div className="spell-grid">
              {SPELLS.filter((spell) => spell.rarity === rarity).map((spell) => (
                <article className="spell-card" key={`${side}-${spell.id}`}>
                  <label className="spell-check">
                    <input type="checkbox" checked={selectedIds.has(spell.id)} onChange={(event) => updateSpell(spell.id, event.target.checked)} />
                    <span>
                      <strong>{spell.name}</strong>
                      <small>{format(spell.damage1)}-{format(spell.damage100)} dmg | {format(spell.health1)}-{format(spell.health100)} PV | {spell.cooldown}s</small>
                    </span>
                  </label>
                  <label className="level-field">
                    <span>Niv.</span>
                    <input type="number" min="1" max="100" value={selected.find((entry) => entry.id === spell.id)?.level || 1} onChange={(event) => updateLevel(spell.id, event.target.value)} disabled={!selectedIds.has(spell.id)} />
                  </label>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("profile");
  const [activeTree, setActiveTree] = useState("Power");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [lastCounts, setLastCounts] = useState({});
  const saveTimer = useRef(null);

  const [profile, setProfile] = useState(() => ({
    version: PROFILE_VERSION,
    savedAt: Date.now(),
    config: { objective: "progress", baseDamage: "1000", baseHealth: "8000", fightDuration: "60", enemyBaseDamage: "1000", enemyBaseHealth: "8000", forgeLevel: "21", dropSlot: "weapon", dropName: "Nouveau drop", dropAttack: "0", dropDefense: "0", dropLine1Stat: "damage", dropLine1Value: "0", dropLine2Stat: "", dropLine2Value: "0" },
    weapon: "ranged",
    enemyWeapon: "ranged",
    equipment: blankEquipment(),
    pets: blankPets(),
    mount: blankMount(),
    stats: blankStats(),
    petStats: blankStats(),
    mountStats: blankStats(),
    talentTree: blankTree(),
    enemyStats: blankStats(),
    enemyPetStats: blankStats(),
    enemyMountStats: blankStats(),
    playerSpells: [],
    enemySpells: []
  }));

  const talentEffects = useMemo(() => computeTalentEffects(profile.talentTree), [profile.talentTree]);
  const objectBase = useMemo(() => baseFromObjects(profile.equipment, profile.pets, profile.mount, talentEffects), [profile.equipment, profile.pets, profile.mount, talentEffects]);
  const objectStats = useMemo(() => sumStats(collectionSecondaryStats(profile.equipment), collectionSecondaryStats(profile.pets), lineStats(profile.mount?.secondaryStats)), [profile.equipment, profile.pets, profile.mount]);
  const config = useMemo(() => ({
    baseDamage: Math.max(1, number(profile.config.baseDamage) + objectBase.attack),
    baseHealth: Math.max(1, number(profile.config.baseHealth) + objectBase.defense),
    fightDuration: clamp(number(profile.config.fightDuration), 5, 600),
    enemyBaseDamage: Math.max(1, number(profile.config.enemyBaseDamage)),
    enemyBaseHealth: Math.max(1, number(profile.config.enemyBaseHealth)),
    rolls: EQUIPMENT_OPTIMIZER_LINES,
    objective: profile.config.objective,
    weapon: profile.weapon,
    enemyWeapon: profile.enemyWeapon,
    playerSpells: profile.playerSpells,
    enemySpells: profile.enemySpells,
    enemyStats: sumStats(profile.enemyStats, profile.enemyPetStats, profile.enemyMountStats)
  }), [profile, objectBase]);
  const playerStats = useMemo(
    () => sumStats(profile.stats, objectStats, profile.petStats, profile.mountStats, talentEffects.globalStats),
    [profile.stats, objectStats, profile.petStats, profile.mountStats, talentEffects]
  );
  const score = useMemo(() => scoreBuild(playerStats, config), [playerStats, config]);
  const sim = useMemo(() => simulatePvP(playerStats, config), [playerStats, config]);
  const pve = useMemo(() => combatProfile(playerStats, config, "player"), [playerStats, config]);
  const gains = useMemo(() => marginalGains(playerStats, config).slice(0, 5), [playerStats, config]);
  const trades = useMemo(() => tradeSuggestions(playerStats, config).slice(0, 5), [playerStats, config]);
  const objectSuggestions = useMemo(() => objectChangeSuggestions(profile, gains).slice(0, 5), [profile, gains]);
  const talentCandidates = useMemo(() => nextTalentCandidates(profile, playerStats, config).slice(0, 5), [profile, playerStats, config]);

  useEffect(() => {
    document.body.dataset.mode = usesPvp(config.objective) ? "pvp" : "pve";
    document.body.dataset.activePage = activePage;
    if (!usesPvp(config.objective) && activePage === "pvp") setActivePage("profile");
  }, [config.objective, activePage]);

  useEffect(() => {
    const load = async () => {
      const localDraft = readLocalDraft();
      try {
        const result = await api("/api/me");
        if (result.authenticated) {
          setUser(result.username);
          const serverProfile = result.profile;
          const chosen = localDraft && number(localDraft.savedAt) > number(serverProfile?.savedAt) ? localDraft : serverProfile || localDraft;
          if (chosen) setProfile(normalizeProfile(chosen));
          setMessage(chosen === localDraft ? "Brouillon local restaure." : "Session restauree.");
        } else if (localDraft) {
          setProfile(normalizeProfile(localDraft));
          setMessage("Brouillon local restaure.");
        }
      } catch {
        if (localDraft) {
          setProfile(normalizeProfile(localDraft));
          setMessage("API indisponible. Brouillon local restaure.");
          setWarning(true);
        }
      }
    };
    load();
  }, []);

  useEffect(() => {
    const payload = { ...profile, savedAt: Date.now(), version: PROFILE_VERSION };
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(payload));
    if (!user) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api("/api/profile", { method: "PUT", body: { profile: payload } })
        .then(() => setMessage("Sauvegarde auto."))
        .catch((error) => {
          setMessage(`Sauvegarde auto impossible: ${error.message}`);
          setWarning(true);
        });
    }, SERVER_AUTOSAVE_DELAY);
    return () => clearTimeout(saveTimer.current);
  }, [profile, user]);

  const patchProfile = (patch) => setProfile((current) => normalizeProfile({ ...current, ...patch, savedAt: Date.now() }));
  const patchConfig = (id, value) => patchProfile({ config: { ...profile.config, [id]: value } });
  const updateStats = (field, id, value) => patchProfile({ [field]: { ...profile[field], [id]: value } });
  const updateEquipment = (slotId, patch) => patchProfile({ equipment: { ...profile.equipment, [slotId]: { ...profile.equipment[slotId], ...patch } } });
  const updateEquipmentLine = (slotId, index, patch) => {
    const item = profile.equipment[slotId];
    const lines = normalizeLines(item.secondaryStats);
    lines[index] = { ...lines[index], ...patch };
    updateEquipment(slotId, { secondaryStats: lines });
  };
  const updatePet = (index, patch) => {
    const pets = profile.pets.map((pet, petIndex) => (petIndex === index ? { ...pet, ...patch } : pet));
    patchProfile({ pets });
  };
  const updatePetLine = (petIndex, lineIndex, patch) => {
    const pets = profile.pets.map((pet, index) => {
      if (index !== petIndex) return pet;
      const lines = normalizeLines(pet.secondaryStats);
      lines[lineIndex] = { ...lines[lineIndex], ...patch };
      return { ...pet, secondaryStats: lines };
    });
    patchProfile({ pets });
  };
  const updateMountLine = (lineIndex, patch) => {
    const lines = normalizeLines(profile.mount.secondaryStats);
    lines[lineIndex] = { ...lines[lineIndex], ...patch };
    patchProfile({ mount: { ...profile.mount, secondaryStats: lines } });
  };
  const takeDrop = () => {
    const slot = EQUIPMENT_SLOTS.find((entry) => entry.id === profile.config.dropSlot);
    if (!slot) return;
    updateEquipment(slot.id, buildDropItem(profile.config, slot));
  };
  const resetProfile = () => {
    localStorage.removeItem(LOCAL_DRAFT_KEY);
    setLastCounts({});
    setProfile(normalizeProfile({}));
  };
  const forceSave = async () => {
    const payload = { ...profile, savedAt: Date.now(), version: PROFILE_VERSION };
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(payload));
    if (!user) {
      setMessage("Brouillon sauvegarde localement.");
      setWarning(false);
      return;
    }
    await api("/api/profile", { method: "PUT", body: { profile: payload } });
    setMessage("Profil sauvegarde.");
    setWarning(false);
  };
  const login = async () => {
    const username = document.getElementById("username")?.value?.trim();
    const password = document.getElementById("password")?.value;
    const result = await api("/api/login", { method: "POST", body: { username, password } });
    setUser(result.username);
    setMessage("Connecte.");
    setWarning(false);
    if (result.profile) setProfile(normalizeProfile(result.profile));
  };
  const register = async () => {
    const username = document.getElementById("username")?.value?.trim();
    const password = document.getElementById("password")?.value;
    const result = await api("/api/register", { method: "POST", body: { username, password } });
    setUser(result.username);
    setMessage("Compte cree.");
    setWarning(false);
  };
  const logout = async () => {
    await api("/api/logout", { method: "POST", body: {} }).catch(() => {});
    setUser(null);
    setMessage("Deconnecte.");
  };
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = importProfileJson(JSON.parse(await file.text()));
      patchProfile({
        stats: imported.itemStats,
        petStats: imported.petStats,
        mountStats: imported.mountStats,
        equipment: imported.equipment,
        pets: imported.pets,
        mount: imported.mount,
        talentTree: imported.talentTree,
        playerSpells: imported.spells,
        config: { ...profile.config, forgeLevel: imported.forgeLevel ? String(imported.forgeLevel) : profile.config.forgeLevel }
      });
      setImportMessage(`Import OK: ${imported.talentNodes} talents, ${imported.spells.length}/3 sorts.${imported.unknown.length ? ` Stats ignorees: ${imported.unknown.join(", ")}.` : ""}`);
    } catch (error) {
      setImportMessage(error.message || "Import impossible.");
    }
  };
  const optimize = () => {
    const best = optimizeBuild(config, sumStats(objectStats, profile.petStats, profile.mountStats, talentEffects.globalStats));
    setLastCounts(best.counts);
    patchProfile({ stats: best.stats });
  };
  const setTalentLevel = (treeName, nodeId, level) => {
    const next = normalizeTree(profile.talentTree);
    const normalized = clamp(Math.round(number(level)), 0, TECH_TREE_MAX_LEVEL);
    if (normalized) next[treeName][nodeId] = normalized;
    else delete next[treeName][nodeId];
    patchProfile({ talentTree: pruneTree(next) });
  };

  const dropSlot = EQUIPMENT_SLOTS.find((entry) => entry.id === profile.config.dropSlot) || EQUIPMENT_SLOTS[0];
  const currentDropItem = profile.equipment[dropSlot.id];
  const newDropItem = buildDropItem(profile.config, dropSlot);
  const dropEquipment = { ...profile.equipment, [dropSlot.id]: newDropItem };
  const dropObjectBase = baseFromObjects(dropEquipment, profile.pets, profile.mount, talentEffects);
  const dropObjectStats = sumStats(collectionSecondaryStats(dropEquipment), collectionSecondaryStats(profile.pets), lineStats(profile.mount?.secondaryStats));
  const dropConfig = { ...config, baseDamage: Math.max(1, number(profile.config.baseDamage) + dropObjectBase.attack), baseHealth: Math.max(1, number(profile.config.baseHealth) + dropObjectBase.defense) };
  const dropStats = sumStats(profile.stats, dropObjectStats, profile.petStats, profile.mountStats, talentEffects.globalStats);
  const dropScore = scoreBuild(dropStats, dropConfig);
  const dropPvp = usesPvp(config.objective) ? simulatePvP(dropStats, dropConfig).chance : null;
  const canTakeDrop = Boolean(dropSlot && (number(newDropItem.attack) > 0 || number(newDropItem.defense) > 0 || normalizeLines(newDropItem.secondaryStats).some((line) => line.stat && number(line.value) > 0)));

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <img src="/assets/forge-mark.svg" alt="" className="brand-mark" />
          <div><p className="eyebrow">Forge Master</p><h1>Simulateur de caracteristiques</h1></div>
        </div>
        <div className="toolbar">
          <button className="tool-button" type="button" onClick={forceSave}><span>S</span><span>Sauver</span></button>
          <button className="tool-button ghost" type="button" onClick={resetProfile}><span>R</span><span>Reset</span></button>
        </div>
      </header>

      <nav className="app-nav">
        {["profile", "stats", "talents", "pvp", "results"].map((page) => (
          <button key={page} className={`app-nav-button ${activePage === page ? "active" : ""}`} type="button" data-page={page} onClick={() => setActivePage(page)}>
            <span>{page === "profile" ? "Profil" : page === "stats" ? "Stats" : page === "talents" ? "Talents" : page === "pvp" ? "PvP" : "Resultats"}</span>
          </button>
        ))}
      </nav>

      <section className="layout">
        <aside className="controls">
          <section className="panel control-card page-panel page-profile">
            <div className="panel-heading"><h2>Compte</h2><span className="status-pill">{user || "Invite"}</span></div>
            <div className="grid-two">
              <label className="field"><span>Utilisateur</span><input id="username" type="text" autoComplete="username" placeholder="pseudo" /></label>
              <label className="field"><span>Mot de passe</span><input id="password" type="password" autoComplete="current-password" placeholder="8+ caracteres" /></label>
            </div>
            <div className="button-row">
              <button className="small-button" type="button" onClick={login}>Connexion</button>
              <button className="small-button" type="button" onClick={register}>Creer</button>
              <button className="small-button muted-button" type="button" onClick={logout}>Sortir</button>
            </div>
            <div className={`inline-message ${warning ? "warning" : ""}`}>{message}</div>
            <div className="panel-heading compact"><h2>Import 1vcian/fm</h2></div>
            <label className="field"><span>Profil JSON exporte</span><input type="file" accept="application/json,.json" onChange={importFile} /></label>
            <div className="inline-message">{importMessage}</div>
          </section>

          <section className="panel control-card page-panel page-profile">
            <div className="panel-heading"><h2>Profil</h2></div>
            <label className="field"><span>Objectif</span><select value={profile.config.objective} onChange={(event) => patchConfig("objective", event.target.value)}>
              <option value="progress">Progression PvE</option><option value="damage">DPS PvE</option><option value="survival">Survie PvE</option><option value="balanced">Equilibre PvE/PvP</option><option value="pvp">PvP</option>
            </select></label>
            <Segmented value={profile.weapon} options={[["ranged", "Distance"], ["melee", "Melee"]]} onChange={(weapon) => patchProfile({ weapon })} />
            <div className="grid-two">
              <NumField label="Base attaque manuelle" value={profile.config.baseDamage} onChange={(value) => patchConfig("baseDamage", value)} />
              <NumField label="Base PV manuelle" value={profile.config.baseHealth} onChange={(value) => patchConfig("baseHealth", value)} />
              <NumField label="Duree combat PvE" value={profile.config.fightDuration} onChange={(value) => patchConfig("fightDuration", value)} wide />
              <NumField label="Niveau forge" value={profile.config.forgeLevel} onChange={(value) => patchConfig("forgeLevel", value)} />
              <label className="field"><span>Lignes objets</span><output>{EQUIPMENT_OPTIMIZER_LINES} max (2 par objet)</output></label>
            </div>
            <div className="inline-message">
              Base calculee: attaque {format(config.baseDamage)} / PV {format(config.baseHealth)}
              {objectBase.attack || objectBase.defense ? ` (objets +${format(objectBase.attack)} atk, +${format(objectBase.defense)} def)` : ""}
            </div>
            <button className="primary-action" type="button" onClick={optimize}>Optimiser le build</button>
          </section>

          <section className="panel control-card page-panel page-profile">
            <SpellPicker title="Mes sorts" side="player" selected={profile.playerSpells} onChange={(playerSpells) => patchProfile({ playerSpells })} />
          </section>

          <section className="panel control-card page-panel page-pvp pvp-only">
            <div className="panel-heading"><h2>Adversaire PvP</h2></div>
            <Segmented value={profile.enemyWeapon} options={[["ranged", "Distance"], ["melee", "Melee"]]} onChange={(enemyWeapon) => patchProfile({ enemyWeapon })} />
            <div className="grid-two">
              <NumField label="Attaque adv." value={profile.config.enemyBaseDamage} onChange={(value) => patchConfig("enemyBaseDamage", value)} />
              <NumField label="PV adv." value={profile.config.enemyBaseHealth} onChange={(value) => patchConfig("enemyBaseHealth", value)} />
            </div>
            <SpellPicker title="Sorts adversaire" side="enemy" selected={profile.enemySpells} onChange={(enemySpells) => patchProfile({ enemySpells })} />
          </section>
        </aside>

        <section className="stats-column">
          <section className="panel stats-panel page-panel page-stats">
            <EquipmentPanel equipment={profile.equipment} effects={talentEffects.equipment} onItemChange={updateEquipment} onLineChange={updateEquipmentLine} />
            <details className="stat-group" open><summary>Pets actifs</summary><PetPanel pets={profile.pets} effects={talentEffects.pets} onPetChange={updatePet} onLineChange={updatePetLine} /></details>
            <details className="stat-group" open><summary>Monture active</summary><MountPanel mount={profile.mount} effects={talentEffects.mount} onMountChange={(patch) => patchProfile({ mount: { ...profile.mount, ...patch } })} onLineChange={updateMountLine} /></details>
            <details className="stat-group"><summary>Ajustements manuels equipement</summary><StatGrid title="" stats={profile.stats} onChange={(id, value) => updateStats("stats", id, value)} onClear={() => patchProfile({ stats: blankStats() })} /></details>
            <details className="stat-group"><summary>Bonus pets globaux</summary><StatGrid title="" stats={profile.petStats} onChange={(id, value) => updateStats("petStats", id, value)} /></details>
            <details className="stat-group"><summary>Ajustements manuels monture</summary><StatGrid title="" stats={profile.mountStats} onChange={(id, value) => updateStats("mountStats", id, value)} /></details>
          </section>

          <TalentPanel activeTree={activeTree} setActiveTree={setActiveTree} tree={profile.talentTree} setTalentLevel={setTalentLevel} candidates={talentCandidates} config={config} />

          <section className="panel stats-panel page-panel page-pvp pvp-only">
            <StatGrid title="Stats equipement adversaire" stats={profile.enemyStats} onChange={(id, value) => updateStats("enemyStats", id, value)} onClear={() => patchProfile({ enemyStats: blankStats(), enemyPetStats: blankStats(), enemyMountStats: blankStats() })} />
            <details className="stat-group" open><summary>Bonus pets adversaire</summary><StatGrid title="" stats={profile.enemyPetStats} onChange={(id, value) => updateStats("enemyPetStats", id, value)} /></details>
            <details className="stat-group" open><summary>Bonus monture adversaire</summary><StatGrid title="" stats={profile.enemyMountStats} onChange={(id, value) => updateStats("enemyMountStats", id, value)} /></details>
          </section>
        </section>

        <section className="results-stack page-panel page-results">
          <Results score={score} sim={sim} pve={pve} config={config} />
          <section className="panel optimizer-panel">
            <div className="panel-heading"><h2>Ameliorations</h2></div>
            <div className="recommendation">{gains[0] ? `Priorite: ${gains[0].label}${gains[1] ? `, puis ${gains[1].label}` : ""}.` : "Aucune recommandation."}</div>
            <Allocation stats={profile.stats} counts={lastCounts} />
            <RecoList title="Prochaines lignes rentables" items={gains.map((gain) => `${gain.label} +${gain.add}% ${formatDelta(gain.gain, gain.chanceDelta, config)}`)} />
            <RecoList title="Objets a regarder" items={objectSuggestions} empty="Aucun slot evident pour le moment." />
            <RecoList title="Bonus pets a chercher" items={gains.map((gain) => `${gain.label} +${gain.add}% ${formatDelta(gain.gain, gain.chanceDelta, config)}`)} />
            <RecoList title="Trades possibles" items={trades.map((trade) => `${trade.down.label} -> ${trade.up.label} ${formatDelta(trade.gain, trade.chanceDelta, config)}`)} empty="Aucun trade evident." />
          </section>
          <section className="panel item-panel">
            <div className="panel-heading"><h2>Tester un drop</h2></div>
            <div className="grid-two">
              <label className="field"><span>Type d'objet</span><select value={profile.config.dropSlot} onChange={(event) => patchConfig("dropSlot", event.target.value)}>
                {EQUIPMENT_SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
              </select></label>
              <NumField label={dropSlot.main === "attack" ? "Attaque du drop" : "Defense du drop"} value={dropSlot.main === "attack" ? profile.config.dropAttack : profile.config.dropDefense} onChange={(value) => patchConfig(dropSlot.main === "attack" ? "dropAttack" : "dropDefense", value)} />
              <label className="field wide"><span>Nom du drop</span><input value={profile.config.dropName} onChange={(event) => patchConfig("dropName", event.target.value)} /></label>
              <SelectStat label="Stat secondaire 1" value={profile.config.dropLine1Stat} onChange={(value) => patchConfig("dropLine1Stat", value)} optional />
              <NumField label="Valeur 1" value={profile.config.dropLine1Value} onChange={(value) => patchConfig("dropLine1Value", value)} />
              <SelectStat label="Stat secondaire 2" value={profile.config.dropLine2Stat} onChange={(value) => patchConfig("dropLine2Stat", value)} optional />
              <NumField label="Valeur 2" value={profile.config.dropLine2Value} onChange={(value) => patchConfig("dropLine2Value", value)} />
            </div>
            <div className="drop-result">
              <strong className={dropScore >= score ? "positive" : "warning"}>{dropScore >= score ? "Meilleur ou equivalent" : "Moins bon"}</strong>
              <span>{dropComparisonText(dropSlot, currentDropItem, newDropItem)} Score: {score.toFixed(3)} -&gt; {dropScore.toFixed(3)} ({formatSigned(dropScore - score, 3)}). {dropPvp !== null ? `PvP: ${format(sim.chance, 1)}% -> ${format(dropPvp, 1)}%.` : ""}</span>
            </div>
            <button className="primary-action" type="button" onClick={takeDrop} disabled={!canTakeDrop}>Prendre ce drop</button>
          </section>
        </section>
      </section>
    </main>
  );
}

function normalizeProfile(source = {}) {
  return {
    version: PROFILE_VERSION,
    savedAt: number(source.savedAt) || Date.now(),
    config: {
      objective: source.config?.objective || "progress",
      baseDamage: source.config?.baseDamage || "1000",
      baseHealth: source.config?.baseHealth || "8000",
      fightDuration: source.config?.fightDuration || "60",
      enemyBaseDamage: source.config?.enemyBaseDamage || "1000",
      enemyBaseHealth: source.config?.enemyBaseHealth || "8000",
      forgeLevel: source.config?.forgeLevel || "21",
      dropSlot: EQUIPMENT_SLOTS.some((slot) => slot.id === source.config?.dropSlot) ? source.config.dropSlot : "weapon",
      dropName: source.config?.dropName || "Nouveau drop",
      dropAttack: source.config?.dropAttack || "0",
      dropDefense: source.config?.dropDefense || "0",
      dropLine1Stat: STAT_DEFS.some((stat) => stat.id === source.config?.dropLine1Stat) ? source.config.dropLine1Stat : "damage",
      dropLine1Value: source.config?.dropLine1Value || "0",
      dropLine2Stat: STAT_DEFS.some((stat) => stat.id === source.config?.dropLine2Stat) ? source.config.dropLine2Stat : "",
      dropLine2Value: source.config?.dropLine2Value || "0"
    },
    weapon: source.weapon || "ranged",
    enemyWeapon: source.enemyWeapon || "ranged",
    equipment: normalizeEquipment(source.equipment),
    pets: normalizePets(source.pets),
    mount: normalizeMount(source.mount),
    stats: { ...blankStats(), ...(source.stats || {}) },
    petStats: { ...blankStats(), ...(source.petStats || {}) },
    mountStats: { ...blankStats(), ...(source.mountStats || {}) },
    talentTree: normalizeTree(source.talentTree || {}),
    enemyStats: { ...blankStats(), ...(source.enemyStats || {}) },
    enemyPetStats: { ...blankStats(), ...(source.enemyPetStats || {}) },
    enemyMountStats: { ...blankStats(), ...(source.enemyMountStats || {}) },
    playerSpells: Array.isArray(source.playerSpells) ? source.playerSpells.slice(0, MAX_SPELLS) : [],
    enemySpells: Array.isArray(source.enemySpells) ? source.enemySpells.slice(0, MAX_SPELLS) : []
  };
}

function normalizeLines(lines = []) {
  return padLines((Array.isArray(lines) ? lines : []).map((line) => ({
    stat: STAT_DEFS.some((stat) => stat.id === line?.stat) ? line.stat : "",
    value: number(line?.value)
  })));
}

function normalizeEquipment(source = {}) {
  const blank = blankEquipment();
  for (const slot of EQUIPMENT_SLOTS) {
    const item = source?.[slot.id] || {};
    blank[slot.id] = {
      name: item.name || slot.label,
      attack: number(item.attack),
      defense: number(item.defense),
      secondaryStats: normalizeLines(item.secondaryStats)
    };
  }
  return blank;
}

function normalizePets(source = []) {
  const blank = blankPets();
  const entries = Array.isArray(source) ? source : [];
  return blank.map((pet, index) => ({
    ...pet,
    ...(entries[index] || {}),
    name: entries[index]?.name || pet.name,
    attack: number(entries[index]?.attack),
    defense: number(entries[index]?.defense),
    secondaryStats: normalizeLines(entries[index]?.secondaryStats)
  }));
}

function normalizeMount(source = {}) {
  const mount = { ...blankMount(), ...(source || {}) };
  return {
    name: mount.name || "Monture",
    attack: number(mount.attack),
    defense: number(mount.defense),
    secondaryStats: normalizeLines(mount.secondaryStats)
  };
}

function nextTalentCandidates(profile, playerStats, config) {
  const baseScore = scoreBuild(playerStats, config);
  const baseChance = usesPvp(config.objective) ? simulatePvP(playerStats, config).chance : null;
  const candidates = [];
  for (const [treeName, nodes] of Object.entries(TECH_TREE_DATA)) {
    for (const node of nodes) {
      if (!canUpgradeTalent(profile.talentTree, treeName, node)) continue;
      const nextTree = normalizeTree(profile.talentTree);
      nextTree[treeName][node.id] = number(nextTree[treeName][node.id]) + 1;
      const nextEffects = computeTalentEffects(nextTree);
      const nextBase = baseFromObjects(profile.equipment, profile.pets, profile.mount, nextEffects);
      const nextConfig = {
        ...config,
        baseDamage: Math.max(1, number(profile.config.baseDamage) + nextBase.attack),
        baseHealth: Math.max(1, number(profile.config.baseHealth) + nextBase.defense)
      };
      const nextStats = sumStats(profile.stats, collectionSecondaryStats(profile.equipment), collectionSecondaryStats(profile.pets), lineStats(profile.mount?.secondaryStats), profile.petStats, profile.mountStats, nextEffects.globalStats);
      const score = scoreBuild(nextStats, nextConfig);
      const nextChance = usesPvp(config.objective) ? simulatePvP(nextStats, nextConfig).chance : null;
      candidates.push({ treeName, node, gain: score - baseScore, chanceDelta: nextChance === null ? null : nextChance - baseChance });
    }
  }
  return candidates.sort((a, b) => b.gain - a.gain || a.node.layer - b.node.layer);
}

function objectChangeSuggestions(profile, gains) {
  const important = gains.slice(0, 3);
  const suggestions = [];
  const attackStats = new Set(["damage", "rangedDamage", "meleeDamage", "attackSpeed", "doubleChance", "critChance", "critDamage", "lifesteal"]);
  const defenseStats = new Set(["health", "regen", "block"]);

  for (const gain of important) {
    for (const slot of EQUIPMENT_SLOTS) {
      const item = profile.equipment[slot.id];
      const hasStat = normalizeLines(item.secondaryStats).some((line) => line.stat === gain.id && number(line.value) > 0);
      const slotMatches =
        (slot.main === "attack" && attackStats.has(gain.id)) ||
        (slot.main === "defense" && defenseStats.has(gain.id)) ||
        gain.id === "skillDamage" ||
        gain.id === "cooldown";
      if (!hasStat && slotMatches) suggestions.push(`${slot.label}: chercher ${gain.label} en secondaire`);
    }
  }

  for (const gain of important.slice(0, 2)) {
    for (const pet of profile.pets) {
      const hasStat = normalizeLines(pet.secondaryStats).some((line) => line.stat === gain.id && number(line.value) > 0);
      if (!hasStat) suggestions.push(`${pet.name || "Pet"}: chercher ${gain.label}`);
    }
  }

  for (const gain of important.slice(0, 2)) {
    const hasStat = normalizeLines(profile.mount?.secondaryStats).some((line) => line.stat === gain.id && number(line.value) > 0);
    if (!hasStat) suggestions.push(`${profile.mount?.name || "Monture"}: chercher ${gain.label}`);
  }

  return [...new Set(suggestions)];
}

function api(path, options = {}) {
  return fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Erreur serveur");
      return payload;
    });
}

function readLocalDraft() {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY) || localStorage.getItem("forge-master-profile-draft-v1");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function statLabel(id) {
  return STAT_DEFS.find((stat) => stat.id === id)?.label || id || "aucune stat";
}

function lineLabel(line) {
  return line?.stat ? `${statLabel(line.stat)} ${format(number(line.value), 2)}%` : "ligne vide";
}

function buildDropItem(config, slot) {
  return {
    name: config.dropName || `Drop ${slot.label}`,
    attack: slot.main === "attack" ? number(config.dropAttack) : 0,
    defense: slot.main === "defense" ? number(config.dropDefense) : 0,
    secondaryStats: normalizeLines([
      { stat: config.dropLine1Stat, value: number(config.dropLine1Value) },
      { stat: config.dropLine2Stat, value: number(config.dropLine2Value) }
    ])
  };
}

function itemMainText(slot, item) {
  const value = slot.main === "attack" ? number(item?.attack) : number(item?.defense);
  return `${slot.main === "attack" ? "attaque" : "defense"} ${format(value)}`;
}

function itemLinesText(item) {
  const lines = normalizeLines(item?.secondaryStats).filter((line) => line.stat && number(line.value) > 0).map(lineLabel);
  return lines.length ? lines.join(", ") : "aucune secondaire";
}

function dropComparisonText(slot, currentItem, newItem) {
  return `${slot.label}: ${currentItem?.name || slot.label} (${itemMainText(slot, currentItem)}, ${itemLinesText(currentItem)}) -> ${newItem.name} (${itemMainText(slot, newItem)}, ${itemLinesText(newItem)}).`;
}

function formatDelta(gain, chanceDelta, config) {
  if (config.objective === "pvp") return `${formatSigned(chanceDelta, 1)} pts`;
  if (config.objective === "balanced") return `${formatSigned(gain, 3)} | ${formatSigned(chanceDelta, 1)} pts PvP`;
  return formatSigned(gain, 3);
}

function NumField({ label, value, onChange, wide }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span><input type="number" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectStat({ label, value, onChange, optional }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{optional && <option value="">Aucune</option>}{STAT_DEFS.map((stat) => <option key={stat.id} value={stat.id}>{stat.label}</option>)}</select></label>;
}

function Segmented({ value, options, onChange }) {
  return <div className="segmented">{options.map(([id, label]) => <button key={id} type="button" className={`segment ${value === id ? "active" : ""}`} onClick={() => onChange(id)}>{label}</button>)}</div>;
}

function TalentPanel({ activeTree, setActiveTree, tree, setTalentLevel, candidates, config }) {
  const combatText = STAT_DEFS.map((stat) => ({ stat, value: computeTalentStats(tree)[stat.id] || 0 })).filter((entry) => entry.value > 0).map((entry) => `${entry.stat.label} +${format(entry.value)}%`).join(" | ");
  return (
    <section className="panel stats-panel talent-panel page-panel page-talents">
      <div className="panel-heading"><h2>Arbres de talents</h2><span className="mini-pill">{combatText || "0 niveaux"}</span></div>
      <div className="segmented talent-tabs">{Object.entries(TECH_TREE_NAMES).map(([id, label]) => <button key={id} type="button" className={`segment ${activeTree === id ? "active" : ""}`} onClick={() => setActiveTree(id)}>{label}</button>)}</div>
      <div className="recommendation compact-recommendation">{candidates[0] ? `${TECH_TREE_NAMES[candidates[0].treeName]} #${candidates[0].node.id} - ${candidates[0].node.label}: ${formatDelta(candidates[0].gain, candidates[0].chanceDelta, config)}` : "Aucun talent disponible."}</div>
      <ol className="marginals talent-suggestions">
        {candidates.map((candidate) => <li key={`${candidate.treeName}-${candidate.node.id}`}><label className="talent-suggestion"><input type="checkbox" onChange={() => setTalentLevel(candidate.treeName, candidate.node.id, number(tree[candidate.treeName]?.[candidate.node.id]) + 1)} /><span><strong>{TECH_TREE_NAMES[candidate.treeName]} #{candidate.node.id}</strong> {candidate.node.label}</span><span className="positive">{formatDelta(candidate.gain, candidate.chanceDelta, config)}</span></label></li>)}
      </ol>
      <div className="talent-tree">
        {TECH_TREE_DATA[activeTree].map((node) => {
          const level = number(tree[activeTree]?.[node.id]);
          const unlocked = canUpgradeTalent(tree, activeTree, node) || level > 0;
          return <article key={node.id} className={`talent-node ${level ? "selected" : ""} ${unlocked ? "" : "locked"} ${level >= TECH_TREE_MAX_LEVEL ? "complete" : ""}`}>
            <div className="talent-node-head"><span className="talent-node-id">#{node.id}</span><strong>{node.label}</strong></div>
            <span className="talent-node-bonus">{describeTalentBonus(node)}</span>
            <span className="talent-node-req">{node.requirements.length ? `Req. ${node.requirements.map((id) => `#${id}`).join(", ")}` : "Depart"}</span>
            <div className="talent-stepper"><button type="button" disabled={level <= 0} onClick={() => setTalentLevel(activeTree, node.id, level - 1)}>-</button><span>{level}/5</span><button type="button" disabled={!canUpgradeTalent(tree, activeTree, node)} onClick={() => setTalentLevel(activeTree, node.id, level + 1)}>+</button></div>
          </article>;
        })}
      </div>
    </section>
  );
}

function describeTalentBonus(node) {
  const slot = EQUIPMENT_SLOTS.find((entry) => entry.talent === node.type);
  if (slot) return `+2% ${slot.main === "attack" ? "attaque" : "sante"} ${slot.label}/niv.`;
  if (node.type === "PetBonusDamage") return "+2% attaque pets/niv.";
  if (node.type === "PetBonusHealth") return "+2% sante pets/niv.";
  if (node.type === "MountDamage") return "+2% attaque monture/niv.";
  if (node.type === "MountHealth") return "+2% sante monture/niv.";
  const bonuses = TECH_TREE_BONUSES[node.type];
  if (!bonuses) return "Progression";
  return Object.entries(bonuses).map(([statId, value]) => `+${value}% ${STAT_DEFS.find((stat) => stat.id === statId)?.label || statId}/niv.`).join(" | ");
}

function Results({ score, sim, pve, config }) {
  const isPvp = config.objective === "pvp";
  const balanced = config.objective === "balanced";
  return <section className="panel score-panel"><div className="panel-heading"><h2>Resultats</h2><span className="status-pill">{isPvp ? (sim.chance >= 58 ? "Favorable" : sim.chance <= 42 ? "Risque" : "Equilibre") : balanced ? "Equilibre" : "PvE"}</span></div>
    <div className="metric-grid">
      <article className="metric"><span>{isPvp ? "Chance victoire" : balanced ? "Score equilibre" : "Score PvE"}</span><strong>{isPvp ? `${format(sim.chance, 1)}%` : score.toFixed(3)}</strong></article>
      <article className="metric"><span>{isPvp || balanced ? "Chance PvP" : "DPS total"}</span><strong>{isPvp || balanced ? `${format(sim.chance, 1)}%` : format(pve.totalDps)}</strong></article>
      <article className="metric"><span>{isPvp ? "Temps gagner" : "Sustain / sec"}</span><strong>{isPvp ? (Number.isFinite(sim.timeToWin) ? `${format(sim.timeToWin, 1)}s` : "bloque") : format(pve.healingHps)}</strong></article>
      <article className="metric"><span>{isPvp ? "Temps perdre" : "DPS sorts"}</span><strong>{isPvp ? (Number.isFinite(sim.timeToLose) ? `${format(sim.timeToLose, 1)}s` : "bloque") : format(pve.skillDps)}</strong></article>
    </div>
    <div className="bar-block"><div className="bar-label"><span>Score objectif</span><strong>{isPvp ? `${format(sim.chance, 1)}%` : score.toFixed(3)}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${clamp(isPvp ? sim.chance : (score / 25) * 100, 0, 100)}%` }} /></div></div>
  </section>;
}

function Allocation({ counts }) {
  const rows = Object.entries(counts || {}).filter(([, value]) => value > 0);
  if (!rows.length) return <div className="allocation"><p className="empty-note">Lance une optimisation pour afficher la repartition.</p></div>;
  return <div className="allocation">{rows.map(([id, count]) => <div className="allocation-row" key={id}><div className="allocation-name"><span>{STAT_DEFS.find((stat) => stat.id === id)?.label || id}</span><span>{count} lignes</span></div></div>)}</div>;
}

function RecoList({ title, items, empty = "Aucune suggestion." }) {
  return <><div className="divider" /><h3>{title}</h3><ol className="marginals">{items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>{empty}</li>}</ol></>;
}
