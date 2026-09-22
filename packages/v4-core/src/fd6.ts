export const FD6_SCALE = 1_000_000n;
export const F64_SCALE = 1n << 32n;

export type Fd6 = bigint;
export type F64 = bigint;

export function fd6FromDouble(value: number): Fd6 {
  if (!Number.isFinite(value)) throw new RangeError("FD6 requires a finite number");
  const scaled = value * Number(FD6_SCALE);
  return BigInt(scaled < 0 ? Math.ceil(scaled - 0.5) : Math.floor(scaled + 0.5));
}

export function fd6FromF64(value: number): Fd6 {
  if (!Number.isFinite(value)) throw new RangeError("FD6 requires a finite number");
  return BigInt(Math.trunc(value * Number(FD6_SCALE)));
}

export function f64FromNumber(value: number): F64 {
  if (!Number.isFinite(value)) throw new RangeError("F64 requires a finite number");
  const integer = Math.trunc(value);
  const fraction = value - integer;
  return BigInt(integer) * F64_SCALE + BigInt(Math.trunc(fraction * Number(F64_SCALE)));
}

export function f64ToNumber(value: F64): number {
  return Number(value) / Number(F64_SCALE);
}

export function f64Mul(left: F64, right: F64): F64 {
  return left * right / F64_SCALE;
}

export function f64Div(left: F64, right: F64): F64 {
  if (right === 0n) throw new RangeError("F64 division by zero");
  return left * F64_SCALE / right;
}

export function f64Sqrt(value: F64): F64 {
  if (value < 0n) throw new RangeError("F64 square root of a negative value");
  return integerSqrt(value * F64_SCALE);
}

export function fd6ToNumber(value: Fd6): number {
  return Number(value) / Number(FD6_SCALE);
}

export function fd6Mul(left: Fd6, right: Fd6): Fd6 {
  return left * right / FD6_SCALE;
}

export function fd6Div(left: Fd6, right: Fd6): Fd6 {
  if (right === 0n) throw new RangeError("FD6 division by zero");
  return left * FD6_SCALE / right;
}

export function fd6MulF64(left: Fd6, right: F64): Fd6 {
  return left * right / F64_SCALE;
}

function integerSqrt(value: bigint): bigint {
  if (value < 2n) return value;
  let current = 1n << BigInt((value.toString(2).length + 1) >> 1);
  while (true) {
    const next = (current + value / current) >> 1n;
    if (next >= current) return current;
    current = next;
  }
}
