import { describe, expect, it } from "vitest";
import { buildBattleDefinition } from "../src/battle-data";
import { fd6ToNumber } from "../src/fd6";

const point = { age: 1, combat: 1, difficulty: "normal" as const };

describe("APK battle data", () => {
  it("converts enemy F1D values with Raw / 100", () => {
    const result = buildBattleDefinition(fixture(), point);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [melee, ranged] = result.battle.waves[0].enemies;
    expect(fd6ToNumber(melee.health)).toBe(35);
    expect(fd6ToNumber(melee.damage)).toBe(5);
    expect(fd6ToNumber(ranged.damage)).toBe(3.349999);
  });

  it("uses IsRanged instead of inferring the weapon style from range", () => {
    const raw = fixture();
    (raw.WeaponLibrary as any).melee.AttackRange = 12;
    const result = buildBattleDefinition(raw, point);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.battle.waves[0].enemies[0].weapon.isRanged).toBe(false);
    expect(fd6ToNumber(result.battle.waves[0].enemies[0].damage)).toBe(5);
  });

  it("applies hard-mode health and damage multipliers", () => {
    const result = buildBattleDefinition(fixture(), { ...point, difficulty: "hard" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(fd6ToNumber(result.battle.waves[0].enemies[0].health)).toBe(210_000_000);
    expect(fd6ToNumber(result.battle.waves[0].enemies[0].damage)).toBe(30_000_000);
  });

  it("fails explicitly when an enemy weapon is missing", () => {
    const raw = fixture();
    raw.WeaponLibrary = {};

    expect(buildBattleDefinition(raw, point)).toEqual({
      ok: false,
      issue: { code: "missing_enemy_weapon", path: "WeaponLibrary.1" }
    });
  });
});

function fixture(): Record<string, unknown> {
  return {
    MainBattleLibrary: {
      first: {
        BattleId: { AgeIdx: 0, BattleIdx: 0 },
        Waves: [{ WaveIdx: 0, Enemies: [{ Id: 1, Count: 1 }, { Id: 2, Count: 1 }] }]
      }
    },
    EnemyAgeScalingLibrary: { first: { AgeIdx: 0, Damage: { Raw: 500 }, Health: { Raw: 3500 } } },
    EnemyLibrary: {
      1: { EnemyIdx: 1, WeaponId: { Age: 0, Idx: 1 } },
      2: { EnemyIdx: 2, WeaponId: { Age: 0, Idx: 2 } }
    },
    WeaponLibrary: {
      melee: { ItemId: { Age: 0, Idx: 1 }, AttackRange: 0.3, WindupTime: 0.5, AttackDuration: 1.5, IsRanged: false, ProjectileId: -1 },
      ranged: { ItemId: { Age: 0, Idx: 2 }, AttackRange: 7, WindupTime: 0.95, AttackDuration: 1.5, IsRanged: true, ProjectileId: 1 }
    },
    ProjectilesLibrary: [{ Id: 1, Speed: 15, CollisionRadius: 0.3, AffectedByGravity: true }],
    MainBattleConfig: { EnemyHpDifficultyMulti: 6_000_000, EnemyDmgDifficultyMulti: 6_000_000 },
    ItemBalancingConfig: { EnemyRangedDamageMultiplier: 0.67 }
  };
}
