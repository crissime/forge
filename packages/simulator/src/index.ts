import {
  STAT_ID_MAP,
  STAT_LABELS,
  type GameDataBundle,
  type NormalizedSecondaryStat,
  type StatId
} from "@forge-master/game-data";

export type Confidence = "complete" | "partial" | "manual_required";
export type Objective = "progress" | "damage" | "survival" | "pvp" | "balanced";
export type ScenarioId = "endurance" | "timeToKill" | "gauntlet";
export type ScenarioKind = "endurance" | "timeToKill" | "gauntlet";

export interface ScenarioSettings {
  levelRange?: Partial<LevelRangeSettings>;
  endurance?: Partial<EnduranceScenarioSettings>;
  timeToKill?: Partial<TimeToKillScenarioSettings>;
  gauntlet?: Partial<GauntletScenarioSettings>;
}

export interface LevelRangeSettings {
  min: number;
  max: number;
  age?: number;
  combat?: number;
  difficulty?: number;
}

export interface EnduranceScenarioSettings {
  startDamagePct: number;
  growthPct: number;
  maxSeconds: number;
}

export interface TimeToKillScenarioSettings {
  targetSeconds: number;
  incomingDamagePct: number;
  maxSeconds: number;
}

export interface GauntletScenarioSettings {
  mobCount: number;
  firstMobSeconds: number;
  firstDamagePct: number;
  healthGrowthPct: number;
  damageGrowthPct: number;
  pauseSeconds: number;
  maxSeconds: number;
}

interface ResolvedScenarioSet {
  levelRange: ResolvedLevelRange;
  endurance: EnduranceScenarioSettings & {
    startDamagePerSecond: number;
    growthDamagePerSecond: number;
  };
  timeToKill: TimeToKillScenarioSettings & {
    mobHealth: number;
    incomingDamagePerSecond: number;
  };
  gauntlet: GauntletScenarioSettings & {
    firstMobHealth: number;
    firstDamagePerSecond: number;
    waves?: BattleWaveTarget[];
  };
}

interface ResolvedLevelRange {
  min: number;
  max: number;
  average: number;
  estimatedPlayerLevel: number;
  age: number;
  combat: number;
  difficulty: number;
  estimatedAge: number;
  estimatedCombat: number;
  startMultiplier: number;
  endMultiplier: number;
  averageMultiplier: number;
  battleTarget?: BattleTarget;
}

interface BattleWaveTarget {
  waveIndex: number;
  totalHealth: number;
  totalDps: number;
  enemyCount: number;
}

interface BattleTarget {
  ageIdx: number;
  battleIdx: number;
  age: number;
  combat: number;
  difficulty: number;
  waveCount: number;
  enemyCount: number;
  totalHealth: number;
  peakDps: number;
  averageDps: number;
  waves: BattleWaveTarget[];
}

export interface ScenarioResult {
  id: ScenarioId;
  kind: ScenarioKind;
  label: string;
  summary: string;
  score: number;
  success: boolean;
  metrics: Record<string, number>;
}

export interface StatMap extends Record<StatId, number> {}

export interface AuditIssue {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  path?: string;
}

export interface SecondaryLine {
  stat: StatId;
  sourceId: string;
  value: number;
}

export interface NormalizedItem {
  slot: EquipmentSlot;
  name: string;
  age?: number;
  idx?: number;
  level: number;
  rarity?: string;
  attack: number;
  health: number;
  secondaryStats: SecondaryLine[];
  recognized: boolean;
}

export interface NormalizedPet {
  name: string;
  rarity?: string;
  id?: number;
  type?: "Balanced" | "Damage" | "Health";
  level: number;
  attack: number;
  health: number;
  secondaryStats: SecondaryLine[];
  recognized: boolean;
}

export interface NormalizedMount extends NormalizedPet {
  skills?: number[];
}

export interface NormalizedSpellSelection {
  id: string;
  level: number;
  rarity?: string;
}

export interface NormalizedProfile {
  name: string;
  source: "import" | "1vcian" | "manual" | "guest";
  dataVersion: string;
  confidence: Confidence;
  base: {
    attack: number;
    health: number;
    weaponStyle: "melee" | "ranged";
  };
  equipment: Record<EquipmentSlot, NormalizedItem | null>;
  pets: NormalizedPet[];
  mount: NormalizedMount | null;
  spells: NormalizedSpellSelection[];
  talentTree: TalentTree;
  stats: StatMap;
  breakdown: {
    baseAttack: number;
    baseHealth: number;
    equipmentAttack: number;
    equipmentHealth: number;
    petAttack: number;
    petHealth: number;
    mountAttack: number;
    mountHealth: number;
    secondaryStats: StatMap;
    talentStats: StatMap;
  };
  audit: AuditIssue[];
}

export type EquipmentSlot = "Weapon" | "Helmet" | "Body" | "Gloves" | "Belt" | "Necklace" | "Ring" | "Shoe";
export type TalentTree = {
  Forge: Record<string, number>;
  Power: Record<string, number>;
  SkillsPetTech: Record<string, number>;
};

export interface CombatProfile {
  baseWeaponDps: number;
  weaponDps: number;
  skillDps: number;
  totalDps: number;
  baseMaxHealth: number;
  maxHealth: number;
  healingPerSecond: number;
  sustainWindow: number;
  block: number;
  regenPct: number;
  lifestealPct: number;
  weaponDpsPerAttack: number;
  skills: CombatSkill[];
  breakdown: Record<string, number>;
}

export interface CombatSkill {
  id: string;
  kind: "buff" | "damage";
  targetMode: "self" | "single" | "all";
  cooldown: number;
  activeDuration: number;
  startupDelay: number;
  castDelay: number;
  hitInterval: number;
  hitCount: number;
  damagePerHit: number;
  healPerHit: number;
  bonusAttack: number;
  bonusHealth: number;
  confidence: "high" | "medium" | "low";
}

export interface EvaluationResult {
  objective: Objective;
  score: number;
  confidence: Confidence;
  profile: CombatProfile;
  scenarios: ScenarioResult[];
  recommendations: Recommendation[];
  audit: AuditIssue[];
}

export interface PvpResult extends EvaluationResult {
  pvp: {
    chance: number;
    timeToWin: number | null;
    timeToLose: number | null;
    winner: "player" | "opponent" | "draw";
    duration: number;
    playerRemainingHealth: number;
    opponentRemainingHealth: number;
    playerDamage: number;
    opponentDamage: number;
    playerSkillDamage: number;
    opponentSkillDamage: number;
    playerSkillCasts: number;
    opponentSkillCasts: number;
    player: CombatProfile;
    opponent: CombatProfile;
    strengths: string[];
    weaknesses: string[];
  };
}

export interface Recommendation {
  kind: "stat" | "slot" | "talent" | "trade";
  title: string;
  detail: string;
  gain: number;
  chanceDelta?: number;
  scenario?: string;
  source?: string;
}

export interface DropInput {
  target?: "equipment" | "pet" | "mount";
  slot?: EquipmentSlot;
  petIndex?: number;
  name?: string;
  rarity?: string;
  id?: number;
  petType?: "Balanced" | "Damage" | "Health";
  level?: number;
  attack?: number;
  health?: number;
  secondaryStats?: Array<{ stat: StatId; value: number }>;
}

export interface DropComparisonResult {
  currentScore: number;
  dropScore: number;
  delta: number;
  currentChance?: number;
  dropChance?: number;
  verdict: "better" | "equal" | "worse";
  bestPetIndex?: number;
  candidates?: Array<{
    petIndex: number;
    currentScore: number;
    dropScore: number;
    delta: number;
    verdict: "better" | "equal" | "worse";
  }>;
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = ["Weapon", "Helmet", "Body", "Gloves", "Belt", "Necklace", "Ring", "Shoe"];
const SLOT_TO_JSON_TYPE: Record<EquipmentSlot, string> = {
  Weapon: "Weapon",
  Helmet: "Helmet",
  Body: "Armour",
  Gloves: "Gloves",
  Belt: "Belt",
  Necklace: "Necklace",
  Ring: "Ring",
  Shoe: "Shoes"
};
const ITEM_TYPE_TO_SLOT = ["Helmet", "Body", "Gloves", "Necklace", "Ring", "Weapon", "Shoe", "Belt"] as const;
const HARD_CAPS: Partial<Record<StatId, number>> = { doubleChance: 100, critChance: 100, block: 100, cooldown: 80 };
const ITEM_SECONDARY_LINE_2_MIN_AGE = 7;
const RARITY_ORDER = ["Common", "Rare", "Epic", "Legendary", "Ultimate", "Mythic"];
const PET_MOUNT_SECONDARY_LINE_2_MIN_RARITY = "Legendary";
const MAIN_BATTLE_ENEMY_SCALE = 0.02;
const DEFAULT_SCENARIOS = {
  levelRange: { min: 1, max: 1, difficulty: 0 },
  endurance: { startDamagePct: 2, growthPct: 0.12, maxSeconds: 900 },
  timeToKill: { targetSeconds: 24, incomingDamagePct: 0.35, maxSeconds: 300 },
  gauntlet: { mobCount: 8, firstMobSeconds: 8, firstDamagePct: 0.85, healthGrowthPct: 12, damageGrowthPct: 10, pauseSeconds: 1, maxSeconds: 900 }
} satisfies Required<ScenarioSettings>;

export function createEmptyStats(): StatMap {
  return Object.fromEntries(Object.values(STAT_ID_MAP).map((id) => [id, 0])) as StatMap;
}

export function normalizeOneVcianProfile(rawProfile: any, data: GameDataBundle): NormalizedProfile {
  const audit: AuditIssue[] = [];
  if (!rawProfile || typeof rawProfile !== "object") {
    return manualProfile("Profil invalide", data, [{ severity: "error", code: "invalid_json", message: "Le JSON importé n'est pas un objet." }]);
  }

  const talentEffects = computeTalentEffects(rawProfile.techTree || {}, data);
  const equipment = Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, null])) as Record<EquipmentSlot, NormalizedItem | null>;
  let equipmentAttack = 0;
  let equipmentHealth = 0;
  let weaponStyle: "melee" | "ranged" = "ranged";
  const secondaryStats = createEmptyStats();

  for (const slot of EQUIPMENT_SLOTS) {
    const sourceItem = rawProfile.items?.[slot] ?? rawProfile.items?.[slot.toLowerCase()];
    if (!sourceItem) {
      audit.push({ severity: "info", code: "missing_item", message: `${slot}: aucun objet importé.`, path: `items.${slot}` });
      continue;
    }
    const item = reconstructItem(slot, sourceItem, data, talentEffects, audit);
    equipment[slot] = item;
    equipmentAttack += item.attack;
    equipmentHealth += item.health;
    addLinesToStats(secondaryStats, item.secondaryStats);
    if (slot === "Weapon") weaponStyle = isRangedWeapon(sourceItem, data) ? "ranged" : "melee";
  }

  const pets = (Array.isArray(rawProfile.pets?.active) ? rawProfile.pets.active : [])
    .slice(0, 3)
    .map((pet: any, index: number) => reconstructPet(pet, index, data, talentEffects, audit));
  let petAttack = 0;
  let petHealth = 0;
  for (const pet of pets) {
    petAttack += pet.attack;
    petHealth += pet.health;
    addLinesToStats(secondaryStats, pet.secondaryStats);
  }

  const mount = rawProfile.mount?.active ? reconstructMount(rawProfile.mount.active, data, talentEffects, audit) : null;
  const mountAttack = mount?.attack || 0;
  const mountHealth = mount?.health || 0;
  if (mount) addLinesToStats(secondaryStats, mount.secondaryStats);

  const talentStats = talentEffects.globalStats;
  const stats = sumStats(secondaryStats, talentStats);
  const itemBase = data.raw["ItemBalancingConfig.json"] || {};
  const baseAttack = Number(itemBase.PlayerBaseDamage || 10);
  const baseHealth = Number(itemBase.PlayerBaseHealth || 80);
  const spells = normalizeSpells(rawProfile.skills?.equipped, data, audit);
  const confidence = confidenceFromAudit(audit);

  return {
    name: rawProfile.name || "Profil importé",
    source: "import",
    dataVersion: data.normalized.version,
    confidence,
    base: {
      attack: baseAttack + equipmentAttack + petAttack + mountAttack,
      health: baseHealth + equipmentHealth + petHealth + mountHealth,
      weaponStyle
    },
    equipment,
    pets,
    mount,
    spells,
    talentTree: {
      Forge: normalizeTree(rawProfile.techTree?.Forge),
      Power: normalizeTree(rawProfile.techTree?.Power),
      SkillsPetTech: normalizeTree(rawProfile.techTree?.SkillsPetTech)
    },
    stats,
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
    audit
  };
}

export function manualProfile(name: string, data: GameDataBundle, audit: AuditIssue[] = []): NormalizedProfile {
  const itemBase = data.raw["ItemBalancingConfig.json"] || {};
  const baseAttack = Number(itemBase.PlayerBaseDamage || 10);
  const baseHealth = Number(itemBase.PlayerBaseHealth || 80);
  return {
    name,
    source: "manual",
    dataVersion: data.normalized.version,
    confidence: audit.some((issue) => issue.severity === "error") ? "manual_required" : "partial",
    base: { attack: baseAttack, health: baseHealth, weaponStyle: "ranged" },
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, null])) as Record<EquipmentSlot, NormalizedItem | null>,
    pets: [],
    mount: null,
    spells: [],
    talentTree: { Forge: {}, Power: {}, SkillsPetTech: {} },
    stats: createEmptyStats(),
    breakdown: {
      baseAttack,
      baseHealth,
      equipmentAttack: 0,
      equipmentHealth: 0,
      petAttack: 0,
      petHealth: 0,
      mountAttack: 0,
      mountHealth: 0,
      secondaryStats: createEmptyStats(),
      talentStats: createEmptyStats()
    },
    audit
  };
}

export function evaluateProfile(profile: NormalizedProfile, data: GameDataBundle, objective: Objective = "progress", fightDuration = 60, scenarioSettings?: ScenarioSettings): EvaluationResult {
  const combat = combatProfile(profile, data, fightDuration);
  const scenarioSet = resolveScenarioSet(combat, scenarioSettings, profile, data);
  const scenarios = evaluateScenarios(combat, scenarioSet);
  const score = scoreCombat(combat, objective, scenarios);
  return {
    objective,
    score,
    confidence: profile.confidence,
    profile: combat,
    scenarios,
    recommendations: recommend(profile, data, objective, fightDuration, undefined, scenarioSet, scenarios).slice(0, 12),
    audit: profile.audit
  };
}

export function evaluatePvp(player: NormalizedProfile, opponent: NormalizedProfile, data: GameDataBundle, objective: Objective = "pvp", fightDuration = 60, scenarioSettings?: ScenarioSettings): PvpResult {
  const duel = simulatePvpDuel(player, opponent, data, fightDuration);
  const { playerCombat, opponentCombat } = duel;
  const scenarioSet = resolveScenarioSet(playerCombat, scenarioSettings, player, data);
  const scenarios = evaluateScenarios(playerCombat, scenarioSet);
  const chance = duel.chance;
  const score = objective === "balanced" ? scoreCombat(playerCombat, "progress", scenarios) * 0.55 + (chance / 10) * 0.45 : chance / 10;

  return {
    objective,
    score,
    confidence: weakerConfidence(player.confidence, opponent.confidence),
    profile: playerCombat,
    scenarios,
    recommendations: recommend(player, data, objective, fightDuration, opponent, scenarioSet, scenarios).slice(0, 12),
    audit: [...player.audit, ...opponent.audit.map((issue) => ({ ...issue, path: issue.path ? `opponent.${issue.path}` : "opponent" }))],
    pvp: {
      chance,
      timeToWin: duel.winner === "player" ? duel.duration : null,
      timeToLose: duel.winner === "opponent" ? duel.duration : null,
      winner: duel.winner,
      duration: duel.duration,
      playerRemainingHealth: duel.playerHealth,
      opponentRemainingHealth: duel.opponentHealth,
      playerDamage: duel.playerDamage,
      opponentDamage: duel.opponentDamage,
      playerSkillDamage: duel.playerSkillDamage,
      opponentSkillDamage: duel.opponentSkillDamage,
      playerSkillCasts: duel.playerSkillCasts,
      opponentSkillCasts: duel.opponentSkillCasts,
      player: playerCombat,
      opponent: opponentCombat,
      strengths: pvpStrengths(playerCombat, opponentCombat),
      weaknesses: pvpStrengths(opponentCombat, playerCombat)
    }
  };
}

export function compareDrop(profile: NormalizedProfile, drop: DropInput, data: GameDataBundle, objective: Objective = "progress"): DropComparisonResult {
  const current = evaluateProfile(profile, data, objective).score;
  if ((drop.target || "equipment") === "pet" && drop.petIndex === undefined) {
    const candidates = [0, 1, 2].map((petIndex) => {
      const result = compareDropAtTarget(profile, { ...drop, petIndex }, data, objective, current);
      return {
        petIndex,
        currentScore: result.currentScore,
        dropScore: result.dropScore,
        delta: result.delta,
        verdict: result.verdict
      };
    });
    const best = candidates.reduce((winner, candidate) => candidate.delta > winner.delta ? candidate : winner, candidates[0]);
    return {
      ...best,
      bestPetIndex: best.petIndex,
      candidates
    };
  }
  return compareDropAtTarget(profile, drop, data, objective, current);
}

function compareDropAtTarget(
  profile: NormalizedProfile,
  drop: DropInput,
  data: GameDataBundle,
  objective: Objective,
  current: number
): DropComparisonResult & { petIndex?: number } {
  const next = cloneProfile(profile);
  const dropLines = (drop.secondaryStats || []).map((line) => ({ stat: line.stat, sourceId: reverseStatId(line.stat), value: Number(line.value || 0) }));
  const target = drop.target || "equipment";
  const currentEntry = dropTargetEntry(next, drop, target);
  const attackMultiplier = dropTargetMultiplier(next, target, "attack");
  const healthMultiplier = dropTargetMultiplier(next, target, "health");
  const attackDelta = Number(drop.attack || 0) * attackMultiplier - Number(currentEntry?.attack || 0) * attackMultiplier;
  const healthDelta = Number(drop.health || 0) * healthMultiplier - Number(currentEntry?.health || 0) * healthMultiplier;
  const nextStats = subtractStats(next.stats, statMapFromLines(currentEntry?.secondaryStats || []));
  next.stats = sumStats(nextStats, statMapFromLines(dropLines));
  next.base.attack += attackDelta;
  next.base.health += healthDelta;
  replaceDropTarget(next, drop, target, dropLines);
  const dropScore = evaluateProfile(next, data, objective).score;
  const delta = dropScore - current;
  return {
    currentScore: current,
    dropScore,
    delta,
    verdict: Math.abs(delta) < 0.001 ? "equal" : delta > 0 ? "better" : "worse",
    petIndex: target === "pet" ? clamp(Math.round(Number(drop.petIndex || 0)), 0, 2) : undefined
  };
}

function dropTargetEntry(profile: NormalizedProfile, drop: DropInput, target: NonNullable<DropInput["target"]>): NormalizedItem | NormalizedPet | NormalizedMount | null {
  if (target === "pet") return profile.pets[clamp(Math.round(Number(drop.petIndex || 0)), 0, 2)] || null;
  if (target === "mount") return profile.mount;
  return drop.slot ? profile.equipment[drop.slot] : null;
}

function dropTargetMultiplier(profile: NormalizedProfile, target: NonNullable<DropInput["target"]>, stat: "attack" | "health"): number {
  if (target === "pet") {
    const raw = profile.pets.reduce((total, pet) => total + Number(pet[stat] || 0), 0);
    const adjusted = stat === "attack" ? profile.breakdown.petAttack : profile.breakdown.petHealth;
    return raw > 0 && adjusted > 0 ? adjusted / raw : 1;
  }
  if (target === "mount") {
    const raw = Number(profile.mount?.[stat] || 0);
    const adjusted = stat === "attack" ? profile.breakdown.mountAttack : profile.breakdown.mountHealth;
    return raw > 0 && adjusted > 0 ? adjusted / raw : 1;
  }
  return 1;
}

function replaceDropTarget(
  profile: NormalizedProfile,
  drop: DropInput,
  target: NonNullable<DropInput["target"]>,
  secondaryStats: SecondaryLine[]
) {
  const common = {
    name: drop.name || (target === "mount" ? "Monture testée" : target === "pet" ? "Pet testé" : "Drop testé"),
    rarity: drop.rarity,
    id: drop.id,
    type: drop.petType,
    level: Math.max(1, Number(drop.level || 1)),
    attack: Number(drop.attack || 0),
    health: Number(drop.health || 0),
    secondaryStats,
    recognized: true
  };
  if (target === "pet") {
    const petIndex = clamp(Math.round(Number(drop.petIndex || 0)), 0, 2);
    while (profile.pets.length <= petIndex) {
      profile.pets.push({ name: `Pet ${profile.pets.length + 1}`, level: 1, attack: 0, health: 0, secondaryStats: [], recognized: false });
    }
    profile.pets[petIndex] = common;
    return;
  }
  if (target === "mount") {
    profile.mount = { ...common, skills: profile.mount?.skills || [] };
    return;
  }
  if (!drop.slot) throw new Error("Un slot est requis pour comparer un objet.");
  profile.equipment[drop.slot] = { ...common, slot: drop.slot };
}

export function combatProfile(profile: NormalizedProfile, data: GameDataBundle, fightDuration = 60): CombatProfile {
  const stats = profile.stats;
  const globalDamage = 1 + active(stats, "damage") / 100;
  const weaponSpecific = profile.base.weaponStyle === "ranged" ? 1 + active(stats, "rangedDamage") / 100 : 1 + active(stats, "meleeDamage") / 100;
  const attackSpeed = 1 + active(stats, "attackSpeed") / 100;
  const doubleHit = 1 + active(stats, "doubleChance") / 100;
  const critChance = active(stats, "critChance") / 100;
  const critMultiplier = 1.2 + active(stats, "critDamage") / 100;
  const weaponDpsPerAttack = globalDamage * weaponSpecific * attackSpeed * doubleHit * (1 + critChance * (critMultiplier - 1));
  const baseWeaponDps = profile.base.attack * weaponDpsPerAttack;
  const skill = spellContribution(profile.spells, stats, data, weaponDpsPerAttack);
  const weaponDps = baseWeaponDps + skill.averageBuffWeaponDps;
  const baseMaxHealth = profile.base.health * (1 + active(stats, "health") / 100);
  const maxHealth = baseMaxHealth + skill.averageBuffHealth;
  const regenPct = active(stats, "regen") / 100;
  const lifestealPct = active(stats, "lifesteal") / 100;
  const healingPerSecond = maxHealth * regenPct + weaponDps * lifestealPct + skill.supportPerSecond;
  return {
    baseWeaponDps,
    weaponDps,
    skillDps: skill.damagePerSecond,
    totalDps: weaponDps + skill.damagePerSecond,
    baseMaxHealth,
    maxHealth,
    healingPerSecond,
    sustainWindow: maxHealth + healingPerSecond * fightDuration,
    block: active(stats, "block") / 100,
    regenPct,
    lifestealPct,
    weaponDpsPerAttack,
    skills: skill.skills,
    breakdown: {
      baseAttack: profile.base.attack,
      baseHealth: profile.base.health,
      globalDamage,
      weaponSpecific,
      attackSpeed,
      doubleHit,
      critMultiplier,
      baseWeaponDps,
      averageBuffWeaponDps: skill.averageBuffWeaponDps,
      averageBuffHealth: skill.averageBuffHealth,
      skillDamagePerSecond: skill.damagePerSecond,
      skillSupportPerSecond: skill.supportPerSecond,
      aoeSkillCount: skill.skills.filter((entry) => entry.targetMode === "all").length,
      multiHitSkillCount: skill.skills.filter((entry) => entry.hitCount > 1).length
    }
  };
}

function reconstructItem(slot: EquipmentSlot, item: any, data: GameDataBundle, effects: TalentEffects, audit: AuditIssue[]): NormalizedItem {
  const age = readNumber(item.age ?? item.Age);
  const idx = readNumber(item.idx ?? item.Idx);
  const level = Math.max(0, readNumber(item.level ?? item.Level ?? 1));
  const jsonType = SLOT_TO_JSON_TYPE[slot];
  const key = `{'Age': ${age}, 'Type': '${jsonType}', 'Idx': ${idx}}`;
  const itemData = data.raw["ItemBalancingLibrary.json"]?.[key];
  const itemConfig = data.raw["ItemBalancingConfig.json"] || {};
  const levelScaling = Number(itemConfig.LevelScalingBase || 1.01);
  const levelMulti = Math.pow(levelScaling, Math.max(0, level - 1));
  const meleeMulti = slot === "Weapon" && !isRangedWeapon(item, data) ? Number(itemConfig.PlayerMeleeDamageMultiplier || 1.6) : 1;
  let attack = 0;
  let health = 0;
  let recognized = Boolean(itemData);

  if (!itemData?.EquipmentStats) {
    audit.push({ severity: "warning", code: "item_unresolved", message: `${slot}: impossible de reconstruire la valeur principale.`, path: `items.${slot}` });
  } else {
    for (const stat of itemData.EquipmentStats) {
      const statType = stat.StatNode?.UniqueStat?.StatType;
      const value = Number(stat.Value || 0) * levelMulti;
      if (statType === "Damage") attack += value * (1 + effects.equipment[slot].damagePct) * meleeMulti;
      if (statType === "Health") health += value * (1 + effects.equipment[slot].healthPct);
    }
  }

  const secondaryStats = readSecondaryLines(item.secondaryStats, audit, `items.${slot}.secondaryStats`).slice(0, itemSecondaryLineLimit({ age }));
  return {
    slot,
    name: item.customName || item.name || `${slot} ${age}:${idx}`,
    age,
    idx,
    level,
    rarity: item.rarity,
    attack,
    health,
    secondaryStats,
    recognized
  };
}

function reconstructPet(pet: any, index: number, data: GameDataBundle, effects: TalentEffects, audit: AuditIssue[]): NormalizedPet {
  const rarity = String(pet.rarity || pet.Rarity || "Common");
  const id = readNumber(pet.id ?? pet.Id);
  const level = Math.max(0, readNumber(pet.level ?? pet.Level ?? 0));
  const key = `{'Rarity': '${rarity}', 'Id': ${id}}`;
  const petInfo = data.raw["PetLibrary.json"]?.[key];
  const petType = petInfo?.Type || "Balanced";
  const typeMultiplier = data.raw["PetBalancingLibrary.json"]?.[petType] || { DamageMultiplier: 1, HealthMultiplier: 1 };
  const levelInfo = data.raw["PetUpgradeLibrary.json"]?.[rarity]?.LevelInfo?.[Math.max(0, level - 1)];
  let attack = 0;
  let health = 0;
  let recognized = Boolean(levelInfo);

  if (!levelInfo?.PetStats?.Stats) {
    audit.push({ severity: "warning", code: "pet_unresolved", message: `Pet ${index + 1}: niveau ou rareté non reconstruit.`, path: `pets.active.${index}` });
  } else {
    for (const stat of levelInfo.PetStats.Stats) {
      const statType = stat.StatNode?.UniqueStat?.StatType;
      if (statType === "Damage") attack += Number(stat.Value || 0) * Number(typeMultiplier.DamageMultiplier || 1) * (1 + effects.petDamagePct);
      if (statType === "Health") health += Number(stat.Value || 0) * Number(typeMultiplier.HealthMultiplier || 1) * (1 + effects.petHealthPct);
    }
  }

  return {
    name: pet.customName || `${rarity} pet ${id}`,
    rarity,
    id,
    type: petType,
    level,
    attack,
    health,
    secondaryStats: readSecondaryLines(pet.secondaryStats, audit, `pets.active.${index}.secondaryStats`).slice(0, petMountSecondaryLineLimit({ rarity })),
    recognized
  };
}

function reconstructMount(mount: any, data: GameDataBundle, effects: TalentEffects, audit: AuditIssue[]): NormalizedMount {
  const rarity = String(mount.rarity || mount.Rarity || "Common");
  const id = readNumber(mount.id ?? mount.Id);
  const level = Math.max(0, readNumber(mount.level ?? mount.Level ?? 0));
  const levelInfo = data.raw["MountUpgradeLibrary.json"]?.[rarity]?.LevelInfo?.[Math.max(0, level - 1)];
  let attack = 0;
  let health = 0;
  let recognized = Boolean(levelInfo);

  if (!levelInfo?.MountStats?.Stats) {
    audit.push({ severity: "warning", code: "mount_unresolved", message: "Monture: niveau ou rareté non reconstruit.", path: "mount.active" });
  } else {
    for (const stat of levelInfo.MountStats.Stats) {
      const statType = stat.StatNode?.UniqueStat?.StatType;
      if (statType === "Damage") attack += Number(stat.Value || 0) * (1 + effects.mountDamagePct);
      if (statType === "Health") health += Number(stat.Value || 0) * (1 + effects.mountHealthPct);
    }
  }

  return {
    name: mount.customName || `${rarity} mount ${id}`,
    rarity,
    id,
    level,
    attack,
    health,
    skills: Array.isArray(mount.skills) ? mount.skills.map(Number) : [],
    secondaryStats: readSecondaryLines(mount.secondaryStats, audit, "mount.active.secondaryStats").slice(0, petMountSecondaryLineLimit({ rarity })),
    recognized
  };
}

interface TalentEffects {
  equipment: Record<EquipmentSlot, { damagePct: number; healthPct: number }>;
  petDamagePct: number;
  petHealthPct: number;
  mountDamagePct: number;
  mountHealthPct: number;
  globalStats: StatMap;
}

function computeTalentEffects(tree: any, data: GameDataBundle): TalentEffects {
  const effects: TalentEffects = {
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, { damagePct: 0, healthPct: 0 }])) as TalentEffects["equipment"],
    petDamagePct: 0,
    petHealthPct: 0,
    mountDamagePct: 0,
    mountHealthPct: 0,
    globalStats: createEmptyStats()
  };
  const techLibrary = data.raw["TechTreeLibrary.json"] || {};

  for (const node of data.normalized.techNodes) {
    const level = readNumber(tree?.[node.tree]?.[node.id]);
    if (level <= 0) continue;
    const definition = techLibrary[node.type];
    for (const stat of definition?.Stats || []) {
      const target = stat.StatNode?.StatTarget || {};
      const targetType = target.$type;
      const statType = stat.StatNode?.UniqueStat?.StatType;
      const perLevel = Number(stat.ValueIncrease ?? stat.Value ?? 0);
      const value = perLevel * level;

      if (targetType === "WeaponStatTarget") applySlotEffect(effects, "Weapon", statType, value);
      if (targetType === "EquipmentStatTarget") {
        const slot = ITEM_TYPE_TO_SLOT[Number(target.ItemType)] as EquipmentSlot | undefined;
        if (slot) applySlotEffect(effects, slot, statType, value);
      }
      if (targetType === "PetStatTarget") {
        if (statType === "Damage" || statType === "TechTreeDamage") effects.petDamagePct += value;
        if (statType === "Health" || statType === "TechTreeHealth") effects.petHealthPct += value;
      }
      if (targetType === "MountStatTarget") {
        if (statType === "Damage" || statType === "TechTreeDamage") effects.mountDamagePct += value;
        if (statType === "Health" || statType === "TechTreeHealth") effects.mountHealthPct += value;
      }
      if (targetType === "ActiveSkillStatTarget" || targetType === "PassiveSkillStatTarget") {
        if (statType === "Damage" || statType === "SkillDamage") effects.globalStats.skillDamage += value * 100;
        if (statType === "Health" || statType === "SkillHealth") effects.globalStats.health += value * 100;
      }
    }
  }

  return effects;
}

function applySlotEffect(effects: TalentEffects, slot: EquipmentSlot, statType: string, value: number) {
  if (statType === "Damage" || statType === "TechTreeDamage") effects.equipment[slot].damagePct += value;
  if (statType === "Health" || statType === "TechTreeHealth") effects.equipment[slot].healthPct += value;
}

function normalizeTree(tree: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(tree || {})) {
    const level = clamp(Math.round(readNumber(value)), 0, 5);
    if (level > 0) out[key] = level;
  }
  return out;
}

function normalizeSpells(source: any, data: GameDataBundle, audit: AuditIssue[]): NormalizedSpellSelection[] {
  if (!Array.isArray(source)) return [];
  return source.slice(0, 3).flatMap((skill: any, index: number) => {
    const id = String(skill.id || skill.Type || "");
    const spell = data.normalized.spells.find((entry) => entry.id === id);
    if (!spell) {
      audit.push({ severity: "warning", code: "spell_unknown", message: `Sort ignoré: ${id || index + 1}.`, path: `skills.equipped.${index}` });
      return [];
    }
    return [{ id, level: clamp(Math.round(readNumber(skill.level ?? skill.Level ?? 1)), 1, 100), rarity: spell.rarity }];
  });
}

function readSecondaryLines(lines: any, audit: AuditIssue[], path: string): SecondaryLine[] {
  if (!Array.isArray(lines)) return [];
  return lines.flatMap((line, index) => {
    const sourceId = String(line?.statId || line?.Stat || line?.stat || line?.id || "");
    const stat = STAT_ID_MAP[sourceId] || STAT_ID_MAP[sourceId.replace(/\s+/g, "")];
    if (!stat) {
      if (sourceId) audit.push({ severity: "warning", code: "secondary_stat_unknown", message: `Stat secondaire ignorée: ${sourceId}.`, path: `${path}.${index}` });
      return [];
    }
    const rawValue = readNumber(line.value ?? line.Value ?? line.statValue);
    return [{ stat, sourceId, value: Math.abs(rawValue) <= 1 ? rawValue * 100 : rawValue }];
  });
}

function spellContribution(selected: NormalizedSpellSelection[], stats: StatMap, data: GameDataBundle, weaponDpsPerAttack: number) {
  const skillPower = 1 + active(stats, "damage") / 100 + active(stats, "skillDamage") / 100;
  const cooldownReduction = active(stats, "cooldown") / 100;
  let damagePerSecond = 0;
  let supportPerSecond = 0;
  let averageBuffWeaponDps = 0;
  let averageBuffHealth = 0;
  const skills: CombatSkill[] = [];

  for (const entry of selected) {
    const spell = data.normalized.spells.find((item) => item.id === entry.id);
    if (!spell) continue;
    const levelIndex = clamp(Math.round(entry.level || 1), 1, 100) - 1;
    const cooldown = spell.cooldown * Math.max(0.2, 1 - cooldownReduction);
    const activeDuration = Math.max(0, Number(spell.activeDuration || 0));
    const cycleDuration = Math.max(0.1, cooldown + activeDuration);
    const rawDamage = Number(spell.damageByLevel[levelIndex] || 0) * skillPower;
    const rawHealth = Number(spell.healthByLevel[levelIndex] || 0) * skillPower;
    const hitCount = Math.max(0, Number(spell.mechanics?.hitCount ?? 1));
    const kind = spell.mechanics?.kind === "buff" ? "buff" : "damage";
    const damagePerHit = kind === "damage" && hitCount > 0
      ? spell.mechanics?.damageValueMode === "per_hit" ? rawDamage : rawDamage / hitCount
      : 0;
    const healPerHit = kind === "damage" && hitCount > 0 ? rawHealth / hitCount : 0;
    const bonusAttack = kind === "buff" ? rawDamage : 0;
    const bonusHealth = kind === "buff" ? rawHealth : 0;
    const uptime = activeDuration > 0 ? activeDuration / cycleDuration : 0;
    const activationDamage = damagePerHit * hitCount;
    const activationHeal = healPerHit * hitCount;

    if (kind === "damage") {
      damagePerSecond += activationDamage / cycleDuration;
      supportPerSecond += activationHeal / cycleDuration;
    } else {
      averageBuffWeaponDps += bonusAttack * weaponDpsPerAttack * uptime;
      averageBuffHealth += bonusHealth * uptime;
      supportPerSecond += bonusHealth / cycleDuration;
    }

    skills.push({
      id: spell.id,
      kind,
      targetMode: spell.mechanics?.targetMode || (kind === "buff" ? "self" : "single"),
      cooldown,
      activeDuration,
      startupDelay: Number(spell.mechanics?.startupDelay || 3.2),
      castDelay: Number(spell.mechanics?.castDelay || 0),
      hitInterval: Number(spell.mechanics?.hitInterval || 0),
      hitCount,
      damagePerHit,
      healPerHit,
      bonusAttack,
      bonusHealth,
      confidence: spell.mechanics?.confidence || "low"
    });
  }
  return { damagePerSecond, supportPerSecond, averageBuffWeaponDps, averageBuffHealth, skills };
}

interface EncounterWave {
  enemyCount: number;
  totalHealth: number;
  totalDps: number;
}

interface EncounterResult {
  success: boolean;
  died: boolean;
  totalTime: number;
  currentHealth: number;
  currentMaxHealth: number;
  clearedWaves: number;
  killedEnemies: number;
  damageDone: number;
  weaponDamage: number;
  skillDamage: number;
  aoeDamage: number;
  skillCasts: number;
  skillHits: number;
}

function simulateEncounter(combat: CombatProfile, waves: EncounterWave[], maxSeconds: number, pauseSeconds = 0): EncounterResult {
  const epsilon = 0.000001;
  const runtimes = combat.skills.map((skill) => ({ skill, nextCast: Math.max(0, skill.startupDelay) }));
  const pendingHits: Array<{ time: number; skill: CombatSkill; weight: number }> = [];
  const activeBuffs: Array<{ skillId: string; expiresAt: number; bonusAttack: number; bonusHealth: number }> = [];
  let time = 0;
  let currentHealth = combat.baseMaxHealth;
  let currentMaxHealth = combat.baseMaxHealth;
  let enemies: number[] = [];
  let currentWaveDpsPerEnemy = 0;
  let pauseUntil: number | null = null;
  let clearedWaves = 0;
  let killedEnemies = 0;
  let damageDone = 0;
  let weaponDamage = 0;
  let skillDamage = 0;
  let aoeDamage = 0;
  let skillCasts = 0;
  let skillHits = 0;
  let died = false;
  let safety = 0;

  const loadWave = (index: number) => {
    const wave = waves[index];
    const count = Math.max(1, Math.round(wave.enemyCount || 1));
    const healthPerEnemy = Math.max(1, wave.totalHealth / count);
    enemies = Array.from({ length: count }, () => healthPerEnemy);
    currentWaveDpsPerEnemy = Math.max(0, wave.totalDps) / count;
    pauseUntil = null;
  };

  const removeDead = () => {
    const before = enemies.length;
    enemies = enemies.filter((health) => health > epsilon);
    killedEnemies += before - enemies.length;
    if (before > 0 && enemies.length === 0) {
      clearedWaves += 1;
      if (clearedWaves < waves.length) pauseUntil = time + pauseSeconds;
    }
  };

  const currentWeaponDps = () => {
    const bonusAttack = activeBuffs.reduce((sum, buff) => sum + buff.bonusAttack, 0);
    return combat.baseWeaponDps + bonusAttack * combat.weaponDpsPerAttack;
  };

  const currentHealingPerSecond = (weaponDps: number) =>
    currentMaxHealth * combat.regenPct + weaponDps * combat.lifestealPct;

  const dealSingle = (amount: number, source: "weapon" | "skill") => {
    if (!enemies.length || amount <= 0) return;
    const dealt = Math.min(enemies[0], amount);
    enemies[0] -= amount;
    damageDone += dealt;
    if (source === "weapon") weaponDamage += dealt;
    else skillDamage += dealt;
  };

  const dealAoe = (amount: number) => {
    if (!enemies.length || amount <= 0) return;
    for (let index = 0; index < enemies.length; index += 1) {
      const dealt = Math.min(enemies[index], amount);
      enemies[index] -= amount;
      damageDone += dealt;
      skillDamage += dealt;
      aoeDamage += dealt;
    }
  };

  if (waves.length) loadWave(0);

  while (time < maxSeconds - epsilon && clearedWaves < waves.length && !died && safety < 100_000) {
    safety += 1;

    if (pauseUntil !== null && time >= pauseUntil - epsilon) loadWave(clearedWaves);

    for (let index = activeBuffs.length - 1; index >= 0; index -= 1) {
      const buff = activeBuffs[index];
      if (buff.expiresAt > time + epsilon) continue;
      currentMaxHealth = Math.max(1, currentMaxHealth - buff.bonusHealth);
      currentHealth = Math.min(currentHealth, currentMaxHealth);
      activeBuffs.splice(index, 1);
    }

    for (const runtime of runtimes) {
      if (runtime.nextCast > time + epsilon) continue;
      const skill = runtime.skill;
      skillCasts += 1;
      if (skill.kind === "buff") {
        const expiresAt = time + Math.max(0, skill.activeDuration);
        activeBuffs.push({ skillId: skill.id, expiresAt, bonusAttack: skill.bonusAttack, bonusHealth: skill.bonusHealth });
        currentMaxHealth += skill.bonusHealth;
        currentHealth = Math.min(currentMaxHealth, currentHealth + skill.bonusHealth);
      } else {
        const weights = skillHitWeights(skill.hitCount);
        weights.forEach((weight, index) => {
          pendingHits.push({
            time: time + skill.castDelay + index * skill.hitInterval,
            skill,
            weight
          });
        });
      }
      runtime.nextCast = time + Math.max(0.1, skill.cooldown + skill.activeDuration);
    }

    const dueHits = pendingHits.filter((hit) => hit.time <= time + epsilon);
    for (const hit of dueHits) {
      const amount = hit.skill.damagePerHit * hit.weight;
      if (hit.skill.targetMode === "all") dealAoe(amount);
      else dealSingle(amount, "skill");
      if (hit.skill.healPerHit > 0) currentHealth = Math.min(currentMaxHealth, currentHealth + hit.skill.healPerHit * hit.weight);
      skillHits += 1;
    }
    for (let index = pendingHits.length - 1; index >= 0; index -= 1) {
      if (pendingHits[index].time <= time + epsilon) pendingHits.splice(index, 1);
    }
    removeDead();
    if (clearedWaves >= waves.length) break;

    const weaponDps = enemies.length ? currentWeaponDps() : 0;
    const incomingDps = enemies.length
      ? currentWaveDpsPerEnemy * enemies.length * Math.max(0.05, 1 - combat.block)
      : 0;
    const healingPerSecond = currentHealingPerSecond(weaponDps);
    const netIncoming = incomingDps - healingPerSecond;
    const nextCast = Math.min(...runtimes.map((runtime) => runtime.nextCast), Number.POSITIVE_INFINITY);
    const nextHit = Math.min(...pendingHits.map((hit) => hit.time), Number.POSITIVE_INFINITY);
    const nextExpiry = Math.min(...activeBuffs.map((buff) => buff.expiresAt), Number.POSITIVE_INFINITY);
    const nextPause = pauseUntil ?? Number.POSITIVE_INFINITY;
    const enemyDeathTime = enemies.length && weaponDps > 0 ? time + enemies[0] / weaponDps : Number.POSITIVE_INFINITY;
    const playerDeathTime = netIncoming > 0 ? time + currentHealth / netIncoming : Number.POSITIVE_INFINITY;
    const nextTime = Math.min(maxSeconds, nextCast, nextHit, nextExpiry, nextPause, enemyDeathTime, playerDeathTime);
    const delta = Math.max(epsilon, nextTime - time);

    if (weaponDps > 0 && enemies.length) dealSingle(weaponDps * delta, "weapon");
    currentHealth = clamp(currentHealth + (healingPerSecond - incomingDps) * delta, 0, currentMaxHealth);
    time = Math.min(maxSeconds, time + delta);
    if (currentHealth <= epsilon) died = true;
    removeDead();
  }

  return {
    success: clearedWaves >= waves.length,
    died,
    totalTime: time,
    currentHealth,
    currentMaxHealth,
    clearedWaves,
    killedEnemies,
    damageDone,
    weaponDamage,
    skillDamage,
    aoeDamage,
    skillCasts,
    skillHits
  };
}

function skillHitWeights(hitCount: number): number[] {
  const count = Math.max(0, hitCount);
  const whole = Math.floor(count);
  const remainder = count - whole;
  const weights = Array.from({ length: whole }, () => 1);
  if (remainder > 0.0001) weights.push(remainder);
  return weights;
}

interface PvpActor {
  combat: CombatProfile;
  health: number;
  maxHealth: number;
  activeBuffs: Array<{ skillId: string; expiresAt: number; bonusAttack: number; bonusHealth: number }>;
  skills: Array<{ skill: CombatSkill; nextCast: number }>;
  pendingHits: Array<{ time: number; skill: CombatSkill; weight: number }>;
  damage: number;
  skillDamage: number;
  skillCasts: number;
}

interface PvpDuelResult {
  winner: "player" | "opponent" | "draw";
  chance: number;
  duration: number;
  playerHealth: number;
  opponentHealth: number;
  playerDamage: number;
  opponentDamage: number;
  playerSkillDamage: number;
  opponentSkillDamage: number;
  playerSkillCasts: number;
  opponentSkillCasts: number;
  playerCombat: CombatProfile;
  opponentCombat: CombatProfile;
}

function simulatePvpDuel(player: NormalizedProfile, opponent: NormalizedProfile, data: GameDataBundle, requestedDuration: number): PvpDuelResult {
  const config = data.raw["PvpBaseConfig.json"] || {};
  const matchDuration = clamp(
    Math.min(readNumber(requestedDuration) || 60, readNumber(config.PvpMatchTimerSeconds) || 60),
    5,
    600
  );
  const skillHealthMultiplier = readNumber(config.PvpHpSkillMultiplier) || 0.5;
  const playerCombat = combatProfile(pvpAdjustedProfile(player, config), data, matchDuration);
  const opponentCombat = combatProfile(pvpAdjustedProfile(opponent, config), data, matchDuration);
  const playerActor = createPvpActor(playerCombat);
  const opponentActor = createPvpActor(opponentCombat);
  let time = 0;
  let safety = 0;
  const epsilon = 0.000001;

  while (time < matchDuration - epsilon && playerActor.health > epsilon && opponentActor.health > epsilon && safety < 100_000) {
    safety += 1;
    expirePvpBuffs(playerActor, time);
    expirePvpBuffs(opponentActor, time);
    castPvpSkills(playerActor, time, skillHealthMultiplier);
    castPvpSkills(opponentActor, time, skillHealthMultiplier);

    const playerHit = consumePvpHits(playerActor, opponentActor, time);
    const opponentHit = consumePvpHits(opponentActor, playerActor, time);
    if (playerHit.heal > 0) playerActor.health = Math.min(playerActor.maxHealth, playerActor.health + playerHit.heal);
    if (opponentHit.heal > 0) opponentActor.health = Math.min(opponentActor.maxHealth, opponentActor.health + opponentHit.heal);
    opponentActor.health = Math.max(0, opponentActor.health - playerHit.damage);
    playerActor.health = Math.max(0, playerActor.health - opponentHit.damage);
    if (playerActor.health <= epsilon || opponentActor.health <= epsilon) break;

    const playerWeapon = pvpWeaponDps(playerActor) * Math.max(0.05, 1 - opponentActor.combat.block);
    const opponentWeapon = pvpWeaponDps(opponentActor) * Math.max(0.05, 1 - playerActor.combat.block);
    const playerHealing = playerActor.maxHealth * playerActor.combat.regenPct + playerWeapon * playerActor.combat.lifestealPct;
    const opponentHealing = opponentActor.maxHealth * opponentActor.combat.regenPct + opponentWeapon * opponentActor.combat.lifestealPct;
    const playerNetDamage = Math.max(0, opponentWeapon - playerHealing);
    const opponentNetDamage = Math.max(0, playerWeapon - opponentHealing);
    const nextEvent = Math.min(
      matchDuration,
      nextPvpEvent(playerActor),
      nextPvpEvent(opponentActor),
      playerNetDamage > 0 ? time + playerActor.health / playerNetDamage : Number.POSITIVE_INFINITY,
      opponentNetDamage > 0 ? time + opponentActor.health / opponentNetDamage : Number.POSITIVE_INFINITY
    );
    const delta = Math.max(epsilon, nextEvent - time);
    const dealtByPlayer = Math.min(opponentActor.health, playerWeapon * delta);
    const dealtByOpponent = Math.min(playerActor.health, opponentWeapon * delta);
    playerActor.damage += dealtByPlayer;
    opponentActor.damage += dealtByOpponent;
    opponentActor.health = clamp(opponentActor.health + (opponentHealing - playerWeapon) * delta, 0, opponentActor.maxHealth);
    playerActor.health = clamp(playerActor.health + (playerHealing - opponentWeapon) * delta, 0, playerActor.maxHealth);
    time = Math.min(matchDuration, time + delta);
  }

  const playerPct = playerActor.health / Math.max(1, playerActor.maxHealth);
  const opponentPct = opponentActor.health / Math.max(1, opponentActor.maxHealth);
  const winner = playerActor.health <= epsilon && opponentActor.health <= epsilon
    ? "draw"
    : opponentActor.health <= epsilon
      ? "player"
      : playerActor.health <= epsilon
        ? "opponent"
        : Math.abs(playerPct - opponentPct) < 0.0001
          ? "draw"
          : playerPct > opponentPct ? "player" : "opponent";
  const timeBonus = (matchDuration - time) / matchDuration;
  const advantage = (playerPct - opponentPct) * 2
    + (winner === "player" ? 0.8 + timeBonus : winner === "opponent" ? -0.8 - timeBonus : 0);
  const chance = clamp(100 / (1 + Math.exp(-advantage * 2.2)), 1, 99);

  return {
    winner,
    chance,
    duration: time,
    playerHealth: playerActor.health,
    opponentHealth: opponentActor.health,
    playerDamage: playerActor.damage,
    opponentDamage: opponentActor.damage,
    playerSkillDamage: playerActor.skillDamage,
    opponentSkillDamage: opponentActor.skillDamage,
    playerSkillCasts: playerActor.skillCasts,
    opponentSkillCasts: opponentActor.skillCasts,
    playerCombat,
    opponentCombat
  };
}

function pvpAdjustedProfile(profile: NormalizedProfile, config: any): NormalizedProfile {
  const adjusted = cloneProfile(profile);
  const baseMultiplier = readNumber(config.PvpHpBaseMultiplier) || 1;
  const petMultiplier = readNumber(config.PvpHpPetMultiplier) || 0.5;
  const mountMultiplier = readNumber(config.PvpHpMountMultiplier) || 2;
  adjusted.base.health =
    (Number(adjusted.breakdown.baseHealth || 0) + Number(adjusted.breakdown.equipmentHealth || 0)) * baseMultiplier
    + Number(adjusted.breakdown.petHealth || 0) * petMultiplier
    + Number(adjusted.breakdown.mountHealth || 0) * mountMultiplier;
  return adjusted;
}

function createPvpActor(combat: CombatProfile): PvpActor {
  return {
    combat,
    health: combat.baseMaxHealth,
    maxHealth: combat.baseMaxHealth,
    activeBuffs: [],
    skills: combat.skills.map((skill) => ({ skill, nextCast: Math.max(0, skill.startupDelay) })),
    pendingHits: [],
    damage: 0,
    skillDamage: 0,
    skillCasts: 0
  };
}

function expirePvpBuffs(actor: PvpActor, time: number) {
  for (let index = actor.activeBuffs.length - 1; index >= 0; index -= 1) {
    const buff = actor.activeBuffs[index];
    if (buff.expiresAt > time + 0.000001) continue;
    actor.maxHealth = Math.max(1, actor.maxHealth - buff.bonusHealth);
    actor.health = Math.min(actor.health, actor.maxHealth);
    actor.activeBuffs.splice(index, 1);
  }
}

function castPvpSkills(actor: PvpActor, time: number, skillHealthMultiplier: number) {
  for (const runtime of actor.skills) {
    if (runtime.nextCast > time + 0.000001) continue;
    const skill = runtime.skill;
    actor.skillCasts += 1;
    if (skill.kind === "buff") {
      const bonusHealth = skill.bonusHealth * skillHealthMultiplier;
      actor.activeBuffs.push({
        skillId: skill.id,
        expiresAt: time + skill.activeDuration,
        bonusAttack: skill.bonusAttack,
        bonusHealth
      });
      actor.maxHealth += bonusHealth;
      actor.health = Math.min(actor.maxHealth, actor.health + bonusHealth);
    } else {
      skillHitWeights(skill.hitCount).forEach((weight, index) => {
        actor.pendingHits.push({
          time: time + skill.castDelay + index * skill.hitInterval,
          skill,
          weight
        });
      });
    }
    runtime.nextCast = time + Math.max(0.1, skill.cooldown + skill.activeDuration);
  }
}

function consumePvpHits(source: PvpActor, target: PvpActor, time: number): { damage: number; heal: number } {
  let damage = 0;
  let heal = 0;
  for (let index = source.pendingHits.length - 1; index >= 0; index -= 1) {
    const hit = source.pendingHits[index];
    if (hit.time > time + 0.000001) continue;
    const dealt = hit.skill.damagePerHit * hit.weight * Math.max(0.05, 1 - target.combat.block);
    damage += dealt;
    heal += hit.skill.healPerHit * hit.weight;
    source.skillDamage += Math.min(target.health, dealt);
    source.damage += Math.min(target.health, dealt);
    source.pendingHits.splice(index, 1);
  }
  return { damage, heal };
}

function pvpWeaponDps(actor: PvpActor): number {
  const bonusAttack = actor.activeBuffs.reduce((sum, buff) => sum + buff.bonusAttack, 0);
  return actor.combat.baseWeaponDps + bonusAttack * actor.combat.weaponDpsPerAttack;
}

function nextPvpEvent(actor: PvpActor): number {
  return Math.min(
    ...actor.skills.map((runtime) => runtime.nextCast),
    ...actor.pendingHits.map((hit) => hit.time),
    ...actor.activeBuffs.map((buff) => buff.expiresAt),
    Number.POSITIVE_INFINITY
  );
}

function resolveScenarioSet(combat: CombatProfile, settings: ScenarioSettings = {}, profile?: NormalizedProfile, data?: GameDataBundle): ResolvedScenarioSet {
  const levelRange = resolveLevelRange(settings.levelRange, profile, data);
  const endurance = { ...DEFAULT_SCENARIOS.endurance, ...(settings.endurance || {}) };
  const timeToKill = { ...DEFAULT_SCENARIOS.timeToKill, ...(settings.timeToKill || {}) };
  const gauntlet = { ...DEFAULT_SCENARIOS.gauntlet, ...(settings.gauntlet || {}) };
  const enduranceStartPct = clamp(readNumber(endurance.startDamagePct), 0, 100);
  const enduranceGrowthPct = clamp(readNumber(endurance.growthPct), 0, 20);
  const killTargetSeconds = clamp(readNumber(timeToKill.targetSeconds), 1, 600);
  const gauntletFirstSeconds = clamp(readNumber(gauntlet.firstMobSeconds), 1, 600);
  const target = levelRange.battleTarget;
  const targetHealth = target?.totalHealth;
  const targetDps = target?.peakDps;

  return {
    levelRange,
    endurance: {
      startDamagePct: enduranceStartPct,
      growthPct: enduranceGrowthPct,
      maxSeconds: clamp(readNumber(endurance.maxSeconds), 10, 7200),
      startDamagePerSecond: targetDps ?? combat.maxHealth * enduranceStartPct / 100 * levelRange.startMultiplier,
      growthDamagePerSecond: combat.maxHealth * enduranceGrowthPct / 100 * levelRange.averageMultiplier
    },
    timeToKill: {
      targetSeconds: killTargetSeconds,
      incomingDamagePct: clamp(readNumber(timeToKill.incomingDamagePct), 0, 100),
      maxSeconds: clamp(readNumber(timeToKill.maxSeconds), 5, 7200),
      mobHealth: Math.max(1, targetHealth ?? combat.totalDps * killTargetSeconds * levelRange.averageMultiplier),
      incomingDamagePerSecond: targetDps ?? combat.maxHealth * clamp(readNumber(timeToKill.incomingDamagePct), 0, 100) / 100 * levelRange.averageMultiplier
    },
    gauntlet: {
      mobCount: clamp(Math.round(readNumber(gauntlet.mobCount)), 1, 100),
      firstMobSeconds: gauntletFirstSeconds,
      firstDamagePct: clamp(readNumber(gauntlet.firstDamagePct), 0, 100),
      healthGrowthPct: clamp(readNumber(gauntlet.healthGrowthPct), -90, 500),
      damageGrowthPct: clamp(readNumber(gauntlet.damageGrowthPct), -90, 500),
      pauseSeconds: clamp(readNumber(gauntlet.pauseSeconds), 0, 120),
      maxSeconds: clamp(readNumber(gauntlet.maxSeconds), 5, 7200),
      firstMobHealth: Math.max(1, target?.waves[0]?.totalHealth ?? combat.totalDps * gauntletFirstSeconds),
      firstDamagePerSecond: target?.waves[0]?.totalDps ?? combat.maxHealth * clamp(readNumber(gauntlet.firstDamagePct), 0, 100) / 100,
      waves: target?.waves
    }
  };
}

function resolveLevelRange(settings: Partial<LevelRangeSettings> | undefined, profile?: NormalizedProfile, data?: GameDataBundle): ResolvedLevelRange {
  const { estimatedAge, estimatedCombat } = estimateProfileProgress();
  const estimatedPlayerLevel = estimatedCombat;
  const rawAge = Math.round(readNumber(settings?.age ?? settings?.min));
  const rawCombat = Math.round(readNumber(settings?.combat ?? settings?.max));
  const difficulty = clamp(Math.round(readNumber(settings?.difficulty)), 0, 1);
  const requestedAge = rawAge > 0 ? clamp(rawAge, 1, 11) : estimatedAge;
  const requestedCombat = rawCombat > 0 ? clamp(rawCombat, 1, 20) : estimatedCombat;
  const battleTarget = data ? resolveBattleTarget(data, requestedAge, requestedCombat, difficulty) : undefined;
  const age = battleTarget?.age ?? requestedAge;
  const combat = battleTarget?.combat ?? requestedCombat;
  const multiplier = battleTarget ? 1 : progressMultiplier(age, combat, estimatedAge, estimatedCombat);

  return {
    min: age,
    max: combat,
    average: combat,
    estimatedPlayerLevel,
    age,
    combat,
    difficulty,
    estimatedAge,
    estimatedCombat,
    startMultiplier: multiplier,
    endMultiplier: multiplier,
    averageMultiplier: multiplier,
    battleTarget
  };
}

function resolveBattleTarget(data: GameDataBundle, visibleAge: number, visibleCombat: number, difficulty: number): BattleTarget | undefined {
  const mainBattleLibrary = data.raw["MainBattleLibrary.json"] || {};
  const ageScalingLibrary = data.raw["EnemyAgeScalingLibrary.json"] || {};
  const enemyLibrary = data.raw["EnemyLibrary.json"] || {};
  if (!Object.keys(mainBattleLibrary).length || !Object.keys(ageScalingLibrary).length || !Object.keys(enemyLibrary).length) return undefined;

  const stages = availableBattleStages(mainBattleLibrary);
  if (!stages.length) return undefined;
  const requestedAgeIdx = Math.max(0, Math.round(visibleAge) - 1);
  const ageIdx = stages.some((stage) => stage.ageIdx === requestedAgeIdx)
    ? requestedAgeIdx
    : nearestNumber(stages.map((stage) => stage.ageIdx), requestedAgeIdx);
  const combatCount = stages.filter((stage) => stage.ageIdx === ageIdx).length || 1;
  const battleIdx = clamp(Math.round(visibleCombat) - 1, 0, Math.max(0, combatCount - 1));
  const battle = findBattleConfig(mainBattleLibrary, ageIdx, battleIdx);
  const ageScaling = ageScalingLibrary[String(ageIdx)] || ageScalingLibrary[ageIdx];
  if (!battle?.Waves?.length || !ageScaling) return undefined;

  const baseHealth = readNumber(ageScaling.Health?.Raw);
  const baseDamage = readNumber(ageScaling.Damage?.Raw);
  const enemyRangedMulti = readNumber(data.raw["ItemBalancingConfig.json"]?.EnemyRangedDamageMultiplier) || 1;
  const battleConfig = data.raw["MainBattleConfig.json"] || {};
  const healthDifficultyMultiplier = difficulty > 0 ? readNumber(battleConfig.EnemyHpDifficultyMulti) || 6_000_000 : 1;
  const damageDifficultyMultiplier = difficulty > 0 ? readNumber(battleConfig.EnemyDmgDifficultyMulti) || 6_000_000 : 1;
  const waves: BattleWaveTarget[] = battle.Waves.map((wave: any, waveIndex: number) => {
    let totalHealth = 0;
    let totalDps = 0;
    let enemyCount = 0;
    for (const enemy of wave.Enemies || []) {
      const count = Math.max(0, Math.round(readNumber(enemy.Count)));
      const enemyDefinition = enemyLibrary[String(enemy.Id)] || enemyLibrary[enemy.Id];
      const weaponInfo = resolveEnemyWeapon(enemyDefinition, data.raw["WeaponLibrary.json"] || {});
      const isRanged = Boolean(weaponInfo && readNumber(weaponInfo.AttackRange) > 1);
      const attackDuration = Math.max(0.2, readNumber(weaponInfo?.AttackDuration) || 1.5);
      const health = baseHealth * MAIN_BATTLE_ENEMY_SCALE * healthDifficultyMultiplier;
      const damagePerHit = baseDamage * (isRanged ? enemyRangedMulti : 1) * MAIN_BATTLE_ENEMY_SCALE * damageDifficultyMultiplier;
      totalHealth += health * count;
      totalDps += (damagePerHit / attackDuration) * count;
      enemyCount += count;
    }
    return { waveIndex, totalHealth, totalDps, enemyCount };
  });

  return {
    ageIdx,
    battleIdx,
    age: ageIdx + 1,
    combat: battleIdx + 1,
    difficulty,
    waveCount: waves.length,
    enemyCount: waves.reduce((sum, wave) => sum + wave.enemyCount, 0),
    totalHealth: waves.reduce((sum, wave) => sum + wave.totalHealth, 0),
    peakDps: Math.max(...waves.map((wave) => wave.totalDps), 0),
    averageDps: waves.reduce((sum, wave) => sum + wave.totalDps, 0) / Math.max(1, waves.length),
    waves
  };
}

function availableBattleStages(mainBattleLibrary: Record<string, any>): Array<{ ageIdx: number; battleIdx: number }> {
  return Object.values<any>(mainBattleLibrary)
    .flatMap((entry) => {
      const ageIdx = readNumber(entry.BattleId?.AgeIdx ?? entry.AgeIdx);
      const battleIdx = readNumber(entry.BattleId?.BattleIdx ?? entry.BattleIdx);
      return Number.isFinite(ageIdx) && Number.isFinite(battleIdx) ? [{ ageIdx, battleIdx }] : [];
    })
    .sort((left, right) => left.ageIdx - right.ageIdx || left.battleIdx - right.battleIdx);
}

function findBattleConfig(mainBattleLibrary: Record<string, any>, ageIdx: number, battleIdx: number): any {
  const directKey = `{'AgeIdx': ${ageIdx}, 'BattleIdx': ${battleIdx}}`;
  return mainBattleLibrary[directKey] || Object.values<any>(mainBattleLibrary).find((entry) =>
    readNumber(entry.BattleId?.AgeIdx ?? entry.AgeIdx) === ageIdx &&
    readNumber(entry.BattleId?.BattleIdx ?? entry.BattleIdx) === battleIdx
  );
}

function resolveEnemyWeapon(enemyDefinition: any, weaponLibrary: Record<string, any>): any {
  const weaponId = enemyDefinition?.WeaponId;
  if (!weaponId) return null;
  const directKey = `{'Age': ${weaponId.Age}, 'Type': 'Weapon', 'Idx': ${weaponId.Idx}}`;
  return weaponLibrary[directKey] || Object.values<any>(weaponLibrary).find((weapon) =>
    readNumber(weapon.ItemId?.Age) === readNumber(weaponId.Age) &&
    String(weapon.ItemId?.Type || "") === "Weapon" &&
    readNumber(weapon.ItemId?.Idx) === readNumber(weaponId.Idx)
  ) || null;
}

function nearestNumber(values: number[], target: number): number {
  return values.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best, values[0] ?? target);
}

function battleModeLabel(difficulty: number): string {
  return difficulty > 0 ? "Difficile" : "Normal";
}

function estimateProfileProgress(): { estimatedAge: number; estimatedCombat: number } {
  return { estimatedAge: 1, estimatedCombat: 1 };
}

function levelMultiplier(level: number, referenceLevel: number): number {
  const delta = clamp(level - referenceLevel, -250, 250);
  return Math.pow(1.08, delta);
}

function progressMultiplier(age: number, combat: number, referenceAge: number, referenceCombat: number): number {
  const ageDelta = clamp(age - referenceAge, -20, 20);
  const combatDelta = clamp(combat - referenceCombat, -250, 250);
  return Math.pow(2, ageDelta) * levelMultiplier(referenceCombat + combatDelta, referenceCombat);
}

function evaluateScenarios(combat: CombatProfile, scenarioSet: ResolvedScenarioSet): ScenarioResult[] {
  return [
    simulateEndurance(combat, scenarioSet.endurance, scenarioSet.levelRange),
    simulateTimeToKill(combat, scenarioSet.timeToKill, scenarioSet.levelRange),
    simulateGauntlet(combat, scenarioSet.gauntlet, scenarioSet.levelRange)
  ];
}

function simulateEndurance(combat: CombatProfile, scenario: ResolvedScenarioSet["endurance"], levelRange: ResolvedLevelRange): ScenarioResult {
  const mitigation = Math.max(0.05, 1 - combat.block);
  const startDamage = scenario.startDamagePerSecond * mitigation;
  const levelGrowthDamage = combat.maxHealth * scenario.startDamagePct / 100 * Math.max(0, levelRange.endMultiplier - levelRange.startMultiplier) / Math.max(1, scenario.maxSeconds);
  const growth = (scenario.growthDamagePerSecond + levelGrowthDamage) * mitigation;
  const baseNet = startDamage - combat.healingPerSecond;
  let timeAlive = scenario.maxSeconds;

  if (growth <= 0) {
    if (baseNet > 0) timeAlive = combat.maxHealth / baseNet;
  } else {
    const discriminant = baseNet * baseNet + 2 * growth * combat.maxHealth;
    timeAlive = (-baseNet + Math.sqrt(Math.max(0, discriminant))) / growth;
  }

  const cappedTime = clamp(timeAlive, 0, scenario.maxSeconds);
  const success = cappedTime >= scenario.maxSeconds - 0.001;
  const incomingAtEnd = startDamage + growth * cappedTime;

  return {
    id: "endurance",
    kind: "endurance",
    label: "Mob intuable",
    summary: success ? `Tient ${format(cappedTime, 1)}s+` : `Tombe a ${format(cappedTime, 1)}s`,
    score: Math.log1p(cappedTime) * (success ? 1.12 : 1),
    success,
    metrics: {
      timeAlive: cappedTime,
      startDamagePerSecond: startDamage,
      damagePerSecondAtEnd: incomingAtEnd,
      healingPerSecond: combat.healingPerSecond,
      targetEnemyDps: levelRange.battleTarget?.peakDps || 0,
      targetEnemyHealth: levelRange.battleTarget?.totalHealth || 0,
      realBattleData: levelRange.battleTarget ? 1 : 0,
      age: levelRange.age,
      combat: levelRange.combat,
      difficulty: levelRange.difficulty,
      estimatedAge: levelRange.estimatedAge,
      estimatedCombat: levelRange.estimatedCombat,
      levelMin: levelRange.min,
      levelMax: levelRange.max,
      estimatedPlayerLevel: levelRange.estimatedPlayerLevel
    }
  };
}

function simulateTimeToKill(combat: CombatProfile, scenario: ResolvedScenarioSet["timeToKill"], levelRange: ResolvedLevelRange): ScenarioResult {
  const incoming = scenario.incomingDamagePerSecond * Math.max(0.05, 1 - combat.block);
  const encounter = simulateEncounter(combat, [{
    enemyCount: 1,
    totalHealth: scenario.mobHealth,
    totalDps: scenario.incomingDamagePerSecond
  }], scenario.maxSeconds);
  const killTime = encounter.success ? encounter.totalTime : scenario.maxSeconds;
  const deathTime = encounter.died ? encounter.totalTime : scenario.maxSeconds;
  const timeSpent = encounter.totalTime;
  const damageDone = encounter.damageDone;
  const success = encounter.success;
  const speedScore = Math.log1p(scenario.maxSeconds / Math.max(0.1, killTime));

  return {
    id: "timeToKill",
    kind: "timeToKill",
    label: "Mob fragile",
    summary: success ? `Tue en ${format(killTime, 1)}s` : `Echoue a ${format(timeSpent, 1)}s`,
    score: success ? 5 + speedScore : Math.max(0, damageDone / scenario.mobHealth) * 3 - 1,
    success,
    metrics: {
      killTime,
      deathTime,
      mobHealth: scenario.mobHealth,
      damageDone,
      incomingDamagePerSecond: incoming,
      weaponDamage: encounter.weaponDamage,
      skillDamage: encounter.skillDamage,
      aoeDamage: encounter.aoeDamage,
      skillCasts: encounter.skillCasts,
      skillHits: encounter.skillHits,
      targetEnemyDps: levelRange.battleTarget?.peakDps || 0,
      targetEnemyHealth: levelRange.battleTarget?.totalHealth || 0,
      realBattleData: levelRange.battleTarget ? 1 : 0,
      age: levelRange.age,
      combat: levelRange.combat,
      difficulty: levelRange.difficulty,
      estimatedAge: levelRange.estimatedAge,
      estimatedCombat: levelRange.estimatedCombat,
      levelMin: levelRange.min,
      levelMax: levelRange.max,
      estimatedPlayerLevel: levelRange.estimatedPlayerLevel
    }
  };
}

function simulateGauntlet(combat: CombatProfile, scenario: ResolvedScenarioSet["gauntlet"], levelRange: ResolvedLevelRange): ScenarioResult {
  if (scenario.waves?.length) return simulateBattleWaves(combat, scenario, levelRange);

  const mitigation = Math.max(0.05, 1 - combat.block);
  const healthGrowth = 1 + scenario.healthGrowthPct / 100;
  const damageGrowth = 1 + scenario.damageGrowthPct / 100;
  const waves = Array.from({ length: scenario.mobCount }, (_, index) => {
    const mobLevelMultiplier = levelRange.averageMultiplier;
    return {
      enemyCount: 1,
      totalHealth: scenario.firstMobHealth * Math.pow(healthGrowth, index) * mobLevelMultiplier,
      totalDps: scenario.firstDamagePerSecond * Math.pow(damageGrowth, index) * mobLevelMultiplier
    };
  });
  const encounter = simulateEncounter(combat, waves, scenario.maxSeconds, scenario.pauseSeconds);
  const killed = encounter.killedEnemies;
  const success = encounter.success;
  const remainingHealthPct = encounter.currentMaxHealth <= 0 ? 0 : encounter.currentHealth / encounter.currentMaxHealth;
  const speedBonus = success ? Math.log1p(scenario.maxSeconds / Math.max(1, encounter.totalTime)) : 0;

  return {
    id: "gauntlet",
    kind: "gauntlet",
    label: "Serie de mobs",
    summary: success ? `${killed}/${scenario.mobCount} en ${format(encounter.totalTime, 1)}s` : `${killed}/${scenario.mobCount} avant chute`,
    score: (killed / scenario.mobCount) * 8 + Math.max(0, remainingHealthPct) * 2 + speedBonus,
    success,
    metrics: {
      killed,
      mobCount: scenario.mobCount,
      totalTime: encounter.totalTime,
      remainingHealthPct: Math.max(0, remainingHealthPct) * 100,
      firstMobHealth: scenario.firstMobHealth,
      lastDamagePerSecond: scenario.firstDamagePerSecond * Math.pow(damageGrowth, Math.max(0, killed - 1)) * levelRange.averageMultiplier * mitigation,
      weaponDamage: encounter.weaponDamage,
      skillDamage: encounter.skillDamage,
      aoeDamage: encounter.aoeDamage,
      skillCasts: encounter.skillCasts,
      skillHits: encounter.skillHits,
      targetEnemyDps: levelRange.battleTarget?.peakDps || 0,
      targetEnemyHealth: levelRange.battleTarget?.totalHealth || 0,
      realBattleData: levelRange.battleTarget ? 1 : 0,
      age: levelRange.age,
      combat: levelRange.combat,
      difficulty: levelRange.difficulty,
      estimatedAge: levelRange.estimatedAge,
      estimatedCombat: levelRange.estimatedCombat,
      levelMin: levelRange.min,
      levelMax: levelRange.max,
      estimatedPlayerLevel: levelRange.estimatedPlayerLevel
    }
  };
}

function simulateBattleWaves(combat: CombatProfile, scenario: ResolvedScenarioSet["gauntlet"], levelRange: ResolvedLevelRange): ScenarioResult {
  const waves = scenario.waves || [];
  const mitigation = Math.max(0.05, 1 - combat.block);
  const encounter = simulateEncounter(combat, waves, scenario.maxSeconds, scenario.pauseSeconds);
  const success = encounter.success;
  const remainingHealthPct = encounter.currentMaxHealth <= 0 ? 0 : encounter.currentHealth / encounter.currentMaxHealth;
  const totalEnemyHealth = waves.reduce((sum, wave) => sum + wave.totalHealth, 0);
  const peakWaveDps = Math.max(...waves.map((wave) => wave.totalDps), 0);
  const speedBonus = success ? Math.log1p(scenario.maxSeconds / Math.max(1, encounter.totalTime)) : 0;
  const progress = encounter.clearedWaves / Math.max(1, waves.length);

  return {
    id: "gauntlet",
    kind: "gauntlet",
    label: "Combat cible",
    summary: success ? `Passe ${battleModeLabel(levelRange.difficulty)} ${levelRange.age}-${levelRange.combat} en ${format(encounter.totalTime, 1)}s` : `${encounter.clearedWaves}/${waves.length} vagues avant chute`,
    score: progress * 9 + Math.max(0, remainingHealthPct) * 2 + speedBonus,
    success,
    metrics: {
      killed: encounter.killedEnemies,
      mobCount: waves.reduce((sum, wave) => sum + wave.enemyCount, 0),
      waveCount: waves.length,
      clearedWaves: encounter.clearedWaves,
      totalTime: encounter.totalTime,
      remainingHealthPct: Math.max(0, remainingHealthPct) * 100,
      totalEnemyHealth,
      firstMobHealth: waves[0]?.totalHealth || 0,
      peakWaveDps,
      lastDamagePerSecond: (waves[Math.max(0, encounter.clearedWaves - 1)]?.totalDps || peakWaveDps) * mitigation,
      weaponDamage: encounter.weaponDamage,
      skillDamage: encounter.skillDamage,
      aoeDamage: encounter.aoeDamage,
      skillCasts: encounter.skillCasts,
      skillHits: encounter.skillHits,
      realBattleData: 1,
      age: levelRange.age,
      combat: levelRange.combat,
      difficulty: levelRange.difficulty,
      ageIdx: levelRange.battleTarget?.ageIdx ?? levelRange.age - 1,
      battleIdx: levelRange.battleTarget?.battleIdx ?? levelRange.combat - 1,
      estimatedAge: levelRange.estimatedAge,
      estimatedCombat: levelRange.estimatedCombat,
      levelMin: levelRange.min,
      levelMax: levelRange.max,
      estimatedPlayerLevel: levelRange.estimatedPlayerLevel
    }
  };
}

function recommend(
  profile: NormalizedProfile,
  data: GameDataBundle,
  objective: Objective,
  fightDuration: number,
  opponent?: NormalizedProfile,
  scenarioSet = resolveScenarioSet(combatProfile(profile, data, fightDuration), {}, profile, data),
  baseScenarios = evaluateScenarios(combatProfile(profile, data, fightDuration), scenarioSet)
): Recommendation[] {
  const baseScore = scoreNormalized(profile, data, objective, fightDuration, opponent, scenarioSet);
  const lineRecs = recommendSecondaryLines(profile, data, objective, fightDuration, baseScore, scenarioSet, baseScenarios, opponent);
  const pvpMode = Boolean(opponent && (objective === "pvp" || objective === "balanced"));
  const baseChance = pvpMode ? simulatePvpDuel(profile, opponent!, data, fightDuration).chance : undefined;

  const talentRecs = data.normalized.techNodes.flatMap((node) => {
    const currentLevel = readNumber(profile.talentTree?.[node.tree]?.[node.id]);
    if (currentLevel >= node.maxLevel) return [];
    const next = cloneProfile(profile);
    if (!next.talentTree[node.tree]) next.talentTree[node.tree] = {};
    next.talentTree[node.tree][node.id] = currentLevel + 1;
    applyTalentDeltaForRecommendation(next, node);
    const { score, scenarios, pvpChance } = scoreRecommendationCandidate(next, data, objective, fightDuration, opponent, scenarioSet);
    const scenario = bestScenarioDelta(baseScenarios, scenarios);
    const chanceDelta = pvpChance !== undefined && baseChance !== undefined ? pvpChance - baseChance : undefined;
    return [{
      kind: "talent" as const,
      title: `${node.tree} ${node.id}: ${formatTechType(node.type)} +1`,
      detail: chanceDelta !== undefined
        ? `Chance PvP ${formatSigned(chanceDelta, 2)} points contre cet adversaire.`
        : `Gain estime ${format(score - baseScore, 3)}. Impact principal: ${scenario.label} ${formatSigned(scenario.delta, 3)}.`,
      gain: score - baseScore,
      chanceDelta,
      scenario: chanceDelta !== undefined ? "Duel PvP" : scenario.label,
      source: `${node.tree} ${node.id}`
    }];
  });

  return [...lineRecs, ...talentRecs.filter((rec) => rec.gain > 0)].sort((a, b) => b.gain - a.gain);
}

function recommendLegacy(profile: NormalizedProfile, data: GameDataBundle, objective: Objective, fightDuration: number, opponent?: NormalizedProfile): Recommendation[] {
  const baseScore = scoreNormalized(profile, data, objective, fightDuration, opponent);
  const statRecs = data.normalized.stats.map((stat) => {
    const next = cloneProfile(profile);
    next.stats[stat.id] += stat.max;
    const score = scoreNormalized(next, data, objective, fightDuration, opponent);
    return {
      kind: "stat" as const,
      title: `${stat.label} +${format(stat.max)}%`,
      detail: `Gain estimé ${format(score - baseScore, 3)} sur l'objectif actuel.`,
      gain: score - baseScore
    };
  }).sort((a, b) => b.gain - a.gain);

  const bestStats = new Set(statRecs.slice(0, 3).map((rec) => rec.title.split(" +")[0]));
  const slotRecs: Recommendation[] = [];
  for (const slot of EQUIPMENT_SLOTS) {
    const item = profile.equipment[slot];
    for (const stat of data.normalized.stats) {
      if (!bestStats.has(stat.label)) continue;
      if (!item?.secondaryStats.some((line) => line.stat === stat.id)) {
        slotRecs.push({
          kind: "slot",
          title: `${slot}: chercher ${stat.label}`,
          detail: item ? `${slot}: ligne absente sur l'objet équipé.` : `${slot}: slot vide ou non reconnu.`,
          gain: statRecs.find((rec) => rec.title.startsWith(stat.label))?.gain || 0
        });
      }
    }
  }

  const talentRecs = data.normalized.techNodes.flatMap((node) => {
    const currentLevel = readNumber(profile.talentTree?.[node.tree]?.[node.id]);
    if (currentLevel >= node.maxLevel) return [];
    const next = cloneProfile(profile);
    if (!next.talentTree[node.tree]) next.talentTree[node.tree] = {};
    next.talentTree[node.tree][node.id] = currentLevel + 1;
    applyTalentDeltaForRecommendation(next, node);
    const score = scoreNormalized(next, data, objective, fightDuration, opponent);
    return [{
      kind: "talent" as const,
      title: `${node.tree} ${node.id}: ${formatTechType(node.type)} +1`,
      detail: `Gain estimé ${format(score - baseScore, 3)} sur l'objectif actuel.`,
      gain: score - baseScore
    }];
  }).sort((a, b) => b.gain - a.gain);

  const primaryRecs = [...statRecs.slice(0, 4), ...slotRecs.slice(0, 5)].sort((a, b) => b.gain - a.gain);
  const visibleTalentRecs = talentRecs.filter((rec) => rec.gain > 0).slice(0, 3);
  return [...primaryRecs.slice(0, 6), ...visibleTalentRecs, ...primaryRecs.slice(6)];
}

type SecondaryRecommendationSource = {
  kind: "stat" | "slot";
  label: string;
  source: string;
  read: (profile: NormalizedProfile) => { secondaryStats: SecondaryLine[] } | null | undefined;
  maxLines: (profile: NormalizedProfile) => number;
};

type AggregatedLineRecommendation = Recommendation & {
  placements: string[];
  bestPlacement: string;
};

function recommendSecondaryLines(
  profile: NormalizedProfile,
  data: GameDataBundle,
  objective: Objective,
  fightDuration: number,
  baseScore: number,
  scenarioSet: ResolvedScenarioSet,
  baseScenarios: ScenarioResult[],
  opponent?: NormalizedProfile
): Recommendation[] {
  const sources = secondaryRecommendationSources(profile);
  const recommendations = new Map<string, AggregatedLineRecommendation>();
  const pvpMode = Boolean(opponent && (objective === "pvp" || objective === "balanced"));
  const baseChance = pvpMode ? simulatePvpDuel(profile, opponent!, data, fightDuration).chance : undefined;

  for (const source of sources) {
    const carrier = source.read(profile);
    if (!carrier) continue;
    const maxLines = clamp(Math.round(source.maxLines(profile)), 0, 2);
    for (let lineIndex = 0; lineIndex < maxLines; lineIndex += 1) {
      const currentLine = carrier.secondaryStats[lineIndex];
      for (const stat of data.normalized.stats) {
        const value = Number(stat.max || 0);
        if (currentLine?.stat === stat.id && Number(currentLine.value || 0) >= value - 0.001) continue;
        const next = cloneProfile(profile);
        replaceSecondaryLine(next, source, lineIndex, stat.id, value);
        const { score, scenarios, pvpChance } = scoreRecommendationCandidate(next, data, objective, fightDuration, opponent, scenarioSet);
        const gain = score - baseScore;
        if (gain <= 0.0001) continue;
        const scenario = bestScenarioDelta(baseScenarios, scenarios);
        const chanceDelta = pvpChance !== undefined && baseChance !== undefined ? pvpChance - baseChance : undefined;
        const previous = currentLine ? `${statLabel(currentLine.stat)} ${format(currentLine.value, 1)}%` : "ligne vide";
        const group = recommendationSourceGroup(source);
        const placement = `${source.label} L${lineIndex + 1}`;
        const key = `${group}:${stat.id}`;
        const candidate: AggregatedLineRecommendation = {
          kind: source.kind,
          title: `${group}: chercher ${stat.label}`,
          detail: chanceDelta !== undefined
            ? `Meilleur changement: ${placement}, ${previous} -> ${stat.label} ${format(value, 1)}%. Chance PvP ${formatSigned(chanceDelta, 2)} points contre cet adversaire.`
            : `Meilleur changement: ${placement}, ${previous} -> ${stat.label} ${format(value, 1)}%. Gain estime ${format(gain, 3)}. Impact principal: ${scenario.label} ${formatSigned(scenario.delta, 3)}.`,
          gain,
          chanceDelta,
          scenario: chanceDelta !== undefined ? "Duel PvP" : scenario.label,
          source: group,
          placements: [placement],
          bestPlacement: placement
        };
        const existing = recommendations.get(key);
        if (!existing || gain > existing.gain + 0.0001) {
          recommendations.set(key, candidate);
        } else if (Math.abs(gain - existing.gain) <= 0.02 && !existing.placements.includes(placement)) {
          existing.placements.push(placement);
        }
      }
    }
  }

  return Array.from(recommendations.values())
    .map(({ placements, bestPlacement: _bestPlacement, ...rec }) => ({
      ...rec,
      detail: `${rec.detail}${placements.length > 1 ? ` Emplacements equivalents: ${placements.slice(0, 6).join(", ")}${placements.length > 6 ? `, +${placements.length - 6}` : ""}.` : ""}`
    }))
    .sort((a, b) => b.gain - a.gain);
}

function secondaryRecommendationSources(profile: NormalizedProfile): SecondaryRecommendationSource[] {
  const sources: SecondaryRecommendationSource[] = [];
  for (const slot of EQUIPMENT_SLOTS) {
    if (!profile.equipment[slot]) continue;
    sources.push({
      kind: "slot",
      label: slot,
      source: slot,
      read: (target) => target.equipment[slot],
      maxLines: (target) => itemSecondaryLineLimit(target.equipment[slot])
    });
  }
  for (let index = 0; index < profile.pets.length; index += 1) {
    sources.push({
      kind: "stat",
      label: `Pet ${index + 1}`,
      source: `pets.${index}`,
      read: (target) => target.pets[index],
      maxLines: (target) => petMountSecondaryLineLimit(target.pets[index])
    });
  }
  if (profile.mount) {
    sources.push({
      kind: "stat",
      label: "Monture",
      source: "mount",
      read: (target) => target.mount,
      maxLines: (target) => petMountSecondaryLineLimit(target.mount)
    });
  }
  return sources;
}

function itemSecondaryLineLimit(item: Pick<NormalizedItem, "age"> | null | undefined): number {
  return readNumber(item?.age) >= ITEM_SECONDARY_LINE_2_MIN_AGE ? 2 : 1;
}

function petMountSecondaryLineLimit(entity: { rarity?: string } | null | undefined): number {
  return rarityRank(entity?.rarity) >= rarityRank(PET_MOUNT_SECONDARY_LINE_2_MIN_RARITY) ? 2 : 1;
}

function rarityRank(rarity?: string): number {
  const normalized = String(rarity || "Common").toLowerCase();
  const index = RARITY_ORDER.findIndex((entry) => entry.toLowerCase() === normalized);
  return index >= 0 ? index : 0;
}

function recommendationSourceGroup(source: SecondaryRecommendationSource): string {
  if (EQUIPMENT_SLOTS.includes(source.source as EquipmentSlot)) return "Objets";
  if (source.source.startsWith("pets.")) return "Pets";
  if (source.source === "mount") return "Monture";
  return source.label;
}

function replaceSecondaryLine(profile: NormalizedProfile, source: SecondaryRecommendationSource, lineIndex: number, stat: StatId, value: number) {
  if (lineIndex >= source.maxLines(profile)) return;
  const carrier = source.read(profile);
  if (!carrier) return;
  const oldLine = carrier.secondaryStats[lineIndex];
  const nextLine: SecondaryLine = { stat, sourceId: reverseStatId(stat), value };
  const nextLines = carrier.secondaryStats.slice(0, 2);
  nextLines[lineIndex] = nextLine;
  carrier.secondaryStats = nextLines.filter((line) => line?.stat);

  if (oldLine) {
    const oldStats = statMapFromLines([oldLine]);
    profile.stats = subtractStats(profile.stats, oldStats);
    profile.breakdown.secondaryStats = subtractStats(profile.breakdown.secondaryStats, oldStats);
  }
  const newStats = statMapFromLines([nextLine]);
  profile.stats = sumStats(profile.stats, newStats);
  profile.breakdown.secondaryStats = sumStats(profile.breakdown.secondaryStats, newStats);
}

function scoreRecommendationCandidate(
  profile: NormalizedProfile,
  data: GameDataBundle,
  objective: Objective,
  fightDuration: number,
  opponent: NormalizedProfile | undefined,
  scenarioSet: ResolvedScenarioSet
) {
  const combat = combatProfile(profile, data, fightDuration);
  const scenarios = evaluateScenarios(combat, scenarioSet);
  const pvpChance = opponent && (objective === "pvp" || objective === "balanced")
    ? simulatePvpDuel(profile, opponent, data, fightDuration).chance
    : undefined;
  const score = opponent && (objective === "pvp" || objective === "balanced")
    ? objective === "balanced"
      ? scoreCombat(combat, "progress", scenarios) * 0.55 + ((pvpChance || 0) / 10) * 0.45
      : (pvpChance || 0) / 10
    : scoreCombat(combat, objective, scenarios);
  return { score, scenarios, pvpChance };
}

function bestScenarioDelta(baseScenarios: ScenarioResult[], nextScenarios: ScenarioResult[]) {
  return nextScenarios
    .map((scenario) => ({
      label: scenario.label,
      delta: scenario.score - (baseScenarios.find((base) => base.id === scenario.id)?.score || 0)
    }))
    .sort((left, right) => right.delta - left.delta)[0] || { label: "Scenario", delta: 0 };
}

function applyTalentDeltaForRecommendation(profile: NormalizedProfile, node: { effects?: Array<{ targetType: string; statType: string; valuePerLevel: number; itemType?: number }> }) {
  for (const effect of node.effects || []) {
    const value = Number(effect.valuePerLevel || 0);
    if (effect.targetType === "WeaponStatTarget") applyTalentSlotDelta(profile, "Weapon", effect.statType, value);
    if (effect.targetType === "EquipmentStatTarget") {
      const slot = typeof effect.itemType === "number" ? ITEM_TYPE_TO_SLOT[effect.itemType] as EquipmentSlot | undefined : undefined;
      if (slot) applyTalentSlotDelta(profile, slot, effect.statType, value);
    }
    if (effect.targetType === "PetStatTarget") {
      const petAttack = profile.pets.reduce((total, pet) => total + Number(pet.attack || 0), 0);
      const petHealth = profile.pets.reduce((total, pet) => total + Number(pet.health || 0), 0);
      if (effect.statType === "Damage" || effect.statType === "TechTreeDamage") profile.base.attack += petAttack * value;
      if (effect.statType === "Health" || effect.statType === "TechTreeHealth") profile.base.health += petHealth * value;
    }
    if (effect.targetType === "MountStatTarget" && profile.mount) {
      if (effect.statType === "Damage" || effect.statType === "TechTreeDamage") profile.base.attack += Number(profile.mount.attack || 0) * value;
      if (effect.statType === "Health" || effect.statType === "TechTreeHealth") profile.base.health += Number(profile.mount.health || 0) * value;
    }
    if (effect.targetType === "ActiveSkillStatTarget" || effect.targetType === "PassiveSkillStatTarget") {
      if (effect.statType === "Damage" || effect.statType === "SkillDamage" || effect.statType === "TechTreeDamage") profile.stats.skillDamage += value * 100;
      if (effect.statType === "Health" || effect.statType === "SkillHealth" || effect.statType === "TechTreeHealth") profile.stats.health += value * 100;
    }
  }
}

function applyTalentSlotDelta(profile: NormalizedProfile, slot: EquipmentSlot, statType: string, value: number) {
  const item = profile.equipment[slot];
  if (!item) return;
  if (statType === "Damage" || statType === "TechTreeDamage") profile.base.attack += Number(item.attack || 0) * value;
  if (statType === "Health" || statType === "TechTreeHealth") profile.base.health += Number(item.health || 0) * value;
}

function scoreNormalized(profile: NormalizedProfile, data: GameDataBundle, objective: Objective, fightDuration: number, opponent?: NormalizedProfile, scenarioSet?: ResolvedScenarioSet): number {
  const playerCombat = combatProfile(profile, data, fightDuration);
  const scenarios = scenarioSet ? evaluateScenarios(playerCombat, scenarioSet) : undefined;
  if (opponent && (objective === "pvp" || objective === "balanced")) {
    const chance = simulatePvpDuel(profile, opponent, data, fightDuration).chance;
    return objective === "balanced" ? scoreCombat(playerCombat, "progress", scenarios) * 0.55 + (chance / 10) * 0.45 : chance / 10;
  }
  return scoreCombat(playerCombat, objective, scenarios);
}

function scoreCombat(profile: CombatProfile, objective: Objective, scenarios?: ScenarioResult[]): number {
  const damageScore = Math.log1p(profile.totalDps);
  const sustainScore = Math.log1p(profile.sustainWindow);
  const skillScore = Math.log1p(profile.skillDps);
  if (!scenarios?.length) {
    if (objective === "damage") return damageScore + sustainScore * 0.08 + skillScore * 0.04;
    if (objective === "survival") return sustainScore + damageScore * 0.15 + skillScore * 0.04;
    return damageScore * 0.58 + sustainScore * 0.34 + skillScore * 0.08;
  }

  const enduranceScore = scenarioScore(scenarios, "endurance");
  const killScore = scenarioScore(scenarios, "timeToKill");
  const gauntletScore = scenarioScore(scenarios, "gauntlet");
  if (objective === "damage") return damageScore * 0.35 + killScore * 0.55 + gauntletScore * 0.1 + skillScore * 0.04;
  if (objective === "survival") return sustainScore * 0.25 + enduranceScore * 0.6 + gauntletScore * 0.15;
  if (objective === "pvp") return damageScore * 0.35 + sustainScore * 0.25 + enduranceScore * 0.2 + killScore * 0.2;
  return damageScore * 0.22 + sustainScore * 0.16 + enduranceScore * 0.22 + killScore * 0.25 + gauntletScore * 0.15 + skillScore * 0.04;
}

function isRangedWeapon(item: any, data: GameDataBundle): boolean {
  const age = readNumber(item.age ?? item.Age);
  const idx = readNumber(item.idx ?? item.Idx);
  const weapon = data.raw["WeaponLibrary.json"]?.[`{'Age': ${age}, 'Type': 'Weapon', 'Idx': ${idx}}`];
  return weapon ? Number(weapon.AttackRange || 0) >= 1 : true;
}

function addLinesToStats(target: StatMap, lines: SecondaryLine[]) {
  for (const line of lines) target[line.stat] += line.value;
}

function statMapFromLines(lines: SecondaryLine[]): StatMap {
  const stats = createEmptyStats();
  addLinesToStats(stats, lines);
  return stats;
}

function sumStats(...sources: StatMap[]): StatMap {
  const out = createEmptyStats();
  for (const source of sources) for (const key of Object.keys(out) as StatId[]) out[key] += Number(source[key] || 0);
  return out;
}

function subtractStats(left: StatMap, right: StatMap): StatMap {
  const out = createEmptyStats();
  for (const key of Object.keys(out) as StatId[]) out[key] = Number(left[key] || 0) - Number(right[key] || 0);
  return out;
}

function active(stats: StatMap, id: StatId): number {
  const value = Number(stats[id] || 0);
  const cap = HARD_CAPS[id];
  return cap ? Math.min(value, cap) : value;
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function confidenceFromAudit(audit: AuditIssue[]): Confidence {
  if (audit.some((issue) => issue.severity === "error")) return "manual_required";
  if (audit.some((issue) => issue.severity === "warning")) return "partial";
  return "complete";
}

function weakerConfidence(a: Confidence, b: Confidence): Confidence {
  if (a === "manual_required" || b === "manual_required") return "manual_required";
  if (a === "partial" || b === "partial") return "partial";
  return "complete";
}

function cloneProfile(profile: NormalizedProfile): NormalizedProfile {
  return JSON.parse(JSON.stringify(profile)) as NormalizedProfile;
}

function pvpStrengths(left: CombatProfile, right: CombatProfile): string[] {
  const strengths = [];
  if (left.totalDps > right.totalDps * 1.08) strengths.push("DPS supérieur");
  if (left.maxHealth > right.maxHealth * 1.08) strengths.push("PV supérieurs");
  if (left.healingPerSecond > right.healingPerSecond * 1.08) strengths.push("Sustain supérieur");
  if (left.block > right.block + 0.05) strengths.push("Block supérieur");
  return strengths.length ? strengths : ["Profil proche"];
}

function reverseStatId(id: StatId): string {
  return Object.entries(STAT_ID_MAP).find(([, statId]) => statId === id)?.[0] || id;
}

function scenarioScore(scenarios: ScenarioResult[], id: ScenarioResult["id"]): number {
  return scenarios.find((scenario) => scenario.id === id)?.score || 0;
}

function format(value: number, digits = 1): string {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatSigned(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${format(value, digits)}`;
}

function formatTechType(value: string): string {
  return value.replace(/([A-Z])/g, " $1").trim();
}

export function statLabel(stat: NormalizedSecondaryStat | StatId): string {
  return typeof stat === "string" ? STAT_LABELS[stat] : stat.label;
}
