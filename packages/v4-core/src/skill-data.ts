import type { ExistingProfileForCombat, ProfileCombatStat } from "./combat-profile.js";
import { fd6FromF64, type Fd6 } from "./fd6.js";
import { resolveStatFd6, type Fd6StatContribution } from "./stat-resolver.js";

export const V4_BUFF_SKILLS = ["Meat", "Morale", "Berserk", "Buff", "HigherMorale"] as const;
export const SUPPORTED_V4_SKILLS = [
  "RainOfArrows", "Arrows", "Shuriken", "Shout", "Meteorite", "Bomb", "Worm",
  "Lightning", "CannonBarrage", "Stampede", "StrafeRun", "Drone", "Thorns", ...V4_BUFF_SKILLS
] as const;

export type SupportedV4Skill = typeof SUPPORTED_V4_SKILLS[number];

export type PlayerSkillDefinition = {
  type: SupportedV4Skill;
  slot: number;
  level: number;
  activeDuration: Fd6;
  cooldown: Fd6;
  damage: Fd6;
  health: Fd6;
};

export type PlayerSkillsResult =
  | { ok: true; skills: PlayerSkillDefinition[] }
  | { ok: false; issue: { code: string; path: string } };

export function buildPlayerSkillDefinitions(
  source: ExistingProfileForCombat,
  tables: Record<string, unknown>
): PlayerSkillsResult {
  const spells = source.spells ?? [];
  if (spells.length === 0) return { ok: true, skills: [] };

  const baseConfig = objectAt(tables.SkillBaseConfig);
  const maxSlots = Math.trunc(finiteNumber(baseConfig.SkillSlotsCount));
  if (maxSlots <= 0) return missing("missing_skill_base_config", "SkillBaseConfig.SkillSlotsCount");
  if (spells.length > maxSlots) return missing("too_many_profile_skills", "profile.spells");

  const library = objectAt(tables.SkillLibrary);
  const stats = source.stats ?? {};
  const seen = new Set<string>();
  const skills: PlayerSkillDefinition[] = [];

  for (const [slot, spell] of spells.entries()) {
    const id = String(spell.id || "");
    const path = `profile.spells.${slot}`;
    if (!id) return missing("invalid_profile_skill", `${path}.id`);
    if (seen.has(id)) return missing("duplicate_profile_skill", `${path}.id`);
    seen.add(id);

    const config = objectAt(library[id]);
    if (Object.keys(config).length === 0) return missing("missing_skill_data", `SkillLibrary.${id}`);
    if (!isSupportedSkill(id)) return missing("unsupported_skill", `${path}.id`);

    const level = Number(spell.level);
    if (!Number.isInteger(level) || level < 1 || level > 100) {
      return missing("invalid_profile_skill_level", `${path}.level`);
    }
    const levelIndex = level - 1;
    const damageValues = numericArray(config.DamagePerLevel);
    const healthValues = numericArray(config.HealthPerLevel);
    if (!isV4BuffSkill(id) && damageValues[levelIndex] === undefined) {
      return missing("missing_skill_damage_data", `SkillLibrary.${id}.DamagePerLevel.${levelIndex}`);
    }
    if (isV4BuffSkill(id) && damageValues[levelIndex] === undefined && healthValues[levelIndex] === undefined) {
      return missing("missing_skill_buff_data", `SkillLibrary.${id}`);
    }
    const baseDamage = damageValues[levelIndex] ?? 0;
    const baseHealth = healthValues[levelIndex] ?? 0;
    const cooldown = resolveSkillValue(finiteNumber(config.Cooldown), stats, "cooldown");
    if (cooldown < 0n) return missing("invalid_profile_skill_cooldown", "profile.stats.skillCooldown");

    skills.push({
      type: id,
      slot,
      level,
      activeDuration: fd6FromF64(finiteNumber(config.ActiveDuration)),
      cooldown,
      damage: resolveSkillValue(baseDamage, stats, "damage"),
      health: resolveSkillValue(baseHealth, stats, "health")
    });
  }

  return { ok: true, skills };
}

function resolveSkillValue(
  value: number,
  stats: Partial<Record<ProfileCombatStat, number>>,
  kind: "damage" | "health" | "cooldown"
): Fd6 {
  const contributions: Fd6StatContribution[] = kind === "cooldown"
    ? [contribution("None", "OneMinusMultiplier", percent(stats.skillCooldown))]
    : [
        contribution("None", "Multiplier", percent(kind === "damage" ? stats.damage : stats.health)),
        contribution("GeneralCompounding", "Multiplier", percent(stats.skillDamage))
      ];
  return resolveStatFd6(fd6FromF64(value), contributions, { isRanged: null });
}

function contribution(
  layer: Fd6StatContribution["layer"],
  nature: Fd6StatContribution["nature"],
  value: Fd6
): Fd6StatContribution {
  return { layer, nature, value, condition: "None" };
}

function percent(value: unknown): Fd6 {
  return fd6FromF64(finiteNumber(value) / 100);
}

function numericArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map((entry) => finiteNumber(entry)) : [];
}

function objectAt(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSupportedSkill(value: string): value is SupportedV4Skill {
  return (SUPPORTED_V4_SKILLS as readonly string[]).includes(value);
}

export function isV4BuffSkill(value: string): value is typeof V4_BUFF_SKILLS[number] {
  return (V4_BUFF_SKILLS as readonly string[]).includes(value);
}

function missing(code: string, path: string): PlayerSkillsResult {
  return { ok: false, issue: { code, path } };
}
