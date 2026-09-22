import { describe, expect, it } from "vitest";
import { fd6ToNumber } from "../src/fd6";
import { buildPlayerSkillDefinitions } from "../src/skill-data";

describe("APK skill profile mapping", () => {
  it("maps user level 2 to APK index 1 and composes the stat layers", () => {
    const result = buildPlayerSkillDefinitions({
      stats: { damage: 10, health: 20, skillDamage: 50, skillCooldown: 25 },
      spells: [{ id: "Buff", level: 2, rarity: "Epic" }]
    }, {
      SkillBaseConfig: { SkillsCount: 18, SkillSlotsCount: 3 },
      SkillLibrary: {
        Buff: {
          Type: "Buff",
          ActiveDuration: 10,
          Cooldown: 8,
          DamagePerLevel: [100, 200],
          HealthPerLevel: [1_000, 2_000]
        }
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skills[0].level).toBe(2);
    expect(fd6ToNumber(result.skills[0].damage)).toBe(330);
    expect(fd6ToNumber(result.skills[0].health)).toBe(3_600);
    expect(fd6ToNumber(result.skills[0].cooldown)).toBe(6);
  });

  it("rejects level zero instead of reading another array entry", () => {
    const result = buildPlayerSkillDefinitions({
      spells: [{ id: "RainOfArrows", level: 0 }]
    }, {
      SkillBaseConfig: { SkillsCount: 18, SkillSlotsCount: 3 },
      SkillLibrary: { RainOfArrows: { DamagePerLevel: [100] } }
    });

    expect(result).toEqual({
      ok: false,
      issue: { code: "invalid_profile_skill_level", path: "profile.spells.0.level" }
    });
  });
});
