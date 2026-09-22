import { describe, expect, it } from "vitest";
import { f64ToNumber } from "../src/fd6";
import { PseudoRandom } from "../src/pseudo-random";

describe("APK skill pseudo-random", () => {
  it("increments one shared offset and applies the APK integer formula", () => {
    const random = new PseudoRandom();

    expect(f64ToNumber(random.next(1_103_515_245, 12_345, 10_000))).toBeCloseTo(0.759, 8);
    expect(f64ToNumber(random.next(2_003_515_245, 32_425, 10_000))).toBeCloseTo(0.9267, 8);
  });
});
