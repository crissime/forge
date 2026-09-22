import { describe, expect, it } from "vitest";
import { f64FromNumber, fd6Div, fd6FromDouble, fd6FromF64, fd6Mul, fd6ToNumber } from "../src/fd6";
import { resolveStat, type StatContribution } from "../src/stat-resolver";

describe("FD6 arithmetic", () => {
  it("truncates the APK F64 representation of a 0.1 tick", () => {
    expect(f64FromNumber(0.1)).toBe(429_496_729n);
  });

  it("rounds inputs to six decimals away from zero", () => {
    expect(fd6ToNumber(fd6FromDouble(1.2345675))).toBe(1.234568);
    expect(fd6ToNumber(fd6FromDouble(-1.2345675))).toBe(-1.234568);
    expect(fd6ToNumber(fd6FromF64(0.14999999990686774))).toBe(0.149999);
  });

  it("truncates multiplication and division like Int128 arithmetic", () => {
    expect(fd6ToNumber(fd6Mul(fd6FromDouble(1.234567), fd6FromDouble(0.333333)))).toBe(0.411521);
    expect(fd6ToNumber(fd6Div(fd6FromDouble(1), fd6FromDouble(3)))).toBe(0.333333);
  });
});

describe("APK stat layers", () => {
  it("adds bonuses inside the same layer", () => {
    const contributions: StatContribution[] = [
      { layer: "None", nature: "Multiplier", value: 0.2 },
      { layer: "None", nature: "Multiplier", value: 0.3 }
    ];

    expect(resolveStat(100, contributions, { isRanged: true })).toBe(150);
  });

  it("multiplies DamageMulti and RangedDamageMulti across layers", () => {
    const contributions: StatContribution[] = [
      { layer: "None", nature: "Multiplier", value: 0.2 },
      { layer: "GeneralCompounding", nature: "Multiplier", value: 0.3, condition: "Ranged" }
    ];

    expect(resolveStat(100, contributions, { isRanged: true })).toBe(156);
    expect(resolveStat(100, contributions, { isRanged: false })).toBe(120);
  });

  it("selects the melee contribution for a melee weapon", () => {
    const contributions: StatContribution[] = [
      { layer: "GeneralCompounding", nature: "Multiplier", value: 0.5, condition: "Melee" },
      { layer: "GeneralCompounding", nature: "Multiplier", value: 0.3, condition: "Ranged" }
    ];

    expect(resolveStat(100, contributions, { isRanged: false })).toBe(150);
    expect(resolveStat(100, contributions, { isRanged: null })).toBe(100);
  });

  it("applies additive, one-minus and divisor natures", () => {
    const contributions: StatContribution[] = [
      { layer: "None", nature: "Additive", value: 20 },
      { layer: "None", nature: "OneMinusMultiplier", value: 0.25 },
      { layer: "None", nature: "Divisor", value: 0.5 }
    ];

    expect(resolveStat(100, contributions, { isRanged: true })).toBe(60);
  });
});
