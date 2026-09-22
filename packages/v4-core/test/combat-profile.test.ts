import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadV4GameData } from "../../v4-game-data/src/index";
import { buildPlayerCombatProfile } from "../src/combat-profile";
import { f64ToNumber, fd6ToNumber } from "../src/fd6";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECOVERED_EXPORTS = [
  "1-brandon-profil-manuel.forge-master.json",
  "10-brandon-profil-manuel.forge-master-1.forge-master.json",
  "12-elkikito-profil-manuel.forge-master.json",
  "14-natakku-profil-manuel.forge-master.json"
];

describe("existing profile to v4 combat profile", () => {
  it("multiplies global and ranged damage layers", () => {
    const result = buildPlayerCombatProfile({
      name: "test",
      base: { attack: 100, health: 1_000, weaponStyle: "melee" },
      equipment: { Weapon: { age: 0, idx: 1 } },
      stats: { damage: 20, rangedDamage: 30, meleeDamage: 90 }
    }, fixtureTables());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.weapon.isRanged).toBe(true);
    expect(fd6ToNumber(result.profile.damage)).toBeCloseTo(156, 5);
  });

  it("preserves all recovered profiles and reports only missing weapons", () => {
    const data = loadV4GameData();
    let ready = 0;
    let incomplete = 0;

    for (const file of RECOVERED_EXPORTS) {
      const exported = JSON.parse(readFileSync(join(repoRoot, "profile", file), "utf8"));
      const result = buildPlayerCombatProfile(exported.profile, data.tables);
      if (result.ok) {
        ready += 1;
        expect(result.profile.damage, file).toBeGreaterThan(0n);
        expect(result.profile.maxHealth, file).toBeGreaterThan(0n);
      } else {
        incomplete += 1;
        expect(result.issue.code, file).toBe("missing_profile_weapon");
      }
    }

    expect(ready).toBe(4);
    expect(incomplete).toBe(0);
  });

  it("uses the equipped mount collider and center of mass", () => {
    const result = buildPlayerCombatProfile({
      base: { attack: 100, health: 1_000, weaponStyle: "ranged" },
      equipment: { Weapon: { age: 0, idx: 1 } },
      mount: { id: 1, rarity: "Rare" }
    }, fixtureTables());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(f64ToNumber(result.profile.colliderRadius)).toBeCloseTo(0.6, 8);
    expect(f64ToNumber(result.profile.centerOfMass.x)).toBeCloseTo(0.088, 8);
    expect(f64ToNumber(result.profile.centerOfMass.y)).toBeCloseTo(0.588, 8);
    expect(f64ToNumber(result.profile.unitOffset.x)).toBeCloseTo(-0.11, 8);
    expect(f64ToNumber(result.profile.unitOffset.y)).toBeCloseTo(0.533, 8);
  });
});

function fixtureTables(): Record<string, unknown> {
  return {
    ItemBalancingConfig: { PlayerBaseCritDamage: 0.2 },
    WeaponLibrary: [{
      ItemId: { Age: 0, Idx: 1 },
      AttackRange: 7,
      WindupTime: 0.5,
      AttackDuration: 1.5,
      IsRanged: true,
      IsAiming: true,
      ProjectileId: 1
    }],
    ProjectilesLibrary: [{
      Id: 1,
      Speed: 15,
      CollisionRadius: 0.3,
      AffectedByGravity: true
    }],
    MountLibrary: [{
      MountId: { Rarity: "Rare", Id: 1 },
      UnitOffset: { X: -0.11, Y: 0.533 },
      CenterOfMass: { X: 0.088, Y: 0.588 },
      ColliderRadius: 0.6
    }]
  };
}
