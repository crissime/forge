import type {
  EvaluationResult,
  NormalizedProfile,
  Objective,
  PvpResult,
  ScenarioSettings,
  StatMap
} from "@forge-master/simulator";

export type Session = { authenticated: boolean; username?: string };

export type CloudProfile = {
  id: string;
  name: string;
  source: string;
  dataVersion: string;
  confidence: string;
  normalized: NormalizedProfile;
  createdAt: string;
  updatedAt: string;
};

export type StatOption = { id: keyof StatMap; label: string; max: number };
export type SpellOption = { id: string; name: string; rarity: string };
export type TechTreeName = "Forge" | "Power" | "SkillsPetTech";
export type TechEffect = {
  targetType: string;
  statType: string;
  valuePerLevel: number;
  itemType?: number;
};
export type TechNode = {
  tree: TechTreeName;
  id: number;
  tier: number;
  layer: number;
  type: string;
  requirements: number[];
  maxLevel: number;
  effects?: TechEffect[];
};
export type AgeOption = { value: number; label: string };
export type ItemBase = {
  slot: import("@forge-master/simulator").EquipmentSlot;
  age: number;
  idx: number;
  attack: number;
  health: number;
  isRanged?: boolean;
};
export type ItemConfig = {
  levelScalingBase: number;
  meleeDamageMultiplier: number;
  maxLevel: number;
};
export type PetType = "Balanced" | "Damage" | "Health";
export type PetModel = { rarity: string; id: number; name: string; type: PetType };
export type MountModel = { rarity: string; id: number };
export type CompanionLevel = { level: number; attack: number; health: number };
export type CompanionLevels = { rarity: string; levels: CompanionLevel[] };
export type BisAccess = {
  equipmentAges: number[];
  petRarities: string[];
  mountRarities: string[];
  spellRarities: string[];
};

export type GameDataInfo = {
  normalized?: {
    stats: StatOption[];
    techNodes: TechNode[];
    spells: SpellOption[];
    ageOptions: AgeOption[];
    itemBases: ItemBase[];
    petModels: PetModel[];
    mountModels: MountModel[];
    petLevels: CompanionLevels[];
    mountLevels: CompanionLevels[];
    itemConfig: ItemConfig;
  };
};

export type SyncStatus =
  | "modified"
  | "calculating"
  | "saved"
  | "saving"
  | "synced"
  | "error";

export type EditorTarget =
  | { kind: "equipment"; id: string }
  | { kind: "pet"; id: number }
  | { kind: "mount"; id: 0 }
  | { kind: "spell"; id: number }
  | { kind: "audit"; id: 0 }
  | null;

export type Evaluation = EvaluationResult | PvpResult;

export type ScenarioState = Required<ScenarioSettings>;

export const defaultScenarios: ScenarioState = {
  levelRange: { min: 1, max: 1, age: 1, combat: 1, difficulty: 0 },
  endurance: { startDamagePct: 2, growthPct: 0.12, maxSeconds: 900 },
  timeToKill: { targetSeconds: 24, incomingDamagePct: 0.35, maxSeconds: 300 },
  gauntlet: {
    mobCount: 8,
    firstMobSeconds: 8,
    firstDamagePct: 0.85,
    healthGrowthPct: 12,
    damageGrowthPct: 10,
    pauseSeconds: 1,
    maxSeconds: 900
  }
};

export const objectives: Array<{ id: Objective; label: string }> = [
  { id: "progress", label: "Progression" },
  { id: "damage", label: "DPS" },
  { id: "survival", label: "Survie" },
  { id: "balanced", label: "Équilibre" }
];

export const defaultBisAccess: BisAccess = {
  equipmentAges: [0],
  petRarities: ["Common"],
  mountRarities: ["Common"],
  spellRarities: ["Common"]
};
