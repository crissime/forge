import { describe, expect, it } from "vitest";
import type { NormalizedProfile } from "@forge-master/simulator";
import { emptyProfile } from "../../store/workshop";
import {
  bisAccessFromProfile,
  bisProgress,
  bisReferenceForAccess,
  bisReferenceForAge,
  equippedReferenceAge
} from "./bisGuide";

const ages = [
  "Primitive",
  "Medieval",
  "Debut moderne",
  "Moderne",
  "Espace",
  "Interstellaire",
  "Multiverse",
  "Quantique",
  "Enfers",
  "Divin"
].map((label, value) => ({ value, label }));

describe("BIS progression guide", () => {
  it("uses the normal accessibility tier for each equipment age", () => {
    expect(bisReferenceForAge(5, ages)).toMatchObject({
      age: 5,
      petRarity: "Epic",
      mountRarity: "Common",
      spellRarity: "Epic"
    });
    expect(bisReferenceForAge(7, ages)).toMatchObject({
      age: 7,
      petRarity: "Legendary",
      mountRarity: "Rare",
      spellRarity: "Legendary"
    });
    expect(bisReferenceForAge(9, ages)).toMatchObject({
      age: 9,
      petRarity: "Ultimate",
      mountRarity: "Legendary",
      spellRarity: "Ultimate"
    });
  });

  it("reports current equipment and companion progress against a selected age", () => {
    const profile = emptyProfile();
    profile.equipment.Weapon = itemAt(6);
    profile.equipment.Helmet = { ...itemAt(4), slot: "Helmet" };
    profile.pets = [petAt("Epic"), petAt("Legendary"), petAt("Rare")];
    profile.mount = {
      name: "Monture",
      rarity: "Epic",
      level: 1,
      attack: 0,
      health: 0,
      secondaryStats: [],
      recognized: true,
      skills: []
    };
    profile.spells = [
      { id: "EpicSpell", level: 20, rarity: "Epic" },
      { id: "LegendarySpell", level: 10, rarity: "Legendary" },
      { id: "LegacySpell", level: 30 }
    ];

    const reference = bisReferenceForAge(4, ages);
    expect(equippedReferenceAge(profile)).toBe(6);
    expect(bisProgress(profile, reference, [{ id: "LegacySpell", rarity: "Rare" }])).toEqual({
      equipment: 2,
      equipmentTotal: 8,
      pets: 2,
      petsTotal: 3,
      mount: true,
      spells: 2,
      spellsTotal: 3
    });
    expect(bisAccessFromProfile(profile, [{ id: "LegacySpell", rarity: "Rare" }])).toEqual({
      equipmentAges: [0, 1, 2, 3, 4, 5, 6],
      petRarities: ["Common", "Rare", "Epic", "Legendary"],
      mountRarities: ["Common", "Rare", "Epic"],
      spellRarities: ["Common", "Rare", "Epic", "Legendary"]
    });
  });

  it("uses the best checked access instead of forcing the baseline rarity", () => {
    expect(bisReferenceForAccess({
      equipmentAges: [0, 1, 2, 3, 4],
      petRarities: ["Common", "Rare", "Epic", "Legendary"],
      mountRarities: ["Common", "Rare"],
      spellRarities: ["Common", "Rare", "Epic", "Legendary", "Ultimate"]
    }, ages)).toMatchObject({
      age: 4,
      petRarity: "Legendary",
      mountRarity: "Rare",
      spellRarity: "Ultimate"
    });
  });

  it("supports saved BIS settings created before spell access existed", () => {
    const legacyAccess = {
      equipmentAges: [0, 1, 2, 3],
      petRarities: ["Common", "Rare", "Epic"],
      mountRarities: ["Common", "Rare", "Epic"]
    } as Parameters<typeof bisReferenceForAccess>[0];

    expect(bisReferenceForAccess(legacyAccess, ages).spellRarity).toBe("Epic");
  });

  it("does not mark an absent mount as a Common BIS", () => {
    const profile = emptyProfile();
    const progress = bisProgress(profile, bisReferenceForAge(0, ages));

    expect(progress.mount).toBe(false);
  });

  it("uses generated simulations and reports the audited context", () => {
    const reference = bisReferenceForAge(5, ages, "progress");

    expect(reference.stats.reduce((sum, stat) => sum + Number(stat.count || 0), 0)).toBe(12);
    expect(reference.note).toContain("BIS exhaustif");
    expect(reference.note).toContain("lignes secondaires max");
    expect(reference.note).toContain("Max bataille atteint");
    expect(reference.note).toContain("Score progression max");
    expect(reference.note).toContain("Arme BIS");
    expect(reference.note).toContain("Pets BIS");
    expect(reference.note).toContain("sans talents");
  });

  it("changes the simulated allocation with companion and spell access", () => {
    const reference = bisReferenceForAccess({
      equipmentAges: [4],
      petRarities: ["Epic"],
      mountRarities: ["Common"],
      spellRarities: ["Legendary"]
    }, ages, "damage");

    expect(reference.stats.some((stat) => stat.stat === "skillDamage")).toBe(true);
    expect(reference.note).toContain("Pets Epic, monture Common, sorts Legendary");
    expect(reference.note).toContain("Saber Tooth (Degats)");
  });

  it("reports no BIS for early ages filtered out of the generated run", () => {
    const reference = bisReferenceForAccess({
      equipmentAges: [0],
      petRarities: ["Common"],
      mountRarities: ["Common"],
      spellRarities: ["Mythic"]
    }, ages, "damage");

    expect(reference.stats).toEqual([]);
    expect(reference.note).toContain("Aucun BIS genere");
  });

  it("counts the second lines unlocked by legendary companions", () => {
    const reference = bisReferenceForAccess({
      equipmentAges: [5],
      petRarities: ["Legendary"],
      mountRarities: ["Rare"],
      spellRarities: ["Epic"]
    }, ages, "progress");

    expect(reference.stats.reduce((sum, stat) => sum + Number(stat.count || 0), 0)).toBe(15);
    expect(reference.note).toContain("15 lignes secondaires max");
  });

  it("reports no BIS when the exact accessibility case was not generated", () => {
    const reference = bisReferenceForAccess({
      equipmentAges: [10],
      petRarities: ["Mythic"],
      mountRarities: ["Mythic"],
      spellRarities: ["Mythic"]
    }, ages, "progress");

    expect(reference.stats).toEqual([]);
    expect(reference.note).toContain("Aucun BIS genere pour ce cas");
  });
});

function itemAt(age: number): NonNullable<NormalizedProfile["equipment"]["Weapon"]> {
  return {
    slot: "Weapon",
    name: "Objet",
    age,
    level: 1,
    attack: 0,
    health: 0,
    secondaryStats: [],
    recognized: true
  };
}

function petAt(rarity: string): NormalizedProfile["pets"][number] {
  return {
    name: "Pet",
    rarity,
    level: 1,
    attack: 0,
    health: 0,
    secondaryStats: [],
    recognized: true
  };
}
