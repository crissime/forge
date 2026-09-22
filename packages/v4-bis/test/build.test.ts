import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildPlayerCombatProfile, fd6ToNumber, type FairySeasonConfig, type V4GameDataInput } from "../../v4-core/src/index.js";
import { loadV4GameData } from "../../v4-game-data/src/index.js";
import { BIS_EQUIPMENT_SLOTS, buildBisProfile, type BisBuild, type BisBuildRules } from "../src/index.js";

const dataPath = fileURLToPath(new URL("../../v4-game-data/data/2.9.0/", import.meta.url));
const gameData = loadV4GameData(dataPath, "2.9.0");
const fairy = JSON.parse(readFileSync(fileURLToPath(new URL("../../../v4/config/fairy-season-2.9.0.candidate.json", import.meta.url)), "utf8")) as FairySeasonConfig;
const data: V4GameDataInput = { version: gameData.version, tables: { ...gameData.tables, FairySeasonConfig: fairy } };
const rules: BisBuildRules = {
  maxEquipmentAge: 3, itemLevel: 1, petLevel: 1, mountLevel: 1, spellLevel: 1,
  allowedPetRarities: ["Common"], allowedMountRarities: ["Common"],
  allowedSpellRarities: ["Common", "Rare", "Epic", "Legendary", "Ultimate", "Mythic"]
};

function records(value: unknown): Record<string, any>[] {
  return Array.isArray(value) ? value as Record<string, any>[] : [];
}

function legalBuild(): BisBuild {
  const items = records(gameData.tables.ItemBalancingLibrary);
  const equipment = Object.fromEntries(BIS_EQUIPMENT_SLOTS.map((slot) => {
    const type = slot === "Body" ? "Armour" : slot === "Shoe" ? "Shoes" : slot;
    const item = items.find((entry) => entry.ItemId?.Age === 3 && entry.ItemId?.Type === type);
    if (!item) throw new Error(`fixture lacks age 3 ${slot}`);
    return [slot, { age: 3, idx: item.ItemId.Idx, level: 1, secondaryStats: [{ stat: "SkillDamageMulti", value: 30 }] }];
  })) as BisBuild["equipment"];
  const commonPets = records(gameData.tables.PetLibrary)
    .filter((entry) => entry.PetId?.Rarity === "Common")
    .slice(0, 3)
    .map((entry) => ({ id: entry.PetId.Id, rarity: "Common", level: 1, secondaryStats: [{ stat: "DamageMulti", value: 15 }] }));
  const mount = records(gameData.tables.MountLibrary).find((entry) => entry.MountId?.Rarity === "Common");
  if (!mount || commonPets.length !== 3) throw new Error("fixture lacks common companions");
  return {
    name: "Age 3 legal fixture", equipment, pets: commonPets,
    mount: { id: mount.MountId.Id, rarity: "Common", level: 1, secondaryStats: [{ stat: "DamageMulti", value: 15 }] },
    spells: [], fixedStats: { health: 10 },
    fairy: { id: "Mira", level: 20, seasonId: fairy.seasonId, eventState: "active", statsState: "excluded" }
  };
}

describe("BIS component build", () => {
  it("rebuilds a legal profile from APK catalogues and applies a fee only after raw secondary stats", () => {
    const build = legalBuild();
    const before = structuredClone(build);
    const result = buildBisProfile(build, data, rules);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.profile.base?.attack).toBeGreaterThan(10);
    expect(result.profile.secondaryStatsBeforeFairy?.skillDamage).toBe(240);
    expect(result.profile.stats.skillDamage).toBe(240);
    expect(result.profile.secondaryStatsBeforeFairy?.health).toBe(0);
    expect(result.profile.stats.health).toBe(10);
    expect(build).toEqual(before);

    expect(data.version).toBe("2.9.0");
    const combat = buildPlayerCombatProfile(result.profile, data.tables, data.version);
    expect(combat.ok, combat.ok ? "" : JSON.stringify(combat)).toBe(true);
    if (combat.ok) expect(fd6ToNumber(combat.profile.criticalChance)).toBeCloseTo(0.8);
  });

  it("enforces APK line counts and forbids duplicate stats on one carrier", () => {
    const build = legalBuild();
    build.equipment.Weapon.age = 2;
    const noLineAtAgeTwo = buildBisProfile(build, data, rules);
    expect(noLineAtAgeTwo).toEqual({ ok: false, issue: { code: "invalid_build_secondary_line_count", path: "build.equipment.Weapon.secondaryStats" } });

    const duplicate = legalBuild();
    duplicate.equipment.Weapon.age = 7;
    const item = records(gameData.tables.ItemBalancingLibrary)
      .find((entry) => entry.ItemId?.Age === 7 && entry.ItemId?.Type === "Weapon");
    if (!item) throw new Error("fixture lacks age 7 weapon");
    duplicate.equipment.Weapon.idx = item.ItemId.Idx;
    duplicate.equipment.Weapon.secondaryStats = [
      { stat: "SkillDamageMulti", value: 30 }, { stat: "SkillDamageMulti", value: 30 }
    ];
    const forbidden = buildBisProfile(duplicate, data, { ...rules, maxEquipmentAge: 7 });
    expect(forbidden).toEqual({ ok: false, issue: { code: "duplicate_build_secondary_stat", path: "build.equipment.Weapon.secondaryStats.1" } });
  });
});
