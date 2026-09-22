import {
  FD6_SCALE,
  F64_SCALE,
  f64Div,
  f64FromNumber,
  f64Mul,
  f64Sqrt,
  f64ToNumber,
  fd6FromF64,
  fd6Mul,
  fd6MulF64,
  type F64,
  type Fd6
} from "./fd6.js";
import {
  createAttackRuntime,
  stepAttack,
  type AttackRuntime,
  type HitStats
} from "./attack-machine.js";
import type { BattleDefinition, WeaponDefinition } from "./battle-data.js";
import type { PlayerCombatProfile } from "./combat-profile.js";
import { PseudoRandom } from "./pseudo-random.js";
import { RandomPcg } from "./random-pcg.js";
import { isV4BuffSkill, type PlayerSkillDefinition } from "./skill-data.js";

const TICK = f64FromNumber(0.1);
const SKILL_TICK = fd6FromF64(f64ToNumber(TICK));
const MOVE_SPEED = f64FromNumber(2);
const UNIT_RADIUS = f64FromNumber(0.35);
const ENEMY_SPAWN_X = f64FromNumber(15);
const WAVE_DELAY_TICKS = 11;
const GRAVITY = -9.81;
const BALLISTIC_SKILL_PROJECTILES = { Arrows: 3, Shuriken: 5 } as const;
const BALLISTIC_SKILL_SPEED = 20;
const MULTI_STRIKE_SKILLS = {
  Meteorite: { count: 5, radius: 5, delayBase: 1, delayScale: 1 },
  Lightning: { count: 5, radius: 3, delayBase: 0, delayScale: 0.5 },
  CannonBarrage: { count: 3, radius: 6, delayBase: 1, delayScale: 0.5 }
} as const;

type Vec2 = { x: F64; y: F64 };

type Unit = {
  id: number;
  ally: boolean;
  player: boolean;
  solid: boolean;
  targetable: boolean;
  fromSkill: boolean;
  sourceSkillSlot: number | null;
  position: Vec2;
  velocity: Vec2;
  lookDirection: Vec2;
  radius: F64;
  centerOfMass: Vec2;
  unitOffset: Vec2;
  moveSpeed: F64;
  attackRange: F64;
  targetId: number | null;
  targetInAttackRange: boolean;
  killed: boolean;
  removeNextTick: boolean;
  hp: Fd6;
  maxHealth: Fd6;
  maxHealthNoMultiplier: Fd6;
  damage: Fd6;
  attackSpeedMultiplier: Fd6;
  criticalChance: Fd6;
  criticalMultiplier: Fd6;
  blockChance: Fd6;
  reflectChance: Fd6;
  dodgeChance: Fd6;
  doubleAttackChance: Fd6;
  healthRegen: Fd6;
  lifeSteal: Fd6;
  weapon: WeaponDefinition;
  attack: AttackRuntime;
};

type Projectile = {
  id: number;
  sourceId: number;
  ally: boolean;
  position: Vec2;
  previousPosition: Vec2;
  velocity: Vec2;
  radius: F64;
  affectedByGravity: boolean;
  ageTicks: number;
  maxAgeTicks: number;
  hitId: number | null;
  fromSkill: boolean;
  attack: HitStats;
};

type SkillRuntime = PlayerSkillDefinition & {
  ally: boolean;
  active: boolean;
  onCooldown: boolean;
  timer: Fd6;
};

type AreaEffect = {
  sourceId: number;
  ally: boolean;
  position: Vec2;
  velocity: Vec2;
  pulseDuration: F64;
  pulseTimer: F64;
  duration: F64;
  timer: F64;
  radius: F64;
  hasPulse: boolean;
  hasFinalPulse: boolean;
  destroyed: boolean;
  attack: HitStats;
};

export type CombatEngineMode = "average" | "rng";
export type SkillActivationPolicy = "auto_when_ready" | "disabled";

export type CombatEngineOptions = {
  maxSeconds: number;
  mode: CombatEngineMode;
  seed: number;
  skillActivationPolicy: SkillActivationPolicy;
  reflectRoll?: boolean;
};

export type CombatEngineResult = {
  reason: "cleared" | "dead" | "timeout";
  clearedWaves: number;
  timeSeconds: number;
  remainingHealth: Fd6;
  damageDone: Fd6;
  attacks: number;
  projectiles: number;
  skillActivations: number;
  skillHits: number;
};

export type PvpCombatEngineResult = {
  winner: "player" | "opponent" | "draw";
  reason: "knockout" | "timeout";
  timeSeconds: number;
  playerRemainingHealth: Fd6;
  opponentRemainingHealth: Fd6;
  playerMaxHealth: Fd6;
  opponentMaxHealth: Fd6;
  playerDamageDone: Fd6;
  opponentDamageDone: Fd6;
  attacks: number;
  projectiles: number;
  playerSkillActivations: number;
  opponentSkillActivations: number;
  playerSkillHits: number;
  opponentSkillHits: number;
};

type DuelSetup = {
  opponent: PlayerCombatProfile;
  opponentSkills: readonly PlayerSkillDefinition[];
  healthMultiplier: Fd6;
};

type InternalCombatResult = CombatEngineResult & {
  duelWinner: PvpCombatEngineResult["winner"] | null;
  opponentRemainingHealth: Fd6;
  playerMaxHealth: Fd6;
  opponentMaxHealth: Fd6;
  opponentDamageDone: Fd6;
  playerSkillActivations: number;
  opponentSkillActivations: number;
  playerSkillHits: number;
  opponentSkillHits: number;
};

export function simulateWeaponCombat(
  player: PlayerCombatProfile,
  battle: BattleDefinition,
  options: CombatEngineOptions,
  skillDefinitions: readonly PlayerSkillDefinition[] = []
): CombatEngineResult {
  return simulateCombat(player, battle, options, skillDefinitions);
}

export function simulatePvpCombat(
  player: PlayerCombatProfile,
  opponent: PlayerCombatProfile,
  options: CombatEngineOptions,
  playerSkills: readonly PlayerSkillDefinition[],
  opponentSkills: readonly PlayerSkillDefinition[],
  healthMultiplier: Fd6
): PvpCombatEngineResult {
  const simulation = simulateCombat(
    player,
    { point: { age: 0, combat: 0, difficulty: "normal" }, waves: [] },
    options,
    playerSkills,
    { opponent, opponentSkills, healthMultiplier }
  );
  return {
    winner: simulation.duelWinner ?? "draw",
    reason: simulation.reason === "timeout" ? "timeout" : "knockout",
    timeSeconds: simulation.timeSeconds,
    playerRemainingHealth: simulation.remainingHealth,
    opponentRemainingHealth: simulation.opponentRemainingHealth,
    playerMaxHealth: simulation.playerMaxHealth,
    opponentMaxHealth: simulation.opponentMaxHealth,
    playerDamageDone: simulation.damageDone,
    opponentDamageDone: simulation.opponentDamageDone,
    attacks: simulation.attacks,
    projectiles: simulation.projectiles,
    playerSkillActivations: simulation.playerSkillActivations,
    opponentSkillActivations: simulation.opponentSkillActivations,
    playerSkillHits: simulation.playerSkillHits,
    opponentSkillHits: simulation.opponentSkillHits
  };
}

function simulateCombat(
  player: PlayerCombatProfile,
  battle: BattleDefinition,
  options: CombatEngineOptions,
  skillDefinitions: readonly PlayerSkillDefinition[],
  duel?: DuelSetup
): InternalCombatResult {
  const maxTicks = Math.round(options.maxSeconds * 10);
  const random = new RandomPcg(options.seed);
  const skillRandom = new PseudoRandom();
  const units: Unit[] = duel
    ? [
        createPlayer(withHealthMultiplier(player, duel.healthMultiplier), true, 1, 0),
        createPlayer(withHealthMultiplier(duel.opponent, duel.healthMultiplier), false, 2, 18)
      ]
    : [createPlayer(player)];
  let projectiles: Projectile[] = [];
  let areaEffects: AreaEffect[] = [];
  const skills: SkillRuntime[] = skillDefinitions.map((skill) => ({
    ...skill,
    ally: true,
    active: false,
    onCooldown: true,
    timer: 4n * FD6_SCALE
  })).concat((duel?.opponentSkills ?? []).map((skill) => ({
    ...skill,
    ally: false,
    active: false,
    onCooldown: true,
    timer: 4n * FD6_SCALE
  })));
  let nextEntityId = duel ? 3 : 2;
  let currentWave = 0;
  let waveDelay = 0;
  let clearedWaves = 0;
  let damageDone = 0n;
  let opponentDamageDone = 0n;
  let attacks = 0;
  let projectileCount = 0;
  let skillActivations = 0;
  let skillHits = 0;
  let playerSkillActivations = 0;
  let opponentSkillActivations = 0;
  let playerSkillHits = 0;
  let opponentSkillHits = 0;

  if (!duel) spawnWave(units, battle, currentWave, () => nextEntityId++);

  for (let tick = 1; tick <= maxTicks; tick += 1) {
    removeQueued(units);
    projectiles = projectiles.filter((projectile) => (
      projectile.hitId === null && projectile.ageTicks < projectile.maxAgeTicks
    ));
    areaEffects = areaEffects.filter((effect) => !effect.destroyed);

    const playerUnit = units.find((unit) => unit.player && unit.ally);
    const opponentUnit = units.find((unit) => unit.player && !unit.ally);
    if (duel && (!playerUnit || !opponentUnit)) {
      return result(
        playerUnit ? "cleared" : "dead",
        tick,
        playerUnit?.hp ?? 0n,
        playerUnit ? "player" : opponentUnit ? "opponent" : "draw"
      );
    }
    if (!playerUnit) return result("dead", tick, 0n);

    if (!duel && !units.some((unit) => !unit.ally)) {
      if (waveDelay === 0) {
        clearedWaves += 1;
        if (clearedWaves >= battle.waves.length) return result("cleared", tick, playerUnit.hp);
        waveDelay = WAVE_DELAY_TICKS;
      }
      waveDelay -= 1;
      if (waveDelay === 0) {
        currentWave += 1;
        spawnWave(units, battle, currentWave, () => nextEntityId++);
      }
      continue;
    }

    stepSkills();
    moveUnits(units);
    moveProjectiles(projectiles, units);
    resolveUnitPhysics(units);
    applyProjectileHits(projectiles, units);
    applyAreaEffects();
    handleUnits(units);
    activateReadySkills();

    if (duel) {
      const playerAlive = units.some((unit) => unit.player && unit.ally && !unit.removeNextTick);
      const opponentAlive = units.some((unit) => unit.player && !unit.ally && !unit.removeNextTick);
      if (!playerAlive || !opponentAlive) {
        return result(
          playerAlive ? "cleared" : "dead",
          tick,
          playerAlive ? playerUnit.hp : 0n,
          playerAlive ? "player" : opponentAlive ? "opponent" : "draw"
        );
      }
      continue;
    }

    if (!units.some((unit) => unit.player && !unit.removeNextTick)) {
      return result("dead", tick, 0n);
    }
    if (!units.some((unit) => !unit.ally && !unit.removeNextTick)) {
      clearedWaves += 1;
      if (clearedWaves >= battle.waves.length) return result("cleared", tick, playerUnit.hp);
      waveDelay = WAVE_DELAY_TICKS;
    }
  }

  return result(
    "timeout",
    maxTicks,
    units.find((unit) => unit.player && unit.ally)?.hp ?? 0n,
    duel ? winnerByHealthRatio() : null
  );

  function handleUnits(activeUnits: Unit[]): void {
    for (const unit of activeUnits) {
      if (unit.removeNextTick) continue;
      regenerate(unit);
      acquireTarget(unit, activeUnits);
      const wasDoubleAttack = unit.attack.doubleAttack;
      const averageDouble = options.mode === "average" && unit.doubleAttackChance > 0n;
      const step = stepAttack(
        unit.attack,
        {
          windupDuration: fd6FromF64(unit.weapon.windupTime),
          attackDuration: fd6FromF64(unit.weapon.attackDuration),
          attackSpeedMultiplier: unit.attackSpeedMultiplier,
          doubleDamageChance: unit.doubleAttackChance
        },
        unit.targetInAttackRange,
        () => averageDouble ? 0n : random.nextFd6()
      );
      unit.attack = step.runtime;
      if (!step.attacks || unit.targetId === null) continue;

      const target = activeUnits.find((candidate) => candidate.id === unit.targetId);
      if (!target) continue;
      const weight = options.mode === "average" && wasDoubleAttack ? unit.doubleAttackChance : FD6_SCALE;
      attacks += 1;
      if (unit.weapon.projectile) {
        projectiles.push(createProjectile(nextEntityId++, unit, target, weight));
        projectileCount += 1;
      } else {
        applyHit(unit, target, weight);
      }
    }
  }

  function applyProjectileHits(activeProjectiles: Projectile[], activeUnits: Unit[]): void {
    for (const projectile of activeProjectiles) {
      if (projectile.hitId === null) continue;
      const target = activeUnits.find((unit) => unit.id === projectile.hitId);
      if (!target) continue;
      const source = activeUnits.find((unit) => unit.id === projectile.sourceId);
      if (projectile.fromSkill) recordSkillHit(projectile.ally);
      applyResolvedDamage(source, target, resolveDamage(projectile.attack, target, FD6_SCALE));
    }
  }

  function applyHit(source: Unit, target: Unit, weight: Fd6): void {
    applyResolvedDamage(source, target, resolveDamage(source, target, weight));
  }

  function stepSkills(): void {
    for (const skill of skills) {
      if (!skill.active && !skill.onCooldown) continue;
      skill.timer -= SKILL_TICK;
      if (skill.timer > 0n) continue;

      if (skill.active) {
        removeSkillBuff(skill);
        for (const unit of units) {
          if (unit.ally === skill.ally && unit.sourceSkillSlot === skill.slot) unit.removeNextTick = true;
        }
        skill.active = false;
        skill.onCooldown = true;
        skill.timer = skill.cooldown;
      } else {
        skill.onCooldown = false;
        skill.timer = 0n;
      }
    }
  }

  function activateReadySkills(): void {
    if (options.skillActivationPolicy !== "auto_when_ready") return;
    for (const skill of skills) {
      if (skill.active || skill.onCooldown) continue;
      const source = units.find((unit) => (
        unit.player && unit.ally === skill.ally && !unit.removeNextTick
      ));
      const enemies = units.filter((unit) => (
        unit.ally !== skill.ally && unit.targetable && !unit.removeNextTick
      ));
      if (!source || enemies.length === 0) continue;
      activateSkill(skill, source, enemies);
    }
  }

  function activateSkill(skill: SkillRuntime, source: Unit, enemies: Unit[]): void {
    skill.active = true;
    skill.timer = skill.activeDuration;
    skillActivations += 1;
    if (skill.ally) playerSkillActivations += 1;
    else opponentSkillActivations += 1;

    if (isV4BuffSkill(skill.type)) {
      applySkillBuff(skill);
      return;
    }

    const attack = {
      damage: skill.damage,
      criticalChance: source.criticalChance,
      criticalMultiplier: source.criticalMultiplier
    };
    if (skill.type === "RainOfArrows") {
      const pulseDuration = f64Div(f64FromNumber(1), f64FromNumber(5));
      areaEffects.push({
        sourceId: source.id,
        ally: source.ally,
        position: averagePosition(enemies),
        velocity: vector(0, 0),
        pulseDuration,
        pulseTimer: -pulseDuration,
        duration: f64FromNumber(3) + pulseDuration,
        timer: 0n,
        radius: f64FromNumber(6),
        hasPulse: true,
        hasFinalPulse: false,
        destroyed: false,
        attack: { ...attack, damage: attack.damage / 15n }
      });
      return;
    }

    if (skill.type === "Arrows" || skill.type === "Shuriken") {
      const count = BALLISTIC_SKILL_PROJECTILES[skill.type];
      for (let index = 0; index < count; index += 1) {
        const target = enemies[index % enemies.length];
        projectiles.push(createBallisticSkillProjectile(nextEntityId++, source, target, skill.damage / BigInt(count)));
        projectileCount += 1;
      }
      return;
    }

    if (skill.type === "Bomb" || skill.type === "Worm") {
      areaEffects.push({
        sourceId: source.id,
        ally: source.ally,
        position: averagePosition(enemies),
        velocity: vector(0, 0),
        pulseDuration: 0n,
        pulseTimer: 0n,
        duration: f64FromNumber(skill.type === "Bomb" ? 1 : 0.1),
        timer: 0n,
        radius: f64FromNumber(4),
        hasPulse: false,
        hasFinalPulse: true,
        destroyed: false,
        attack
      });
      return;
    }

    if (skill.type === "Shout") {
      const duration = f64FromNumber(1.5);
      areaEffects.push({
        sourceId: source.id,
        ally: source.ally,
        position: addVector(source.position, vector(source.ally ? 5 : -5, 0)),
        velocity: vector(0, 0),
        pulseDuration: f64Div(duration, f64FromNumber(8)),
        pulseTimer: 0n,
        duration,
        timer: 0n,
        radius: f64FromNumber(10),
        hasPulse: true,
        hasFinalPulse: false,
        destroyed: false,
        attack: { ...attack, damage: attack.damage / 8n }
      });
      return;
    }

    if (skill.type === "Meteorite" || skill.type === "Lightning" || skill.type === "CannonBarrage") {
      const config = MULTI_STRIKE_SKILLS[skill.type];
      const center = averagePosition(enemies);
      const direction = source.ally ? 1n : -1n;
      for (let index = 0; index < config.count; index += 1) {
        const randomX = (skillRandom.next(1_103_515_245, 12_345, 10_000) * 2n - F64_SCALE) * 2n * direction;
        const randomY = skillRandom.next(2_003_515_245, 32_425, 10_000) * 2n - F64_SCALE;
        const randomDelay = skillRandom.next(2_003_515_245, 32_425, 10_000);
        areaEffects.push({
          sourceId: source.id,
          ally: source.ally,
          position: addVector(center, { x: randomX, y: randomY }),
          velocity: vector(0, 0),
          pulseDuration: 0n,
          pulseTimer: 0n,
          duration: f64FromNumber(config.delayBase) + f64Mul(randomDelay, f64FromNumber(config.delayScale)),
          timer: 0n,
          radius: f64FromNumber(config.radius),
          hasPulse: false,
          hasFinalPulse: true,
          destroyed: false,
          attack: { ...attack, damage: attack.damage / BigInt(config.count) }
        });
      }
      return;
    }

    if (skill.type === "Stampede") {
      areaEffects.push({
        sourceId: source.id,
        ally: source.ally,
        position: addVector(source.position, vector(source.ally ? -15 : 15, 0)),
        velocity: vector(source.ally ? 8 : -8, 0),
        pulseDuration: f64FromNumber(0.25),
        pulseTimer: 0n,
        duration: f64FromNumber(8),
        timer: 0n,
        radius: f64FromNumber(3),
        hasPulse: true,
        hasFinalPulse: false,
        destroyed: false,
        attack
      });
      return;
    }

    if (skill.type === "StrafeRun") {
      areaEffects.push({
        sourceId: source.id,
        ally: source.ally,
        position: averagePosition(enemies),
        velocity: vector(0, 0),
        pulseDuration: f64FromNumber(0.25),
        pulseTimer: 0n,
        duration: f64FromNumber(1),
        timer: 0n,
        radius: f64FromNumber(3),
        hasPulse: true,
        hasFinalPulse: false,
        destroyed: false,
        attack
      });
      return;
    }

    if (skill.type === "Drone") {
      units.push(createDrone(nextEntityId++, source, skill));
      return;
    }

    const pulseDuration = f64Div(f64FromNumber(1), f64FromNumber(2));
    areaEffects.push({
      sourceId: source.id,
      ally: source.ally,
      position: { ...nearestEnemy(source, enemies).position },
      velocity: vector(0, 0),
      pulseDuration,
      pulseTimer: 0n,
      duration: f64Mul(pulseDuration, f64FromNumber(2)),
      timer: -pulseDuration,
      radius: f64FromNumber(3),
      hasPulse: true,
      hasFinalPulse: true,
      destroyed: false,
      attack
    });
  }

  function applySkillBuff(skill: SkillRuntime): void {
    for (const unit of units) {
      if (unit.ally !== skill.ally || unit.removeNextTick) continue;
      unit.damage += skill.damage;
      unit.maxHealth += skill.health;
      unit.hp = min(unit.maxHealth, unit.hp + skill.health);
    }
  }

  function removeSkillBuff(skill: SkillRuntime): void {
    if (!isV4BuffSkill(skill.type)) return;
    for (const unit of units) {
      if (unit.ally !== skill.ally || unit.removeNextTick) continue;
      unit.damage -= skill.damage;
      unit.maxHealth -= skill.health;
      unit.hp = min(unit.hp, unit.maxHealth);
    }
  }

  function applyAreaEffects(): void {
    for (const effect of areaEffects) {
      if (effect.destroyed) continue;
      effect.position = addVector(effect.position, multiplyVector(effect.velocity, TICK));
      effect.timer += TICK;
      if (effect.hasPulse) {
        effect.pulseTimer += TICK;
        if (effect.pulseTimer > effect.pulseDuration) {
          effect.pulseTimer = 0n;
          applyAreaDamage(effect);
        }
      }
      if (effect.timer > effect.duration) {
        if (effect.hasFinalPulse) applyAreaDamage(effect);
        effect.destroyed = true;
      }
    }
  }

  function applyAreaDamage(effect: AreaEffect): void {
    const source = units.find((unit) => unit.id === effect.sourceId);
    for (const target of units) {
      if (target.ally === effect.ally || !target.targetable || target.removeNextTick) continue;
      const distance = vectorLength(subtractVector(target.position, effect.position));
      if (distance >= effect.radius) continue;
      recordSkillHit(effect.ally);
      applyResolvedDamage(source, target, resolveDamage(effect.attack, target, FD6_SCALE));
    }
  }

  function resolveDamage(attack: HitStats, target: Unit, weight: Fd6): {
    damage: Fd6;
    reflectedDamage: Fd6;
  } {
    if (options.mode === "rng") {
      if (random.nextFd6() <= target.dodgeChance) return { damage: 0n, reflectedDamage: 0n };
      const blocked = random.nextFd6() <= target.blockChance;
      if (!options.reflectRoll && blocked) return { damage: 0n, reflectedDamage: 0n };
      const reflected = options.reflectRoll && random.nextFd6() <= target.reflectChance;
      const damage = random.nextFd6() < attack.criticalChance
        ? fd6Mul(attack.damage, attack.criticalMultiplier)
        : attack.damage;
      const resolved = blocked ? 0n : fd6Mul(damage, weight);
      return { damage: resolved, reflectedDamage: reflected ? resolved : 0n };
    }

    const avoidance = fd6Mul(FD6_SCALE - target.dodgeChance, FD6_SCALE - target.blockChance);
    const criticalBonus = fd6Mul(attack.criticalChance, attack.criticalMultiplier - FD6_SCALE);
    const damage = fd6Mul(fd6Mul(fd6Mul(attack.damage, FD6_SCALE + criticalBonus), avoidance), weight);
    return {
      damage,
      reflectedDamage: options.reflectRoll ? fd6Mul(damage, max(0n, min(FD6_SCALE, target.reflectChance))) : 0n
    };
  }

  function applyResolvedDamage(
    source: Unit | undefined,
    target: Unit,
    hit: { damage: Fd6; reflectedDamage: Fd6 }
  ): void {
    const { damage, reflectedDamage } = hit;
    if (damage <= 0n) return;
    target.hp -= damage;
    if (source?.ally) damageDone += damage;
    else if (source) opponentDamageDone += damage;
    if (target.hp <= 0n && !target.killed) {
      target.killed = true;
      target.removeNextTick = true;
    }
    if (source && source.lifeSteal > 0n) {
      source.hp = min(source.maxHealth, source.hp + fd6Mul(damage, source.lifeSteal));
    }
    if (source && reflectedDamage > 0n) {
      source.hp -= reflectedDamage;
      if (target.ally) damageDone += reflectedDamage;
      else opponentDamageDone += reflectedDamage;
      if (source.hp <= 0n && !source.killed) {
        source.killed = true;
        source.removeNextTick = true;
      }
    }
  }

  function createProjectile(id: number, source: Unit, target: Unit, weight: Fd6): Projectile {
    const config = source.weapon.projectile!;
    const targetPosition = addVector(target.position, target.centerOfMass);
    const start = projectileStart(source, targetPosition);
    const velocity = projectileVelocity(start, targetPosition, config.speed, config.affectedByGravity);
    const duration = f64Div(targetPosition.x - start.x, velocity.x);
    return {
      id,
      sourceId: source.id,
      ally: source.ally,
      position: start,
      previousPosition: start,
      velocity,
      radius: f64FromNumber(config.collisionRadius),
      affectedByGravity: config.affectedByGravity,
      ageTicks: 0,
      maxAgeTicks: Math.max(1, Math.ceil(f64ToNumber(duration) / f64ToNumber(TICK))),
      hitId: null,
      fromSkill: source.fromSkill,
      attack: {
        damage: fd6Mul(source.damage, weight),
        criticalChance: source.criticalChance,
        criticalMultiplier: source.criticalMultiplier
      }
    };
  }

  function createBallisticSkillProjectile(id: number, source: Unit, target: Unit, damage: Fd6): Projectile {
    const direction = source.ally ? 1n : -1n;
    const randomX = (skillRandom.next(1_103_515_245, 12_345, 10_000) * 2n - F64_SCALE) * 4n * direction;
    const randomY = (skillRandom.next(2_003_515_245, 32_425, 10_000) * 2n - F64_SCALE) * 2n;
    const start = addVector(source.position, {
      x: f64FromNumber(source.ally ? -12 : 12) + randomX,
      y: f64FromNumber(2) + randomY
    });
    const targetPosition = addVector(target.position, target.centerOfMass);
    const velocity = projectileVelocity(start, targetPosition, BALLISTIC_SKILL_SPEED, true);
    const duration = f64Div(targetPosition.x - start.x, velocity.x);
    return {
      id,
      sourceId: source.id,
      ally: source.ally,
      position: start,
      previousPosition: start,
      velocity,
      radius: f64FromNumber(0.4),
      affectedByGravity: true,
      ageTicks: 0,
      maxAgeTicks: Math.max(1, Math.ceil(f64ToNumber(duration) / f64ToNumber(TICK))),
      hitId: null,
      fromSkill: true,
      attack: {
        damage,
        criticalChance: source.criticalChance,
        criticalMultiplier: source.criticalMultiplier
      }
    };
  }

  function createDrone(id: number, source: Unit, skill: SkillRuntime): Unit {
    return {
      id,
      ally: source.ally,
      player: false,
      solid: false,
      targetable: false,
      fromSkill: true,
      sourceSkillSlot: skill.slot,
      position: addVector(source.position, vector(source.ally ? 10 : -10, 1)),
      velocity: vector(0, 0),
      lookDirection: vector(source.ally ? 1 : -1, 0),
      radius: f64FromNumber(0.35),
      centerOfMass: vector(0, 0),
      unitOffset: vector(0, 0),
      moveSpeed: 0n,
      attackRange: f64FromNumber(4),
      targetId: null,
      targetInAttackRange: false,
      killed: false,
      removeNextTick: false,
      hp: FD6_SCALE,
      maxHealth: FD6_SCALE,
      maxHealthNoMultiplier: FD6_SCALE,
      damage: skill.damage,
      attackSpeedMultiplier: FD6_SCALE,
      criticalChance: 0n,
      criticalMultiplier: FD6_SCALE,
      blockChance: 0n,
      reflectChance: 0n,
      dodgeChance: 0n,
      doubleAttackChance: 0n,
      healthRegen: 0n,
      lifeSteal: 0n,
      weapon: {
        itemId: { age: -1, idx: -1 },
        attackRange: 4,
        windupTime: 1 / 6,
        attackDuration: 0.5,
        isRanged: true,
        isAiming: false,
        handOffset: { x: 0, y: 2.3 },
        weaponOffset: { x: 0, y: 0 },
        projectileId: -1,
        projectile: {
          id: -1,
          speed: 30,
          collisionRadius: 0.2,
          affectedByGravity: false
        }
      },
      attack: createAttackRuntime()
    };
  }

  function recordSkillHit(ally: boolean): void {
    skillHits += 1;
    if (ally) playerSkillHits += 1;
    else opponentSkillHits += 1;
  }

  function winnerByHealthRatio(): PvpCombatEngineResult["winner"] {
    const playerUnit = units.find((unit) => unit.player && unit.ally);
    const opponentUnit = units.find((unit) => unit.player && !unit.ally);
    if (!playerUnit || !opponentUnit) {
      return playerUnit ? "player" : opponentUnit ? "opponent" : "draw";
    }
    const playerRatio = max(0n, playerUnit.hp) * opponentUnit.maxHealth;
    const opponentRatio = max(0n, opponentUnit.hp) * playerUnit.maxHealth;
    return playerRatio === opponentRatio ? "draw" : playerRatio > opponentRatio ? "player" : "opponent";
  }

  function result(
    reason: CombatEngineResult["reason"],
    ticks: number,
    remainingHealth: Fd6,
    duelWinner: PvpCombatEngineResult["winner"] | null = null
  ): InternalCombatResult {
    const playerUnit = units.find((unit) => unit.player && unit.ally);
    const opponentUnit = units.find((unit) => unit.player && !unit.ally);
    return {
      reason,
      clearedWaves,
      timeSeconds: ticks / 10,
      remainingHealth: remainingHealth > 0n ? remainingHealth : 0n,
      damageDone,
      attacks,
      projectiles: projectileCount,
      skillActivations,
      skillHits,
      duelWinner,
      opponentRemainingHealth: max(0n, opponentUnit?.hp ?? 0n),
      playerMaxHealth: playerUnit?.maxHealth ?? 0n,
      opponentMaxHealth: opponentUnit?.maxHealth ?? 0n,
      opponentDamageDone,
      playerSkillActivations,
      opponentSkillActivations,
      playerSkillHits,
      opponentSkillHits
    };
  }
}

function createPlayer(
  source: PlayerCombatProfile,
  ally = true,
  id = 1,
  positionX = 0
): Unit {
  return {
    id,
    ally,
    player: true,
    solid: true,
    targetable: true,
    fromSkill: false,
    sourceSkillSlot: null,
    position: vector(positionX, 0),
    velocity: vector(0, 0),
    lookDirection: vector(ally ? 1 : -1, 0),
    radius: source.colliderRadius,
    centerOfMass: { ...source.centerOfMass },
    unitOffset: { ...source.unitOffset },
    moveSpeed: source.moveSpeed,
    attackRange: source.weapon.attackRange,
    targetId: null,
    targetInAttackRange: false,
    killed: false,
    removeNextTick: false,
    hp: source.maxHealth,
    maxHealth: source.maxHealth,
    maxHealthNoMultiplier: source.maxHealthNoMultiplier,
    damage: source.damage,
    attackSpeedMultiplier: source.attackSpeedMultiplier,
    criticalChance: source.criticalChance,
    criticalMultiplier: source.criticalMultiplier,
    blockChance: source.blockChance,
    reflectChance: source.reflectChance,
    dodgeChance: source.dodgeChance,
    doubleAttackChance: source.doubleAttackChance,
    healthRegen: source.healthRegen,
    lifeSteal: source.lifeSteal,
    weapon: {
      itemId: { age: source.weapon.age, idx: source.weapon.idx },
      attackRange: f64ToNumber(source.weapon.attackRange),
      windupTime: Number(source.weapon.windupDuration) / Number(FD6_SCALE),
      attackDuration: Number(source.weapon.attackDuration) / Number(FD6_SCALE),
      isRanged: source.weapon.isRanged,
      isAiming: source.weapon.isAiming,
      handOffset: {
        x: f64ToNumber(source.weapon.handOffset.x),
        y: f64ToNumber(source.weapon.handOffset.y)
      },
      weaponOffset: {
        x: f64ToNumber(source.weapon.weaponOffset.x),
        y: f64ToNumber(source.weapon.weaponOffset.y)
      },
      projectileId: source.weapon.projectileId,
      projectile: source.weapon.projectile ? {
        id: source.weapon.projectileId,
        speed: f64ToNumber(source.weapon.projectile.speed),
        collisionRadius: f64ToNumber(source.weapon.projectile.collisionRadius),
        affectedByGravity: source.weapon.projectile.affectedByGravity
      } : null
    },
    attack: createAttackRuntime()
  };
}

function withHealthMultiplier(source: PlayerCombatProfile, multiplier: Fd6): PlayerCombatProfile {
  return {
    ...source,
    maxHealth: fd6Mul(source.maxHealth, multiplier),
    maxHealthNoMultiplier: fd6Mul(source.maxHealthNoMultiplier, multiplier)
  };
}

function spawnWave(
  units: Unit[],
  battle: BattleDefinition,
  waveIndex: number,
  nextId: () => number
): void {
  const definitions = battle.waves[waveIndex]?.enemies ?? [];
  const count = definitions.reduce((sum, stack) => sum + stack.count, 0);
  const positions = formationPositions(count);
  let positionIndex = 0;
  for (const stack of definitions) {
    for (let index = 0; index < stack.count; index += 1) {
      const offset = positions[positionIndex++];
      units.push({
        id: nextId(),
        ally: false,
        player: false,
        solid: true,
        targetable: true,
        fromSkill: false,
        sourceSkillSlot: null,
        position: { x: ENEMY_SPAWN_X + offset.x, y: offset.y },
        velocity: vector(0, 0),
        lookDirection: vector(-1, 0),
        radius: UNIT_RADIUS,
        centerOfMass: vector(0, 0),
        unitOffset: vector(0, 0),
        moveSpeed: MOVE_SPEED,
        attackRange: f64FromNumber(stack.weapon.attackRange),
        targetId: null,
        targetInAttackRange: false,
        killed: false,
        removeNextTick: false,
        hp: stack.health,
        maxHealth: stack.health,
        maxHealthNoMultiplier: stack.health,
        damage: stack.damage,
        attackSpeedMultiplier: FD6_SCALE,
        criticalChance: 0n,
        criticalMultiplier: FD6_SCALE,
        blockChance: 0n,
        reflectChance: 0n,
        dodgeChance: 0n,
        doubleAttackChance: 0n,
        healthRegen: 0n,
        lifeSteal: 0n,
        weapon: stack.weapon,
        attack: createAttackRuntime()
      });
    }
  }
}

function formationPositions(count: number): Vec2[] {
  const columns = count > 4 ? 3 : 2;
  const positions: Vec2[] = [];
  let remaining = count;
  let row = 0;
  while (remaining > 0) {
    const rowCount = Math.min(columns, remaining);
    for (let column = 0; column < rowCount; column += 1) {
      positions.push(vector(row, column - rowCount / 2 + 0.5));
    }
    remaining -= rowCount;
    row += 1;
  }
  return positions;
}

function removeQueued(units: Unit[]): void {
  for (let index = units.length - 1; index >= 0; index -= 1) {
    if (units[index].removeNextTick) units.splice(index, 1);
  }
}

function moveUnits(units: Unit[]): void {
  for (const unit of units) {
    unit.velocity = unit.targetInAttackRange
      ? vector(0, 0)
      : multiplyVector(unit.lookDirection, unit.moveSpeed);
  }
}

function resolveUnitPhysics(units: Unit[]): void {
  for (const unit of units) unit.position = addVector(unit.position, multiplyVector(unit.velocity, TICK));

  for (let leftIndex = 0; leftIndex < units.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < units.length; rightIndex += 1) {
      const left = units[leftIndex];
      const right = units[rightIndex];
      if (!left.solid || !right.solid) continue;
      const delta = subtractVector(right.position, left.position);
      const distance = vectorLength(delta);
      const minDistance = left.radius + right.radius;
      if (distance >= minDistance || distance === 0n) continue;

      const normal = divideVector(delta, distance);
      const overlap = minDistance - distance;
      const leftWeight = left.targetInAttackRange ? 1000 : 1;
      const rightWeight = right.targetInAttackRange ? 1000 : 1;
      const totalWeight = leftWeight + rightWeight;
      const leftShare = f64FromNumber(leftWeight / totalWeight);
      const rightShare = f64FromNumber(rightWeight / totalWeight);
      left.position = subtractVector(left.position, multiplyVector(normal, f64Mul(overlap, rightShare)));
      right.position = addVector(right.position, multiplyVector(normal, f64Mul(overlap, leftShare)));
      left.position.y = clamp(left.position.y, f64FromNumber(-4), f64FromNumber(4));
      right.position.y = clamp(right.position.y, f64FromNumber(-4), f64FromNumber(4));
    }
  }
}

function acquireTarget(unit: Unit, units: Unit[]): void {
  let target: Unit | undefined;
  let bestDistance: F64 | undefined;
  for (const candidate of units) {
    if (
      candidate.id === unit.id || candidate.ally === unit.ally ||
      !candidate.targetable || candidate.removeNextTick
    ) continue;
    const distance = vectorLength(subtractVector(candidate.position, unit.position));
    if (bestDistance === undefined || distance < bestDistance) {
      target = candidate;
      bestDistance = distance;
    }
  }

  if (!target || bestDistance === undefined) {
    unit.targetId = null;
    unit.targetInAttackRange = false;
    return;
  }

  const direction = subtractVector(target.position, unit.position);
  unit.lookDirection = bestDistance === 0n ? unit.lookDirection : divideVector(direction, bestDistance);
  unit.targetId = target.id;
  unit.targetInAttackRange = bestDistance < unit.attackRange + unit.radius + target.radius;
}

function averagePosition(units: Unit[]): Vec2 {
  const total = units.reduce((sum, unit) => addVector(sum, unit.position), vector(0, 0));
  return divideVector(total, f64FromNumber(units.length));
}

function nearestEnemy(source: Unit, enemies: Unit[]): Unit {
  return enemies.reduce((nearest, candidate) => {
    const nearestDistance = vectorLength(subtractVector(nearest.position, source.position));
    const candidateDistance = vectorLength(subtractVector(candidate.position, source.position));
    return candidateDistance < nearestDistance ? candidate : nearest;
  });
}

function regenerate(unit: Unit): void {
  if (unit.healthRegen <= 0n || unit.hp >= unit.maxHealth) return;
  const perSecond = fd6Mul(unit.maxHealthNoMultiplier, unit.healthRegen);
  unit.hp = min(unit.maxHealth, unit.hp + fd6MulF64(perSecond, TICK));
}

function moveProjectiles(projectiles: Projectile[], units: Unit[]): void {
  for (const projectile of projectiles) {
    if (projectile.hitId !== null) continue;
    projectile.previousPosition = { ...projectile.position };
    if (projectile.affectedByGravity) {
      projectile.velocity.y += f64Mul(f64FromNumber(GRAVITY), TICK);
    }
    projectile.position = addVector(projectile.position, multiplyVector(projectile.velocity, TICK));
    projectile.ageTicks += 1;

    let nearest: { id: number; distance: number } | undefined;
    for (const unit of units) {
      if (unit.ally === projectile.ally || !unit.targetable) continue;
      const distance = distanceToSegment(
        addVector(unit.position, unit.centerOfMass),
        projectile.previousPosition,
        projectile.position
      );
      const collisionDistance = f64ToNumber(unit.radius + projectile.radius);
      if (distance < collisionDistance && (!nearest || distance < nearest.distance)) {
        nearest = { id: unit.id, distance };
      }
    }
    projectile.hitId = nearest?.id ?? null;
  }
}

function projectileVelocity(start: Vec2, target: Vec2, speed: number, affectedByGravity: boolean): Vec2 {
  const dx = f64ToNumber(target.x - start.x);
  const dy = f64ToNumber(target.y - start.y);
  if (!affectedByGravity) {
    const length = Math.hypot(dx, dy) || 1;
    return vector(dx / length * speed, dy / length * speed);
  }

  const gravity = -GRAVITY;
  const squaredSpeed = speed * speed;
  const discriminant = squaredSpeed * squaredSpeed - gravity * (gravity * dx * dx + 2 * dy * squaredSpeed);
  if (discriminant <= 0 || Math.abs(dx) < 1e-9) {
    const length = Math.hypot(dx, dy) || 1;
    return vector(dx / length * speed, dy / length * speed);
  }
  const tangent = (squaredSpeed - Math.sqrt(discriminant)) / (gravity * Math.abs(dx));
  const cosine = 1 / Math.sqrt(1 + tangent * tangent);
  return vector(Math.sign(dx) * speed * cosine, speed * tangent * cosine);
}

function projectileStart(source: Unit, target: Vec2): Vec2 {
  const sign = source.ally ? F64_SCALE : -F64_SCALE;
  const handOffset = {
    x: f64Mul(source.unitOffset.x + f64FromNumber(source.weapon.handOffset.x), sign),
    y: source.unitOffset.y + f64FromNumber(source.weapon.handOffset.y)
  };
  const handPosition = addVector(source.position, handOffset);
  const weaponOffset = {
    x: f64FromNumber(source.weapon.weaponOffset.x),
    y: f64FromNumber(source.weapon.weaponOffset.y)
  };
  if (!source.weapon.isAiming) {
    return addVector(handPosition, { x: f64Mul(weaponOffset.x, sign), y: weaponOffset.y });
  }

  const targetDelta = subtractVector(target, handPosition);
  const length = vectorLength(targetDelta);
  if (length === 0n) return handPosition;
  const direction = divideVector(targetDelta, length);
  const perpendicular = { x: -direction.y, y: direction.x };
  return addVector(handPosition, {
    x: f64Mul(direction.x, weaponOffset.x) + f64Mul(f64Mul(perpendicular.x, weaponOffset.y), sign),
    y: f64Mul(direction.y, weaponOffset.x) + f64Mul(f64Mul(perpendicular.y, weaponOffset.y), sign)
  });
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const px = f64ToNumber(point.x);
  const py = f64ToNumber(point.y);
  const x1 = f64ToNumber(start.x);
  const y1 = f64ToNumber(start.y);
  const x2 = f64ToNumber(end.x);
  const y2 = f64ToNumber(end.y);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function vector(x: number, y: number): Vec2 {
  return { x: f64FromNumber(x), y: f64FromNumber(y) };
}

function addVector(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x + right.x, y: left.y + right.y };
}

function subtractVector(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x - right.x, y: left.y - right.y };
}

function multiplyVector(value: Vec2, scalar: F64): Vec2 {
  return { x: f64Mul(value.x, scalar), y: f64Mul(value.y, scalar) };
}

function divideVector(value: Vec2, scalar: F64): Vec2 {
  return { x: f64Div(value.x, scalar), y: f64Div(value.y, scalar) };
}

function vectorLength(value: Vec2): F64 {
  return f64Sqrt(f64Mul(value.x, value.x) + f64Mul(value.y, value.y));
}

function clamp(value: F64, minimum: F64, maximum: F64): F64 {
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

function min(left: Fd6, right: Fd6): Fd6 {
  return left < right ? left : right;
}

function max(left: Fd6, right: Fd6): Fd6 {
  return left > right ? left : right;
}
