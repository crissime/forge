import { describe, expect, it } from "vitest";
import { fd6ToNumber } from "../src/fd6";
import { RandomPcg } from "../src/random-pcg";

describe("Metaplay RandomPCG", () => {
  it("matches the APK PCG sequence for seed 42", () => {
    const random = new RandomPcg(42);

    expect(Array.from({ length: 5 }, () => random.nextUInt())).toEqual([
      3_270_867_926,
      1_795_671_209,
      1_924_641_435,
      1_143_034_755,
      4_121_910_957
    ]);
  });

  it("converts NextF64 to FD6 by truncation", () => {
    const random = new RandomPcg(0);

    expect(fd6ToNumber(random.nextFd6())).toBe(0.906793);
  });
});
