import { describe, expect, it } from "vitest";
import { loadV4GameData } from "../../v4-game-data/src/index";
import { buildBattleDefinition } from "../src/battle-data";
import { fd6ToNumber } from "../src/fd6";

describe("v4 2.8.2 data integration", () => {
  it("builds the first real battle from the verified APK snapshot", () => {
    const data = loadV4GameData();
    const result = buildBattleDefinition(data.tables, {
      age: 1,
      combat: 1,
      difficulty: "normal"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.battle.waves).toHaveLength(2);
    expect(result.battle.waves[0].enemies[0].count).toBe(1);
    expect(fd6ToNumber(result.battle.waves[0].enemies[0].health)).toBe(35);
    expect(fd6ToNumber(result.battle.waves[0].enemies[0].damage)).toBe(5);
    expect(result.battle.waves[0].enemies[0].weapon.attackDuration).toBe(1.5);
  });

  it("resolves every main battle and every enemy weapon", () => {
    const data = loadV4GameData();
    const battles = data.tables.MainBattleLibrary as Array<{
      BattleId: { AgeIdx: number; BattleIdx: number };
    }>;

    expect(battles).toHaveLength(210);
    for (const entry of battles) {
      const point = {
        age: entry.BattleId.AgeIdx + 1,
        combat: entry.BattleId.BattleIdx + 1,
        difficulty: "normal" as const
      };
      const result = buildBattleDefinition(data.tables, point);
      expect(result.ok, `${point.age}-${point.combat}`).toBe(true);
      if (!result.ok) continue;
      expect(result.battle.waves.length, `${point.age}-${point.combat}`).toBeGreaterThan(0);
      expect(result.battle.waves.every((wave) =>
        wave.enemies.length > 0 && wave.enemies.every((enemy) => enemy.count > 0)
      ), `${point.age}-${point.combat}`).toBe(true);
    }
  });
});
