import type { NormalizedProfile, StatMap } from "@forge-master/simulator";
import type { AgeOption, BisAccess } from "../../types";
import { normalizeRarity, rarityValues } from "../shared/gameData";

export type BisStatTarget = {
  stat: keyof StatMap;
  label: string;
  target?: string;
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

const EARLY_STATS: BisStatTarget[] = [
  { stat: "attackSpeed", label: "Vitesse d'attaque" },
  { stat: "lifesteal", label: "Vol de vie" },
  { stat: "regen", label: "Régénération" }
];

const MODERN_STATS: BisStatTarget[] = [
  { stat: "doubleChance", label: "Double attaque", target: "100%" },
  { stat: "attackSpeed", label: "Vitesse d'attaque", target: "88%+" },
  { stat: "lifesteal", label: "Vol de vie", target: "40%+" },
  { stat: "regen", label: "Régénération", target: "5-20%" }
];

const MID_STATS: BisStatTarget[] = [
  { stat: "doubleChance", label: "Double attaque", target: "100%" },
  { stat: "attackSpeed", label: "Vitesse d'attaque", target: "88%+" },
  { stat: "lifesteal", label: "Vol de vie", target: "40%+" },
  { stat: "skillDamage", label: "Dégâts des sorts", target: "20-40%" }
];

const LATE_STATS: BisStatTarget[] = [
  { stat: "critChance", label: "Chance critique", target: "50%+" },
  { stat: "critDamage", label: "Dégâts critiques", target: "500%+" },
  { stat: "doubleChance", label: "Double attaque", target: "100%" },
  { stat: "attackSpeed", label: "Vitesse d'attaque", target: "115%+" },
  { stat: "lifesteal", label: "Vol de vie", target: "50%+" }
];

export function bisReferenceForAge(age: number, ageOptions: AgeOption[]): BisReference {
  const cleanAge = Math.min(9, Math.max(0, Math.round(Number(age || 0))));
  const ageLabel = ageOptions.find((option) => option.value === cleanAge)?.label || `Âge ${cleanAge}`;

  if (cleanAge <= 2) {
    return {
      age: cleanAge,
      ageLabel,
      phase: "Début de progression",
      petRarity: cleanAge === 0 ? "Common" : "Rare",
      mountRarity: cleanAge === 0 ? "Common" : "Rare",
      spellRarity: cleanAge === 0 ? "Common" : "Rare",
      stats: EARLY_STATS,
      note: "Montez d'abord l'âge et le niveau des objets. Le sustain aide à pousser les premiers combats."
    };
  }

  if (cleanAge <= 4) {
    return {
      age: cleanAge,
      ageLabel,
      phase: "Début de build",
      petRarity: "Epic",
      mountRarity: "Epic",
      spellRarity: "Epic",
      stats: MODERN_STATS,
      note: "Les lignes secondaires commencent à compter davantage que quelques niveaux d'objet."
    };
  }

  if (cleanAge <= 6) {
    return {
      age: cleanAge,
      ageLabel,
      phase: "Milieu de progression",
      petRarity: "Epic",
      mountRarity: "Epic",
      spellRarity: "Epic",
      stats: MID_STATS,
      note: "Choisissez entre un build sorts ou un build polyvalent selon les recommandations du simulateur."
    };
  }

  return {
    age: cleanAge,
    ageLabel,
    phase: "Fin de progression",
    petRarity: cleanAge === 7 ? "Legendary" : cleanAge === 8 ? "Ultimate" : "Mythic",
    mountRarity: cleanAge === 7 ? "Legendary" : cleanAge === 8 ? "Ultimate" : "Mythic",
    spellRarity: cleanAge === 7 ? "Legendary" : cleanAge === 8 ? "Ultimate" : "Mythic",
    stats: LATE_STATS,
    note: "Le critique devient prioritaire. Régénération et dégâts des sorts perdent généralement en rendement."
  };
}

export function bisReferenceForAccess(access: BisAccess, ageOptions: AgeOption[]): BisReference {
  const age = highestNumber(access.equipmentAges || [], 0);
  const baseline = bisReferenceForAge(age, ageOptions);
  return {
    ...baseline,
    petRarity: highestRarity(access.petRarities || [], baseline.petRarity),
    mountRarity: highestRarity(access.mountRarities || [], baseline.mountRarity),
    spellRarity: highestRarity(access.spellRarities || [], baseline.spellRarity)
  };
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
