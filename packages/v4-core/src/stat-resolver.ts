import { FD6_SCALE, fd6Div, fd6FromDouble, fd6FromF64, fd6Mul, fd6ToNumber, type Fd6 } from "./fd6.js";

export type StatLayer = "None" | "GeneralCompounding" | "Skins" | "Ascensions" | "TechTree";
export type StatNature = "Additive" | "Multiplier" | "Divisor" | "OneMinusMultiplier";
export type StatCondition = "None" | "Melee" | "Ranged";

export type StatContribution = {
  layer: StatLayer;
  nature: StatNature;
  value: number;
  condition?: StatCondition;
};

export type Fd6StatContribution = Omit<StatContribution, "value"> & { value: Fd6 };

export type StatContext = {
  isRanged: boolean | null;
};

export type StatDefaults = {
  multiplier?: number;
  divisor?: number;
};

type LayerBucket = {
  additive: Fd6;
  multiplier: Fd6;
  divisor: Fd6;
  oneMinusMultiplier: Fd6;
  hasMultiplier: boolean;
  hasDivisor: boolean;
};

export function resolveStat(
  incomingValue: number,
  contributions: readonly StatContribution[],
  context: StatContext,
  defaults: StatDefaults = {}
): number {
  return fd6ToNumber(resolveStatFd6(
    fd6FromDouble(incomingValue),
    contributions.map((contribution) => ({
      ...contribution,
      value: fd6FromF64(contribution.value)
    })),
    context,
    {
      multiplier: fd6FromF64(defaults.multiplier ?? 1),
      divisor: fd6FromF64(defaults.divisor ?? 1)
    }
  ));
}

export function resolveStatFd6(
  incomingValue: Fd6,
  contributions: readonly Fd6StatContribution[],
  context: StatContext,
  defaults: { multiplier: Fd6; divisor: Fd6 } = {
    multiplier: FD6_SCALE,
    divisor: FD6_SCALE
  }
): Fd6 {
  const buckets = new Map<StatLayer, LayerBucket>();
  for (const contribution of contributions) {
    if (!conditionMatches(contribution.condition ?? "None", context)) continue;
    const bucket = buckets.get(contribution.layer) ?? createBucket();
    addContribution(bucket, contribution.nature, contribution.value);
    buckets.set(contribution.layer, bucket);
  }

  const base = buckets.get("None") ?? createBucket();
  let value = applyBaseLayer(incomingValue, base, defaults);
  for (const [layer, bucket] of buckets) {
    if (layer !== "None") value = applyCompoundingLayer(value, bucket);
  }
  return value;
}

function createBucket(): LayerBucket {
  return {
    additive: 0n,
    multiplier: 0n,
    divisor: 0n,
    oneMinusMultiplier: 0n,
    hasMultiplier: false,
    hasDivisor: false
  };
}

function addContribution(bucket: LayerBucket, nature: StatNature, value: Fd6) {
  if (nature === "Additive") bucket.additive += value;
  if (nature === "Multiplier") {
    bucket.multiplier += value;
    bucket.hasMultiplier = true;
  }
  if (nature === "Divisor") {
    bucket.divisor += value;
    bucket.hasDivisor = true;
  }
  if (nature === "OneMinusMultiplier") bucket.oneMinusMultiplier += value;
}

function applyBaseLayer(
  value: Fd6,
  bucket: LayerBucket,
  defaults: { multiplier: Fd6; divisor: Fd6 }
): Fd6 {
  const multiplier = defaults.multiplier + bucket.multiplier;
  const divisor = defaults.divisor + bucket.divisor;
  return fd6Div(
    fd6Mul(fd6Mul(value + bucket.additive, multiplier), FD6_SCALE - bucket.oneMinusMultiplier),
    divisor
  );
}

function applyCompoundingLayer(value: Fd6, bucket: LayerBucket): Fd6 {
  let result = value + bucket.additive;
  if (bucket.hasMultiplier) result = fd6Mul(result, FD6_SCALE + bucket.multiplier);
  result = fd6Mul(result, FD6_SCALE - bucket.oneMinusMultiplier);
  if (bucket.hasDivisor) result = fd6Div(result, FD6_SCALE + bucket.divisor);
  return result;
}

function conditionMatches(condition: StatCondition, context: StatContext): boolean {
  if (condition === "Ranged") return context.isRanged === true;
  if (condition === "Melee") return context.isRanged === false;
  return true;
}
