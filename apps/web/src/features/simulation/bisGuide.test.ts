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
  it("keeps Epic pets, mount and spells from Modern through Multiverse", () => {
    for (const age of [3, 4, 5, 6]) {
      expect(bisReferenceForAge(age, ages)).toMatchObject({
        age,
        petRarity: "Epic",
        mountRarity: "Epic",
        spellRarity: "Epic"
      });
    }
  });

  it("raises companion rarity on the final equipment ages", () => {
    expect(bisReferenceForAge(0, ages).petRarity).toBe("Common");
    expect(bisReferenceForAge(1, ages).petRarity).toBe("Rare");
    expect(bisReferenceForAge(2, ages).petRarity).toBe("Rare");
    expect(bisReferenceForAge(7, ages).petRarity).toBe("Legendary");
    expect(bisReferenceForAge(8, ages).petRarity).toBe("Ultimate");
    expect(bisReferenceForAge(9, ages).petRarity).toBe("Mythic");
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
    expect(reference.note).toContain("Niveau de test");
    expect(reference.note).toContain("Front max estime");
    expect(reference.note).toContain("Arme BIS");
    expect(reference.note).toContain("Pets BIS");
    expect(reference.note).toContain("sans talents");
  });

  it("changes the simulated allocation with companion and spell access", () => {
    const reference = bisReferenceForAccess({
      equipmentAges: [5],
      petRarities: ["Common"],
      mountRarities: ["Common"],
      spellRarities: ["Mythic"]
    }, ages, "survival");

    expect(reference.stats.some((stat) => stat.stat === "skillDamage")).toBe(true);
    expect(reference.note).toContain("Pets Common, monture Common, sorts Mythic");
    expect(reference.note).toContain("Dog (Degats)");
  });

  it("uses early-age generated cases from the full BIS run", () => {
    const reference = bisReferenceForAccess({
      equipmentAges: [0],
      petRarities: ["Common"],
      mountRarities: ["Common"],
      spellRarities: ["Mythic"]
    }, ages, "damage");

    expect(reference.stats.length).toBeGreaterThan(0);
    expect(reference.note).toContain("BIS exhaustif");
    expect(reference.note).toContain("Niveau de test");
  });

  it("counts the second lines unlocked by legendary companions", () => {
    const reference = bisReferenceForAccess({
      equipmentAges: [5],
      petRarities: ["Legendary"],
      mountRarities: ["Legendary"],
      spellRarities: ["Epic"]
    }, ages, "progress");

    expect(reference.stats.reduce((sum, stat) => sum + Number(stat.count || 0), 0)).toBe(16);
    expect(reference.note).toContain("16 lignes secondaires max");
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
