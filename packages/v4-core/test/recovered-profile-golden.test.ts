import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadV4GameData } from "../../v4-game-data/src/index";
import { evaluateCombatVerdict, evaluatePvpVerdict } from "../src/index";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECOVERED_EXPORTS = [
  "1-brandon-profil-manuel.forge-master.json",
  "10-brandon-profil-manuel.forge-master-1.forge-master.json",
  "12-elkikito-profil-manuel.forge-master.json",
  "14-natakku-profil-manuel.forge-master.json"
];

describe("recovered profile golden verdict", () => {
  it("keeps Elkikito 9-10 normal cleared just before 120 seconds", () => {
    const exported = JSON.parse(readFileSync(
      join(repoRoot, "profile/12-elkikito-profil-manuel.forge-master.json"),
      "utf8"
    ));
    const verdict = evaluateCombatVerdict(
      exported.profile,
      loadV4GameData(),
      { age: 9, combat: 10, difficulty: "normal" },
      { maxSeconds: 120 }
    );

    expect(verdict).toMatchObject({
      passed: true,
      reason: "cleared",
      clearedWaves: 3,
      waveCount: 3,
      timeSeconds: 119.3,
      remainingHealth: 804_684.504412,
      damageDone: 11_980_911.23442,
      metrics: {
        engine: "v4-spatial-skills-11",
        dataVersion: "2.8.2",
        attacks: 176,
        skillActivations: 41,
        skillHits: 409
      }
    });
  });

  it("keeps the recovered Shuriken profile deterministic on 9-10 normal", () => {
    const exported = JSON.parse(readFileSync(
      join(repoRoot, "profile/1-brandon-profil-manuel.forge-master.json"),
      "utf8"
    ));
    const verdict = evaluateCombatVerdict(
      exported.profile,
      loadV4GameData(),
      { age: 9, combat: 10, difficulty: "normal" },
      { maxSeconds: 120 }
    );

    expect(verdict).toMatchObject({
      passed: false,
      reason: "dead",
      clearedWaves: 0,
      waveCount: 3,
      timeSeconds: 11.4,
      remainingHealth: 0,
      damageDone: 1_372_706.534829,
      metrics: {
        engine: "v4-spatial-skills-11",
        dataVersion: "2.8.2",
        attacks: 15,
        projectiles: 10,
        skillActivations: 5,
        skillHits: 58
      }
    });
  });

  it("keeps the recovered aiming ranged profile deterministic", () => {
    const exported = JSON.parse(readFileSync(
      join(repoRoot, "profile/10-brandon-profil-manuel.forge-master-1.forge-master.json"),
      "utf8"
    ));
    const verdict = evaluateCombatVerdict(
      exported.profile,
      loadV4GameData(),
      { age: 9, combat: 10, difficulty: "normal" },
      { maxSeconds: 120, skillActivationPolicy: "auto_when_ready" }
    );

    expect(verdict).toMatchObject({
      passed: false,
      reason: "dead",
      clearedWaves: 1,
      timeSeconds: 23.4,
      remainingHealth: 0,
      damageDone: 6_773_063.052275,
      metrics: {
        engine: "v4-spatial-skills-11",
        attacks: 62,
        projectiles: 50,
        skillActivations: 7,
        skillHits: 78
      }
    });
  });

  it("keeps the recovered fixed ranged profile deterministic", () => {
    const exported = JSON.parse(readFileSync(
      join(repoRoot, "profile/14-natakku-profil-manuel.forge-master.json"),
      "utf8"
    ));
    const verdict = evaluateCombatVerdict(
      exported.profile,
      loadV4GameData(),
      { age: 9, combat: 10, difficulty: "normal" },
      { maxSeconds: 120, skillActivationPolicy: "auto_when_ready" }
    );

    expect(verdict).toMatchObject({
      passed: true,
      reason: "cleared",
      clearedWaves: 3,
      timeSeconds: 29.9,
      remainingHealth: 2_878_461.162938,
      damageDone: 13_418_973.30261,
      metrics: {
        engine: "v4-spatial-skills-11",
        attacks: 64,
        projectiles: 54,
        skillActivations: 7,
        skillHits: 48
      }
    });
  });
});

describe("recovered profile PvP compatibility", () => {
  it("uses existing exports and identifies only the missing weapon in incomplete ones", () => {
    const data = loadV4GameData();
    let simulated = 0;
    let missingWeapon = 0;

    for (const file of RECOVERED_EXPORTS) {
      const exported = JSON.parse(readFileSync(join(repoRoot, "profile", file), "utf8"));
      const verdict = evaluatePvpVerdict(exported.profile, exported.profile, data, {
        skillActivationPolicy: "disabled"
      });
      if (verdict.reason === "invalid_input") {
        expect(verdict.issues[0], file).toMatchObject({
          code: "missing_profile_weapon",
          path: "player.equipment.Weapon"
        });
        missingWeapon += 1;
      } else {
        expect(["knockout", "timeout"], file).toContain(verdict.reason);
        expect(verdict.winner, file).not.toBeNull();
        expect(verdict.metrics.dataVersion, file).toBe("2.8.2");
        simulated += 1;
      }
    }
    expect({ simulated, missingWeapon }).toEqual({ simulated: 4, missingWeapon: 0 });
  });

  it("keeps existing exports readable with the 2.9.0 candidate data", () => {
    const candidateDir = fileURLToPath(new URL("../../v4-game-data/data/2.9.0/", import.meta.url));
    const data = loadV4GameData(candidateDir, "2.9.0");
    let simulated = 0;
    let missingWeapon = 0;

    for (const file of RECOVERED_EXPORTS) {
      const exported = JSON.parse(readFileSync(join(repoRoot, "profile", file), "utf8"));
      const pvpVerdict = evaluatePvpVerdict(exported.profile, exported.profile, data, {
        skillActivationPolicy: "disabled"
      });
      const pveVerdict = evaluateCombatVerdict(
        exported.profile,
        data,
        { age: 9, combat: 10, difficulty: "normal" },
        { maxSeconds: 120 }
      );
      if (pvpVerdict.reason === "invalid_input") {
        expect(pvpVerdict.issues[0].code, file).toBe("missing_profile_weapon");
        expect(pveVerdict.issues[0].code, file).toBe("missing_profile_weapon");
        missingWeapon += 1;
      } else {
        expect(["knockout", "timeout"], file).toContain(pvpVerdict.reason);
        expect(pvpVerdict.metrics.dataVersion).toBe("2.9.0");
        expect(["cleared", "dead", "timeout"], file).toContain(pveVerdict.reason);
        expect(pveVerdict.metrics.dataVersion).toBe("2.9.0");
        simulated += 1;
      }
    }
    expect({ simulated, missingWeapon }).toEqual({ simulated: 4, missingWeapon: 0 });
  });
});
