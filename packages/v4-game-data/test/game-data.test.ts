import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadV4GameData, REQUIRED_V4_TABLES, V4_GAME_VERSION } from "../src/index";

describe("v4 APK game data", () => {
  it("loads the verified 2.8.2 snapshot", () => {
    const data = loadV4GameData();

    expect(data.version).toBe(V4_GAME_VERSION);
    expect(Object.keys(data.manifest.tables)).toHaveLength(25);
    expect(data.tables.MainBattleLibrary).toHaveLength(210);
    expect(data.tables.WeaponLibrary).toHaveLength(99);
    expect(data.tables.ProjectilesLibrary).toHaveLength(16);
    expect(Object.keys(data.tables.SkillLibrary as object)).toHaveLength(18);
    expect(data.tables.SkillBaseConfig).toEqual({ SkillsCount: 18, SkillSlotsCount: 3 });
    expect(data.tables.MountLibrary).toHaveLength(15);
    expect(data.tables.ItemBalancingLibrary).toHaveLength(232);
    expect(data.tables.PetLibrary).toHaveLength(25);
    expect(data.tables.PetUpgradeLibrary).toHaveLength(6);
    expect(data.tables.MountUpgradeLibrary).toHaveLength(6);
    expect(data.tables.SecondaryStatItemUnlockLibrary).toEqual([
      { ItemAge: 0, NumberOfSecondStats: 0 },
      { ItemAge: 1, NumberOfSecondStats: 0 },
      { ItemAge: 2, NumberOfSecondStats: 0 },
      { ItemAge: 3, NumberOfSecondStats: 1 },
      { ItemAge: 4, NumberOfSecondStats: 1 },
      { ItemAge: 5, NumberOfSecondStats: 1 },
      { ItemAge: 6, NumberOfSecondStats: 1 },
      { ItemAge: 7, NumberOfSecondStats: 2 },
      { ItemAge: 8, NumberOfSecondStats: 2 },
      { ItemAge: 9, NumberOfSecondStats: 2 }
    ]);
    expect(data.tables.SecondaryStatPetUnlockLibrary).toEqual([
      { PetRarity: "Common", NumberOfSecondStats: 1 },
      { PetRarity: "Rare", NumberOfSecondStats: 1 },
      { PetRarity: "Epic", NumberOfSecondStats: 1 },
      { PetRarity: "Legendary", NumberOfSecondStats: 2 },
      { PetRarity: "Ultimate", NumberOfSecondStats: 2 },
      { PetRarity: "Mythic", NumberOfSecondStats: 2 }
    ]);
    expect(data.tables.PvpBaseConfig).toMatchObject({
      PvpHpBaseMultiplier: 1,
      PvpHpPetMultiplier: 0.5,
      PvpHpSkillMultiplier: 0.5,
      PvpHpMountMultiplier: 2,
      PvpMatchTimerSeconds: 60
    });
    expect(Object.keys(data.wire)).toHaveLength(25);
  });

  it("contains every table required by the verdict", () => {
    const data = loadV4GameData();

    for (const tableName of REQUIRED_V4_TABLES) {
      expect(data.tables[tableName], tableName).toBeDefined();
    }
  });

  it("loads the 2.9.0 candidate only when explicitly requested", () => {
    const path = fileURLToPath(new URL("../data/2.9.0/", import.meta.url));
    expect(() => loadV4GameData(path)).toThrow("unsupported game version");

    const data = loadV4GameData(path, "2.9.0");
    expect(data.version).toBe("2.9.0");
    expect(data.tables.WeaponLibrary).toHaveLength(111);
    expect((data.tables.SecondaryStatLibrary as Array<{ Stat: string }>).at(-1)?.Stat)
      .toBe("ReflectChance");

    type Weapon = {
      ItemId: { Age: number; Idx: number };
      IsRanged: boolean;
    };
    const weapon = (data.tables.WeaponLibrary as Weapon[]).find(
      ({ ItemId }) => ItemId.Age === -1001 && ItemId.Idx === 12
    );
    const oldWeapon = (loadV4GameData().tables.WeaponLibrary as Weapon[]).find(
      ({ ItemId }) => ItemId.Age === -1001 && ItemId.Idx === 12
    );
    expect(oldWeapon?.IsRanged).toBe(true);
    expect(weapon?.IsRanged).toBe(false);
  });
});
