import { describe, expect, it } from "vitest";
import { createAttackRuntime, resolveHit, stepAttack, type AttackConfig, type AttackRuntime } from "../src/attack-machine";
import { FD6_SCALE, fd6FromDouble, fd6ToNumber } from "../src/fd6";

const config: AttackConfig = {
  windupDuration: fd6FromDouble(0.5),
  attackDuration: fd6FromDouble(1.5),
  attackSpeedMultiplier: FD6_SCALE,
  doubleDamageChance: 0n
};

describe("APK attack state machine", () => {
  it("uses a 0.1 second tick and treats attack duration as the total cycle", () => {
    let runtime = createAttackRuntime();
    const hitTicks: number[] = [];

    for (let tick = 1; tick <= 24; tick += 1) {
      const step = stepAttack(runtime, config, true);
      runtime = step.runtime;
      if (step.attacks) hitTicks.push(tick);
    }

    expect(hitTicks).toEqual([7, 24]);
  });

  it("cancels a windup when the target leaves range", () => {
    let runtime: AttackRuntime = createAttackRuntime();
    runtime = stepAttack(runtime, config, true).runtime;
    runtime = stepAttack(runtime, config, true).runtime;
    const step = stepAttack(runtime, config, false);

    expect(step.cancelled).toBe(true);
    expect(step.runtime).toEqual(createAttackRuntime());
  });

  it("schedules double damage as a second accelerated attack", () => {
    const doubleConfig = { ...config, doubleDamageChance: fd6FromDouble(0.5) };
    let runtime = createAttackRuntime();
    const hitTicks: number[] = [];

    for (let tick = 1; tick <= 10; tick += 1) {
      const step = stepAttack(runtime, doubleConfig, true, () => 0n);
      runtime = step.runtime;
      if (step.attacks) hitTicks.push(tick);
    }

    expect(hitTicks).toEqual([7, 9]);
    expect(runtime.doubleAttack).toBe(true);
  });
});

describe("APK hit resolution", () => {
  const attack = {
    damage: fd6FromDouble(100),
    criticalChance: fd6FromDouble(0.25),
    criticalMultiplier: fd6FromDouble(1.5)
  };

  it("stops after dodge without rolling block or critical", () => {
    const rolls = [fd6FromDouble(0.1), fd6FromDouble(0.9)];
    let calls = 0;
    const result = resolveHit(attack, { dodgeChance: fd6FromDouble(0.1), blockChance: 0n }, () => rolls[calls++]);

    expect(result.dodged).toBe(true);
    expect(result.damage).toBe(0n);
    expect(calls).toBe(1);
  });

  it("uses <= for block and < for critical", () => {
    const blockRolls = [fd6FromDouble(0.9), fd6FromDouble(0.2)];
    let blockCall = 0;
    const blocked = resolveHit(attack, { dodgeChance: 0n, blockChance: fd6FromDouble(0.2) }, () => blockRolls[blockCall++]);
    expect(blocked.blocked).toBe(true);

    const critRolls = [fd6FromDouble(0.9), fd6FromDouble(0.9), fd6FromDouble(0.249999)];
    let critCall = 0;
    const critical = resolveHit(attack, { dodgeChance: 0n, blockChance: 0n }, () => critRolls[critCall++]);
    expect(critical.critical).toBe(true);
    expect(fd6ToNumber(critical.damage)).toBe(150);
  });
});
