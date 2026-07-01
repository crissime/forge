import type { NormalizedProfile, Objective, StatMap } from "@forge-master/simulator";
import type { AgeOption, BisAccess } from "../../types";
import { normalizeRarity, rarityValues } from "../shared/gameData";
import simulatedBis from "./simulatedBis.json";

export type BisStatTarget = {
  stat: keyof StatMap;
  label: string;
  target?: string;
  count?: number;
};

export type BisReference = {
  age: number;
  ageLabel: string;
  phase: string;
  petRarity: string;
  mountRarity: string;
  spellRarity: string;
  stats: BisStatTarget[];
  note: string;
};

export type BisProgress = {
  equipment: number;
  equipmentTotal: number;
  pets: number;
  petsTotal: number;
  mount: boolean;
  spells: number;
  spellsTotal: number;
};

const EQUIPMENT_SLOTS = [
  "Weapon",
  "Helmet",
  "Body",
  "Gloves",
  "Belt",
  "Necklace",
  "Ring",
  "Shoe"
] as const;

type GeneratedCase = {
  objective?: string;
  lineCount?: number;
  candidateCount?: number;
  frontier?: { age: number; combat: number };
  reach?: { age: number; combat: number; successCount?: number; scenarioCount?: number };
  battleReach?: { age: number; combat: number; summary?: string };
  exhaustive?: boolean;
  v3?: boolean;
  access?: { equipmentAge?: number; petRarity?: string; mountRarity?: string; spellRarity?: string };
  winner?: {
    weaponStyle?: string;
    stats?: Array<{ stat: string; label: string; count: number; total: number }>;
    pets?: Array<{ name: string; type?: string }>;
  };
};

type GeneratedStat = { stat: string; label: string; count: number; total: number };
type GeneratedPet = { name: string; type?: string };
type FightPoint = { age: number; combat: number; successCount?: number; scenarioCount?: number; summary?: string };
type GeneratedResult = {
  objective: string;
  lineCount: number;
  candidateCount?: number;
  companionLevel?: number;
  spellLevel?: number;
  stats: GeneratedStat[];
  frontier?: FightPoint;
  reach?: FightPoint;
  battleReach?: FightPoint;
  pets: GeneratedPet[];
  weaponStyle?: string;
  missing?: boolean;
  exhaustive: boolean;
  v3?: boolean;
};

export function bisReferenceForAge(age: number, ageOptions: AgeOption[], objective: Objective = "progress"): BisReference {
  const cleanAge = Math.min(9, Math.max(0, Math.round(Number(age || 0))));
  const ageLabel = ageOptions.find((option) => option.value === cleanAge)?.label || `Age ${cleanAge}`;
  const access = defaultAccessForAge(cleanAge);
  return referenceForCase(cleanAge, ageLabel, objective, access.petRarity, access.mountRarity, access.spellRarity);
}

export function bisReferenceForAccess(access: BisAccess, ageOptions: AgeOption[], objective: Objective = "progress"): BisReference {
  const age = highestNumber(access.equipmentAges || [], 0);
  const ageLabel = ageOptions.find((option) => option.value === age)?.label || `Age ${age}`;
  const baseline = defaultAccessForAge(age);
  return referenceForCase(
    age,
    ageLabel,
    objective,
    highestRarity(access.petRarities || [], baseline.petRarity),
    highestRarity(access.mountRarities || [], baseline.mountRarity),
    highestRarity(access.spellRarities || [], baseline.spellRarity)
  );
}

export function bisAccessFromProfile(
  profile: NormalizedProfile | null,
  spellOptions: Array<{ id: string; rarity: string }> = []
): BisAccess {
  const age = equippedReferenceAge(profile);
  const petRarity = highestRarity(
    profile?.pets
      .map((pet) => pet.rarity)
      .filter((rarity): rarity is string => Boolean(rarity)) || [],
    "Common"
  );
  const mountRarity = normalizeRarity(profile?.mount?.rarity);
  const spellRarity = highestRarity(
    profile?.spells.map((spell) =>
      spell.rarity || spellOptions.find((option) => option.id === spell.id)?.rarity
    ).filter((rarity): rarity is string => Boolean(rarity)) || [],
    "Common"
  );
  return {
    equipmentAges: Array.from({ length: age + 1 }, (_, index) => index),
    petRarities: raritiesThrough(petRarity),
    mountRarities: raritiesThrough(mountRarity),
    spellRarities: raritiesThrough(spellRarity)
  };
}

export function equippedReferenceAge(profile: NormalizedProfile | null): number {
  if (!profile) return 0;
  return Math.max(
    0,
    ...Object.values(profile.equipment).map((item) => Number(item?.age ?? 0))
  );
}

export function bisProgress(
  profile: NormalizedProfile | null,
  reference: BisReference,
  spellOptions: Array<{ id: string; rarity: string }> = []
): BisProgress {
  if (!profile) {
    return {
      equipment: 0,
      equipmentTotal: EQUIPMENT_SLOTS.length,
      pets: 0,
      petsTotal: 3,
      mount: false,
      spells: 0,
      spellsTotal: 3
    };
  }

  return {
    equipment: EQUIPMENT_SLOTS.filter((slot) => Number(profile.equipment[slot]?.age ?? -1) >= reference.age).length,
    equipmentTotal: EQUIPMENT_SLOTS.length,
    pets: profile.pets
      .slice(0, 3)
      .filter((pet) => rarityRank(pet.rarity) >= rarityRank(reference.petRarity))
      .length,
    petsTotal: 3,
    mount: Boolean(profile.mount) && rarityRank(profile.mount?.rarity) >= rarityRank(reference.mountRarity),
    spells: profile.spells
      .slice(0, 3)
      .filter((spell) => {
        const rarity = spell.rarity || spellOptions.find((option) => option.id === spell.id)?.rarity;
        return rarityRank(rarity) >= rarityRank(reference.spellRarity);
      })
      .length,
    spellsTotal: 3
  };
}

function referenceForCase(
  age: number,
  ageLabel: string,
  objective: Objective,
  petRarity: string,
  mountRarity: string,
  spellRarity: string
): BisReference {
  const result = simulatedResult(age, petRarity, mountRarity, spellRarity, objective);
  if (result.missing) {
    return {
      age,
      ageLabel,
      phase: age <= 2 ? "Debut de progression" : age <= 4 ? "Debut de build" : age <= 6 ? "Milieu de progression" : "Fin de progression",
      petRarity,
      mountRarity,
      spellRarity,
      stats: [],
      note: `Aucun BIS genere pour ce cas : equipement ${age}, pets ${petRarity}, monture ${mountRarity}, sorts ${spellRarity}, objectif ${objectiveLabel(result.objective)}.`
    };
  }
  const battle: FightPoint = result.frontier || { age: 1, combat: 1 };
  const reach: FightPoint = result.reach || battle;
  const battleReach: FightPoint = result.battleReach || battle;
  const stats = Array.isArray(result.stats) ? result.stats : [];
  const lineCount = Number(result.lineCount || stats.reduce((sum, stat) => sum + Number(stat.count || 0), 0));
  const method = result.v3 ? "BIS v3 exhaustif controle" : result.exhaustive ? "BIS exhaustif" : "Repartition simulee";
  const battleText = `Max progression du BIS theorique : ${battleReach.age}-${battleReach.combat} normal.`;
  const reachScenarios = reach.successCount
    ? ` (${reach.successCount}/${reach.scenarioCount} scenarios reussis)`
    : "";
  const reachText = `Score progression max : ${reach.age}-${reach.combat} normal${reachScenarios}.`;
  const candidateText = result.candidateCount ? ` ${formatInteger(result.candidateCount)} candidats testes.` : "";
  const companionLevel = Number(result.companionLevel || 100);
  const spellLevel = Number(result.spellLevel || 100);
  const levelText = companionLevel === 1 && spellLevel === 1
    ? "Objets max, pets/monture niveau 1, sorts niveau 1"
    : `Ancienne generation a regenerer: pets/monture niveau ${companionLevel}, sorts niveau ${spellLevel}`;
  const petText = result.pets.length
    ? ` Pets BIS : ${result.pets.map((pet) => `${pet.name} (${petTypeLabel(pet.type)})`).join(", ")}.`
    : "";
  const weaponStyle = result.weaponStyle || inferredWeaponStyle(stats);
  const weaponText = weaponStyle ? ` Arme BIS : ${weaponStyleLabel(weaponStyle)}.` : "";

  return {
    age,
    ageLabel,
    phase: age <= 2 ? "Debut de progression" : age <= 4 ? "Debut de build" : age <= 6 ? "Milieu de progression" : "Fin de progression",
    petRarity,
    mountRarity,
    spellRarity,
    stats: stats.map((stat) => ({
      stat: stat.stat as keyof StatMap,
      label: stat.label,
      count: stat.count,
      target: `${stat.count} ligne${stat.count > 1 ? "s" : ""} - ${formatPercent(stat.total)}`
    })),
    note: `${method} pour l'objectif ${objectiveLabel(result.objective)}, avec ${lineCount} lignes secondaires max. ${battleText} ${reachText}${candidateText} Pets ${petRarity}, monture ${mountRarity}, sorts ${spellRarity}. ${levelText}, sans talents.${weaponText}${petText}`
  };
}

function simulatedResult(
  age: number,
  petRarity: string,
  mountRarity: string,
  spellRarity: string,
  objective: Objective
): GeneratedResult {
  const normalizedObjective = objective === "damage" || objective === "survival" ? objective : "progress";
  const key = [age, petRarity, mountRarity, spellRarity, normalizedObjective].join("|");
  const generated = simulatedBis as {
    schema?: string;
    assumptions?: { companionLevel?: number; spellLevel?: number };
    cases?: Record<string, GeneratedCase>;
    templates?: any[];
  };
  const exhaustiveCase = generated.schema === "forge-master-exhaustive-bis-v1" ? generated.cases?.[key] : null;
  if (exhaustiveCase?.winner) return exhaustiveResult(exhaustiveCase, true, generated.assumptions);

  if (generated.schema === "forge-master-exhaustive-bis-v1") {
    return {
      objective: normalizedObjective,
      lineCount: 0,
      companionLevel: generated.assumptions?.companionLevel,
      spellLevel: generated.assumptions?.spellLevel,
      stats: [],
      frontier: undefined,
      reach: undefined,
      battleReach: undefined,
      pets: [],
      weaponStyle: undefined,
      missing: true,
      exhaustive: false
    };
  }

  const templateId = generated.cases?.[key];
  const template = generated.templates?.find((entry) => entry.id === templateId)
    || generated.templates?.find((entry) => entry.objective === normalizedObjective)
    || generated.templates?.[0];
  return {
    ...template,
    frontier: undefined,
    reach: undefined,
    battleReach: undefined,
    pets: [],
    weaponStyle: undefined,
    exhaustive: false
  };
}

function exhaustiveResult(entry: GeneratedCase, exact: boolean, assumptions?: { companionLevel?: number; spellLevel?: number }) {
  return {
    objective: entry.objective || "progress",
    lineCount: entry.lineCount || 0,
    candidateCount: entry.candidateCount,
    companionLevel: assumptions?.companionLevel,
    spellLevel: assumptions?.spellLevel,
    stats: entry.winner?.stats || [],
    frontier: entry.frontier,
    reach: entry.reach,
    battleReach: entry.battleReach,
    pets: entry.winner?.pets || [],
    weaponStyle: entry.winner?.weaponStyle,
    exhaustive: exact && entry.exhaustive !== false,
    v3: entry.v3
  };
}

function inferredWeaponStyle(stats: GeneratedStat[]) {
  if (stats.some((stat) => stat.stat === "meleeDamage")) return "melee";
  if (stats.some((stat) => stat.stat === "rangedDamage")) return "ranged";
  return undefined;
}

function weaponStyleLabel(style: string) {
  return style === "ranged" ? "distance" : style === "melee" ? "melee" : style;
}

function defaultAccessForAge(age: number) {
  if (age <= 5) return { petRarity: "Epic", mountRarity: "Common", spellRarity: "Epic" };
  if (age <= 7) return { petRarity: "Legendary", mountRarity: "Rare", spellRarity: "Legendary" };
  return { petRarity: "Ultimate", mountRarity: "Legendary", spellRarity: "Ultimate" };
}

function rarityForAge(age: number) {
  if (age === 0) return "Common";
  if (age <= 2) return "Rare";
  if (age <= 6) return "Epic";
  if (age === 7) return "Legendary";
  if (age === 8) return "Ultimate";
  return "Mythic";
}

function rarityRank(rarity?: string) {
  return rarityValues.indexOf(normalizeRarity(rarity));
}

function highestRarity(rarities: string[], fallback: string) {
  if (!rarities.length) return normalizeRarity(fallback);
  return rarities.reduce(
    (best, rarity) => rarityRank(rarity) > rarityRank(best) ? normalizeRarity(rarity) : best,
    normalizeRarity(rarities[0])
  );
}

function raritiesThrough(rarity: string) {
  return rarityValues.slice(0, Math.max(0, rarityRank(rarity)) + 1);
}

function highestNumber(values: number[], fallback: number) {
  return Math.max(fallback, ...values.map(Number));
}

function objectiveLabel(objective: string) {
  if (objective === "damage") return "DPS";
  if (objective === "survival") return "survie";
  return "progression";
}

function formatPercent(value: number) {
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`;
}

function formatInteger(value: number) {
  return Number(value).toLocaleString("fr-FR");
}

function petTypeLabel(type?: string) {
  if (type === "Damage") return "Degats";
  if (type === "Health") return "PV";
  if (type === "Balanced") return "Equilibre";
  return "type inconnu";
}
