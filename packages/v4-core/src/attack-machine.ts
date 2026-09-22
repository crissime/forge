import { FD6_SCALE, f64FromNumber, fd6Div, fd6Mul, fd6MulF64, type Fd6 } from "./fd6.js";

export const COMBAT_TICK_SECONDS = f64FromNumber(0.1);

export type AttackState = "idle" | "winding-up" | "cooldown";

export type AttackRuntime = {
  state: AttackState;
  timer: Fd6;
  doubleAttack: boolean;
};

export type AttackConfig = {
  windupDuration: Fd6;
  attackDuration: Fd6;
  attackSpeedMultiplier: Fd6;
  doubleDamageChance: Fd6;
};

export type AttackStep = {
  runtime: AttackRuntime;
  attacks: number;
  doubleAttackStarted: boolean;
  cancelled: boolean;
};

export function createAttackRuntime(): AttackRuntime {
  return { state: "idle", timer: 0n, doubleAttack: false };
}

export function stepAttack(
  current: AttackRuntime,
  config: AttackConfig,
  targetInRange: boolean,
  rollDouble: () => Fd6 = () => FD6_SCALE
): AttackStep {
  const runtime = { ...current };
  if (runtime.state === "idle") {
    if (targetInRange) runtime.state = "winding-up";
    return { runtime, attacks: 0, doubleAttackStarted: false, cancelled: false };
  }

  runtime.timer += fd6MulF64(config.attackSpeedMultiplier, COMBAT_TICK_SECONDS);
  if (runtime.state === "winding-up") {
    if (!targetInRange) {
      return { runtime: createAttackRuntime(), attacks: 0, doubleAttackStarted: false, cancelled: true };
    }
    if (runtime.timer < config.windupDuration) {
      return { runtime, attacks: 0, doubleAttackStarted: false, cancelled: false };
    }

    runtime.state = "cooldown";
    if (!runtime.doubleAttack && rollDouble() <= config.doubleDamageChance) {
      runtime.timer = fd6Mul(config.windupDuration, FD6_SCALE - fd6Div(FD6_SCALE, 4n * FD6_SCALE));
      runtime.doubleAttack = true;
      runtime.state = "winding-up";
      return { runtime, attacks: 1, doubleAttackStarted: true, cancelled: false };
    }
    return { runtime, attacks: 1, doubleAttackStarted: false, cancelled: false };
  }

  if (runtime.timer >= config.attackDuration) return {
    runtime: createAttackRuntime(),
    attacks: 0,
    doubleAttackStarted: false,
    cancelled: false
  };
  return { runtime, attacks: 0, doubleAttackStarted: false, cancelled: false };
}

export type HitStats = {
  damage: Fd6;
  criticalChance: Fd6;
  criticalMultiplier: Fd6;
};

export type HitDefense = {
  dodgeChance: Fd6;
  blockChance: Fd6;
};

export type HitResult = {
  damage: Fd6;
  dodged: boolean;
  blocked: boolean;
  critical: boolean;
};

export function resolveHit(
  attack: HitStats,
  defense: HitDefense,
  random: () => Fd6
): HitResult {
  if (random() <= defense.dodgeChance) {
    return { damage: 0n, dodged: true, blocked: false, critical: false };
  }
  if (random() <= defense.blockChance) {
    return { damage: 0n, dodged: false, blocked: true, critical: false };
  }
  const critical = random() < attack.criticalChance;
  return {
    damage: critical ? fd6Mul(attack.damage, attack.criticalMultiplier) : attack.damage,
    dodged: false,
    blocked: false,
    critical
  };
}
