import { useEffect } from "react";
import type { Recommendation, ScenarioResult } from "@forge-master/simulator";
import { useWorkshop } from "../../store/workshop";
import { objectives } from "../../types";
import { NumericInput } from "../shared/NumericInput";
import ui from "../shared/ui.module.css";
import styles from "./SimulationPage.module.css";

const simulationObjectives = objectives.filter((item) => item.id !== "balanced");
const recommendationGroups = ["Équipement", "Talents", "Pets / Monture", "Sorts", "Stats secondaires"] as const;
type RecommendationGroup = typeof recommendationGroups[number];

export function SimulationPage() {
  const evaluation = useWorkshop((state) => state.evaluation);
  const objective = useWorkshop((state) => state.objective);
  const scenarios = useWorkshop((state) => state.scenarios);
  const setObjective = useWorkshop((state) => state.setObjective);
  const setScenarios = useWorkshop((state) => state.setScenarios);
  const results = evaluation?.scenarios || [];
  const combatResult = results.find((result) => result.id === "gauntlet") || results[0];
  const modelTrials = Number(results[0]?.metrics.trials || scenarios.model?.trials || 64);
  const success = Boolean(combatResult?.success);
  const priorities = evaluation?.recommendations.slice(0, 3) || [];
  const grouped = groupRecommendations(evaluation?.recommendations.slice(3) || []);

  useEffect(() => {
    if (objective === "pvp" || objective === "balanced") setObjective("progress");
  }, [objective, setObjective]);

  return (
    <div className={ui.page}>
      <header className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Simulation continue</p>
          <h1>Verdict et recommandations</h1>
        </div>
        <span className={ui.pill}>Relance automatique · 400 ms</span>
      </header>

      <section className={`${ui.card} ${styles.controls}`}>
        <div>
          <span className={ui.eyebrow}>Objectif</span>
          <div className={`${ui.segmented} ${styles.objectives}`}>
            {simulationObjectives.map((item) => (
              <button
                key={item.id}
                className={`${ui.tab} ${objective === item.id ? ui.tabActive : ""}`}
                onClick={() => setObjective(item.id)}
              >{item.label}</button>
            ))}
          </div>
        </div>
        <CompactSelect
          label="Mode"
          value={Number(scenarios.levelRange.difficulty || 0)}
          options={[{ value: 0, label: "Normal" }, { value: 1, label: "Difficile" }]}
          onChange={(difficulty) => setScenarios({ ...scenarios, levelRange: { ...scenarios.levelRange, difficulty } })}
        />
        <CompactSelect
          label="Niveau"
          value={Number(scenarios.levelRange.age ?? scenarios.levelRange.min ?? 1)}
          options={Array.from({ length: 11 }, (_, index) => ({ value: index + 1, label: String(index + 1) }))}
          onChange={(age) => setScenarios({ ...scenarios, levelRange: { ...scenarios.levelRange, age, min: age } })}
        />
        <CompactSelect
          label="Combat"
          value={Number(scenarios.levelRange.combat ?? scenarios.levelRange.max ?? 1)}
          options={Array.from({ length: 20 }, (_, index) => ({ value: index + 1, label: String(index + 1) }))}
          onChange={(combat) => setScenarios({ ...scenarios, levelRange: { ...scenarios.levelRange, combat, max: combat } })}
        />
      </section>

      <section className={`${styles.verdict} ${success ? "" : styles.verdictFail}`}>
        <div>
          <p className={ui.eyebrow}>Ton build actuel</p>
          <h2>{evaluation && combatResult ? success ? "Ton build passe le combat testé" : "Ton build ne passe pas encore" : "Calcul en cours…"}</h2>
          <p className={ui.muted}>
            {evaluation && combatResult
              ? `${success ? "Combat réussi" : "Combat échoué"} · niveau ${scenarios.levelRange.age ?? scenarios.levelRange.min ?? 1}, combat ${scenarios.levelRange.combat ?? scenarios.levelRange.max ?? 1}, mode ${Number(scenarios.levelRange.difficulty || 0) ? "difficile" : "normal"}.`
              : "Le moteur prépare le premier verdict."}
          </p>
        </div>
      </section>

      <section className={styles.resultGrid}>
        {combatResult ? <ScenarioCard result={combatResult} /> :
          <div className={styles.resultCard}><strong>Combat testé</strong><p>En attente du moteur.</p></div>}
      </section>

      <section className={styles.recommendations}>
        <div className={ui.card}>
          <div className={ui.cardHeader}><h2>Priorités</h2><span className={ui.pill}>À faire en premier</span></div>
          <ol className={styles.priority}>
            {priorities.length ? priorities.map((recommendation, index) => (
              <li key={`${recommendation.title}-${index}`}>
                <div><strong>{recommendation.title}</strong><small>{cleanRecommendationDetail(recommendation.detail)}</small></div>
              </li>
            )) : <li><div><strong>Aucune recommandation</strong><small>Le moteur n’a rien de significatif à proposer.</small></div></li>}
          </ol>
        </div>
        {recommendationGroups.map((group) => grouped[group].length ? (
          <div className={ui.card} key={group}>
            <div className={ui.cardHeader}><h2>{group}</h2></div>
            <ul className={ui.list}>
              {grouped[group].map((recommendation, index) => (
                <li className={ui.listItem} key={`${recommendation.title}-${index}`}>
                  <strong>{recommendation.title}</strong><small>{cleanRecommendationDetail(recommendation.detail)}</small>
                </li>
              ))}
            </ul>
          </div>
        ) : null)}
      </section>

      <details className={`${ui.card} ${styles.experts}`}>
        <summary>Paramètres experts</summary>
        <div className={ui.grid3}>
          <ScenarioFields
            title="Endurance"
            values={scenarios.endurance}
            onChange={(patch) => setScenarios({ ...scenarios, endurance: { ...scenarios.endurance, ...patch } })}
          />
          <ScenarioFields
            title="Temps pour tuer"
            values={scenarios.timeToKill}
            onChange={(patch) => setScenarios({ ...scenarios, timeToKill: { ...scenarios.timeToKill, ...patch } })}
          />
          <ScenarioFields
            title="Série de mobs"
            values={scenarios.gauntlet}
            onChange={(patch) => setScenarios({ ...scenarios, gauntlet: { ...scenarios.gauntlet, ...patch } })}
          />
        </div>
      </details>

      <details className={`${ui.card} ${styles.calculation}`}>
        <summary>Voir le calcul</summary>
        <p className={ui.muted}>V3 · {format(modelTrials)} simulations · {enemySummary(results)}</p>
        <div className={ui.grid4}>
          <Metric label="DPS arme" value={evaluation?.profile.weaponDps} />
          <Metric label="DPS sorts" value={evaluation?.profile.skillDps} />
          <Metric label="PV max" value={evaluation?.profile.maxHealth} />
          <Metric label="Soin / s" value={evaluation?.profile.healingPerSecond} />
        </div>
      </details>
    </div>
  );
}

function ScenarioCard({ result }: { result: ScenarioResult }) {
  const metric = Object.entries(result.metrics).find(([, value]) => Number(value) > 0);
  const enemyMode = typeof result.metrics.enemyMode === "string" ? result.metrics.enemyMode : "";
  const blockRate = Number(result.metrics.blockRate || 0);
  return (
    <article className={styles.resultCard}>
      <header><strong>Combat testé</strong><span className={`${ui.pill} ${result.success ? ui.pillGood : ui.pillBad}`}>{result.success ? "Réussi" : "Échec"}</span></header>
      {metric && <strong>{format(metric[1], 1)} <small>{metric[0]}</small></strong>}
      {enemyMode && enemyMode !== "unknown" && <small>{enemyLabel(enemyMode)} · block {format(blockRate)}%</small>}
      <p>{result.summary}</p>
    </article>
  );
}

function CompactNumber({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className={ui.field}><span>{label}</span><NumericInput value={value} ariaLabel={`${label}${suffix ? ` en ${suffix}` : ""}`} onChange={onChange} /></label>;
}

function CompactSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: number;
  options: Array<{ value: number; label: string }>;
  onChange: (value: number) => void;
}) {
  return <label className={ui.field}><span>{label}</span><select value={value} onChange={(event) => onChange(Number(event.target.value))}>
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select></label>;
}

function ScenarioFields({
  title,
  values,
  onChange
}: {
  title: string;
  values: Record<string, number | undefined>;
  onChange: (patch: Record<string, number>) => void;
}) {
  return (
    <div className={ui.flatCard}>
      <div className={ui.cardHeader}><h2>{title}</h2></div>
      {Object.entries(values).filter(([, value]) => typeof value === "number").map(([key, value]) => (
        <CompactNumber key={key} label={humanize(key)} value={Number(value)} onChange={(next) => onChange({ [key]: next })} />
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return null;
  return <div className={ui.metric}><span>{label}</span><strong>{format(value)}</strong></div>;
}

function groupRecommendations(recommendations: Recommendation[]) {
  const groups: Record<RecommendationGroup, Recommendation[]> = {
    "Équipement": [],
    "Talents": [],
    "Pets / Monture": [],
    "Sorts": [],
    "Stats secondaires": []
  };
  return recommendations.reduce((groups, recommendation) => {
    groups[recommendationGroup(recommendation)].push(recommendation);
    return groups;
  }, groups);
}

function recommendationGroup(recommendation: Recommendation): RecommendationGroup {
  const text = `${recommendation.title} ${recommendation.detail} ${recommendation.source || ""}`.toLowerCase();
  if (text.includes("pet") || text.includes("monture") || text.includes("mount")) return "Pets / Monture";
  if (recommendation.kind === "talent" || text.includes("talent") || text.includes("forge ") || text.includes("power ") || text.includes("skillspettech")) return "Talents";
  if (recommendation.kind === "spell" || text.includes("sort")) return "Sorts";
  if (recommendation.kind === "stat") return "Stats secondaires";
  return "Équipement";
}

function cleanRecommendationDetail(detail: string) {
  return detail
    .replace(/Gain estim(?:é|e) [^.]+\.?\s*/i, "")
    .replace(/Impact principal:[^.]+\.?\s*/i, "")
    .replaceAll("Mob intuable", "Endurance")
    .replaceAll("Mob fragile", "Combat court")
    .trim() || "Amélioration recommandée.";
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function enemySummary(results: ScenarioResult[]) {
  const mode = results.map((result) => result.metrics.enemyMode).find((value) => typeof value === "string" && value !== "unknown");
  return typeof mode === "string" ? enemyLabel(mode) : "mobs non identifies";
}

function enemyLabel(mode: string) {
  if (mode === "mixed") return "mobs mixtes";
  if (mode === "ranged") return "mobs distance";
  if (mode === "melee") return "mobs melee";
  return "mobs non identifies";
}

function format(value: unknown, digits = 0) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: digits });
}
