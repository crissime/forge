import { F64_SCALE, FD6_SCALE, f64FromNumber, fd6FromDouble, fd6FromF64, type F64, type Fd6 } from "./fd6.js";
import { resolveProfileFairy, type FairyCalculation, type FairySelection } from "./fairy.js";
import { resolveStatFd6, type Fd6StatContribution } from "./stat-resolver.js";

export type ExistingProfileForCombat = {
  name?: string;
  base?: {
    attack?: number;
    health?: number;
    weaponStyle?: "melee" | "ranged";
  };
  equipment?: {
    Weapon?: { age?: number; idx?: number } | null;
  };
  mount?: { id?: number; rarity?: string } | null;
  /** All-source totals in percentage points; must exclude fairy when fairy is requested. */
  stats?: Partial<Record<ProfileCombatStat, number>>;
  /** Omitted means unknown legacy state; null explicitly declares no fairy. */
  fairy?: FairySelection | null;
  /** Raw secondary totals in percentage points, before fairy, excluding other layers (talents etc.). */
  secondaryStatsBeforeFairy?: Partial<Record<ProfileCombatStat, number>>;
  spells?: Array<{ id?: string; level?: number; rarity?: string }>;
};

export type ProfileCombatStat =
  | "attackSpeed"
  | "block"
  | "critChance"
  | "critDamage"
  | "damage"
  | "doubleChance"
  | "health"
  | "lifesteal"
  | "meleeDamage"
  | "rangedDamage"
  | "reflectChance"
  | "regen"
  | "skillCooldown"
  | "skillDamage";

export type PlayerCombatProfile = {
  fairy?: FairyCalculation;
  name: string;
  damage: Fd6;
  maxHealth: Fd6;
  maxHealthNoMultiplier: Fd6;
  attackSpeedMultiplier: Fd6;
  criticalChance: Fd6;
  criticalMultiplier: Fd6;
  blockChance: Fd6;
  reflectChance: Fd6;
  dodgeChance: Fd6;
  doubleAttackChance: Fd6;
  healthRegen: Fd6;
  lifeSteal: Fd6;
  moveSpeed: F64;
  colliderRadius: F64;
  centerOfMass: { x: F64; y: F64 };
  unitOffset: { x: F64; y: F64 };
  weapon: {
    age: number;
    idx: number;
    isRanged: boolean;
    isAiming: boolean;
    handOffset: { x: F64; y: F64 };
    weaponOffset: { x: F64; y: F64 };
    attackRange: F64;
    windupDuration: Fd6;
    attackDuration: Fd6;
    projectileId: number;
    projectile: {
      speed: F64;
      collisionRadius: F64;
      affectedByGravity: boolean;
    } | null;
  };
};

export type CombatProfileResult =
  | { ok: true; profile: PlayerCombatProfile }
  | { ok: false; issue: { code: string; path: string } };

export function buildPlayerCombatProfile(
  source: ExistingProfileForCombat,
  tables: Record<string, unknown>,
  gameVersion?: string
): CombatProfileResult {
  const fairyResult = resolveProfileFairy(source, tables.FairySeasonConfig, gameVersion);
  if (!fairyResult.ok) return fairyResult;
  const fairy = fairyResult.fairy;
  const baseAttack = finiteNumber(source.base?.attack);
  const baseHealth = finiteNumber(source.base?.health);
  if (!(baseAttack > 0)) return missing("invalid_profile_attack", "profile.base.attack");
  if (!(baseHealth > 0)) return missing("invalid_profile_health", "profile.base.health");

  const weaponId = source.equipment?.Weapon;
  if (!weaponId || !Number.isInteger(weaponId.age) || !Number.isInteger(weaponId.idx)) {
    return missing("missing_profile_weapon", "profile.equipment.Weapon");
  }
  const weaponAge = weaponId.age as number;
  const weaponIdx = weaponId.idx as number;
  const weapon = values(tables.WeaponLibrary).find((entry) => {
    const itemId = objectAt(entry.ItemId);
    return finiteNumber(itemId.Age) === weaponAge && finiteNumber(itemId.Idx) === weaponIdx;
  });
  if (!weapon) return missing("missing_profile_weapon_data", `WeaponLibrary.${weaponAge}.${weaponIdx}`);

  const isRanged = weapon.IsRanged === true;
  const projectileId = Math.trunc(finiteNumber(weapon.ProjectileId, -1));
  const projectile = projectileId < 0
    ? null
    : values(tables.ProjectilesLibrary).find((entry) => finiteNumber(entry.Id, -1) === projectileId);
  if (projectileId >= 0 && !projectile) {
    return missing("missing_projectile", `ProjectilesLibrary.${projectileId}`);
  }
  const stats = source.stats ?? {};
  const chance = (stat: "critChance" | "block" | "reflectChance"): Fd6 =>
    fairy?.targetStat === stat ? fairy.combatTargetAfter * FD6_SCALE / F64_SCALE : percent(stats[stat]);
  const itemConfig = objectAt(tables.ItemBalancingConfig);
  const mount = resolveMount(source.mount, tables.MountLibrary);
  if (!mount.ok) return mount;
  const damage = resolveStatFd6(
    fd6FromDouble(baseAttack),
    damageContributions(stats, isRanged),
    { isRanged }
  );
  const maxHealth = resolveStatFd6(
    fd6FromDouble(baseHealth),
    [contribution("None", "Multiplier", percent(stats.health))],
    { isRanged }
  );
  const baseCritDamage = fd6FromF64(finiteNumber(itemConfig.PlayerBaseCritDamage, 0.2));

  return {
    ok: true,
    profile: {
      ...(fairy ? { fairy } : {}),
      name: String(source.name || "Profil"),
      damage,
      maxHealth,
      maxHealthNoMultiplier: fd6FromDouble(baseHealth),
      attackSpeedMultiplier: FD6_SCALE + percent(stats.attackSpeed),
      criticalChance: chance("critChance"),
      criticalMultiplier: FD6_SCALE + baseCritDamage + percent(stats.critDamage),
      blockChance: chance("block"),
      reflectChance: chance("reflectChance"),
      dodgeChance: 0n,
      doubleAttackChance: percent(stats.doubleChance),
      healthRegen: percent(stats.regen),
      lifeSteal: percent(stats.lifesteal),
      moveSpeed: f64FromNumber(2),
      colliderRadius: mount.colliderRadius,
      centerOfMass: mount.centerOfMass,
      unitOffset: mount.unitOffset,
      weapon: {
        age: weaponAge,
        idx: weaponIdx,
        isRanged,
        isAiming: weapon.IsAiming === true,
        handOffset: readVector(weapon.Hand),
        weaponOffset: readVector(weapon.Offset),
        attackRange: f64FromNumber(finiteNumber(weapon.AttackRange)),
        windupDuration: fd6FromF64(finiteNumber(weapon.WindupTime)),
        attackDuration: fd6FromF64(finiteNumber(weapon.AttackDuration)),
        projectileId,
        projectile: projectile ? {
          speed: f64FromNumber(finiteNumber(projectile.Speed)),
          collisionRadius: f64FromNumber(finiteNumber(projectile.CollisionRadius)),
          affectedByGravity: projectile.AffectedByGravity === true
        } : null
      }
    }
  };
}

function resolveMount(
  source: ExistingProfileForCombat["mount"],
  table: unknown
):
  | {
      ok: true;
      colliderRadius: F64;
      centerOfMass: { x: F64; y: F64 };
      unitOffset: { x: F64; y: F64 };
    }
  | { ok: false; issue: { code: string; path: string } } {
  if (!source) {
    return {
      ok: true,
      colliderRadius: f64FromNumber(0.35),
      centerOfMass: { x: 0n, y: 0n },
      unitOffset: { x: 0n, y: 0n }
    };
  }

  const id = Number.isInteger(source.id) ? source.id as number : 0;
  const rarity = typeof source.rarity === "string" && source.rarity ? source.rarity : "Common";
  const config = values(table).find((entry) => {
    const mountId = objectAt(entry.MountId);
    return finiteNumber(mountId.Id, -1) === id && String(mountId.Rarity) === rarity;
  });
  if (!config) {
    return { ok: false, issue: { code: "missing_mount_data", path: `MountLibrary.${rarity}.${id}` } };
  }

  const center = objectAt(config.CenterOfMass);
  const offset = objectAt(config.UnitOffset);
  return {
    ok: true,
    colliderRadius: f64FromNumber(finiteNumber(config.ColliderRadius, 0.35)),
    centerOfMass: {
      x: f64FromNumber(finiteNumber(center.X)),
      y: f64FromNumber(finiteNumber(center.Y))
    },
    unitOffset: {
      x: f64FromNumber(finiteNumber(offset.X)),
      y: f64FromNumber(finiteNumber(offset.Y))
    }
  };
}

function readVector(value: unknown): { x: F64; y: F64 } {
  const source = objectAt(value);
  return {
    x: f64FromNumber(finiteNumber(source.X)),
    y: f64FromNumber(finiteNumber(source.Y))
  };
}

function damageContributions(
  stats: Partial<Record<ProfileCombatStat, number>>,
  isRanged: boolean
): Fd6StatContribution[] {
  return [
    contribution("None", "Multiplier", percent(stats.damage)),
    contribution(
      "GeneralCompounding",
      "Multiplier",
      percent(isRanged ? stats.rangedDamage : stats.meleeDamage),
      isRanged ? "Ranged" : "Melee"
    )
  ];
}

function contribution(
  layer: Fd6StatContribution["layer"],
  nature: Fd6StatContribution["nature"],
  value: Fd6,
  condition: Fd6StatContribution["condition"] = "None"
): Fd6StatContribution {
  return { layer, nature, value, condition };
}

function percent(value: unknown): Fd6 {
  return fd6FromF64(finiteNumber(value) / 100);
}

function values(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function objectAt(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function missing(code: string, path: string): CombatProfileResult {
  return { ok: false, issue: { code, path } };
}
