import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  DropComparisonResult,
  EquipmentSlot,
  EvaluationResult,
  NormalizedProfile,
  Objective,
  PvpResult,
  SecondaryLine,
  StatMap
} from "@forge-master/simulator";
import {
  defaultBisAccess,
  defaultScenarios,
  type BisAccess,
  type EditorTarget,
  type GameDataInfo,
  type ScenarioState,
  type Session,
  type SyncStatus,
  type TechNode
} from "../types";

const equipmentSlots: EquipmentSlot[] = [
  "Weapon",
  "Helmet",
  "Body",
  "Gloves",
  "Belt",
  "Necklace",
  "Ring",
  "Shoe"
];
const itemTypeToSlot: EquipmentSlot[] = [
  "Helmet",
  "Body",
  "Gloves",
  "Necklace",
  "Ring",
  "Weapon",
  "Shoe",
  "Belt"
];
const memory = new Map<string, string>();
const fallbackStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key)
};

export type ComparisonHistory = {
  at: string;
  label: string;
  result: DropComparisonResult;
};

type WorkshopState = {
  profile: NormalizedProfile | null;
  opponent: NormalizedProfile | null;
  past: NormalizedProfile[];
  future: NormalizedProfile[];
  objective: Objective;
  scenarios: ScenarioState;
  evaluation: EvaluationResult | PvpResult | null;
  gameData: GameDataInfo;
  session: Session;
  cloudProfileId: string | null;
  syncStatus: SyncStatus;
  selected: EditorTarget;
  comparisonHistory: ComparisonHistory[];
  bisAccess: BisAccess;
  toast: string;
  setProfile: (profile: NormalizedProfile, record?: boolean) => void;
  editProfile: (recipe: (draft: NormalizedProfile) => void) => void;
  setOpponent: (profile: NormalizedProfile | null) => void;
  editOpponent: (recipe: (draft: NormalizedProfile) => void) => void;
  undo: () => void;
  redo: () => void;
  setObjective: (objective: Objective) => void;
  setScenarios: (scenarios: ScenarioState) => void;
  setEvaluation: (evaluation: EvaluationResult | PvpResult | null) => void;
  setGameData: (gameData: GameDataInfo) => void;
  setSession: (session: Session) => void;
  setCloudProfileId: (id: string | null) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setSelected: (selected: EditorTarget) => void;
  addComparison: (entry: ComparisonHistory) => void;
  setBisAccess: (access: BisAccess) => void;
  notify: (message: string) => void;
};

export const useWorkshop = create<WorkshopState>()(
  persist(
    (set, get) => ({
      profile: null,
      opponent: null,
      past: [],
      future: [],
      objective: "progress",
      scenarios: defaultScenarios,
      evaluation: null,
      gameData: {},
      session: { authenticated: false },
      cloudProfileId: null,
      syncStatus: "saved",
      selected: null,
      comparisonHistory: [],
      bisAccess: defaultBisAccess,
      toast: "",
      setProfile: (profile, record = false) =>
        set((state) => ({
          profile: clone(profile),
          past: record && state.profile ? [...state.past, clone(state.profile)].slice(-50) : state.past,
          future: record ? [] : state.future,
          syncStatus: record ? "modified" : state.syncStatus
        })),
      editProfile: (recipe) =>
        set((state) => {
          if (!state.profile) return state;
          const draft = clone(state.profile);
          prepareEditable(draft, state.gameData.normalized?.techNodes || []);
          recipe(draft);
          recalculateProfile(draft, state.gameData);
          return {
            profile: draft,
            past: [...state.past, clone(state.profile)].slice(-50),
            future: [],
            syncStatus: "modified"
          };
        }),
      setOpponent: (opponent) => set({ opponent: opponent ? clone(opponent) : null }),
      editOpponent: (recipe) =>
        set((state) => {
          if (!state.opponent) return state;
          const opponent = clone(state.opponent);
          recipe(opponent);
          return { opponent };
        }),
      undo: () =>
        set((state) => {
          const previous = state.past.at(-1);
          if (!previous || !state.profile) return state;
          return {
            profile: clone(previous),
            past: state.past.slice(0, -1),
            future: [clone(state.profile), ...state.future].slice(0, 50),
            syncStatus: "modified"
          };
        }),
      redo: () =>
        set((state) => {
          const next = state.future[0];
          if (!next || !state.profile) return state;
          return {
            profile: clone(next),
            past: [...state.past, clone(state.profile)].slice(-50),
            future: state.future.slice(1),
            syncStatus: "modified"
          };
        }),
      setObjective: (objective) => set({ objective }),
      setScenarios: (scenarios) => set({ scenarios }),
      setEvaluation: (evaluation) => set({ evaluation }),
      setGameData: (gameData) => set({ gameData }),
      setSession: (session) => set({ session }),
      setCloudProfileId: (cloudProfileId) => set({ cloudProfileId }),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setSelected: (selected) => set({ selected }),
      addComparison: (entry) =>
        set((state) => ({
          comparisonHistory: [entry, ...state.comparisonHistory].slice(0, 10)
        })),
      setBisAccess: (bisAccess) => set({ bisAccess }),
      notify: (toast) => {
        set({ toast });
        window.setTimeout(() => {
          if (get().toast === toast) set({ toast: "" });
        }, 3200);
      }
    }),
    {
      name: "forge-master-v3",
      storage: createJSONStorage(() => typeof localStorage === "undefined" ? fallbackStorage : localStorage),
      partialize: (state) => ({
        profile: state.profile,
        opponent: state.opponent,
        objective: state.objective,
        scenarios: state.scenarios,
        comparisonHistory: state.comparisonHistory,
        bisAccess: state.bisAccess,
        cloudProfileId: state.cloudProfileId
      })
    }
  )
);

export function emptyProfile(): NormalizedProfile {
  const stats = blankStats();
  return {
    name: "Profil atelier",
    source: "manual",
    dataVersion: "local",
    confidence: "partial",
    base: { attack: 10, health: 80, weaponStyle: "ranged" },
    equipment: Object.fromEntries(equipmentSlots.map((slot) => [slot, null])) as NormalizedProfile["equipment"],
    pets: [],
    mount: null,
    spells: [],
    talentTree: { Forge: {}, Power: {}, SkillsPetTech: {} },
    stats,
    breakdown: {
      baseAttack: 10,
      baseHealth: 80,
      equipmentAttack: 0,
      equipmentHealth: 0,
      petAttack: 0,
      petHealth: 0,
      mountAttack: 0,
      mountHealth: 0,
      secondaryStats: blankStats(),
      talentStats: blankStats()
    },
    audit: [{ severity: "info", code: "local_profile", message: "Profil local prêt à être complété." }]
  };
}

export function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T;
}

function blankStats(source?: StatMap): StatMap {
  const keys = source
    ? Object.keys(source)
    : [
        "damage",
        "health",
        "rangedDamage",
        "meleeDamage",
        "skillDamage",
        "cooldown",
        "regen",
        "lifesteal",
        "attackSpeed",
        "doubleChance",
        "critChance",
        "critDamage",
        "block"
      ];
  return Object.fromEntries(keys.map((key) => [key, 0])) as StatMap;
}

function prepareEditable(profile: NormalizedProfile, nodes: TechNode[]) {
  if (profile.source === "manual" || profile.source === "guest") return;
  const effects = talentEffects(profile, nodes);
  for (const slot of equipmentSlots) {
    const item = profile.equipment[slot];
    if (!item) continue;
    item.attack /= 1 + effects.equipment[slot].attack;
    item.health /= 1 + effects.equipment[slot].health;
  }
  for (const pet of profile.pets) {
    pet.attack /= 1 + effects.petAttack;
    pet.health /= 1 + effects.petHealth;
  }
  if (profile.mount) {
    profile.mount.attack /= 1 + effects.mountAttack;
    profile.mount.health /= 1 + effects.mountHealth;
  }
  profile.source = "manual";
}

function recalculateProfile(profile: NormalizedProfile, gameData: GameDataInfo) {
  const effects = talentEffects(profile, gameData.normalized?.techNodes || []);
  const secondary = blankStats(profile.stats);
  let equipmentAttack = 0;
  let equipmentHealth = 0;
  let petAttack = 0;
  let petHealth = 0;
  let mountAttack = 0;
  let mountHealth = 0;

  for (const slot of equipmentSlots) {
    const item = profile.equipment[slot];
    if (!item) continue;
    equipmentAttack += Number(item.attack || 0) * (1 + effects.equipment[slot].attack);
    equipmentHealth += Number(item.health || 0) * (1 + effects.equipment[slot].health);
    addLines(secondary, item.secondaryStats);
    item.recognized = hasValues(item.attack, item.health, item.secondaryStats);
  }
  for (const pet of profile.pets) {
    petAttack += Number(pet.attack || 0) * (1 + effects.petAttack);
    petHealth += Number(pet.health || 0) * (1 + effects.petHealth);
    addLines(secondary, pet.secondaryStats);
    pet.recognized = hasValues(pet.attack, pet.health, pet.secondaryStats);
  }
  if (profile.mount) {
    mountAttack = Number(profile.mount.attack || 0) * (1 + effects.mountAttack);
    mountHealth = Number(profile.mount.health || 0) * (1 + effects.mountHealth);
    addLines(secondary, profile.mount.secondaryStats);
    profile.mount.recognized = hasValues(
      profile.mount.attack,
      profile.mount.health,
      profile.mount.secondaryStats
    );
  }

  profile.breakdown.equipmentAttack = equipmentAttack;
  profile.breakdown.equipmentHealth = equipmentHealth;
  profile.breakdown.petAttack = petAttack;
  profile.breakdown.petHealth = petHealth;
  profile.breakdown.mountAttack = mountAttack;
  profile.breakdown.mountHealth = mountHealth;
  profile.breakdown.secondaryStats = secondary;
  profile.breakdown.talentStats = effects.stats;
  profile.stats = blankStats(profile.stats);
  for (const key of Object.keys(profile.stats) as Array<keyof StatMap>) {
    profile.stats[key] = Number(secondary[key] || 0) + Number(effects.stats[key] || 0);
  }
  profile.base.attack =
    Number(profile.breakdown.baseAttack || 0) + equipmentAttack + petAttack + mountAttack;
  profile.base.health =
    Number(profile.breakdown.baseHealth || 0) + equipmentHealth + petHealth + mountHealth;
  profile.confidence = "partial";
}

function talentEffects(profile: NormalizedProfile, nodes: TechNode[]) {
  const effects = {
    equipment: Object.fromEntries(
      equipmentSlots.map((slot) => [slot, { attack: 0, health: 0 }])
    ) as Record<EquipmentSlot, { attack: number; health: number }>,
    petAttack: 0,
    petHealth: 0,
    mountAttack: 0,
    mountHealth: 0,
    stats: blankStats(profile.stats)
  };
  for (const node of nodes) {
    const level = Number(profile.talentTree[node.tree]?.[node.id] || 0);
    if (!level) continue;
    for (const effect of node.effects || []) {
      const value = Number(effect.valuePerLevel || 0) * level;
      const attack = /Damage/i.test(effect.statType);
      const health = /Health/i.test(effect.statType);
      if (effect.targetType === "WeaponStatTarget") {
        if (attack) effects.equipment.Weapon.attack += value;
        if (health) effects.equipment.Weapon.health += value;
      }
      if (effect.targetType === "EquipmentStatTarget" && effect.itemType !== undefined) {
        const slot = itemTypeToSlot[effect.itemType];
        if (slot && attack) effects.equipment[slot].attack += value;
        if (slot && health) effects.equipment[slot].health += value;
      }
      if (effect.targetType === "PetStatTarget") {
        if (attack) effects.petAttack += value;
        if (health) effects.petHealth += value;
      }
      if (effect.targetType === "MountStatTarget") {
        if (attack) effects.mountAttack += value;
        if (health) effects.mountHealth += value;
      }
      if (/SkillStatTarget/.test(effect.targetType)) {
        if (attack && "skillDamage" in effects.stats) effects.stats.skillDamage += value * 100;
        if (health && "health" in effects.stats) effects.stats.health += value * 100;
      }
    }
  }
  return effects;
}

function addLines(target: StatMap, lines: SecondaryLine[]) {
  for (const line of lines) target[line.stat] = Number(target[line.stat] || 0) + Number(line.value || 0);
}

function hasValues(attack: number, health: number, lines: SecondaryLine[]) {
  return Boolean(Number(attack) || Number(health) || lines.some((line) => Number(line.value)));
}
