import { describe, expect, it } from "vitest";
import type { NormalizedProfile } from "@forge-master/simulator";
import { emptyProfile } from "../../store/workshop";
import {
  bisAccessFromProfile,
  bisProgress,
  bisReferenceForAccess,
  bisReferenceForAge,
  equippedReferenceAge,
  type GeneratedBisData
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

const generatedBis = {
  schema: "forge-master-exhaustive-bis-v1",
  assumptions: { companionLevel: 1, spellLevel: 1 },
  cases: {
    "5|Epic|Common|Epic|progress": generatedCase("progress", 12, [
      ["attackSpeed", "Attack Speed", 5, 200],
      ["doubleChance", "Double Chance", 3, 60],
      ["damage", "Damage", 2, 30],
      ["lifesteal", "Lifesteal", 2, 40]
    ]),
    "4|Epic|Common|Epic|reach": generatedCase("reach", 12, [
      ["lifesteal", "Lifesteal", 5, 100],
      ["attackSpeed", "Attack Speed", 4, 160],
      ["doubleChance", "Double Chance", 2, 40],
      ["damage", "Damage", 1, 15]
    ]),
    "4|Epic|Common|Legendary|damage": generatedCase("damage", 12, [
      ["skillDamage", "Skill Damage", 4, 120],
      ["meleeDamage", "Melee Damage", 4, 200],
      ["attackSpeed", "Attack Speed", 4, 160]
    ]),
    "5|Legendary|Rare|Epic|progress": generatedCase("progress", 15, [
      ["lifesteal", "Lifesteal", 5, 100],
      ["attackSpeed", "Attack Speed", 5, 200],
      ["doubleChance", "Double Chance", 3, 60],
      ["damage", "Damage", 2, 30]
    ])
  }
} satisfies GeneratedBisData;

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

  it("does not expose BIS while generated data is unavailable", () => {
    const reference = bisReferenceForAge(5, ages);

    expect(reference.stats).toEqual([]);
    expect(reference.note).toContain("BIS indisponible");
  });

  it("uses generated simulations and reports the audited context", () => {
    const reference = bisReferenceForAge(5, ages, "progress", generatedBis);

    expect(reference.stats.reduce((sum, stat) => sum + Number(stat.count || 0), 0)).toBe(12);
    expect(reference.note).toContain("BIS exhaustif");
    expect(reference.note).toContain("lignes secondaires max");
    expect(reference.note).toContain("Max progression du BIS theorique");
    expect(reference.note).toContain("Score progression max");
    expect(reference.note).toContain("Arme BIS");
    expect(reference.note).toContain("Pets BIS");
    expect(reference.note).toContain("sans talents");
  });

  it("prefers reach BIS when objective-specific BIS was removed", () => {
    const reference = bisReferenceForAge(4, ages, "progress", generatedBis);

    expect(reference.note).toContain("objectif avance max");
    expect(reference.stats[0]).toMatchObject({ stat: "lifesteal", count: 5 });
  });

  it("changes the simulated allocation with companion and spell access", () => {
    const reference = bisReferenceForAccess({
      equipmentAges: [4],
      petRarities: ["Epic"],
      mountRarities: ["Common"],
      spellRarities: ["Legendary"]
    }, ages, "damage", generatedBis);

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
    }, ages, "damage", generatedBis);

    expect(reference.stats).toEqual([]);
    expect(reference.note).toContain("Aucun BIS genere");
  });

  it("counts the second lines unlocked by legendary companions", () => {
    const reference = bisReferenceForAccess({
      equipmentAges: [5],
      petRarities: ["Legendary"],
      mountRarities: ["Rare"],
      spellRarities: ["Epic"]
    }, ages, "progress", generatedBis);

    expect(reference.stats.reduce((sum, stat) => sum + Number(stat.count || 0), 0)).toBe(15);
    expect(reference.note).toContain("15 lignes secondaires max");
  });

  it("reports no BIS when the exact accessibility case was not generated", () => {
    const reference = bisReferenceForAccess({
      equipmentAges: [10],
      petRarities: ["Mythic"],
      mountRarities: ["Mythic"],
      spellRarities: ["Mythic"]
    }, ages, "progress", generatedBis);

    expect(reference.stats).toEqual([]);
    expect(reference.note).toContain("Aucun BIS genere pour ce cas");
  });
});

function generatedCase(
  objective: string,
  lineCount: number,
  stats: Array<[string, string, number, number]>
): NonNullable<GeneratedBisData["cases"]>[string] {
  return {
    objective,
    lineCount,
    candidateCount: 123,
    frontier: { age: 8, combat: 2 },
    reach: { age: 9, combat: 2, successCount: 2, scenarioCount: 3 },
    battleReach: { age: 8, combat: 15 },
    exhaustive: true,
    winner: {
      weaponStyle: "ranged",
      stats: stats.map(([stat, label, count, total]) => ({ stat, label, count, total })),
      pets: [{ name: "Saber Tooth", type: "Damage" }]
    }
  };
}

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
