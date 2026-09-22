import type {
  FairySelection,
  NormalizedProfile,
  ProfileCombatStat,
  V4GameDataInput
} from "../../v4-core/src/index.js";

export const BIS_EQUIPMENT_SLOTS = [
  "Weapon", "Helmet", "Body", "Gloves", "Belt", "Necklace", "Ring", "Shoe"
] as const;

export type BisEquipmentSlot = typeof BIS_EQUIPMENT_SLOTS[number];
export type BisSecondaryLine = { stat: string; value: number };
export type BisEquipment = { age: number; idx: number; level: number; secondaryStats: BisSecondaryLine[] };
export type BisPet = { id: number; rarity: string; level: number; secondaryStats: BisSecondaryLine[] };
export type BisMount = { id: number; rarity: string; level: number; secondaryStats: BisSecondaryLine[] };

export type BisBuild = {
  name?: string;
  equipment: Record<BisEquipmentSlot, BisEquipment>;
  pets: BisPet[];
  mount: BisMount | null;
  spells: Array<{ id: string; level: number; rarity?: string }>;
  /** Fixed contributions from an explicitly selected scenario, never copied from a user profile. */
  fixedStats?: Partial<Record<ProfileCombatStat, number>>;
  fairy: FairySelection | null;
};

export type BisBuildRules = {
  maxEquipmentAge: number;
  itemLevel: number;
  petLevel: number;
  mountLevel: number;
  spellLevel: number;
  allowedPetRarities: string[];
  allowedMountRarities: string[];
  allowedSpellRarities: string[];
};

export type BisBuildResult =
  | { ok: true; profile: NormalizedProfile; primary: { attack: number; health: number }; secondary: Record<string, number> }
  | { ok: false; issue: { code: string; path: string } };

const ITEM_TYPE_BY_SLOT: Record<BisEquipmentSlot, string> = {
  Weapon: "Weapon", Helmet: "Helmet", Body: "Armour", Gloves: "Gloves",
  Belt: "Belt", Necklace: "Necklace", Ring: "Ring", Shoe: "Shoes"
};
const PROFILE_STAT_BY_SECONDARY: Record<string, ProfileCombatStat | undefined> = {
  CriticalChance: "critChance", CriticalMulti: "critDamage", BlockChance: "block",
  HealthRegen: "regen", LifeSteal: "lifesteal", DoubleDamageChance: "doubleChance",
  DamageMulti: "damage", MeleeDamageMulti: "meleeDamage", RangedDamageMulti: "rangedDamage",
  AttackSpeed: "attackSpeed", SkillDamageMulti: "skillDamage", SkillCooldownMulti: "skillCooldown",
  HealthMulti: "health", ReflectChance: "reflectChance"
};

/**
 * Rebuilds a fresh profile exclusively from a declared build and verified APK tables.
 * It intentionally rejects a missing catalog value instead of falling back to imported totals.
 */
export function buildBisProfile(build: BisBuild, data: V4GameDataInput, rules: BisBuildRules): BisBuildResult {
  const fail = (code: string, path: string): BisBuildResult => ({ ok: false, issue: { code, path } });
  const tables = data?.tables;
  if (!tables || typeof tables !== "object") return fail("missing_game_data", "data.tables");
  if (!Number.isInteger(rules.maxEquipmentAge) || rules.maxEquipmentAge < 0) return fail("invalid_build_rule", "rules.maxEquipmentAge");

  const items = objects(tables.ItemBalancingLibrary);
  const weapons = objects(tables.WeaponLibrary);
  const petCatalog = objects(tables.PetLibrary);
  const petUpgrades = objects(tables.PetUpgradeLibrary);
  const petBalancing = objects(tables.PetBalancingLibrary);
  const mountUpgrades = objects(tables.MountUpgradeLibrary);
  const itemUnlocks = objects(tables.SecondaryStatItemUnlockLibrary);
  const petUnlocks = objects(tables.SecondaryStatPetUnlockLibrary);
  const secondaryDefinitions = objects(tables.SecondaryStatLibrary);
  const petSlots = integer(object(tables.PetBaseConfig).PetSlotsCount);
  const itemConfig = object(tables.ItemBalancingConfig);
  if (!items.length || !weapons.length || !petCatalog.length || !petUpgrades.length || !mountUpgrades.length ||
      !itemUnlocks.length || !petUnlocks.length || !secondaryDefinitions.length || petSlots < 1) {
    return fail("missing_bis_catalog_data", "data.tables");
  }

  const totals = emptyStats();
  const primary = { attack: finite(itemConfig.PlayerBaseDamage), health: finite(itemConfig.PlayerBaseHealth) };
  if (!(primary.attack > 0) || !(primary.health > 0)) return fail("missing_player_base_data", "ItemBalancingConfig");
  const equipment: Record<string, unknown> = {};

  for (const slot of BIS_EQUIPMENT_SLOTS) {
    const selected = build.equipment?.[slot];
    const path = `build.equipment.${slot}`;
    if (!selected || !levelIs(selected.level, rules.itemLevel) || !Number.isInteger(selected.age) || !Number.isInteger(selected.idx)) {
      return fail("invalid_build_equipment", path);
    }
    if (selected.age < 0 || selected.age > rules.maxEquipmentAge) return fail("inaccessible_build_equipment", `${path}.age`);
    const item = items.find((entry) => idMatches(object(entry.ItemId), selected.age, ITEM_TYPE_BY_SLOT[slot], selected.idx));
    if (!item) return fail("missing_build_equipment_data", path);
    const stats = primaryContributions(item.EquipmentStats, `${path}.primary`);
    if (!stats.ok) return stats;
    const multiplier = Math.pow(finite(itemConfig.LevelScalingBase), selected.level - 1);
    const weapon = slot === "Weapon"
      ? weapons.find((entry) => idMatches(object(entry.ItemId), selected.age, "Weapon", selected.idx))
      : null;
    if (slot === "Weapon" && !weapon) return fail("missing_build_weapon_data", path);
    const melee = slot === "Weapon" && weapon?.IsRanged !== true ? finite(itemConfig.PlayerMeleeDamageMultiplier) : 1;
    primary.attack += stats.attack * multiplier * melee;
    primary.health += stats.health * multiplier;
    const secondary = validateLines(selected.secondaryStats, lineLimit(itemUnlocks, "ItemAge", selected.age), secondaryDefinitions, rules, `${path}.secondaryStats`);
    if (!secondary.ok) return secondary;
    addStats(totals, secondary.stats);
    equipment[slot] = { age: selected.age, idx: selected.idx, level: selected.level, secondaryStats: structuredClone(selected.secondaryStats) };
  }

  if (!Array.isArray(build.pets) || build.pets.length > petSlots) return fail("invalid_build_pet_count", "build.pets");
  const pets: unknown[] = [];
  for (const [index, selected] of build.pets.entries()) {
    const path = `build.pets.${index}`;
    if (!selected || !levelIs(selected.level, rules.petLevel) || !rules.allowedPetRarities.includes(selected.rarity)) {
      return fail("inaccessible_build_pet", path);
    }
    const pet = petCatalog.find((entry) => {
      const id = object(entry.PetId);
      return integer(id.Id) === selected.id && id.Rarity === selected.rarity;
    });
    if (!pet) return fail("missing_build_pet_data", path);
    const upgrade = upgradeFor(petUpgrades, selected.rarity, selected.level);
    if (!upgrade) return fail("missing_build_pet_upgrade", path);
    const values = primaryContributions(upgrade.Stats, `${path}.primary`);
    if (!values.ok) return values;
    const balance = petBalancing.find((entry) => entry.Type === pet.Type);
    if (!balance) return fail("missing_build_pet_multiplier", path);
    primary.attack += values.attack * finite(balance.DamageMultiplier, 1);
    primary.health += values.health * finite(balance.HealthMultiplier, 1);
    const secondary = validateLines(selected.secondaryStats, lineLimit(petUnlocks, "PetRarity", selected.rarity), secondaryDefinitions, rules, `${path}.secondaryStats`);
    if (!secondary.ok) return secondary;
    addStats(totals, secondary.stats);
    pets.push(structuredClone(selected));
  }

  let mount: unknown = null;
  if (build.mount) {
    const selected = build.mount;
    if (!levelIs(selected.level, rules.mountLevel) || !rules.allowedMountRarities.includes(selected.rarity)) {
      return fail("inaccessible_build_mount", "build.mount");
    }
    const upgrade = upgradeFor(mountUpgrades, selected.rarity, selected.level);
    if (!upgrade) return fail("missing_build_mount_upgrade", "build.mount");
    const values = primaryContributions(upgrade.Stats, "build.mount.primary");
    if (!values.ok) return values;
    primary.attack += values.attack;
    primary.health += values.health;
    const secondary = validateLines(selected.secondaryStats, lineLimit(petUnlocks, "PetRarity", selected.rarity), secondaryDefinitions, rules, "build.mount.secondaryStats");
    if (!secondary.ok) return secondary;
    addStats(totals, secondary.stats);
    mount = structuredClone(selected);
  }

  const skillSlots = integer(object(tables.SkillBaseConfig).SkillSlotsCount);
  const skills = object(tables.SkillLibrary);
  if (!Array.isArray(build.spells) || build.spells.length > skillSlots) return fail("invalid_build_spell_count", "build.spells");
  for (const [index, spell] of build.spells.entries()) {
    if (!spell || !levelIs(spell.level, rules.spellLevel) || !object(skills[spell.id]) ||
        !rules.allowedSpellRarities.includes(String(object(skills[spell.id]).Rarity))) {
      return fail("inaccessible_build_spell", `build.spells.${index}`);
    }
  }

  const rawSecondary = { ...totals };
  const fixed = build.fixedStats ?? {};
  const stats = { ...totals };
  for (const [stat, value] of Object.entries(fixed)) {
    if (!(stat in stats) || !Number.isFinite(value)) return fail("invalid_build_fixed_stat", `build.fixedStats.${stat}`);
    stats[stat as ProfileCombatStat] += value;
  }
  const profile: NormalizedProfile = {
    name: build.name || "BIS candidat", source: "manual", dataVersion: String(data.version || ""),
    base: { attack: primary.attack, health: primary.health },
    equipment: equipment as NormalizedProfile["equipment"], pets, mount: mount as NormalizedProfile["mount"],
    spells: structuredClone(build.spells), stats, secondaryStatsBeforeFairy: rawSecondary,
    fairy: structuredClone(build.fairy), talentTree: {},
    breakdown: { kind: "bis-component-rebuild-v1", primary, secondaryStatsBeforeFairy: rawSecondary, fixedStats: fixed },
    audit: []
  };
  return { ok: true, profile, primary, secondary: rawSecondary };
}

function primaryContributions(value: unknown, path: string): { ok: true; attack: number; health: number } | { ok: false; issue: { code: string; path: string } } {
  let attack = 0;
  let health = 0;
  for (const entry of objects(value)) {
    const type = object(object(entry.StatNode).UniqueStat).StatType;
    const target = object(object(entry.StatNode).Target).Kind;
    const amount = finite(entry.Value);
    if (target !== "Player" || !Number.isFinite(amount) || (type !== "Damage" && type !== "Health")) {
      return { ok: false, issue: { code: "unsupported_build_primary_stat", path } };
    }
    if (type === "Damage") attack += amount;
    else health += amount;
  }
  return { ok: true, attack, health };
}

function validateLines(lines: BisSecondaryLine[], max: number, definitions: Record<string, unknown>[], rules: BisBuildRules, path: string): { ok: true; stats: Record<ProfileCombatStat, number> } | { ok: false; issue: { code: string; path: string } } {
  if (!Array.isArray(lines) || lines.length !== max) return { ok: false, issue: { code: "invalid_build_secondary_line_count", path } };
  const stats = emptyStats();
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const definition = definitions.find((entry) => entry.Stat === line?.stat);
    const stat = PROFILE_STAT_BY_SECONDARY[line?.stat];
    const min = finite(definition?.LowerRange) * 100;
    const maxValue = finite(definition?.UpperRange) * 100;
    // Fixed-point values exported from the APK can be infinitesimally below an exact percent (for example 14.99999999).
    if (!definition || !stat || !(maxValue > 0) || !Number.isFinite(line?.value) || line.value < min - 1e-6 || line.value > maxValue + 1e-6) {
      return { ok: false, issue: { code: "invalid_build_secondary_line", path: `${path}.${index}` } };
    }
    if (seen.has(line.stat)) {
      return { ok: false, issue: { code: "duplicate_build_secondary_stat", path: `${path}.${index}` } };
    }
    seen.add(line.stat);
    stats[stat] += line.value;
  }
  return { ok: true, stats };
}

function upgradeFor(entries: Record<string, unknown>[], rarity: string, level: number): Record<string, unknown> | undefined {
  const library = entries.find((entry) => entry.Rarity === rarity);
  return objects(library?.LevelInfo).find((entry) => integer(entry.Level) === level - 1);
}

function lineLimit(entries: Record<string, unknown>[], field: string, key: unknown): number {
  const entry = entries.find((candidate) => candidate[field] === key);
  return integer(entry?.NumberOfSecondStats);
}

function idMatches(id: Record<string, unknown>, age: number, type: string, idx: number): boolean {
  return integer(id.Age) === age && id.Type === type && integer(id.Idx) === idx;
}

function levelIs(level: unknown, expected: number): boolean {
  return Number.isInteger(level) && Number.isInteger(expected) && level === expected && level >= 1;
}

function emptyStats(): Record<ProfileCombatStat, number> {
  return {
    attackSpeed: 0, block: 0, critChance: 0, critDamage: 0, damage: 0, doubleChance: 0,
    health: 0, lifesteal: 0, meleeDamage: 0, rangedDamage: 0, reflectChance: 0,
    regen: 0, skillCooldown: 0, skillDamage: 0
  };
}

function addStats(target: Record<ProfileCombatStat, number>, source: Record<ProfileCombatStat, number>) {
  for (const stat of Object.keys(target) as ProfileCombatStat[]) target[stat] += source[stat];
}
function object(value: unknown): Record<string, any> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}; }
function objects(value: unknown): Record<string, any>[] { return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) : []; }
function integer(value: unknown): number { return Number.isInteger(value) ? Number(value) : 0; }
function finite(value: unknown, fallback = 0): number { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
