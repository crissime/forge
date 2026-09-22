import assert from "node:assert/strict";
import test from "node:test";
import { assessReadiness, requiredGates } from "./prepare-bis-batch.mjs";

const policy = () => ({
  schema: "forge-master-v4-bis-gates-v1", gameVersion: "2.9.0",
  gates: requiredGates.map((id) => ({ id, status: "verified", evidence: ["proof"] }))
});
const checks = [{ id: "tests", passed: true }];

test("technical checks alone cannot authorize an incomplete batch", () => {
  const input = policy();
  input.gates.find(({ id }) => id === "fairy_season").status = "candidate";
  const result = assessReadiness(checks, input, () => true);
  assert.equal(result.status, "blocked");
  assert.equal(result.blockers[0].id, "fairy_season");
  assert.equal(result.batchStarted, false);
});

test("an omitted or duplicated prerequisite is blocking", () => {
  const input = policy();
  input.gates.pop();
  input.gates.push(input.gates[0]);
  const result = assessReadiness(checks, input, () => true);
  assert.equal(result.blockers.length, 2);
});

test("failed checks, missing evidence and no checks remain blocking", () => {
  assert.equal(assessReadiness([{ id: "test", passed: false }], policy(), () => true).status, "blocked");
  assert.equal(assessReadiness(checks, policy(), () => false).status, "blocked");
  assert.equal(assessReadiness([], policy(), () => true).status, "blocked");
});

test("a complete dossier requests review, never starts a batch", () => {
  assert.deepEqual(assessReadiness(checks, policy(), () => true), {
    status: "ready_for_review", batchStarted: false, blockers: []
  });
});
