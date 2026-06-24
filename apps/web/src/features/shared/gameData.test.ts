import { describe, expect, it } from "vitest";
import {
  calculateItemValues,
  calculatePetValues,
  petDisplayName,
  petModelsFor
} from "./gameData";

describe("game-data presentation calculations", () => {
  it("derives equipment and pet values from game data", () => {
    const item = calculateItemValues(
      "Weapon",
      2,
      7,
      3,
      [{ slot: "Weapon", age: 2, idx: 7, attack: 100, health: 20, isRanged: false }],
      { levelScalingBase: 2, meleeDamageMultiplier: 1.5, maxLevel: 98 }
    );
    expect(item.attack).toBe(600);
    expect(item.health).toBe(80);

    const pet = calculatePetValues(
      "Rare",
      4,
      2,
      [{ rarity: "Rare", id: 4, name: "Scorpion", type: "Damage" }],
      [{ rarity: "Rare", levels: [{ level: 2, attack: 80, health: 60 }] }]
    );
    expect(pet.attack).toBe(120);
    expect(pet.health).toBe(30);
    expect(pet.name).toBe("Scorpion");
  });

  it("lists every epic pet by name and derives its specialization from the selected id", () => {
    const models = [
      { rarity: "Epic", id: 0, name: "Griffin", type: "Health" as const },
      { rarity: "Epic", id: 1, name: "Saber Tooth", type: "Damage" as const },
      { rarity: "Epic", id: 2, name: "Unicorn", type: "Balanced" as const },
      { rarity: "Epic", id: 3, name: "Tiger", type: "Damage" as const },
      { rarity: "Epic", id: 4, name: "Panda", type: "Health" as const }
    ];
    const levels = [{ rarity: "Epic", levels: [{ level: 1, attack: 100, health: 800 }] }];

    expect(petModelsFor("Epic", models).map((model) => model.name)).toEqual([
      "Griffin",
      "Saber Tooth",
      "Unicorn",
      "Tiger",
      "Panda"
    ]);
    expect(calculatePetValues("Epic", 4, 1, models, levels)).toMatchObject({
      id: 4,
      name: "Panda",
      type: "Health",
      attack: 50,
      health: 1200
    });
    expect(calculatePetValues("Epic", 3, 1, models, levels)).toMatchObject({
      id: 3,
      name: "Tiger",
      type: "Damage",
      attack: 150,
      health: 400
    });
  });

  it("resolves an old generic pet name from rarity and id", () => {
    expect(petDisplayName({
      name: "Pet 1",
      rarity: "Epic",
      id: 0,
      level: 12,
      attack: 1,
      health: 1,
      secondaryStats: [],
      recognized: true
    }, [{ rarity: "Epic", id: 0, name: "Griffin", type: "Health" }])).toBe("Griffin");
  });
});
