import { afterEach, describe, expect, it, vi } from "vitest";
import * as core from "../../v4-core/src/index.js";
import { searchBis, type BisCandidate } from "../src/index.js";

const point: core.FightPoint = { age: 1, combat: 1, difficulty: "normal" };
const options: core.CombatVerdictOptions = { maxSeconds: 5, blockMode: "rng", seed: 42 };
const context = { caseId: "synthetic-oracle", experimental: true };

function candidate(id: string, attack = 1, health = 1000): BisCandidate {
  return {
    id, build: { label: id },
    profile: {
      name: id, base: { attack, health },
      equipment: { Weapon: { age: 0, idx: 1 } },
      stats: {}, breakdown: {}, talentTree: {}, pets: [], spells: []
    }
  };
}

// Combat fixtures only, not a legal equipment catalogue or a BIS generator.
function data(): core.V4GameDataInput {
  return {
    version: "fixture",
    tables: {
      MainBattleLibrary: [{
        BattleId: { AgeIdx: 0, BattleIdx: 0 },
        Waves: [{ WaveIdx: 0, Enemies: [{ Id: 1, Count: 1 }] }]
      }],
      EnemyAgeScalingLibrary: [{ AgeIdx: 0, Health: { Raw: 10000 }, Damage: { Raw: 1000 } }],
      EnemyLibrary: [{ EnemyIdx: 1, WeaponId: { Age: 0, Idx: 0 } }],
      WeaponLibrary: [0, 1].map((idx) => ({
        ItemId: { Age: 0, Idx: idx, Type: "Weapon" },
        AttackRange: 20, WindupTime: 0.1, AttackDuration: 1,
        IsRanged: false, ProjectileId: -1
      })),
      ProjectilesLibrary: [],
      MainBattleConfig: { EnemyHpDifficultyMulti: 6000000, EnemyDmgDifficultyMulti: 6000000 },
      ItemBalancingConfig: { PlayerBaseCritDamage: 0.2 },
      SkillLibrary: {}, SkillBaseConfig: { SkillSlotsCount: 3 }
    }
  };
}

function run(candidates: Iterable<BisCandidate>, extra: Partial<Parameters<typeof searchBis<BisCandidate, typeof context>>[0]> = {}) {
  return searchBis({ context, data: data(), point, options, candidates, budget: { maxEvaluations: 20 }, ...extra });
}

function verdict(overrides: Partial<core.CombatVerdict> = {}): core.CombatVerdict {
  return {
    point, passed: true, reason: "cleared", clearedWaves: 1, waveCount: 1,
    timeSeconds: 2, maxSeconds: 5, remainingHealth: 90, damageDone: 100,
    blockMode: "rng", seed: 42, issues: [], metrics: { playerMaxHealth: 100 },
    ...overrides
  };
}

afterEach(() => vi.restoreAllMocks());

describe("BIS search over prepared candidates", () => {
  it("agrees with an independent small exhaustive official-combat oracle", () => {
    const candidates = [candidate("low", 0.1), candidate("high", 1), candidate("dead", 0.01, 1)];
    const bundle = data();
    const oracle = candidates.map((c) => ({ id: c.id, verdict: core.evaluateCombatVerdict(c.profile, bundle, point, options) }));
    expect(oracle.every((c) => ["dead", "timeout"].includes(c.verdict.reason))).toBe(true);
    oracle.sort((a, b) => b.verdict.clearedWaves - a.verdict.clearedWaves ||
      b.verdict.damageDone - a.verdict.damageDone || (a.id < b.id ? -1 : 1));
    const result = run(candidates, { data: bundle, exactCandidateCount: candidates.length });
    expect(result.ranked.map((e) => e.candidate.id)).toEqual(oracle.map((e) => e.id));
    expect(result.best?.candidate.id).toBe("high");
    expect(result).toMatchObject({ exhaustive: true, stopReason: "exhausted", outcome: "no_pass_found", evaluatedCount: 3 });
    for (const entry of result.ranked) {
      expect(entry.verdict).toEqual(core.evaluateCombatVerdict(entry.candidate.profile, bundle, result.point, result.options));
    }
  });

  it("orders passes by time then relative HP, not absolute HP, then canonical id", () => {
    const outcomes: Record<string, core.CombatVerdict> = {
      slow: verdict({ timeSeconds: 3 }),
      absolute: verdict({ remainingHealth: 800, metrics: { playerMaxHealth: 1000 } }),
      z: verdict(), a: verdict(),
      fast: verdict({ timeSeconds: 1, remainingHealth: 1 }),
      fail: verdict({ passed: false, reason: "timeout", damageDone: 1e9 })
    };
    vi.spyOn(core, "evaluateCombatVerdict").mockImplementation((p) => outcomes[p.name!]);
    const candidates = Object.keys(outcomes).map((id) => candidate(id));
    expect(run(candidates).ranked.map((e) => e.candidate.id))
      .toEqual(["fast", "a", "z", "absolute", "slow", "fail"]);
    expect(run([...candidates].reverse()).ranked).toEqual(run(candidates).ranked);
  });

  it("orders failures by cleared waves then damage then id, never time or HP", () => {
    const outcomes = [
      verdict({ passed: false, reason: "dead", clearedWaves: 1, damageDone: 50, remainingHealth: 0 }),
      verdict({ passed: false, reason: "timeout", clearedWaves: 0, damageDone: 999 }),
      verdict({ passed: false, reason: "timeout", clearedWaves: 1, damageDone: 60 }),
      verdict({ passed: false, reason: "timeout", clearedWaves: 1, damageDone: 60 })
    ];
    vi.spyOn(core, "evaluateCombatVerdict").mockImplementationOnce(() => outcomes[0])
      .mockImplementationOnce(() => outcomes[1]).mockImplementationOnce(() => outcomes[2])
      .mockImplementationOnce(() => outcomes[3]);
    expect(run([candidate("dead"), candidate("huge"), candidate("z"), candidate("a")]).ranked.map((e) => e.candidate.id))
      .toEqual(["a", "z", "dead", "huge"]);
  });

  it("counts and excludes real invalid_input and missing_data verdicts", () => {
    const invalid = candidate("invalid", 0);
    const missing = candidate("missing");
    missing.profile.equipment.Weapon = { age: 99, idx: 99 };
    const result = run([invalid, missing]);
    expect(result).toMatchObject({ evaluatedCount: 2, best: null, ranked: [], exhaustive: true, outcome: "no_valid_candidate" });
    expect(result.excluded.map((e) => e.verdict.reason)).toEqual(["invalid_input", "missing_data"]);
    expect(run([invalid, missing, candidate("valid")], { budget: { maxEvaluations: 2 } }).stopReason).toBe("evaluation_budget");
  });

  it("does not evaluate or pull one extra candidate at the count boundary", () => {
    let pulled = 0;
    let closed = false;
    function* candidates() {
      try {
        while (true) { pulled++; yield candidate(String(pulled)); }
      } finally { closed = true; }
    }
    const result = run(candidates(), { budget: { maxEvaluations: 2 } });
    expect(result).toMatchObject({ evaluatedCount: 2, exhaustive: false, stopReason: "evaluation_budget" });
    expect(pulled).toBe(2);
    expect(closed).toBe(true);
  });

  it("verifies the declared exact boundary before claiming exhaustion", () => {
    const candidates = [candidate("one")];
    expect(run(candidates, { budget: { maxEvaluations: 1 } }).exhaustive).toBe(false);
    expect(run(candidates, { budget: { maxEvaluations: 1 }, exactCandidateCount: 1 }))
      .toMatchObject({ exhaustive: true, stopReason: "exhausted" });
  });

  it.each([0, 1])("rejects declared count %s with an extra candidate, without evaluating the extra", (exact) => {
    const evaluate = vi.spyOn(core, "evaluateCombatVerdict");
    expect(() => run([candidate("a"), candidate("b")], {
      budget: { maxEvaluations: exact }, exactCandidateCount: exact
    })).toThrow(/more candidates than exactCandidateCount/);
    expect(evaluate).toHaveBeenCalledTimes(exact);
  });

  it("does not probe declared exhaustion after the soft deadline", () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValue(10);
    const next = vi.fn(() => ({ done: true as const, value: undefined }));
    const result = run({ [Symbol.iterator]: () => ({ next }) }, {
      budget: { maxEvaluations: 0, maxTimeMs: 10 }, exactCandidateCount: 0
    });
    expect(next).not.toHaveBeenCalled();
    expect(result).toMatchObject({ exhaustive: false, stopReason: "time_budget" });
  });

  it("handles empty space and zero budget without inventing an impossibility", () => {
    expect(run([])).toMatchObject({ best: null, exhaustive: true, outcome: "no_valid_candidate" });
    expect(run([], { budget: { maxEvaluations: 0 } })).toMatchObject({ exhaustive: false, stopReason: "evaluation_budget" });
    expect(run([], { budget: { maxEvaluations: 0 }, exactCandidateCount: 0 })).toMatchObject({ exhaustive: true });
  });

  it("repeats the entire count-bounded result and replays official RNG verdicts", () => {
    const candidates = [candidate("a"), candidate("b", 2), candidate("c", 3)];
    candidates.forEach((c) => { c.profile.stats.block = 50; });
    const result = run(candidates, { budget: { maxEvaluations: 2 } });
    expect(run(candidates, { budget: { maxEvaluations: 2 } })).toEqual(result);
    for (const entry of result.ranked) {
      expect(core.evaluateCombatVerdict(entry.candidate.profile, data(), result.point, result.options)).toEqual(entry.verdict);
    }
  });

  it("does not mutate inputs and retains detached build/profile/context snapshots", () => {
    const c = candidate("a");
    const input = { context: structuredClone(context), data: data(), point: { ...point }, options: { ...options }, candidates: [c], budget: { maxEvaluations: 2 } };
    const before = structuredClone(input);
    const result = searchBis(input);
    expect(input).toEqual(before);
    c.profile.stats.health = 100;
    (c.build as { label: string }).label = "changed";
    input.context.caseId = "changed";
    input.point.age = 99;
    input.options.seed = 123;
    expect(result.ranked[0].candidate).toEqual(before.candidates[0]);
    expect(result.context).toEqual(before.context);
    expect(result.point).toEqual(before.point);
    expect(result.options).toEqual(before.options);
  });

  it("snapshots a reused mutable candidate before advancing its producer", () => {
    const c = candidate("a");
    function* candidates() {
      yield c;
      c.id = "b";
      c.profile.base!.attack = 2;
      yield c;
    }
    const result = run(candidates());
    expect(result.ranked.find((e) => e.candidate.id === "a")?.candidate.profile.base?.attack).toBe(1);
  });

  it("separates a search time interruption from a combat timeout", () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(0)
      .mockReturnValueOnce(0).mockReturnValue(10);
    const result = run([candidate("a"), candidate("b")], { budget: { maxEvaluations: 20, maxTimeMs: 10 } });
    expect(result).toMatchObject({ evaluatedCount: 1, stopReason: "time_budget", exhaustive: false });
    expect(result.best?.verdict.reason).toBe("timeout");
  });

  it("does not launch a combat when candidate production consumed the soft deadline", () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(10);
    const result = run([candidate("a")], { budget: { maxEvaluations: 20, maxTimeMs: 10 } });
    expect(result).toMatchObject({ evaluatedCount: 0, stopReason: "time_budget", exhaustive: false });
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid count %s", (count) => {
    expect(() => run([], { budget: { maxEvaluations: count } })).toThrow(RangeError);
    expect(() => run([], { exactCandidateCount: count })).toThrow(RangeError);
  });

  it("rejects an invalid deadline, duplicate ids and observable count mismatch", () => {
    expect(() => run([], { budget: { maxEvaluations: 1, maxTimeMs: -1 } })).toThrow(RangeError);
    expect(() => run([candidate("a"), candidate("a")])).toThrow(/unique/);
    expect(() => run([candidate("")])).toThrow(/nonempty/);
    expect(() => run([], { exactCandidateCount: 1 })).toThrow(/exactCandidateCount/);
  });

  it("requires the official maximum-health metric, never duplicates core stat formulas", () => {
    vi.spyOn(core, "evaluateCombatVerdict").mockReturnValue(verdict({ metrics: {} }));
    expect(() => run([candidate("a")])).toThrow(/metrics.playerMaxHealth/);
  });

  it("replays a passing official verdict with the core-provided maximum health", () => {
    const c = candidate("pass", 1000);
    const official = core.evaluateCombatVerdict(c.profile, data(), point, options);
    expect(official.passed).toBe(true);
    expect(typeof official.metrics.playerMaxHealth).toBe("number");
    expect(run([c]).best?.verdict).toEqual(official);
    expect(run([c]).best?.relativeHealth).toBe(official.remainingHealth / Number(official.metrics.playerMaxHealth));
  });

  it("rejects unspecified fairy state in 2.9.0 before calling the official evaluator", () => {
    const evaluate = vi.spyOn(core, "evaluateCombatVerdict");
    const bundle = { ...data(), version: "2.9.0" };
    expect(() => run([candidate("missing")], { data: bundle })).toThrow(/explicit profile.fairy/);
    const undefinedState = candidate("undefined");
    undefinedState.profile.fairy = undefined;
    expect(() => run([undefinedState], { data: bundle })).toThrow(/explicit profile.fairy/);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("allows explicit no-fairy baseline in 2.9.0 and leaves earlier versions unaffected", () => {
    const baseline = candidate("baseline");
    Object.assign(baseline.profile, { fairy: null });
    const bundle = { ...data(), version: "2.9.0" };
    expect(run([baseline], { data: bundle }).best?.verdict)
      .toEqual(core.evaluateCombatVerdict(baseline.profile, bundle, point, options));
    expect(run([candidate("old")], { data: { ...data(), version: "2.8.2" } }).evaluatedCount).toBe(1);
    expect(run([candidate("fixture")]).evaluatedCount).toBe(1);
  });
});
