import { buildBattleDefinition } from "./battle-data.js";
import {
  simulatePvpCombat,
  simulateWeaponCombat,
  type SkillActivationPolicy
} from "./combat-engine.js";
import {
  buildPlayerCombatProfile,
  type ExistingProfileForCombat
} from "./combat-profile.js";
import { fd6FromF64, fd6ToNumber } from "./fd6.js";
import type { FairyCalculation } from "./fairy.js";
import { buildPlayerSkillDefinitions } from "./skill-data.js";

export * from "./fd6.js";
export * from "./stat-resolver.js";
export * from "./battle-data.js";
export * from "./attack-machine.js";
export * from "./random-pcg.js";
export * from "./combat-profile.js";
export * from "./fairy.js";
export * from "./combat-engine.js";
export * from "./skill-data.js";

export type FightPoint = {
  age: number;
  combat: number;
  difficulty: "normal" | "hard";
};

export type CombatVerdict = {
  point: FightPoint;
  passed: boolean;
  reason: "cleared" | "dead" | "timeout" | "invalid_input" | "missing_data";
  clearedWaves: number;
  waveCount: number;
  timeSeconds: number;
  maxSeconds: number;
  remainingHealth: number;
  damageDone: number;
  blockMode: "average" | "rng";
  seed: number | null;
  issues: Array<{ severity: "warning" | "error"; code: string; path?: string }>;
  metrics: Record<string, number | string>;
};

export type CombatVerdictOptions = {
  maxSeconds?: number;
  blockMode?: "average" | "rng";
  seed?: number;
  skillActivationPolicy?: SkillActivationPolicy;
};

export type PvpVerdictOptions = Omit<CombatVerdictOptions, "maxSeconds">;

export type PvpVerdict = {
  winner: "player" | "opponent" | "draw" | null;
  reason: "knockout" | "timeout" | "invalid_input" | "missing_data";
  validation: "unverified_in_game";
  timeSeconds: number;
  maxSeconds: number;
  playerRemainingHealth: number;
  opponentRemainingHealth: number;
  playerMaxHealth: number;
  opponentMaxHealth: number;
  playerDamageDone: number;
  opponentDamageDone: number;
  blockMode: "average" | "rng";
  seed: number | null;
  issues: Array<{ severity: "warning" | "error"; code: string; path?: string }>;
  metrics: Record<string, number | string>;
};

export type V4GameDataInput = {
  version?: string;
  tables: Record<string, unknown>;
};

export type AuditIssue = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  path?: string;
};

export type NormalizedProfile = ExistingProfileForCombat & {
  equipment: Record<string, unknown> & ExistingProfileForCombat["equipment"];
  stats: NonNullable<ExistingProfileForCombat["stats"]>;
  breakdown: Record<string, unknown>;
  talentTree: Record<string, unknown>;
  pets?: unknown[];
  spells?: Array<{ id?: string; level?: number; rarity?: string }>;
  audit?: AuditIssue[];
  dataVersion?: string;
  source?: string;
};

export type V4ProfileSourceKind =
  | "db-normalized"
  | "db-rawProfile"
  | "export-v2"
  | "localStorage-v3"
  | "1vcian"
  | "manual";

export type V4ProfileEntry = {
  schema: "forge-master-v4-profile-entry-v1";
  sourceKind: V4ProfileSourceKind;
  dataVersion: string;
  name: string;
  profile: NormalizedProfile | null;
  decisionComplete: boolean;
  missing: string[];
  audit: AuditIssue[];
};

const DEFAULT_MAX_SECONDS = 900;
const DEFAULT_RNG_SEED = 1337;
const DEFAULT_SKILL_ACTIVATION_POLICY: SkillActivationPolicy = "auto_when_ready";

export function evaluateCombatVerdict(
  profile: NormalizedProfile,
  data: V4GameDataInput,
  point: FightPoint,
  options: CombatVerdictOptions = {}
): CombatVerdict {
  const maxSeconds = options.maxSeconds === undefined ? DEFAULT_MAX_SECONDS : readNumber(options.maxSeconds);
  const blockMode = options.blockMode === "rng" ? "rng" : "average";
  const seed = blockMode === "rng"
    ? Math.round(options.seed === undefined ? DEFAULT_RNG_SEED : readNumber(options.seed))
    : null;
  const skillActivationPolicy = options.skillActivationPolicy ?? DEFAULT_SKILL_ACTIVATION_POLICY;
  const base = emptyVerdict(point, maxSeconds, blockMode, seed);

  const inputIssue = validatePoint(point);
  if (inputIssue) return { ...base, reason: "invalid_input", issues: [inputIssue] };
  const optionIssue = validateOptions(options);
  if (optionIssue) return { ...base, reason: "invalid_input", issues: [optionIssue] };
  if (!isNormalizedProfile(profile)) {
    return {
      ...base,
      reason: "invalid_input",
      issues: [{ severity: "error", code: "invalid_profile", path: "profile" }]
    };
  }
  if (!data || !isObject(data.tables)) {
    return {
      ...base,
      reason: "missing_data",
      issues: [{ severity: "error", code: "missing_game_data", path: "data.tables" }]
    };
  }
  const battle = buildBattleDefinition(data.tables, point);
  if (!battle.ok) {
    return {
      ...base,
      reason: "missing_data",
      issues: [{ severity: "error", ...battle.issue }]
    };
  }
  const player = buildPlayerCombatProfile(profile, data.tables, data.version);
  if (!player.ok) {
    const reason = player.issue.code.startsWith("invalid_profile") ? "invalid_input" : "missing_data";
    return {
      ...base,
      reason,
      issues: [{ severity: "error", ...player.issue }]
    };
  }
  const skills = buildPlayerSkillDefinitions(profile, data.tables);
  if (!skills.ok) {
    const reason = skills.issue.code.startsWith("invalid_profile") ||
      skills.issue.code === "duplicate_profile_skill" ||
      skills.issue.code === "too_many_profile_skills"
      ? "invalid_input"
      : "missing_data";
    return {
      ...base,
      reason,
      issues: [{ severity: "error", ...skills.issue }]
    };
  }

  const simulation = simulateWeaponCombat(player.profile, battle.battle, {
    maxSeconds,
    mode: blockMode,
    seed: seed ?? DEFAULT_RNG_SEED,
    skillActivationPolicy,
    reflectRoll: data.version === "2.9.0"
  }, skills.skills);
  const enemyStacks = battle.battle.waves.flatMap((wave) => wave.enemies);
  const meleeEnemyCount = enemyStacks
    .filter((stack) => !stack.weapon.isRanged)
    .reduce((sum, stack) => sum + stack.count, 0);
  const rangedEnemyCount = enemyStacks
    .filter((stack) => stack.weapon.isRanged)
    .reduce((sum, stack) => sum + stack.count, 0);
  const enemyMode = meleeEnemyCount && rangedEnemyCount
    ? "mixed"
    : rangedEnemyCount ? "ranged" : "melee";

  return {
    ...base,
    passed: simulation.reason === "cleared",
    reason: simulation.reason,
    clearedWaves: simulation.clearedWaves,
    waveCount: battle.battle.waves.length,
    timeSeconds: simulation.timeSeconds,
    remainingHealth: fd6ToNumber(simulation.remainingHealth),
    damageDone: fd6ToNumber(simulation.damageDone),
    issues: [...fairyWarnings(player.profile.fairy, "profile", profile, data.version), ...(options.skillActivationPolicy === undefined && skills.skills.length > 0
      ? [{
          severity: "warning" as const,
          code: "assumed_skill_auto_activation",
          path: "options.skillActivationPolicy"
        }]
      : [])],
    metrics: {
      ...fairyMetrics(player.profile.fairy, "fairy"),
      playerMaxHealth: fd6ToNumber(player.profile.maxHealth),
      engine: "v4-spatial-skills-11",
      dataVersion: String(data.version || "unknown"),
      randomnessModel: blockMode,
      attacks: simulation.attacks,
      projectiles: simulation.projectiles,
      skillActivations: simulation.skillActivations,
      skillHits: simulation.skillHits,
      skillCount: skills.skills.length,
      skillActivationPolicy,
      meleeEnemyCount,
      rangedEnemyCount,
      enemyMode
    }
  };
}

export function evaluatePvpVerdict(
  player: NormalizedProfile,
  opponent: NormalizedProfile,
  data: V4GameDataInput,
  options: PvpVerdictOptions = {}
): PvpVerdict {
  const blockMode = options.blockMode === "rng" ? "rng" : "average";
  const seed = blockMode === "rng"
    ? Math.round(options.seed === undefined ? DEFAULT_RNG_SEED : readNumber(options.seed))
    : null;
  const skillActivationPolicy = options.skillActivationPolicy ?? DEFAULT_SKILL_ACTIVATION_POLICY;
  const base: PvpVerdict = {
    winner: null,
    reason: "invalid_input",
    validation: "unverified_in_game",
    timeSeconds: 0,
    maxSeconds: 0,
    playerRemainingHealth: 0,
    opponentRemainingHealth: 0,
    playerMaxHealth: 0,
    opponentMaxHealth: 0,
    playerDamageDone: 0,
    opponentDamageDone: 0,
    blockMode,
    seed,
    issues: [],
    metrics: {}
  };

  if (Object.hasOwn(options, "maxSeconds")) {
    return { ...base, issues: [{ severity: "error", code: "fixed_pvp_duration", path: "options.maxSeconds" }] };
  }
  const optionIssue = validateOptions(options);
  if (optionIssue) return { ...base, issues: [optionIssue] };
  for (const [path, profile] of [["player", player], ["opponent", opponent]] as const) {
    if (!isNormalizedProfile(profile) || !Array.isArray(profile.pets) || !Array.isArray(profile.spells)) {
      return {
        ...base,
        issues: [{ severity: "error", code: "incomplete_pvp_profile", path }]
      };
    }
  }
  if (!data || !isObject(data.tables)) {
    return {
      ...base,
      reason: "missing_data",
      issues: [{ severity: "error", code: "missing_game_data", path: "data.tables" }]
    };
  }
  const config = readPvpConfig(data.tables.PvpBaseConfig);
  if (!config) {
    return {
      ...base,
      reason: "missing_data",
      issues: [{ severity: "error", code: "missing_pvp_config", path: "PvpBaseConfig" }]
    };
  }
  base.maxSeconds = config.PvpMatchTimerSeconds;

  const playerCombat = buildPlayerCombatProfile(player, data.tables, data.version);
  if (!playerCombat.ok) return pvpBuildFailure(base, playerCombat.issue, "player");
  const opponentCombat = buildPlayerCombatProfile(opponent, data.tables, data.version);
  if (!opponentCombat.ok) return pvpBuildFailure(base, opponentCombat.issue, "opponent");
  const playerSkills = buildPlayerSkillDefinitions(player, data.tables);
  if (!playerSkills.ok) return pvpBuildFailure(base, playerSkills.issue, "player");
  const opponentSkills = buildPlayerSkillDefinitions(opponent, data.tables);
  if (!opponentSkills.ok) return pvpBuildFailure(base, opponentSkills.issue, "opponent");

  const playerMultiplier = pvpHealthMultiplier(player, config);
  const opponentMultiplier = pvpHealthMultiplier(opponent, config);
  const healthMultiplier = Math.max(playerMultiplier, opponentMultiplier);
  const simulation = simulatePvpCombat(
    playerCombat.profile,
    opponentCombat.profile,
    {
      maxSeconds: config.PvpMatchTimerSeconds,
      mode: blockMode,
      seed: seed ?? DEFAULT_RNG_SEED,
      skillActivationPolicy,
      reflectRoll: data.version === "2.9.0"
    },
    playerSkills.skills,
    opponentSkills.skills,
    fd6FromF64(healthMultiplier)
  );
  return {
    ...base,
    winner: simulation.winner,
    reason: simulation.reason,
    timeSeconds: simulation.timeSeconds,
    playerRemainingHealth: fd6ToNumber(simulation.playerRemainingHealth),
    opponentRemainingHealth: fd6ToNumber(simulation.opponentRemainingHealth),
    playerMaxHealth: fd6ToNumber(simulation.playerMaxHealth),
    opponentMaxHealth: fd6ToNumber(simulation.opponentMaxHealth),
    playerDamageDone: fd6ToNumber(simulation.playerDamageDone),
    opponentDamageDone: fd6ToNumber(simulation.opponentDamageDone),
    issues: [...fairyWarnings(playerCombat.profile.fairy, "player", player, data.version),
      ...fairyWarnings(opponentCombat.profile.fairy, "opponent", opponent, data.version), ...(options.skillActivationPolicy === undefined &&
      playerSkills.skills.length + opponentSkills.skills.length > 0
      ? [{ severity: "warning" as const, code: "assumed_skill_auto_activation", path: "options.skillActivationPolicy" }]
      : [])],
    metrics: {
      ...fairyMetrics(playerCombat.profile.fairy, "playerFairy"),
      ...fairyMetrics(opponentCombat.profile.fairy, "opponentFairy"),
      engine: "v4-pvp-duel-1",
      dataVersion: String(data.version || "unknown"),
      healthMultiplier,
      playerMultiplier,
      opponentMultiplier,
      attacks: simulation.attacks,
      projectiles: simulation.projectiles,
      playerSkillActivations: simulation.playerSkillActivations,
      opponentSkillActivations: simulation.opponentSkillActivations,
      playerSkillHits: simulation.playerSkillHits,
      opponentSkillHits: simulation.opponentSkillHits,
      skillActivationPolicy
    }
  };
}

function fairyWarnings(
  fairy: FairyCalculation | undefined,
  side: string,
  source: ExistingProfileForCombat,
  gameVersion: string | undefined
): CombatVerdict["issues"] {
  if (gameVersion === "2.9.0" && source.fairy === undefined) {
    return [{ severity: "warning", code: "fairy_state_unspecified", path: `${side}.fairy` }];
  }
  return fairy?.provenance.status === "community_transcription"
    ? [{ severity: "warning", code: "fairy_community_transcription", path: `${side}.fairy` }]
    : [];
}

function fairyMetrics(fairy: FairyCalculation | undefined, prefix: string): CombatVerdict["metrics"] {
  return fairy ? {
    [`${prefix}Id`]: fairy.id,
    [`${prefix}Level`]: fairy.level,
    [`${prefix}SeasonId`]: fairy.seasonId,
    [`${prefix}ProvenanceStatus`]: fairy.provenance.status
  } : {};
}

type PvpConfig = {
  PvpHpBaseMultiplier: number;
  PvpHpPetMultiplier: number;
  PvpHpSkillMultiplier: number;
  PvpHpMountMultiplier: number;
  PvpMatchTimerSeconds: number;
};

function readPvpConfig(value: unknown): PvpConfig | null {
  if (!isObject(value)) return null;
  const fields = [
    "PvpHpBaseMultiplier", "PvpHpPetMultiplier", "PvpHpSkillMultiplier", "PvpHpMountMultiplier"
  ] as const;
  for (const field of fields) {
    if (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] < 0) return null;
  }
  if (typeof value.PvpHpBaseMultiplier !== "number" || value.PvpHpBaseMultiplier <= 0) return null;
  const duration = value.PvpMatchTimerSeconds;
  if (!Number.isInteger(duration) || Number(duration) <= 0 || Number(duration) > 7200) return null;
  return value as PvpConfig;
}

function pvpHealthMultiplier(profile: NormalizedProfile, config: PvpConfig): number {
  return config.PvpHpBaseMultiplier +
    profile.pets!.length * config.PvpHpPetMultiplier +
    profile.spells!.length * config.PvpHpSkillMultiplier +
    (profile.mount ? config.PvpHpMountMultiplier : 0);
}

function pvpBuildFailure(
  base: PvpVerdict,
  issue: { code: string; path: string },
  side: "player" | "opponent"
): PvpVerdict {
  const invalid = issue.code.startsWith("invalid_profile") ||
    issue.code === "duplicate_profile_skill" ||
    issue.code === "too_many_profile_skills" ||
    issue.code === "missing_profile_weapon";
  return {
    ...base,
    reason: invalid ? "invalid_input" : "missing_data",
    issues: [{
      severity: "error",
      code: issue.code,
      path: issue.path.startsWith("profile") ? issue.path.replace(/^profile/, side) : issue.path
    }]
  };
}

export function adaptProfileToV4(input: unknown, sourceKind?: V4ProfileSourceKind): V4ProfileEntry {
  const raw = typeof input === "string" ? safeJson(input) : input;
  const detected = detectProfile(raw);
  const profile = detected.profile;
  const missing = profile ? missingProfileSections(profile) : ["profile"];
  return {
    schema: "forge-master-v4-profile-entry-v1",
    sourceKind: sourceKind || detected.sourceKind,
    dataVersion: String(profile?.dataVersion || ""),
    name: String(profile?.name || "Profil"),
    profile,
    decisionComplete: Boolean(profile),
    missing,
    audit: [
      ...(Array.isArray(profile?.audit) ? profile.audit : []),
      ...missing.map((path) => ({
        severity: "warning" as const,
        code: "missing_profile_section",
        message: `Profile section is missing: ${path}`,
        path
      }))
    ]
  };
}

function emptyVerdict(
  point: FightPoint,
  maxSeconds: number,
  blockMode: "average" | "rng",
  seed: number | null
): CombatVerdict {
  return {
    point,
    passed: false,
    reason: "invalid_input",
    clearedWaves: 0,
    waveCount: 0,
    timeSeconds: 0,
    maxSeconds,
    remainingHealth: 0,
    damageDone: 0,
    blockMode,
    seed,
    issues: [],
    metrics: {}
  };
}

function validatePoint(point: FightPoint) {
  if (!point || typeof point !== "object") return { severity: "error" as const, code: "invalid_point" };
  if (!Number.isInteger(point.age) || point.age < 1) {
    return { severity: "error" as const, code: "invalid_age", path: "point.age" };
  }
  if (!Number.isInteger(point.combat) || point.combat < 1) {
    return { severity: "error" as const, code: "invalid_combat", path: "point.combat" };
  }
  if (point.difficulty !== "normal" && point.difficulty !== "hard") {
    return { severity: "error" as const, code: "invalid_difficulty", path: "point.difficulty" };
  }
  return null;
}

function validateOptions(options: CombatVerdictOptions) {
  if (options.maxSeconds !== undefined) {
    const maxSeconds = readNumber(options.maxSeconds);
    if (maxSeconds < 5 || maxSeconds > 7200) {
      return { severity: "error" as const, code: "invalid_max_seconds", path: "options.maxSeconds" };
    }
  }
  if (options.blockMode !== undefined && options.blockMode !== "average" && options.blockMode !== "rng") {
    return { severity: "error" as const, code: "invalid_block_mode", path: "options.blockMode" };
  }
  if (options.seed !== undefined && !Number.isFinite(Number(options.seed))) {
    return { severity: "error" as const, code: "invalid_seed", path: "options.seed" };
  }
  if (
    options.skillActivationPolicy !== undefined &&
    options.skillActivationPolicy !== "auto_when_ready" &&
    options.skillActivationPolicy !== "disabled"
  ) {
    return {
      severity: "error" as const,
      code: "invalid_skill_activation_policy",
      path: "options.skillActivationPolicy"
    };
  }
  return null;
}

function detectProfile(raw: any): { sourceKind: V4ProfileSourceKind; profile: NormalizedProfile | null } {
  const exportProfile = profileFromV2Export(raw);
  if (exportProfile) return { sourceKind: "export-v2", profile: exportProfile };
  if (isNormalizedProfile(raw?.normalized)) return { sourceKind: "db-normalized", profile: raw.normalized };
  const rawProfile = profileFromRawProfile(raw?.rawProfile);
  if (rawProfile) return { sourceKind: "db-rawProfile", profile: rawProfile };
  if (isNormalizedProfile(raw?.state?.profile)) return { sourceKind: "localStorage-v3", profile: raw.state.profile };
  if (isNormalizedProfile(raw)) return { sourceKind: raw.source === "import" ? "1vcian" : "manual", profile: raw };
  return { sourceKind: "manual", profile: null };
}

function profileFromV2Export(raw: any): NormalizedProfile | null {
  return raw?.schema === "forge-master-v2-profile" && isNormalizedProfile(raw.profile) ? raw.profile : null;
}

function profileFromRawProfile(value: any): NormalizedProfile | null {
  const parsed = typeof value === "string" ? safeJson(value) : value;
  return profileFromV2Export(parsed) || (isNormalizedProfile(parsed) ? parsed : null);
}

function isNormalizedProfile(value: any): value is NormalizedProfile {
  return Boolean(value && typeof value === "object" && value.equipment && value.stats && value.breakdown && value.talentTree);
}

function missingProfileSections(profile: NormalizedProfile): string[] {
  const missing = [];
  if (!profile.equipment) missing.push("equipment");
  if (!Array.isArray(profile.pets)) missing.push("pets");
  if (!Array.isArray(profile.spells)) missing.push("spells");
  if (!profile.talentTree) missing.push("talentTree");
  return missing;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
