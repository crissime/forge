import { describe, expect, it } from "vitest";
import { emptyProfile } from "../../store/workshop";
import { setOpponentSpell, setOpponentStat, setOpponentTotal } from "./pvpProfile";

describe("compact PvP opponent profile", () => {
  it("stores total attack and health without equipment contributions", () => {
    const profile = emptyProfile();
    profile.breakdown.equipmentAttack = 100;
    profile.breakdown.petHealth = 200;

    setOpponentTotal(profile, "attack", 1_250);
    setOpponentTotal(profile, "health", 9_500);

    expect(profile.base).toMatchObject({ attack: 1_250, health: 9_500 });
    expect(profile.breakdown.baseAttack).toBe(1_250);
    expect(profile.breakdown.equipmentAttack).toBe(0);
    expect(profile.breakdown.baseHealth).toBe(9_500);
    expect(profile.breakdown.petHealth).toBe(0);
  });

  it("stores every secondary stat as a direct PvP total", () => {
    const profile = emptyProfile();

    setOpponentStat(profile, "critDamage", 64.5);
    setOpponentStat(profile, "cooldown", 7);

    expect(profile.stats.critDamage).toBe(64.5);
    expect(profile.breakdown.secondaryStats.critDamage).toBe(64.5);
    expect(profile.breakdown.talentStats.critDamage).toBe(0);
    expect(profile.stats.cooldown).toBe(7);
  });

  it("supports three opponent spells with level and rarity", () => {
    const profile = emptyProfile();
    const spells = [
      { id: "Arrows", name: "Arrows", rarity: "Common" },
      { id: "Morale", name: "Morale", rarity: "Epic" }
    ];

    setOpponentSpell(profile, 0, "Arrows", 20, spells);
    setOpponentSpell(profile, 1, "Morale", 150, spells);

    expect(profile.spells).toEqual([
      { id: "Arrows", level: 20, rarity: "Common" },
      { id: "Morale", level: 100, rarity: "Epic" }
    ]);
  });
});
