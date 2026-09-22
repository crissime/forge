import { f64Div, f64FromNumber, type F64 } from "./fd6.js";
import type { ExistingProfileForCombat, ProfileCombatStat } from "./combat-profile.js";

export type FairyId = "Mira" | "Tira" | "Lora";
export type FairySelection = {
  id: FairyId;
  level: number;
  seasonId: string;
  eventState: "active";
  /** Included totals must be reconstructed before requesting a new calculation. */
  statsState: "excluded" | "included";
};
export type FairyCoefficients = {
  /** All coefficients are percentage points, not ratios. */
  divisor: number;
  baseBonus: number;
  gainPerLevel: number;
  cap: number;
  maxLevel: number;
};
export type FairySeasonConfig = {
  gameVersion: "2.9.0";
  seasonId: string;
  provenance: {
    source: string;
    observedAt: string;
    status: "community_transcription" | "user_confirmed" | "verified_in_game";
  };
  fairies: Record<FairyId, FairyCoefficients>;
};
export type FairyCalculation = {
  id: FairyId;
  level: number;
  seasonId: string;
  gameVersion: "2.9.0";
  provenance: FairySeasonConfig["provenance"];
  coefficients: FairyCoefficients;
  requiredStat: ProfileCombatStat;
  targetStat: "critChance" | "block" | "reflectChance";
  /** All following amounts are Q32.32 ratios; steps is an unscaled integer. */
  requiredTotal: F64;
  targetBefore: F64;
  steps: bigint;
  bonusPerStep: F64;
  rawBonus: F64;
  effectiveBonus: F64;
  targetRawAfter: F64;
  targetEffectiveAfter: F64;
  combatTargetAfter: F64;
};

const mappings = {
  Mira: { requiredStat: "skillDamage", targetStat: "critChance" },
  Tira: { requiredStat: "skillCooldown", targetStat: "block" },
  Lora: { requiredStat: "health", targetStat: "reflectChance" }
} as const;
const MIN_F64 = -(1n << 63n);
const MAX_F64 = (1n << 63n) - 1n;

export function resolveProfileFairy(
  source: ExistingProfileForCombat,
  config: unknown,
  gameVersion?: string
): { ok: true; fairy?: FairyCalculation } | { ok: false; issue: { code: string; path: string } } {
  const fail = (code: string, path: string) => ({ ok: false as const, issue: { code, path } });
  if (source.fairy === undefined || source.fairy === null) return { ok: true };
  const selection = source.fairy;
  if (!isObject(selection) || !Object.hasOwn(mappings, selection.id)) {
    return fail("invalid_profile_fairy", "profile.fairy.id");
  }
  if (selection.eventState !== "active") {
    return fail("invalid_profile_fairy_event", "profile.fairy.eventState");
  }
  if (selection.statsState !== "excluded") {
    return fail("invalid_profile_fairy_stats_state", "profile.fairy.statsState");
  }
  if (gameVersion !== "2.9.0") return fail("unsupported_fairy_game_version", "data.version");
  if (!isObject(config)) return fail("missing_fairy_season_config", "FairySeasonConfig");
  if (config.gameVersion !== gameVersion || !nonempty(config.seasonId)) {
    return fail("invalid_fairy_season_config", "FairySeasonConfig.gameVersion");
  }
  if (!nonempty(selection.seasonId) || selection.seasonId !== config.seasonId) {
    return fail("invalid_profile_fairy_season", "profile.fairy.seasonId");
  }
  const provenance = config.provenance;
  if (!isObject(provenance) || !nonempty(provenance.source) ||
      !nonempty(provenance.observedAt) || !Number.isFinite(Date.parse(provenance.observedAt)) ||
      !["community_transcription", "user_confirmed", "verified_in_game"].includes(provenance.status)) {
    return fail("invalid_fairy_provenance", "FairySeasonConfig.provenance");
  }
  const coefficients = isObject(config.fairies) ? config.fairies[selection.id] : undefined;
  if (!isObject(coefficients) ||
      !["divisor", "baseBonus", "gainPerLevel", "cap"].every((key) => validPercent(coefficients[key]) && coefficients[key] >= 0) ||
      f64FromNumber(coefficients.divisor / 100) === 0n ||
      !Number.isSafeInteger(coefficients.maxLevel) || coefficients.maxLevel < 1) {
    return fail("invalid_fairy_coefficients", `FairySeasonConfig.fairies.${selection.id}`);
  }
  if (!Number.isSafeInteger(selection.level) || selection.level < 1 || selection.level > coefficients.maxLevel) {
    return fail("invalid_profile_fairy_level", "profile.fairy.level");
  }
  const { requiredStat, targetStat } = mappings[selection.id];
  const secondary = source.secondaryStatsBeforeFairy;
  for (const stat of [requiredStat, targetStat]) {
    if (!validPercent(secondary?.[stat])) {
      return fail("invalid_profile_fairy_secondary_total", `profile.secondaryStatsBeforeFairy.${stat}`);
    }
  }
  if (!validPercent(source.stats?.[targetStat])) {
    return fail("invalid_profile_fairy_target_total", `profile.stats.${targetStat}`);
  }
  const requiredTotal = f64FromNumber(secondary![requiredStat]! / 100);
  const targetBefore = f64FromNumber(secondary![targetStat]! / 100);
  const quotient = f64Div(requiredTotal, f64FromNumber(coefficients.divisor / 100));
  if (!inRange(quotient)) return fail("invalid_profile_fairy_overflow", "profile.secondaryStatsBeforeFairy");
  // Arithmetic shift floors negative Q32.32 values before taking the absolute value.
  const floor = quotient >> 32n;
  const steps = floor < 0n ? -floor : floor;
  const bonusPerStep = f64FromNumber(coefficients.baseBonus / 100) +
    f64FromNumber(coefficients.gainPerLevel / 100) * BigInt(selection.level - 1);
  const rawBonus = steps * bonusPerStep;
  const targetRawAfter = targetBefore + rawBonus;
  const cap = f64FromNumber(coefficients.cap / 100);
  const targetEffectiveAfter = rawBonus !== 0n && targetRawAfter > cap ? cap : targetRawAfter;
  const effectiveBonus = targetEffectiveAfter - targetBefore;
  const combatTargetAfter = f64FromNumber(source.stats![targetStat]! / 100) + effectiveBonus;
  if (![bonusPerStep, rawBonus, targetRawAfter, effectiveBonus, combatTargetAfter].every(inRange)) {
    return fail("invalid_profile_fairy_overflow", "profile.fairy");
  }
  return { ok: true, fairy: {
    id: selection.id, level: selection.level, seasonId: config.seasonId, gameVersion,
    provenance: { source: provenance.source, observedAt: provenance.observedAt, status: provenance.status },
    coefficients: {
      divisor: coefficients.divisor, baseBonus: coefficients.baseBonus,
      gainPerLevel: coefficients.gainPerLevel, cap: coefficients.cap, maxLevel: coefficients.maxLevel
    },
    requiredStat, targetStat, requiredTotal, targetBefore, steps, bonusPerStep,
    rawBonus, effectiveBonus, targetRawAfter, targetEffectiveAfter, combatTargetAfter
  } };
}

function inRange(value: bigint): boolean { return value >= MIN_F64 && value <= MAX_F64; }
function validPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    value / 100 >= -2147483648 && value / 100 < 2147483648;
}
function nonempty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
