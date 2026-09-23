import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { loadFamilyPilotContext } from "./run-bis-family-pilot.mjs";
import { playPair, standings } from "./run-pvp-finalists.mjs";

test("wins, losses and half-point draws are accounted symmetrically", () => {
  const candidates = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const rows = standings(candidates, [
    { a: "a", b: "b", aWins: 3, bWins: 1, draws: 2 },
    { a: "a", b: "c", aWins: 4, bWins: 2, draws: 0 },
    { a: "b", b: "c", aWins: 0, bWins: 6, draws: 0 }
  ]);
  assert.deepEqual(rows.map((r) => r.candidate.id), ["c", "a", "b"]);
  assert.equal(rows[0].score, 8 / 12);
  assert.equal(rows.reduce((n, r) => n + r.wins, 0), rows.reduce((n, r) => n + r.losses, 0));
  assert.ok(rows.every((r) => r.fights === 12));
});

test("swapping pair labels inverts outcomes and preserves both positions", () => {
  const c = loadFamilyPilotContext(resolve("v4/config/bis-family-pilot-2.9.0.json"));
  const a = c.candidates.find((p) => p.dimensions.fairy === "Mira" && p.dimensions.style === "melee");
  const b = c.candidates.find((p) => p.dimensions.fairy === "Lora" && p.dimensions.style === "ranged");
  const ab = playPair(a, b, c.data, 16), ba = playPair(b, a, c.data, 16);
  assert.equal(ab.aWins, ba.bWins);
  assert.equal(ab.bWins, ba.aWins);
  assert.equal(ab.draws, ba.draws);
  assert.equal(ab.aWins + ab.bWins + ab.draws, 32);
  assert.deepEqual(playPair(a, b, c.data, 16), ab);
});
