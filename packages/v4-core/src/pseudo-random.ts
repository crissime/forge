import { F64_SCALE, type F64 } from "./fd6.js";

export class PseudoRandom {
  private offset = 0;

  next(multiplier: number, addition: number, modulo: number): F64 {
    if (!Number.isInteger(modulo) || modulo <= 0) throw new RangeError("modulo must be a positive integer");
    this.offset += 1;
    const value = (Math.imul(this.offset, multiplier) + addition) | 0;
    const numerator = (value & 0x7fff_ffff) % modulo;
    return BigInt(numerator) * F64_SCALE / BigInt(modulo);
  }
}
