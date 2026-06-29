import { describe, expect, it } from "vitest";
import { loadGameData } from "@forge-master/game-data";

describe("exhaustive BIS generator", () => {
  it("enumerates collapsed secondary stat totals", async () => {
    const { statCountVectors } = await import("../../../scripts/generate-simulated-bis.mjs");
    const stats = [{ id: "damage" }, { id: "health" }, { id: "regen" }];

    expect(Array.from(statCountVectors(stats, 2, 2))).toEqual([
      { damage: 0, health: 0, regen: 2 },
      { damage: 0, health: 1, regen: 1 },
      { damage: 0, health: 2, regen: 0 },
      { damage: 1, health: 0, regen: 1 },
      { damage: 1, health: 1, regen: 0 },
      { damage: 2, health: 0, regen: 0 }
    ]);
  });

  it("covers one accessibility case through the full scoring path", async () => {
    const data = await loadGameData();
    const { exhaustiveCase } = await import("../../../scripts/generate-simulated-bis.mjs");
    const result = exhaustiveCase({
      key: "0|Common|Common|Common|progress",
      age: 0,
      petRarity: "Common",
      mountRarity: "Common",
      spellRarity: "Common",
      objective: "progress"
    }, data, {
      topN: 3,
      choiceLimit: 1,
      statAllocationLimit: 2,
      smoke: true
    });

    expect(result.key).toBe("0|Common|Common|Common|progress");
    expect(result.exhaustive).toBe(false);
    expect(result.candidateCount).toBeGreaterThan(0);
    expect(result.top.length).toBeGreaterThan(0);
    expect(result.winner.stats.reduce((sum, stat) => sum + stat.count, 0)).toBe(result.lineCount);
  });

  it("keeps melee, hybrid and ranged weapon variants", async () => {
    const data = await loadGameData();
    const { itemChoices } = await import("../../../scripts/generate-simulated-bis.mjs");
    const weapons = itemChoices("Weapon", 5, data);

    expect(weapons.map((weapon) => weapon.idx)).toEqual([...new Set(weapons.map((weapon) => weapon.idx))]);
    expect(weapons.map((weapon) => weapon.isRanged === false ? weapon.health > 0 ? "hybrid" : "melee" : "ranged").sort()).toEqual([
      "hybrid",
      "melee",
      "ranged"
    ]);
  });

  it("allows duplicate pet models in BIS pet triples", async () => {
    const data = await loadGameData();
    const { bestPetTriples } = await import("../../../scripts/generate-simulated-bis.mjs");
    const triples = bestPetTriples("Common", data);

    expect(triples.some((pets) => pets.every((pet) => pet.name === "Dog"))).toBe(true);
  });

  it("can restrict pets to type archetypes", async () => {
    const data = await loadGameData();
    const { bestPetTriples } = await import("../../../scripts/generate-simulated-bis.mjs");
    const triples = bestPetTriples("Common", data, Infinity, "type-archetypes");

    expect(triples).toHaveLength(8);
    expect(triples.some((pets) => pets.every((pet) => pet.name === "Dog"))).toBe(true);
    expect(triples.some((pets) => pets.map((pet) => pet.type).join("|") === "Damage|Health|Balanced")).toBe(true);
  });

  it("filters controlled secondary stat counts", async () => {
    const { statCountVectors } = await import("../../../scripts/generate-simulated-bis.mjs");
    const stats = [
      { id: "skillDamage" },
      { id: "cooldown" },
      { id: "attackSpeed" },
      { id: "doubleChance" },
      { id: "critChance" },
      { id: "critDamage" },
      { id: "lifesteal" }
    ];
    const counts = Array.from(statCountVectors(stats, 1, 1, Infinity, { statRules: "controlled" }));

    expect(counts).toHaveLength(3);
    expect(counts).toEqual(expect.arrayContaining([
      expect.objectContaining({ skillDamage: 1 }),
      expect.objectContaining({ attackSpeed: 1 }),
      expect.objectContaining({ critChance: 1 })
    ]));
  });
});
