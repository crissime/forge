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
  frontier?: { age: number; combat: number };
  reach?: { age: number; combat: number; successCount?: number; scenarioCount?: number };
  exhaustive?: boolean;
  access?: { equipmentAge?: number };
  winner?: {
    stats?: Array<{ stat: string; label: string; count: number; total: number }>;
    pets?: Array<{ name: string; type?: string }>;
  };
};

type GeneratedStat = { stat: string; label: string; count: number; total: number };
type GeneratedPet = { name: string; type?: string };
type FightPoint = { age: number; combat: number; successCount?: number; scenarioCount?: number };
type GeneratedResult = {
  objective: string;
  lineCount: number;
  stats: GeneratedStat[];
  frontier?: FightPoint;
  reach?: FightPoint;
  pets: GeneratedPet[];
  exhaustive: boolean;
};

export function bisReferenceForAge(age: number, ageOptions: AgeOption[], objective: Objective = "progress"): BisReference {
  const cleanAge = Math.min(9, Math.max(0, Math.round(Number(age || 0))));
  const ageLabel = ageOptions.find((option) => option.value === cleanAge)?.label || `Age ${cleanAge}`;
  const rarity = rarityForAge(cleanAge);
  return referenceForCase(cleanAge, ageLabel, objective, rarity, rarity, rarity);
}

export function bisReferenceForAccess(access: BisAccess, ageOptions: AgeOption[], objective: Objective = "progress"): BisReference {
  const age = highestNumber(access.equipmentAges || [], 0);
  const ageLabel = ageOptions.find((option) => option.value === age)?.label || `Age ${age}`;
  const baselineRarity = rarityForAge(age);
  return referenceForCase(
    age,
    ageLabel,
    objective,
    highestRarity(access.petRarities || [], baselineRarity),
    highestRarity(access.mountRarities || [], baselineRarity),
    highestRarity(access.spellRarities || [], baselineRarity)
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
  const battle: FightPoint = result.frontier || { age: 1, combat: 1 };
  const reach: FightPoint = result.reach || battle;
  const stats = Array.isArray(result.stats) ? result.stats : [];
  const lineCount = Number(result.lineCount || stats.reduce((sum, stat) => sum + Number(stat.count || 0), 0));
  const method = result.exhaustive ? "BIS exhaustif" : "Repartition simulee";
  const reachText = `Front max estime : ${reach.age}-${reach.combat} normal${reach.successCount ? ` (${reach.successCount}/${reach.scenarioCount} scenarios reussis)` : ""}.`;
  const petText = result.pets.length
    ? ` Pets BIS : ${result.pets.map((pet) => `${pet.name} (${petTypeLabel(pet.type)})`).join(", ")}.`
    : "";

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
    note: `${method} pour l'objectif ${objectiveLabel(result.objective)}, avec ${lineCount} lignes secondaires max. Niveau de test : ${battle.age}-${battle.combat} normal. ${reachText} Pets ${petRarity}, monture ${mountRarity}, sorts ${spellRarity}, niveaux max, sans talents.${petText}`
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
  const generated = simulatedBis as { schema?: string; cases?: Record<string, GeneratedCase>; templates?: any[] };
  const exhaustiveCase = generated.schema === "forge-master-exhaustive-bis-v1" ? generated.cases?.[key] : null;
  if (exhaustiveCase?.winner) return exhaustiveResult(exhaustiveCase, true);

  if (generated.schema === "forge-master-exhaustive-bis-v1") {
    const cases = Object.values(generated.cases || {});
    const fallback = cases.find((entry) =>
      entry.objective === normalizedObjective && entry.access?.equipmentAge === age && entry.winner
    ) || cases.find((entry) => entry.objective === normalizedObjective && entry.winner);
    return fallback ? exhaustiveResult(fallback, false) : {
      objective: normalizedObjective,
      lineCount: 0,
      stats: [],
      frontier: undefined,
      reach: undefined,
      pets: [],
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
    pets: [],
    exhaustive: false
  };
}

function exhaustiveResult(entry: GeneratedCase, exact: boolean) {
  return {
    objective: entry.objective || "progress",
    lineCount: entry.lineCount || 0,
    stats: entry.winner?.stats || [],
    frontier: entry.frontier,
    reach: entry.reach,
    pets: entry.winner?.pets || [],
    exhaustive: exact && entry.exhaustive !== false
  };
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

function petTypeLabel(type?: string) {
  if (type === "Damage") return "Degats";
  if (type === "Health") return "PV";
  if (type === "Balanced") return "Equilibre";
  return "type inconnu";
}
