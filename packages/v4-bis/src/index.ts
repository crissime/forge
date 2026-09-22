import {
  evaluateCombatVerdict,
  type CombatVerdict,
  type CombatVerdictOptions,
  type FightPoint,
  type NormalizedProfile,
  type V4GameDataInput
} from "../../v4-core/src/index.js";

export * from "./build.js";

export type BisCandidate = {
  id: string;
  profile: NormalizedProfile;
  build?: unknown;
};

export type BisEvaluation<T extends BisCandidate = BisCandidate> = {
  candidate: T;
  verdict: CombatVerdict;
  relativeHealth: number | null;
};

export type BisSearchInput<T extends BisCandidate, C> = {
  context: C;
  data: V4GameDataInput;
  point: FightPoint;
  options?: CombatVerdictOptions;
  candidates: Iterable<T>;
  budget: { maxEvaluations: number; maxTimeMs?: number };
  exactCandidateCount?: number;
};

export type BisSearchResult<T extends BisCandidate, C> = {
  policy: "pve-pass-time-relative-hp-waves-damage-id-v1";
  context: C;
  point: FightPoint;
  options: CombatVerdictOptions;
  budget: BisSearchInput<T, C>["budget"];
  exactCandidateCount: number | null;
  evaluatedCount: number;
  exhaustive: boolean;
  stopReason: "exhausted" | "evaluation_budget" | "time_budget";
  outcome: "pass_found" | "no_pass_found" | "no_valid_candidate";
  best: BisEvaluation<T> | null;
  ranked: BisEvaluation<T>[];
  excluded: BisEvaluation<T>[];
};

/** Only searches the supplied space. Profiles must already contain rebuilt totals. */
export function searchBis<T extends BisCandidate, C>(
  input: BisSearchInput<T, C>
): BisSearchResult<T, C> {
  const budget = { ...input.budget };
  requireCount(budget.maxEvaluations, "budget.maxEvaluations");
  const exact = input.exactCandidateCount;
  if (exact !== undefined) requireCount(exact, "exactCandidateCount");
  if (budget.maxTimeMs !== undefined &&
      (!Number.isFinite(budget.maxTimeMs) || budget.maxTimeMs < 0)) {
    throw new RangeError("budget.maxTimeMs must be finite and nonnegative");
  }
  const context = structuredClone(input.context);
  const point = structuredClone(input.point);
  const options = structuredClone(input.options ?? {});
  const ranked: BisEvaluation<T>[] = [];
  const excluded: BisEvaluation<T>[] = [];
  const ids = new Set<string>();
  const start = budget.maxTimeMs === undefined ? 0 : performance.now();
  const timedOut = () => budget.maxTimeMs !== undefined &&
    performance.now() - start >= budget.maxTimeMs;
  const iterator = input.candidates[Symbol.iterator]();
  let evaluatedCount = 0;
  let stopReason: BisSearchResult<T, C>["stopReason"] = "evaluation_budget";
  let exhausted = false;

  try {
    while (true) {
      // Verify the declared boundary with one pull, never another combat.
      if (exact !== undefined && evaluatedCount === exact) {
        if (timedOut()) {
          stopReason = "time_budget";
          break;
        }
        if (!iterator.next().done) {
          throw new Error("Iterable contains more candidates than exactCandidateCount");
        }
        stopReason = "exhausted";
        exhausted = true;
        break;
      }
      if (evaluatedCount >= budget.maxEvaluations) break;
      if (timedOut()) {
        stopReason = "time_budget";
        break;
      }
      const next = iterator.next();
      if (next.done) {
        if (exact !== undefined && evaluatedCount !== exact) {
          throw new Error("Iterable ended before exactCandidateCount");
        }
        stopReason = "exhausted";
        exhausted = true;
        break;
      }
      // next() and a synchronous combat cannot be preempted by this soft limit.
      if (timedOut()) {
        stopReason = "time_budget";
        break;
      }
      const candidate = structuredClone(next.value);
      if (typeof candidate.id !== "string" || candidate.id.length === 0 || ids.has(candidate.id)) {
        throw new Error("Candidate ids must be nonempty, unique canonical strings");
      }
      ids.add(candidate.id);
      if (input.data.version === "2.9.0" && candidate.profile.fairy === undefined) {
        throw new Error("BIS 2.9.0 requires explicit profile.fairy (null means no fairy)");
      }
      const verdict = evaluateCombatVerdict(candidate.profile, input.data, point, options);
      evaluatedCount++;
      const entry: BisEvaluation<T> = { candidate, verdict, relativeHealth: null };
      if (verdict.reason === "invalid_input" || verdict.reason === "missing_data") {
        excluded.push(entry);
        continue;
      }
      if (verdict.passed) {
        const maxHealth = verdict.metrics.playerMaxHealth;
        if (typeof maxHealth !== "number" || !Number.isFinite(maxHealth) || maxHealth <= 0) {
          throw new Error("Core contract: passing verdict requires metrics.playerMaxHealth > 0");
        }
        entry.relativeHealth = verdict.remainingHealth / maxHealth;
      }
      ranked.push(entry);
    }
  } finally {
    // Release generators even on budget interruption or malformed input.
    if (!exhausted) iterator.return?.();
  }

  ranked.sort(compare);
  const best = ranked[0] ?? null;
  return {
    policy: "pve-pass-time-relative-hp-waves-damage-id-v1",
    context, point, options, budget,
    exactCandidateCount: exact ?? null,
    evaluatedCount,
    exhaustive: exhausted,
    stopReason,
    outcome: best?.verdict.passed ? "pass_found" : best ? "no_pass_found" : "no_valid_candidate",
    best, ranked, excluded
  };
}

function compare(a: BisEvaluation, b: BisEvaluation): number {
  const av = a.verdict;
  const bv = b.verdict;
  if (av.passed !== bv.passed) return av.passed ? -1 : 1;
  const score = av.passed
    ? av.timeSeconds - bv.timeSeconds || b.relativeHealth! - a.relativeHealth!
    : bv.clearedWaves - av.clearedWaves || bv.damageDone - av.damageDone;
  return score || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0);
}

function requireCount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a nonnegative safe integer`);
  }
}
