import { describe, expect, it } from "vitest";
import { loadGameData } from "@forge-master/game-data";
import { combatProfile, compareDrop, createEmptyStats, evaluatePvp, evaluateProfile, evaluateProfileSnapshot, manualProfile, normalizeOneVcianProfile } from "../src/index";

const slotToJsonType = {
  Weapon: "Weapon",
  Helmet: "Helmet",
  Body: "Armour",
  Gloves: "Gloves",
  Belt: "Belt",
  Necklace: "Necklace",
  Ring: "Ring",
  Shoe: "Shoes"
} as const;

describe("game data integration", () => {
  it("loads normalized substats, exact spell arrays and tech nodes", async () => {
    const data = await loadGameData();
    expect(data.normalized.stats).toHaveLength(13);
    expect(data.normalized.stats.find((stat) => stat.id === "critDamage")?.max).toBeCloseTo(80, 5);
    expect(data.normalized.spells).toHaveLength(18);
    expect(data.normalized.spells.find((spell) => spell.id === "Drone")?.damageByLevel).toHaveLength(100);
    expect(data.normalized.spells.find((spell) => spell.id === "RainOfArrows")?.mechanics).toMatchObject({
      kind: "damage",
      targetMode: "all",
      hitCount: 15
    });
    expect(data.normalized.spells.find((spell) => spell.id === "Meat")?.mechanics.kind).toBe("buff");
    expect(data.normalized.techNodes.filter((node) => node.tree === "Forge")).toHaveLength(50);
    expect(data.normalized.techNodes.filter((node) => node.tree === "Power")).toHaveLength(100);
    expect(data.normalized.techNodes.filter((node) => node.tree === "SkillsPetTech")).toHaveLength(85);
    expect(data.normalized.ageOptions.map((age) => age.label)).toContain("Espace");
    expect(data.normalized.itemBases.length).toBeGreaterThan(200);
    expect(data.normalized.itemBases.find((item) => item.slot === "Helmet" && item.age === 0 && item.idx === 0)?.health).toBe(40);
    expect(data.normalized.petModels).toHaveLength(25);
    expect(data.normalized.petModels.filter((pet) => pet.rarity === "Common")).toHaveLength(6);
    expect(data.normalized.petModels.filter((pet) => pet.rarity === "Rare")).toHaveLength(5);
    expect(data.normalized.petModels.filter((pet) => pet.rarity === "Legendary")).toHaveLength(3);
    expect(data.normalized.petModels.map(({ rarity, id, name, type }) => `${rarity}:${id}:${name}:${type}`)).toEqual([
      "Common:0:Chicken:Balanced",
      "Common:1:Dog:Damage",
      "Common:2:Cat:Balanced",
      "Common:3:Snail:Health",
      "Common:4:Mouse:Balanced",
      "Common:5:Turtle:Health",
      "Rare:0:Hedgehog:Health",
      "Rare:1:Bear:Health",
      "Rare:2:Ostrich:Balanced",
      "Rare:3:Spider:Damage",
      "Rare:4:Scorpion:Damage",
      "Epic:0:Griffin:Health",
      "Epic:1:Saber Tooth:Damage",
      "Epic:2:Unicorn:Balanced",
      "Epic:3:Tiger:Damage",
      "Epic:4:Panda:Health",
      "Legendary:0:Serpent:Damage",
      "Legendary:1:Cerberus:Balanced",
      "Legendary:2:Kitsune:Damage",
      "Ultimate:0:Electry:Damage",
      "Ultimate:1:Treant:Health",
      "Ultimate:2:Enchanted Elk:Balanced",
      "Mythic:0:Baby Dragon:Balanced",
      "Mythic:1:Genie:Health",
      "Mythic:2:Spectral Tiger:Damage"
    ]);
    expect(data.manifest.files.some((file) => file.file === "ManualSpriteMapping.json" && file.sha256.length === 64)).toBe(true);
    expect(data.normalized.mountModels.filter((mount) => mount.rarity === "Common")).toHaveLength(3);
    expect(data.normalized.mountModels.filter((mount) => mount.rarity === "Mythic").map((mount) => mount.name)).toEqual([
      "Hover Disk",
      "Hover Board"
    ]);
    expect(data.normalized.petLevels.find((group) => group.rarity === "Common")?.levels).toHaveLength(100);
    expect(data.normalized.mountLevels.find((group) => group.rarity === "Common")?.levels[0].level).toBe(1);
  });
});

describe("simulator", () => {
  it("uses V3 additive weapon damage buckets and keeps skill damage additive", async () => {
    const data = await loadGameData();
    const spell = data.normalized.spells.find((entry) => entry.id === "Arrows")!;
    spell.damageByLevel = Array(100).fill(100);
    spell.healthByLevel = Array(100).fill(0);
    spell.cooldown = 10;
    spell.activeDuration = 0;
    spell.mechanics = { kind: "damage", targetMode: "single", hitCount: 1, confidence: "high" } as any;

    const profile = manualProfile("Buckets", data);
    profile.base.attack = 100;
    profile.base.weaponStyle = "ranged";
    profile.stats.damage = 14;
    profile.stats.rangedDamage = 15;
    profile.stats.skillDamage = 15.3;
    profile.spells = [{ id: "Arrows", level: 1 }];
    const combat = combatProfile(profile, data, 60, { damageStacking: "additive", blockMode: "average", trials: 1 });

    expect(combat.breakdown.weaponDamage).toBeCloseTo(1.29, 5);
    expect(combat.breakdown.weaponDamage).not.toBeCloseTo(1.14 * 1.15, 5);
    expect(combat.skills[0].damagePerHit).toBeCloseTo(129.3, 5);
  });

  it("lets double chance benefit from the average crit factor", async () => {
    const data = await loadGameData();
    const profile = manualProfile("Double crit", data);
    profile.base.attack = 100;
    profile.stats.doubleChance = 100;
    profile.stats.critChance = 100;
    profile.stats.critDamage = 80;
    const combat = combatProfile(profile, data, 60, { blockMode: "average", trials: 1 });

    expect(combat.weaponDpsPerAttack).toBeCloseTo(4, 5);
  });

  it("runs seeded RNG block and exposes the observed block rate", async () => {
    const data = await loadGameData();
    data.raw["MainBattleLibrary.json"] = {};
    const settings = {
      model: { blockMode: "rng" as const, trials: 64, seed: 42 },
      endurance: { startDamagePct: 100, growthPct: 0, maxSeconds: 10 }
    };
    const blocked = manualProfile("Blocked", data);
    blocked.base.health = 1000;
    blocked.breakdown.baseHealth = 1000;
    blocked.stats.block = 100;
    blocked.breakdown.secondaryStats.block = 100;
    const open = structuredClone(blocked);
    open.stats.block = 0;
    open.breakdown.secondaryStats.block = 0;
    const half = structuredClone(blocked);
    half.stats.block = 50;
    half.breakdown.secondaryStats.block = 50;

    const blockedResult = evaluateProfileSnapshot(blocked, data, "survival", 60, settings);
    const openResult = evaluateProfileSnapshot(open, data, "survival", 60, settings);
    const halfA = evaluateProfileSnapshot(half, data, "survival", 60, settings);
    const halfB = evaluateProfileSnapshot(half, data, "survival", 60, settings);

    expect(blockedResult.scenarios[0].metrics.timeAlive).toBe(10);
    expect(blockedResult.scenarios[0].metrics.blockRate).toBe(100);
    expect(openResult.scenarios[0].metrics.timeAlive).toBeLessThan(2);
    expect(openResult.scenarios[0].metrics.blockRate).toBe(0);
    expect(halfA.scenarios[0].metrics.blockRate).toBe(halfB.scenarios[0].metrics.blockRate);
    expect(Number(halfA.scenarios[0].metrics.blockRate)).toBeGreaterThan(35);
    expect(Number(halfA.scenarios[0].metrics.blockRate)).toBeLessThan(65);
  });

  it("exposes melee and ranged mob metrics from real battle data", async () => {
    const data = await loadGameData();
    data.raw["MainBattleLibrary.json"] = {
      test: { BattleId: { AgeIdx: 0, BattleIdx: 0 }, Waves: [{ Enemies: [{ Id: 1, Count: 2 }, { Id: 2, Count: 3 }] }] }
    };
    data.raw["EnemyAgeScalingLibrary.json"] = { 0: { Health: { Raw: 100 }, Damage: { Raw: 10 } } };
    data.raw["EnemyLibrary.json"] = {
      1: { WeaponId: { Age: 0, Idx: 0 } },
      2: { WeaponId: { Age: 0, Idx: 1 } }
    };
    data.raw["WeaponLibrary.json"] = {
      melee: { ItemId: { Age: 0, Type: "Weapon", Idx: 0 }, AttackRange: 0, AttackDuration: 1 },
      ranged: { ItemId: { Age: 0, Type: "Weapon", Idx: 1 }, AttackRange: 5, AttackDuration: 2 }
    };
    const profile = manualProfile("Mixed mobs", data);
    profile.base.attack = 1_000_000;
    profile.base.health = 1_000_000;
    const result = evaluateProfileSnapshot(profile, data, "progress", 60, {
      levelRange: { age: 1, combat: 1 },
      model: { trials: 2, seed: 7 }
    });
    const battle = result.scenarios.find((scenario) => scenario.label === "Combat cible")!;

    expect(battle.metrics.enemyMode).toBe("mixed");
    expect(battle.metrics.meleeEnemyCount).toBe(2);
    expect(battle.metrics.rangedEnemyCount).toBe(3);
    expect(Number(battle.metrics.meleeDps)).toBeGreaterThan(0);
    expect(Number(battle.metrics.rangedDps)).toBeGreaterThan(0);
  });

  it("makes melee walk into ranged waves before weapon damage starts", async () => {
    const data = await loadGameData();
    data.raw["MainBattleLibrary.json"] = {
      test: { BattleId: { AgeIdx: 0, BattleIdx: 0 }, Waves: [{ Enemies: [{ Id: 1, Count: 1 }] }] }
    };
    data.raw["EnemyAgeScalingLibrary.json"] = { 0: { Health: { Raw: 100 }, Damage: { Raw: 10_000 } } };
    data.raw["EnemyLibrary.json"] = { 1: { WeaponId: { Age: 0, Idx: 0 } } };
    data.raw["WeaponLibrary.json"] = {
      ranged: { ItemId: { Age: 0, Type: "Weapon", Idx: 0 }, AttackRange: 5, AttackDuration: 1 }
    };
    data.raw["ItemBalancingConfig.json"] = { EnemyRangedDamageMultiplier: 1 };

    const melee = manualProfile("Melee", data);
    melee.base.attack = 1_000;
    melee.base.health = 500;
    melee.breakdown.baseAttack = 1_000;
    melee.breakdown.baseHealth = 500;
    melee.base.weaponStyle = "melee";
    melee.spells = [];
    const meleeBattle = evaluateProfileSnapshot(melee, data, "progress", 60, {
      levelRange: { age: 1, combat: 1 },
      model: { blockMode: "average", trials: 1 }
    }).scenarios.find((scenario) => scenario.label === "Combat cible")!;

    const ranged = structuredClone(melee);
    ranged.base.weaponStyle = "ranged";
    const rangedBattle = evaluateProfileSnapshot(ranged, data, "progress", 60, {
      levelRange: { age: 1, combat: 1 },
      model: { blockMode: "average", trials: 1 }
    }).scenarios.find((scenario) => scenario.label === "Combat cible")!;

    expect(meleeBattle.success).toBe(false);
    expect(meleeBattle.metrics.clearedWaves).toBe(0);
    expect(meleeBattle.metrics.totalTime).toBeCloseTo(2.5, 3);
    expect(rangedBattle.success).toBe(true);
  });

  it("delays melee against melee waves without melee damage during approach", async () => {
    const data = await loadGameData();
    data.raw["MainBattleLibrary.json"] = {
      test: { BattleId: { AgeIdx: 0, BattleIdx: 0 }, Waves: [{ Enemies: [{ Id: 1, Count: 1 }] }] }
    };
    data.raw["EnemyAgeScalingLibrary.json"] = { 0: { Health: { Raw: 100 }, Damage: { Raw: 10_000 } } };
    data.raw["EnemyLibrary.json"] = { 1: { WeaponId: { Age: 0, Idx: 0 } } };
    data.raw["WeaponLibrary.json"] = {
      melee: { ItemId: { Age: 0, Type: "Weapon", Idx: 0 }, AttackRange: 0, AttackDuration: 1 }
    };

    const profile = manualProfile("Melee mirror", data);
    profile.base.attack = 1_000;
    profile.base.health = 500;
    profile.breakdown.baseAttack = 1_000;
    profile.breakdown.baseHealth = 500;
    profile.base.weaponStyle = "melee";
    profile.spells = [];
    const battle = evaluateProfileSnapshot(profile, data, "progress", 60, {
      levelRange: { age: 1, combat: 1 },
      model: { blockMode: "average", trials: 1 }
    }).scenarios.find((scenario) => scenario.label === "Combat cible")!;

    expect(battle.success).toBe(true);
    expect(Number(battle.metrics.totalTime)).toBeGreaterThan(2);
    expect(Number(battle.metrics.totalTime)).toBeLessThan(2.1);
  });

  it("reconstructs a 1vcian profile and evaluates recommendations", async () => {
    const data = await loadGameData();
    const raw = buildFixtureProfile(data);
    const profile = normalizeOneVcianProfile(raw, data);
    const result = evaluateProfile(profile, data, "progress");
    const snapshot = evaluateProfileSnapshot(profile, data, "progress");

    expect(profile.confidence).not.toBe("manual_required");
    expect(profile.base.attack).toBeGreaterThan(10);
    expect(profile.base.health).toBeGreaterThan(80);
    expect(profile.stats.damage).toBeGreaterThan(0);
    expect(profile.pets[0].secondaryStats).toHaveLength(1);
    expect(profile.mount?.secondaryStats).toHaveLength(1);
    expect(result.profile.totalDps).toBeGreaterThan(0);
    expect(result.scenarios.map((scenario) => scenario.id)).toEqual(["endurance", "timeToKill", "gauntlet"]);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some((recommendation) => recommendation.source === "Sorts")).toBe(true);
    expect(snapshot.score).toBeCloseTo(result.score, 8);
    expect(Object.hasOwn(snapshot, "recommendations")).toBe(false);
  });

  it("evaluates variable scenarios and ranks one-line stat mutations", async () => {
    const data = await loadGameData();
    const profile = normalizeOneVcianProfile(buildFixtureProfile(data), data);
    for (const item of Object.values(profile.equipment)) {
      if (item) item.age = 0;
    }
    const result = evaluateProfile(profile, data, "survival", 60, {
      levelRange: { min: 8, max: 15 },
      endurance: { startDamagePct: 8, growthPct: 0.8, maxSeconds: 300 },
      timeToKill: { targetSeconds: 35, incomingDamagePct: 1, maxSeconds: 240 },
      gauntlet: { mobCount: 5, firstMobSeconds: 7, firstDamagePct: 1.5, healthGrowthPct: 20, damageGrowthPct: 20 }
    });
    const endurance = result.scenarios.find((scenario) => scenario.id === "endurance");
    const lowLevel = evaluateProfile(profile, data, "survival", 60, { levelRange: { min: 1, max: 1 } });
    const highLevel = evaluateProfile(profile, data, "survival", 60, { levelRange: { min: 80, max: 80 } });
    const hardLevel = evaluateProfile(profile, data, "survival", 60, { levelRange: { min: 8, max: 15, difficulty: 1 } });

    expect(endurance?.metrics.timeAlive).toBeGreaterThan(0);
    expect(endurance?.metrics.age).toBe(8);
    expect(endurance?.metrics.combat).toBe(15);
    expect(endurance?.metrics.difficulty).toBe(0);
    expect(result.scenarios.find((scenario) => scenario.id === "gauntlet")?.metrics.realBattleData).toBe(1);
    expect(result.scenarios.find((scenario) => scenario.id === "gauntlet")?.metrics.waveCount).toBeGreaterThan(0);
    expect(highLevel.scenarios.find((scenario) => scenario.id === "timeToKill")?.metrics.mobHealth).toBeGreaterThan(lowLevel.scenarios.find((scenario) => scenario.id === "timeToKill")?.metrics.mobHealth || 0);
    expect(hardLevel.scenarios.find((scenario) => scenario.id === "timeToKill")?.metrics.mobHealth).toBeGreaterThan((result.scenarios.find((scenario) => scenario.id === "timeToKill")?.metrics.mobHealth || 0) * 1000);
    expect(result.recommendations.some((rec) => rec.source === "Objets")).toBe(true);
    expect(result.recommendations.filter((rec) => rec.source === "Objets").every((rec) => !rec.detail.includes("L2"))).toBe(true);
    expect(result.recommendations.filter((rec) => rec.source === "Pets").every((rec) => !rec.detail.includes("L2"))).toBe(true);
    expect(result.recommendations.filter((rec) => rec.source === "Monture").every((rec) => !rec.detail.includes("L2"))).toBe(true);
    expect(new Set(result.recommendations.map((rec) => rec.title)).size).toBe(result.recommendations.length);
    const recommendedPlacements = result.recommendations
      .map((recommendation) => recommendation.detail.match(/Meilleur changement: ([^,]+)/)?.[1])
      .filter((placement): placement is string => Boolean(placement));
    expect(new Set(recommendedPlacements).size).toBe(recommendedPlacements.length);
    expect(result.recommendations[0].gain).toBeGreaterThan(0);
    expect(result.recommendations[0].scenario).toBeTruthy();
  });

  it("uses PvP timing and produces bounded chance", async () => {
    const data = await loadGameData();
    const player = normalizeOneVcianProfile(buildFixtureProfile(data), data);
    const enemy = normalizeOneVcianProfile(buildFixtureProfile(data, "Enemy"), data);
    weakenProfile(enemy, 0.8);
    const result = evaluatePvp(player, enemy, data);

    expect(result.pvp.chance).toBeGreaterThanOrEqual(1);
    expect(result.pvp.chance).toBeLessThanOrEqual(99);
    expect(result.pvp.winner).toBe("player");
    expect(result.pvp.playerDamage).toBeGreaterThan(0);
    expect(result.pvp.playerSkillCasts).toBeGreaterThan(0);
    expect(result.pvp.strengths.length).toBeGreaterThan(0);
    expect(result.recommendations.some((recommendation) => recommendation.scenario === "Duel PvP" && recommendation.chanceDelta !== undefined)).toBe(true);
  });

  it("runs a symmetric timeline duel near fifty percent", async () => {
    const data = await loadGameData();
    const player = normalizeOneVcianProfile(buildFixtureProfile(data), data);
    const opponent = structuredClone(player);
    opponent.name = "Mirror";
    const result = evaluatePvp(player, opponent, data);

    expect(result.pvp.winner).toBe("draw");
    expect(result.pvp.chance).toBeCloseTo(50, 4);
    expect(result.pvp.playerDamage).toBeCloseTo(result.pvp.opponentDamage, 4);
    expect(result.pvp.playerSkillDamage).toBeCloseTo(result.pvp.opponentSkillDamage, 4);
  });

  it("applies PvP health multipliers and skill buffs during the duel", async () => {
    const data = await loadGameData();
    const player = manualProfile("Buffed", data);
    player.base.attack = 100;
    player.breakdown.baseAttack = 100;
    player.breakdown.baseHealth = 1000;
    player.breakdown.petHealth = 1000;
    player.breakdown.mountHealth = 1000;
    player.base.health = 3000;
    player.spells = [{ id: "Morale", level: 10 }];
    const opponent = manualProfile("Target", data);
    opponent.base.attack = 1;
    opponent.breakdown.baseAttack = 1;
    opponent.breakdown.baseHealth = 1000;
    opponent.base.health = 1000;
    const result = evaluatePvp(player, opponent, data);

    expect(result.pvp.player.maxHealth).toBeGreaterThan(3000);
    expect(result.pvp.player.weaponDps).toBeGreaterThan(result.pvp.player.baseWeaponDps);
    expect(result.pvp.playerSkillCasts).toBeGreaterThan(0);
  });

  it("applies buffs as temporary stats instead of direct spell damage", async () => {
    const data = await loadGameData();
    const profile = manualProfile("Buff test", data);
    profile.spells = [{ id: "Morale", level: 20 }];
    const result = evaluateProfile(profile, data, "progress");

    expect(result.profile.skillDps).toBe(0);
    expect(result.profile.weaponDps).toBeGreaterThan(result.profile.baseWeaponDps);
    expect(result.profile.maxHealth).toBeGreaterThan(result.profile.baseMaxHealth);
    expect(result.profile.skills[0]).toMatchObject({ kind: "buff", targetMode: "self" });
  });

  it("gives AOE skills their multi-target value in real battle waves", async () => {
    const data = await loadGameData();
    const arrows = data.normalized.spells.find((spell) => spell.id === "Arrows")!;
    const shout = data.normalized.spells.find((spell) => spell.id === "Shout")!;
    arrows.damageByLevel = Array(100).fill(25);
    shout.damageByLevel = Array(100).fill(25);
    arrows.cooldown = 3;
    shout.cooldown = 3;
    data.raw["MainBattleLibrary.json"] = {
      test: {
        BattleId: { AgeIdx: 0, BattleIdx: 0 },
        Waves: [{ Enemies: [{ Id: 0, Count: 5 }] }]
      }
    };
    data.raw["EnemyAgeScalingLibrary.json"] = {
      0: { Health: { Raw: 100_000 }, Damage: { Raw: 0 } }
    };

    const single = manualProfile("Single", data);
    single.base.attack = 1;
    single.base.health = 1_000_000;
    single.spells = [{ id: "Arrows", level: 1 }];
    const aoe = structuredClone(single);
    aoe.name = "AOE";
    aoe.spells = [{ id: "Shout", level: 1 }];

    const settings = { levelRange: { min: 1, max: 1 }, gauntlet: { maxSeconds: 20 } };
    const singleResult = evaluateProfile(single, data, "damage", 60, settings);
    const aoeResult = evaluateProfile(aoe, data, "damage", 60, settings);
    const singleWave = singleResult.scenarios.find((scenario) => scenario.id === "gauntlet")!;
    const aoeWave = aoeResult.scenarios.find((scenario) => scenario.id === "gauntlet")!;

    expect(aoeWave.metrics.aoeDamage).toBeGreaterThan(0);
    expect(aoeWave.metrics.skillDamage).toBeGreaterThan(singleWave.metrics.skillDamage);
  });

  it("compares a manual drop without mutating the source profile", async () => {
    const data = await loadGameData();
    const profile = normalizeOneVcianProfile(buildFixtureProfile(data), data);
    const before = profile.base.attack;
    const comparison = compareDrop(profile, {
      slot: "Weapon",
      name: "Better weapon",
      attack: profile.equipment.Weapon!.attack * 1.15,
      secondaryStats: [{ stat: "damage", value: 15 }]
    }, data);

    expect(comparison.dropScore).toBeGreaterThan(comparison.currentScore);
    expect(profile.base.attack).toBe(before);
  });

  it("keeps a zero-value secondary line when comparing a drop", async () => {
    const data = await loadGameData();
    const profile = normalizeOneVcianProfile(buildFixtureProfile(data), data);
    const weapon = profile.equipment.Weapon!;
    weapon.secondaryStats = [{ stat: "damage", sourceId: "DamageMulti", value: 100000 }];
    profile.breakdown.secondaryStats.damage = 0;

    const comparison = compareDrop(profile, {
      slot: "Weapon",
      name: "Same weapon without roll",
      attack: weapon.attack,
      health: weapon.health,
      secondaryStats: [{ stat: "damage", value: 0 }]
    }, data, "damage");

    expect(comparison.verdict).toBe("worse");
    expect(comparison.dropScore).toBeLessThan(comparison.currentScore);
  });

  it("compares pet and mount drops without mutating the source profile", async () => {
    const data = await loadGameData();
    const profile = normalizeOneVcianProfile(buildFixtureProfile(data), data);
    const petAttack = profile.pets[0].attack;
    const mountHealth = profile.mount!.health;

    const petComparison = compareDrop(profile, {
      target: "pet",
      petIndex: 0,
      rarity: "Legendary",
      attack: petAttack * 1.2,
      health: profile.pets[0].health,
      secondaryStats: [{ stat: "damage", value: 10 }]
    }, data);
    const mountComparison = compareDrop(profile, {
      target: "mount",
      rarity: "Legendary",
      attack: profile.mount!.attack,
      health: mountHealth * 1.2,
      secondaryStats: [{ stat: "health", value: 10 }]
    }, data, "survival");

    expect(petComparison.dropScore).toBeGreaterThan(petComparison.currentScore);
    expect(mountComparison.dropScore).toBeGreaterThan(mountComparison.currentScore);
    expect(profile.pets[0].attack).toBe(petAttack);
    expect(profile.mount!.health).toBe(mountHealth);
  });

  it("reconstructs displayed companion level one from the first upgrade row", async () => {
    const data = await loadGameData();
    const raw = buildFixtureProfile(data);
    raw.pets.active[0].level = 1;
    raw.mount.active.level = 1;
    raw.techTree = { Forge: {}, Power: {}, SkillsPetTech: {} };
    const profile = normalizeOneVcianProfile(raw, data);
    const petModel = data.normalized.petModels.find((model) => model.rarity === "Common" && model.id === 0)!;
    const petLevel = data.normalized.petLevels.find((group) => group.rarity === "Common")!.levels[0];
    const mountLevel = data.normalized.mountLevels.find((group) => group.rarity === "Common")!.levels[0];
    const petAttackMultiplier = petModel.type === "Damage" ? 1.5 : petModel.type === "Health" ? 0.5 : 1;
    const petHealthMultiplier = petModel.type === "Damage" ? 0.5 : petModel.type === "Health" ? 1.5 : 1;

    expect(profile.pets[0].attack).toBeCloseTo(petLevel.attack * petAttackMultiplier, 5);
    expect(profile.pets[0].health).toBeCloseTo(petLevel.health * petHealthMultiplier, 5);
    expect(profile.mount!.attack).toBeCloseTo(mountLevel.attack, 5);
    expect(profile.mount!.health).toBeCloseTo(mountLevel.health, 5);
  });

  it("compares a pet drop against all three equipped positions", async () => {
    const data = await loadGameData();
    const profile = normalizeOneVcianProfile(buildFixtureProfile(data), data);
    profile.pets = [
      { ...structuredClone(profile.pets[0]), attack: 10, health: 100 },
      { ...structuredClone(profile.pets[0]), attack: 20, health: 100 },
      { ...structuredClone(profile.pets[0]), attack: 30, health: 100 }
    ];
    const before = structuredClone(profile.pets);
    const comparison = compareDrop(profile, {
      target: "pet",
      rarity: "Legendary",
      id: 0,
      petType: "Damage",
      level: 30,
      attack: 40,
      health: 100,
      secondaryStats: [{ stat: "damage", value: 10 }]
    }, data);

    expect(comparison.candidates).toHaveLength(3);
    expect(comparison.candidates?.map((candidate) => candidate.petIndex)).toEqual([0, 1, 2]);
    expect(comparison.bestPetIndex).toBe(0);
    expect(profile.pets).toEqual(before);
  });

  it("creates all stat keys at zero", () => {
    const stats = createEmptyStats();
    expect(Object.keys(stats)).toHaveLength(13);
    expect(Object.values(stats).every((value) => value === 0)).toBe(true);
  });
});

function buildFixtureProfile(data: Awaited<ReturnType<typeof loadGameData>>, name = "Fixture") {
  const items = Object.fromEntries(
    Object.entries(slotToJsonType).map(([slot, jsonType]) => {
      const item = Object.values<any>(data.raw["ItemBalancingLibrary.json"]).find((entry) => entry.ItemId?.Type === jsonType && Number(entry.EquipmentStats?.[0]?.Value || 0) > 0);
      return [slot, {
        age: item.ItemId.Age,
        idx: item.ItemId.Idx,
        level: 12,
        rarity: slot,
        secondaryStats: [
          { statId: "DamageMulti", value: 0.12 },
          { statId: "CriticalChance", value: 0.05 }
        ]
      }];
    })
  );

  return {
    name,
    items,
    pets: {
      active: [
        { rarity: "Common", id: 0, level: 8, secondaryStats: [{ statId: "HealthMulti", value: 0.1 }, { statId: "DamageMulti", value: 0.1 }] },
        { rarity: "Rare", id: 0, level: 4, secondaryStats: [{ statId: "AttackSpeed", value: 0.12 }] }
      ]
    },
    mount: {
      active: { rarity: "Common", id: 0, level: 5, skills: [], secondaryStats: [{ statId: "BlockChance", value: 0.03 }, { statId: "CriticalChance", value: 0.04 }] }
    },
    skills: {
      equipped: [
        { id: "Arrows", level: 20 },
        { id: "Shuriken", level: 15 },
        { id: "Meat", level: 10 }
      ]
    },
    techTree: {
      Forge: { 0: 1, 1: 1 },
      Power: { 0: 2, 1: 1, 2: 1 },
      SkillsPetTech: { 1: 2, 5: 1 }
    }
  };
}

function weakenProfile(profile: ReturnType<typeof normalizeOneVcianProfile>, factor: number) {
  profile.breakdown.baseAttack = profile.base.attack * factor;
  profile.breakdown.baseHealth = profile.base.health * factor;
  profile.breakdown.equipmentAttack = 0;
  profile.breakdown.equipmentHealth = 0;
  profile.breakdown.petAttack = 0;
  profile.breakdown.petHealth = 0;
  profile.breakdown.mountAttack = 0;
  profile.breakdown.mountHealth = 0;
  for (const slot of Object.keys(profile.equipment) as Array<keyof typeof profile.equipment>) {
    profile.equipment[slot] = null;
  }
  profile.pets = [];
  profile.mount = null;
}
