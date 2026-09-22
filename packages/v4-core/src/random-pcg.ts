import { F64_SCALE, type F64, type Fd6 } from "./fd6.js";

const MASK_64 = (1n << 64n) - 1n;
const MASK_32 = (1n << 32n) - 1n;
const MULTIPLIER = 6_364_136_223_846_793_005n;
const INCREMENT = 1_442_695_040_888_963_407n;
const INITIAL_OFFSET = INCREMENT * MULTIPLIER + INCREMENT & MASK_64;

export class RandomPcg {
  private state: bigint;

  constructor(seed: bigint | number) {
    const normalizedSeed = typeof seed === "bigint" ? seed : BigInt(Math.trunc(seed));
    this.state = (normalizedSeed * MULTIPLIER + INITIAL_OFFSET) & MASK_64;
  }

  nextUInt(): number {
    const previous = this.state;
    this.state = (previous * MULTIPLIER + INCREMENT) & MASK_64;
    const xorshifted = Number((((previous >> 18n) ^ previous) >> 27n) & MASK_32) >>> 0;
    const rotation = Number(previous >> 59n) & 31;
    return ((xorshifted >>> rotation) | (xorshifted << ((-rotation) & 31))) >>> 0;
  }

  nextF64(): F64 {
    return BigInt(this.nextUInt());
  }

  nextFd6(): Fd6 {
    return this.nextF64() * 1_000_000n / F64_SCALE;
  }
}
