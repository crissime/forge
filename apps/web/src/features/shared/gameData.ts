import type { EquipmentSlot, NormalizedPet } from "@forge-master/simulator";
import type {
  AgeOption,
  CompanionLevels,
  ItemBase,
  ItemConfig,
  MountModel,
  PetModel,
  PetType
} from "../../types";

export type WeaponKind = "melee" | "meleeHybrid" | "ranged";

export const rarityValues = ["Common", "Rare", "Epic", "Legendary", "Ultimate", "Mythic"];
export const rarityLabels: Record<string, string> = {
  Common: "Commun",
  Rare: "Rare",
  Epic: "Épique",
  Legendary: "Légendaire",
  Ultimate: "Ultime",
  Mythic: "Mythique"
};

export function calculateItemValues(
  slot: EquipmentSlot,
  age: number,
  idx: number,
  level: number,
  itemBases: ItemBase[],
  itemConfig: ItemConfig
) {
  const cleanAge = Math.round(Number(age || 0));
  const cleanIdx = Math.round(Number(idx || 0));
  const cleanLevel = Math.max(1, Math.round(Number(level || 1)));
  const base = resolveItemBase(slot, cleanAge, cleanIdx, itemBases);
  const levelMulti = Math.pow(Number(itemConfig.levelScalingBase || 1.01), cleanLevel - 1);
  const meleeMulti = slot === "Weapon" && base?.isRanged === false
    ? Number(itemConfig.meleeDamageMultiplier || 1)
    : 1;
  return {
    age: cleanAge,
    idx: base?.idx ?? cleanIdx,
    level: cleanLevel,
    base,
    attack: Number(base?.attack || 0) * levelMulti * meleeMulti,
    health: Number(base?.health || 0) * levelMulti
  };
}

export function calculatePetValues(
  rarity: string,
  id: number,
  level: number,
  models: PetModel[],
  levels: CompanionLevels[]
) {
  const cleanRarity = normalizeRarity(rarity);
  const cleanLevel = clamp(Math.round(Number(level || 1)), 1, 100);
  const model = petModelFor(cleanRarity, id, models) || firstPetModel(cleanRarity, models);
  const levelInfo = companionLevelAt(cleanRarity, cleanLevel, levels);
  const multiplier = petTypeMultiplier(model?.type || "Balanced");
  return {
    rarity: cleanRarity,
    id: model?.id ?? Math.round(Number(id || 0)),
    name: model?.name || `Pet ${Math.round(Number(id || 0)) + 1}`,
    type: model?.type || "Balanced",
    level: cleanLevel,
    attack: Number(levelInfo?.attack || 0) * multiplier.attack,
    health: Number(levelInfo?.health || 0) * multiplier.health,
    recognized: Boolean(model && levelInfo)
  };
}

export function calculateMountValues(
  rarity: string,
  id: number,
  level: number,
  models: MountModel[],
  levels: CompanionLevels[]
) {
  const cleanRarity = normalizeRarity(rarity);
  const cleanLevel = clamp(Math.round(Number(level || 1)), 1, 100);
  const model = models.find((entry) =>
    normalizeRarity(entry.rarity) === cleanRarity &&
    entry.id === Math.round(Number(id || 0))
  ) || firstMountModel(cleanRarity, models);
  const levelInfo = companionLevelAt(cleanRarity, cleanLevel, levels);
  return {
    rarity: cleanRarity,
    id: model?.id ?? Math.round(Number(id || 0)),
    name: model?.name || `Monture ${Math.round(Number(id || 0)) + 1}`,
    level: cleanLevel,
    attack: Number(levelInfo?.attack || 0),
    health: Number(levelInfo?.health || 0),
    recognized: Boolean(model && levelInfo)
  };
}

export function resolveItemSelection(
  slot: EquipmentSlot,
  requestedAge: number,
  weaponKind: WeaponKind,
  itemBases: ItemBase[],
  ageOptions: AgeOption[]
) {
  const age = itemBases.some((item) => item.slot === slot && item.age === requestedAge)
    ? Math.round(requestedAge)
    : ageOptions.find((option) => itemBases.some((item) => item.slot === slot && item.age === option.value))?.value ?? 0;
  const base = slot === "Weapon"
    ? firstWeaponBaseForKind(age, weaponKind, itemBases) || firstItemBase(slot, age, itemBases)
    : firstItemBase(slot, age, itemBases);
  return { age, idx: base?.idx ?? 0 };
}

export function availableAges(slot: EquipmentSlot, ageOptions: AgeOption[], itemBases: ItemBase[]) {
  return ageOptions.filter((age) => itemBases.some((item) => item.slot === slot && item.age === age.value));
}

export function firstPetModel(rarity: string, models: PetModel[]) {
  return models
    .filter((entry) => normalizeRarity(entry.rarity) === normalizeRarity(rarity))
    .sort((left, right) => left.id - right.id)[0];
}

export function petModelFor(rarity: string, id: number, models: PetModel[]) {
  return models.find((entry) =>
    normalizeRarity(entry.rarity) === normalizeRarity(rarity) &&
    entry.id === Math.round(Number(id || 0))
  );
}

export function firstMountModel(rarity: string, models: MountModel[]) {
  return models
    .filter((entry) => normalizeRarity(entry.rarity) === normalizeRarity(rarity))
    .sort((left, right) => left.id - right.id)[0];
}

export function mountModelFor(rarity: string, id: number, models: MountModel[]) {
  return models.find((entry) =>
    normalizeRarity(entry.rarity) === normalizeRarity(rarity) &&
    entry.id === Math.round(Number(id || 0))
  );
}

export function petModelsFor(rarity: string, models: PetModel[]) {
  return models
    .filter((model) => normalizeRarity(model.rarity) === normalizeRarity(rarity))
    .sort((left, right) => left.id - right.id);
}

export function petDisplayName(pet: NormalizedPet | undefined, models: PetModel[]) {
  if (!pet) return undefined;
  return petModelFor(normalizeRarity(pet.rarity), Number(pet.id ?? 0), models)?.name || pet.name;
}

export function mountDisplayName(mount: { name: string; rarity?: string; id?: number } | null, models: MountModel[]) {
  if (!mount) return undefined;
  return mountModelFor(normalizeRarity(mount.rarity), Number(mount.id ?? 0), models)?.name || mount.name;
}

export function mountModelsFor(rarity: string, models: MountModel[]) {
  return models
    .filter((model) => normalizeRarity(model.rarity) === normalizeRarity(rarity))
    .sort((left, right) => left.id - right.id);
}

export function weaponKindOptions(age: number, itemBases: ItemBase[]) {
  const kinds = new Set(
    itemBases.filter((entry) => entry.slot === "Weapon" && entry.age === age).map(weaponKindFromBase)
  );
  return (["melee", "meleeHybrid", "ranged"] as WeaponKind[]).filter((kind) => kinds.has(kind));
}

export function weaponKindFromBase(base?: ItemBase): WeaponKind {
  if (base?.isRanged) return "ranged";
  if (Number(base?.health || 0) > 0) return "meleeHybrid";
  return "melee";
}

export function weaponKindLabel(kind: WeaponKind) {
  if (kind === "ranged") return "Distance";
  if (kind === "meleeHybrid") return "Corps à corps + vie";
  return "Corps à corps";
}

export function petTypeLabel(type: PetType) {
  if (type === "Damage") return "Dégâts";
  if (type === "Health") return "PV";
  return "Équilibré";
}

export function normalizeRarity(rarity?: string) {
  const normalized = String(rarity || "Common").toLowerCase();
  return rarityValues.find((entry) => entry.toLowerCase() === normalized) || "Common";
}

export function itemAllowsSecondLine(age: number) {
  return age >= 7;
}

export function companionAllowsSecondLine(rarity: string) {
  return rarityValues.indexOf(normalizeRarity(rarity)) >= rarityValues.indexOf("Legendary");
}

function resolveItemBase(slot: EquipmentSlot, age: number, idx: number, itemBases: ItemBase[]) {
  if (slot === "Weapon") {
    return itemBases.find((entry) => entry.slot === slot && entry.age === age && entry.idx === idx);
  }
  return firstItemBase(slot, age, itemBases);
}

function firstItemBase(slot: EquipmentSlot, age: number, itemBases: ItemBase[]) {
  return itemBases
    .filter((entry) => entry.slot === slot && entry.age === age)
    .sort((left, right) => left.idx - right.idx)[0];
}

function firstWeaponBaseForKind(age: number, kind: WeaponKind, itemBases: ItemBase[]) {
  return itemBases
    .filter((entry) => entry.slot === "Weapon" && entry.age === age && weaponKindFromBase(entry) === kind)
    .sort((left, right) => left.idx - right.idx)[0];
}

function companionLevelAt(rarity: string, level: number, groups: CompanionLevels[]) {
  return groups
    .find((group) => normalizeRarity(group.rarity) === normalizeRarity(rarity))
    ?.levels.find((entry) => entry.level === level);
}

function petTypeMultiplier(type: PetType) {
  if (type === "Damage") return { attack: 1.5, health: 0.5 };
  if (type === "Health") return { attack: 0.5, health: 1.5 };
  return { attack: 1, health: 1 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
