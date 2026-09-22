import { FD6_SCALE, f64FromNumber, fd6MulF64, type Fd6 } from "./fd6.js";

export type BattlePoint = {
  age: number;
  combat: number;
  difficulty: "normal" | "hard";
};

export type WeaponDefinition = {
  itemId: { age: number; idx: number };
  attackRange: number;
  windupTime: number;
  attackDuration: number;
  isRanged: boolean;
  isAiming: boolean;
  handOffset: { x: number; y: number };
  weaponOffset: { x: number; y: number };
  projectileId: number;
  projectile: ProjectileDefinition | null;
};

export type ProjectileDefinition = {
  id: number;
  speed: number;
  collisionRadius: number;
  affectedByGravity: boolean;
};

export type EnemyStackDefinition = {
  enemyId: number;
  count: number;
  health: Fd6;
  damage: Fd6;
  weapon: WeaponDefinition;
};

export type BattleDefinition = {
  point: BattlePoint;
  waves: Array<{ index: number; enemies: EnemyStackDefinition[] }>;
};

export type BattleDataIssue = {
  code: string;
  path: string;
};

export type BattleDataResult =
  | { ok: true; battle: BattleDefinition }
  | { ok: false; issue: BattleDataIssue };

export function buildBattleDefinition(raw: Record<string, unknown>, point: BattlePoint): BattleDataResult {
  const ageIdx = point.age - 1;
  const battleIdx = point.combat - 1;
  const battle = values(raw.MainBattleLibrary).find((entry) =>
    numberAt(entry, "BattleId", "AgeIdx") === ageIdx &&
    numberAt(entry, "BattleId", "BattleIdx") === battleIdx
  );
  if (!battle) return missing("missing_battle_data", "MainBattleLibrary");

  const scaling = values(raw.EnemyAgeScalingLibrary).find((entry) => numberAt(entry, "AgeIdx") === ageIdx);
  if (!scaling) return missing("missing_enemy_scaling", `EnemyAgeScalingLibrary.${ageIdx}`);

  const config = objectAt(raw.MainBattleConfig);
  const itemConfig = objectAt(raw.ItemBalancingConfig);
  const healthDifficulty = point.difficulty === "hard" ? numberAt(config, "EnemyHpDifficultyMulti") : 1;
  const damageDifficulty = point.difficulty === "hard" ? numberAt(config, "EnemyDmgDifficultyMulti") : 1;
  if (!(healthDifficulty > 0) || !(damageDifficulty > 0)) {
    return missing("missing_difficulty_multiplier", "MainBattleConfig");
  }

  const baseHealth = f1d(numberAt(scaling, "Health", "Raw"));
  const baseDamage = f1d(numberAt(scaling, "Damage", "Raw"));
  const enemyHealth = fd6MulF64(baseHealth, f64FromNumber(healthDifficulty));
  const enemyDamage = fd6MulF64(baseDamage, f64FromNumber(damageDifficulty));
  const rangedMultiplier = numberAt(itemConfig, "EnemyRangedDamageMultiplier");
  const enemies = values(raw.EnemyLibrary);
  const weapons = values(raw.WeaponLibrary);
  const projectiles = values(raw.ProjectilesLibrary);
  const sourceWaves = arrayAt(battle, "Waves");
  if (!sourceWaves.length) return missing("missing_battle_wave", "MainBattleLibrary.Waves");

  const waves: BattleDefinition["waves"] = [];
  for (const [waveOffset, sourceWave] of sourceWaves.entries()) {
    const sourceEnemies = arrayAt(sourceWave, "Enemies");
    if (!sourceEnemies.length) return missing("missing_battle_wave", `MainBattleLibrary.Waves.${waveOffset}`);
    const stacks: EnemyStackDefinition[] = [];

    for (const sourceEnemy of sourceEnemies) {
      const enemyId = numberAt(sourceEnemy, "Id");
      const count = numberAt(sourceEnemy, "Count");
      const enemy = enemies.find((entry) => numberAt(entry, "EnemyIdx") === enemyId);
      if (!enemy) return missing("missing_enemy", `EnemyLibrary.${enemyId}`);
      const weaponId = objectAt(enemy.WeaponId);
      const sourceWeapon = weapons.find((entry) => sameItemId(objectAt(entry.ItemId), weaponId));
      if (!sourceWeapon) return missing("missing_enemy_weapon", `WeaponLibrary.${enemyId}`);
      const projectileId = numberAt(sourceWeapon, "ProjectileId");
      const projectile = projectileId < 0
        ? null
        : projectiles.find((entry) => numberAt(entry, "Id") === projectileId);
      if (projectileId >= 0 && !projectile) {
        return missing("missing_projectile", `ProjectilesLibrary.${projectileId}`);
      }
      const weapon = readWeapon(sourceWeapon, projectile ? readProjectile(projectile) : null);
      if (weapon.isRanged && !(rangedMultiplier > 0)) {
        return missing("missing_enemy_ranged_multiplier", "ItemBalancingConfig.EnemyRangedDamageMultiplier");
      }
      stacks.push({
        enemyId,
        count,
        health: enemyHealth,
        damage: weapon.isRanged ? fd6MulF64(enemyDamage, f64FromNumber(rangedMultiplier)) : enemyDamage,
        weapon
      });
    }
    waves.push({ index: numberAt(sourceWave, "WaveIdx") || waveOffset, enemies: stacks });
  }

  return { ok: true, battle: { point, waves } };
}

function readWeapon(
  source: Record<string, unknown>,
  projectile: ProjectileDefinition | null
): WeaponDefinition {
  const itemId = objectAt(source.ItemId);
  return {
    itemId: { age: numberAt(itemId, "Age"), idx: numberAt(itemId, "Idx") },
    attackRange: numberAt(source, "AttackRange"),
    windupTime: numberAt(source, "WindupTime"),
    attackDuration: numberAt(source, "AttackDuration"),
    isRanged: source.IsRanged === true,
    isAiming: source.IsAiming === true,
    handOffset: readVector(source.Hand),
    weaponOffset: readVector(source.Offset),
    projectileId: numberAt(source, "ProjectileId"),
    projectile
  };
}

function readVector(source: unknown): { x: number; y: number } {
  return { x: numberAt(source, "X"), y: numberAt(source, "Y") };
}

function readProjectile(source: Record<string, unknown>): ProjectileDefinition {
  return {
    id: numberAt(source, "Id"),
    speed: numberAt(source, "Speed"),
    collisionRadius: numberAt(source, "CollisionRadius"),
    affectedByGravity: source.AffectedByGravity === true
  };
}

function f1d(raw: number): Fd6 {
  return BigInt(Math.trunc(raw)) * (FD6_SCALE / 100n);
}

function sameItemId(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return numberAt(left, "Age") === numberAt(right, "Age") &&
    numberAt(left, "Idx") === numberAt(right, "Idx");
}

function values(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter(isObject);
  if (isObject(value)) return Object.values(value).filter(isObject);
  return [];
}

function arrayAt(value: unknown, key: string): Array<Record<string, unknown>> {
  const target = objectAt(value)[key];
  return Array.isArray(target) ? target.filter(isObject) : [];
}

function numberAt(value: unknown, ...path: string[]): number {
  let current: unknown = value;
  for (const part of path) current = objectAt(current)[part];
  const parsed = Number(current);
  return Number.isFinite(parsed) ? parsed : 0;
}

function objectAt(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function missing(code: string, path: string): BattleDataResult {
  return { ok: false, issue: { code, path } };
}
