import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_GAME_DATA_VERSION = "2026_05_23_14_08";

export const RAW_GAME_DATA_FILES = [
  "SecondaryStatLibrary.json",
  "SkillLibrary.json",
  "TechTreeLibrary.json",
  "ItemBalancingLibrary.json",
  "ItemBalancingConfig.json",
  "WeaponLibrary.json",
  "PetLibrary.json",
  "PetUpgradeLibrary.json",
  "PetBalancingLibrary.json",
  "PetBaseConfig.json",
  "MountLibrary.json",
  "MountUpgradeLibrary.json",
  "PvpBaseConfig.json",
  "MainBattleConfig.json",
  "MainBattleLibrary.json",
  "EnemyAgeScalingLibrary.json",
  "EnemyLibrary.json",
  "ProjectilesLibrary.json"
] as const;

export const ROOT_GAME_DATA_FILES = ["TechTreeMapping.json", "ManualSpriteMapping.json"] as const;
export const CURATED_GAME_DATA_FILES = ["SkillMechanics.json"] as const;

export type RawGameDataFile =
  | (typeof RAW_GAME_DATA_FILES)[number]
  | (typeof ROOT_GAME_DATA_FILES)[number]
  | (typeof CURATED_GAME_DATA_FILES)[number];

export type StatId =
  | "damage"
  | "health"
  | "rangedDamage"
  | "meleeDamage"
  | "skillDamage"
  | "cooldown"
  | "regen"
  | "lifesteal"
  | "attackSpeed"
  | "doubleChance"
  | "critChance"
  | "critDamage"
  | "block";

export interface NormalizedSecondaryStat {
  id: StatId;
  sourceId: string;
  label: string;
  min: number;
  max: number;
  nature: string;
}

export interface NormalizedSpell {
  id: string;
  name: string;
  rarity: string;
  cooldown: number;
  activeDuration: number;
  damageByLevel: number[];
  healthByLevel: number[];
  mechanics: {
    kind: "buff" | "damage";
    targetMode: "self" | "single" | "all";
    hitCount: number;
    hitInterval: number;
    castDelay: number;
    startupDelay: number;
    damageValueMode: "total" | "per_hit";
    confidence: "high" | "medium" | "low";
    source: string;
    sourceUrl: string;
  };
}

export type TechTreeName = "Forge" | "Power" | "SkillsPetTech";

export interface NormalizedTechNode {
  tree: TechTreeName;
  id: number;
  tier: number;
  layer: number;
  type: string;
  requirements: number[];
  maxLevel: number;
  effects: Array<{
    targetType: string;
    statType: string;
    valuePerLevel: number;
    itemType?: number;
  }>;
}

export type ItemSlot = "Weapon" | "Helmet" | "Body" | "Gloves" | "Belt" | "Necklace" | "Ring" | "Shoe";

export interface NormalizedItemBase {
  slot: ItemSlot;
  age: number;
  idx: number;
  attack: number;
  health: number;
  isRanged?: boolean;
}

export interface NormalizedPetModel {
  rarity: string;
  id: number;
  name: string;
  type: "Balanced" | "Damage" | "Health";
}

export interface NormalizedMountModel {
  rarity: string;
  id: number;
}

export interface NormalizedCompanionLevel {
  level: number;
  attack: number;
  health: number;
}

export interface NormalizedCompanionLevels {
  rarity: string;
  levels: NormalizedCompanionLevel[];
}

export interface NormalizedAgeOption {
  value: number;
  label: string;
}

export interface NormalizedGameData {
  version: string;
  stats: NormalizedSecondaryStat[];
  spells: NormalizedSpell[];
  techNodes: NormalizedTechNode[];
  ageOptions: NormalizedAgeOption[];
  itemBases: NormalizedItemBase[];
  petModels: NormalizedPetModel[];
  mountModels: NormalizedMountModel[];
  petLevels: NormalizedCompanionLevels[];
  mountLevels: NormalizedCompanionLevels[];
  itemConfig: {
    levelScalingBase: number;
    meleeDamageMultiplier: number;
    maxLevel: number;
  };
}

export interface GameDataManifestFile {
  file: string;
  sourceUrl: string;
  sha256: string;
  bytes: number;
}

export interface GameDataManifest {
  version: string;
  sourceRepo: string;
  sourceRef: string;
  generatedAt: string;
  files: GameDataManifestFile[];
}

export interface GameDataBundle {
  manifest: GameDataManifest;
  normalized: NormalizedGameData;
  raw: Record<RawGameDataFile, any>;
}

export const STAT_ID_MAP: Record<string, StatId> = {
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

export const STAT_LABELS: Record<StatId, string> = {
  damage: "Damage",
  health: "Health",
  rangedDamage: "Ranged Damage",
  meleeDamage: "Melee Damage",
  skillDamage: "Skill Damage",
  cooldown: "Skill Cooldown",
  regen: "Health Regen",
  lifesteal: "Lifesteal",
  attackSpeed: "Attack Speed",
  doubleChance: "Double Chance",
  critChance: "Crit Chance",
  critDamage: "Crit Damage",
  block: "Block"
};

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeGameData(version: string, raw: Partial<Record<RawGameDataFile, any>>): NormalizedGameData {
  const secondary = raw["SecondaryStatLibrary.json"] || {};
  const spells = raw["SkillLibrary.json"] || {};
  const skillMechanics = raw["SkillMechanics.json"] || {};
  const mapping = raw["TechTreeMapping.json"] || {};
  const techLibrary = raw["TechTreeLibrary.json"] || {};
  const itemLibrary = raw["ItemBalancingLibrary.json"] || {};
  const itemConfig = raw["ItemBalancingConfig.json"] || {};
  const weaponLibrary = raw["WeaponLibrary.json"] || {};
  const petLibrary = raw["PetLibrary.json"] || {};
  const spriteMapping = raw["ManualSpriteMapping.json"] || {};
  const petUpgradeLibrary = raw["PetUpgradeLibrary.json"] || {};
  const mountLibrary = raw["MountLibrary.json"] || {};
  const mountUpgradeLibrary = raw["MountUpgradeLibrary.json"] || {};

  return {
    version,
    stats: Object.entries(STAT_ID_MAP)
      .map(([sourceId, id]) => {
        const entry = secondary[sourceId] || {};
        return {
          id,
          sourceId,
          label: STAT_LABELS[id],
          min: Number(entry.LowerRange || 0) * 100,
          max: Number(entry.UpperRange || 0) * 100,
          nature: entry.StatNodes?.[0]?.UniqueStat?.StatNature || "Multiplier"
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label)),
    spells: Object.values<any>(spells).map((spell) => {
      const mechanics = skillMechanics.spells?.[spell.Type] || {};
      return {
        id: String(spell.Type),
        name: String(spell.Type || "").replace(/([A-Z])/g, " $1").trim(),
        rarity: String(spell.Rarity || "Common"),
        cooldown: Number(spell.Cooldown || 1),
        activeDuration: Number(spell.ActiveDuration || 0),
        damageByLevel: Array.isArray(spell.DamagePerLevel) ? spell.DamagePerLevel.map(Number) : [],
        healthByLevel: Array.isArray(spell.HealthPerLevel) ? spell.HealthPerLevel.map(Number) : [],
        mechanics: {
          kind: mechanics.kind === "buff" ? "buff" : "damage",
          targetMode: ["self", "single", "all"].includes(mechanics.targetMode) ? mechanics.targetMode : "single",
          hitCount: Number(mechanics.hitCount ?? 1),
          hitInterval: Number(mechanics.hitInterval || 0),
          castDelay: Number(mechanics.castDelay || 0),
          startupDelay: Number(skillMechanics.startupDelay || 3.2),
          damageValueMode: mechanics.damageValueMode === "per_hit" ? "per_hit" : "total",
          confidence: ["high", "medium", "low"].includes(mechanics.confidence) ? mechanics.confidence : "low",
          source: String(skillMechanics.source || "curated"),
          sourceUrl: String(skillMechanics.sourceUrl || "")
        }
      } satisfies NormalizedSpell;
    }),
    techNodes: (["Forge", "Power", "SkillsPetTech"] as TechTreeName[]).flatMap((treeName) => {
      const nodes = mapping.trees?.[treeName]?.nodes || [];
      return nodes.map((node: any) => ({
        tree: treeName,
        id: Number(node.id),
        tier: Number(node.tier || 0),
        layer: Number(node.layer || node.id || 0),
        type: String(node.type),
        requirements: Array.isArray(node.requirements) ? node.requirements.map(Number) : [],
        maxLevel: Number(techLibrary[node.type]?.MaxLevel || 5),
        effects: (techLibrary[node.type]?.Stats || []).map((stat: any) => ({
          targetType: String(stat.StatNode?.StatTarget?.$type || ""),
          statType: String(stat.StatNode?.UniqueStat?.StatType || ""),
          valuePerLevel: Number(stat.ValueIncrease ?? stat.Value ?? 0),
          itemType: typeof stat.StatNode?.StatTarget?.ItemType === "number" ? Number(stat.StatNode.StatTarget.ItemType) : undefined
        }))
      }));
    }),
    ageOptions: AGE_OPTIONS,
    itemBases: normalizeItemBases(itemLibrary, weaponLibrary),
    petModels: Object.values<any>(petLibrary)
      .map((entry) => {
        const rarity = String(entry.PetId?.Rarity || "Common");
        const id = Number(entry.PetId?.Id || 0);
        return {
          rarity,
          id,
          name: petModelName(spriteMapping, rarity, id),
          type: (["Balanced", "Damage", "Health"].includes(entry.Type) ? entry.Type : "Balanced") as NormalizedPetModel["type"]
        };
      })
      .sort(sortCompanionModel),
    mountModels: Object.values<any>(mountLibrary)
      .map((entry) => ({
        rarity: String(entry.MountId?.Rarity || "Common"),
        id: Number(entry.MountId?.Id || 0)
      }))
      .sort(sortCompanionModel),
    petLevels: normalizeCompanionLevels(petUpgradeLibrary, "PetStats"),
    mountLevels: normalizeCompanionLevels(mountUpgradeLibrary, "MountStats"),
    itemConfig: {
      levelScalingBase: Number(itemConfig.LevelScalingBase || 1.01),
      meleeDamageMultiplier: Number(itemConfig.PlayerMeleeDamageMultiplier || 1.6),
      maxLevel: Number(itemConfig.ItemBaseMaxLevel || 98)
    }
  };
}

function petModelName(spriteMapping: any, rarity: string, id: number): string {
  const match = Object.values<any>(spriteMapping?.pets?.mapping || {})
    .find((entry) => String(entry.rarity) === rarity && Number(entry.id) === id);
  return splitPascalCase(String(match?.name || `Pet ${id + 1}`));
}

function splitPascalCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .trim();
}

function normalizeCompanionLevels(library: Record<string, any>, statsKey: "PetStats" | "MountStats"): NormalizedCompanionLevels[] {
  return Object.entries<any>(library).map(([rarity, entry]) => ({
    rarity,
    levels: (entry.LevelInfo || []).map((levelInfo: any) => {
      let attack = 0;
      let health = 0;
      for (const stat of levelInfo?.[statsKey]?.Stats || []) {
        const statType = stat.StatNode?.UniqueStat?.StatType;
        if (statType === "Damage") attack += Number(stat.Value || 0);
        if (statType === "Health") health += Number(stat.Value || 0);
      }
      return {
        level: Number(levelInfo.Level || 0) + 1,
        attack,
        health
      };
    })
  }));
}

function sortCompanionModel(left: { rarity: string; id: number }, right: { rarity: string; id: number }) {
  const rarityOrder = ["Common", "Rare", "Epic", "Legendary", "Ultimate", "Mythic"];
  return rarityOrder.indexOf(left.rarity) - rarityOrder.indexOf(right.rarity) || left.id - right.id;
}

const JSON_TYPE_TO_SLOT: Record<string, ItemSlot> = {
  Weapon: "Weapon",
  Helmet: "Helmet",
  Armour: "Body",
  Gloves: "Gloves",
  Belt: "Belt",
  Necklace: "Necklace",
  Ring: "Ring",
  Shoes: "Shoe"
};

const AGE_OPTIONS: NormalizedAgeOption[] = [
  { value: 0, label: "Primitive" },
  { value: 1, label: "Medieval" },
  { value: 2, label: "Debut moderne" },
  { value: 3, label: "Moderne" },
  { value: 4, label: "Espace" },
  { value: 5, label: "Interstellaire" },
  { value: 6, label: "Multiverse" },
  { value: 7, label: "Quantique" },
  { value: 8, label: "Enfers" },
  { value: 9, label: "Divin" }
];

function normalizeItemBases(itemLibrary: Record<string, any>, weaponLibrary: Record<string, any>): NormalizedItemBase[] {
  return Object.values<any>(itemLibrary)
    .flatMap((entry) => {
      const slot = JSON_TYPE_TO_SLOT[String(entry.ItemId?.Type || "")];
      if (!slot) return [];
      const age = Number(entry.ItemId?.Age || 0);
      const idx = Number(entry.ItemId?.Idx || 0);
      let attack = 0;
      let health = 0;
      for (const stat of entry.EquipmentStats || []) {
        const statType = stat.StatNode?.UniqueStat?.StatType;
        if (statType === "Damage") attack += Number(stat.Value || 0);
        if (statType === "Health") health += Number(stat.Value || 0);
      }
      const weaponKey = `{'Age': ${age}, 'Type': 'Weapon', 'Idx': ${idx}}`;
      return [{
        slot,
        age,
        idx,
        attack,
        health,
        isRanged: slot === "Weapon" && weaponLibrary[weaponKey] ? Boolean(weaponLibrary[weaponKey].IsRanged) : undefined
      }];
    })
    .sort((left, right) => left.slot.localeCompare(right.slot) || left.age - right.age || left.idx - right.idx);
}

export function defaultDataRoot(): string {
  return process.env.GAME_DATA_DIR || path.resolve(process.cwd(), "packages", "game-data", "data");
}

export async function loadGameData(version = process.env.GAME_DATA_VERSION || DEFAULT_GAME_DATA_VERSION, root = defaultDataRoot()): Promise<GameDataBundle> {
  const versionRoot = path.join(root, version);
  const manifest = JSON.parse(await readFile(path.join(versionRoot, "manifest.json"), "utf8")) as GameDataManifest;
  const normalized = JSON.parse(await readFile(path.join(versionRoot, "normalized.json"), "utf8")) as NormalizedGameData;
  const raw: Partial<Record<RawGameDataFile, any>> = {};

  for (const file of [...RAW_GAME_DATA_FILES, ...ROOT_GAME_DATA_FILES, ...CURATED_GAME_DATA_FILES]) {
    raw[file] = JSON.parse(await readFile(path.join(versionRoot, "raw", file), "utf8"));
  }

  return { manifest, normalized, raw: raw as Record<RawGameDataFile, any> };
}
