import { useEffect, type ReactNode } from "react";
import type { Recommendation, ScenarioResult } from "@forge-master/simulator";
import { Crown, PawPrint, ScanLine, ShieldCheck, WandSparkles } from "lucide-react";
import { useWorkshop } from "../../store/workshop";
import { objectives } from "../../types";
import { rarityLabels, rarityValues } from "../shared/gameData";
import ui from "../shared/ui.module.css";
import {
  bisAccessFromProfile,
  bisProgress,
  bisReferenceForAccess,
  bisReferenceForAge
} from "./bisGuide";
import styles from "./SimulationPage.module.css";

export function SimulationPage() {
  const profile = useWorkshop((state) => state.profile);
  const evaluation = useWorkshop((state) => state.evaluation);
  const objective = useWorkshop((state) => state.objective);
  const scenarios = useWorkshop((state) => state.scenarios);
  const gameData = useWorkshop((state) => state.gameData);
  const bisAccess = useWorkshop((state) => state.bisAccess);
  const setObjective = useWorkshop((state) => state.setObjective);
  const setScenarios = useWorkshop((state) => state.setScenarios);
  const setBisAccess = useWorkshop((state) => state.setBisAccess);
  const ageOptions = gameData.normalized?.ageOptions || [];
  const spellOptions = gameData.normalized?.spells || [];
  const effectiveBisAccess = {
    equipmentAges: bisAccess.equipmentAges?.length ? bisAccess.equipmentAges : [0],
    petRarities: bisAccess.petRarities?.length ? bisAccess.petRarities : ["Common"],
    mountRarities: bisAccess.mountRarities?.length ? bisAccess.mountRarities : ["Common"],
    spellRarities: bisAccess.spellRarities?.length ? bisAccess.spellRarities : ["Common"]
  };
  const results = evaluation?.scenarios || [];
  const success = results.length > 0 && results.filter((result) => result.success).length >= Math.ceil(results.length / 2);
  const priorities = evaluation?.recommendations.slice(0, 3) || [];
  const grouped = groupRecommendations(evaluation?.recommendations.slice(3) || []);
  const bisReference = bisReferenceForAccess(effectiveBisAccess, ageOptions);
  const baselineReference = bisReferenceForAge(bisReference.age, ageOptions);
  const currentBisProgress = bisProgress(profile, bisReference, spellOptions);

  useEffect(() => {
    if (objective === "pvp") setObjective("progress");
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
            {objectives.map((item) => (
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
          <p className={ui.eyebrow}>Verdict principal</p>
          <h2>{evaluation ? success ? "Build prêt pour le niveau testé" : "Build encore fragile" : "Calcul en cours…"}</h2>
          <p className={ui.muted}>
            {evaluation
              ? `${results.filter((result) => result.success).length}/${results.length} scénarios réussis · niveau ${scenarios.levelRange.age ?? scenarios.levelRange.min ?? 1}, combat ${scenarios.levelRange.combat ?? scenarios.levelRange.max ?? 1}, mode ${Number(scenarios.levelRange.difficulty || 0) ? "difficile" : "normal"}.`
              : "Le moteur prépare le premier verdict."}
          </p>
        </div>
        <div className={styles.verdictScore}>
          <strong>{format(evaluation?.score, 3)}</strong>
          <span>score dominant</span>
        </div>
      </section>

      <section className={ui.grid3}>
        {results.length ? results.map((result) => <ScenarioCard key={result.id} result={result} />) :
          ["Endurance", "Temps pour tuer", "Série de mobs"].map((label) => <div className={styles.resultCard} key={label}><strong>{label}</strong><p>En attente du moteur.</p></div>)}
      </section>

      <section className={styles.bisSection} aria-labelledby="bis-title">
        <header className={styles.bisHeader}>
          <div>
            <p className={ui.eyebrow}>Repères de progression</p>
            <h2 id="bis-title">Objectifs BIS accessibles</h2>
            <p className={ui.muted}>
              {bisReference.phase} · repère {bisReference.ageLabel} : pets, monture et sorts {rarityLabels[baselineReference.petRarity]}.
            </p>
          </div>
          <button className={ui.button} onClick={() => setBisAccess(bisAccessFromProfile(profile, spellOptions))}>
            <ScanLine size={18} aria-hidden />
            Depuis mon profil
          </button>
        </header>

        <div className={styles.accessGrid}>
          <AccessChecks
            label="Âges d'équipement accessibles"
            options={ageOptions.map((age) => ({ value: String(age.value), label: age.label }))}
            selected={effectiveBisAccess.equipmentAges.map(String)}
            onChange={(value) => setBisAccess({
              ...effectiveBisAccess,
              equipmentAges: toggleAccess(effectiveBisAccess.equipmentAges, Number(value))
            })}
          />
          <AccessChecks
            label="Raretés de pets accessibles"
            options={rarityValues.map((rarity) => ({ value: rarity, label: rarityLabels[rarity] }))}
            selected={effectiveBisAccess.petRarities}
            onChange={(value) => setBisAccess({
              ...effectiveBisAccess,
              petRarities: toggleAccess(effectiveBisAccess.petRarities, value)
            })}
          />
          <AccessChecks
            label="Raretés de monture accessibles"
            options={rarityValues.map((rarity) => ({ value: rarity, label: rarityLabels[rarity] }))}
            selected={effectiveBisAccess.mountRarities}
            onChange={(value) => setBisAccess({
              ...effectiveBisAccess,
              mountRarities: toggleAccess(effectiveBisAccess.mountRarities, value)
            })}
          />
          <AccessChecks
            label="Raretés de sorts accessibles"
            options={rarityValues.map((rarity) => ({ value: rarity, label: rarityLabels[rarity] }))}
            selected={effectiveBisAccess.spellRarities}
            onChange={(value) => setBisAccess({
              ...effectiveBisAccess,
              spellRarities: toggleAccess(effectiveBisAccess.spellRarities, value)
            })}
          />
        </div>

        <div className={styles.bisTargets}>
          <BisTarget
            icon={<ShieldCheck size={22} aria-hidden />}
            label="Équipement"
            target={`${bisReference.ageLabel} ou mieux`}
            progress={`${currentBisProgress.equipment}/${currentBisProgress.equipmentTotal} objets`}
            complete={currentBisProgress.equipment === currentBisProgress.equipmentTotal}
          />
          <BisTarget
            icon={<PawPrint size={22} aria-hidden />}
            label="Pets"
            target={`${rarityLabels[bisReference.petRarity]} ou mieux`}
            progress={`${currentBisProgress.pets}/${currentBisProgress.petsTotal} pets`}
            complete={currentBisProgress.pets === currentBisProgress.petsTotal}
          />
          <BisTarget
            icon={<Crown size={22} aria-hidden />}
            label="Monture"
            target={`${rarityLabels[bisReference.mountRarity]} ou mieux`}
            progress={currentBisProgress.mount ? "Palier atteint" : "À améliorer"}
            complete={currentBisProgress.mount}
          />
          <BisTarget
            icon={<WandSparkles size={22} aria-hidden />}
            label="Sorts"
            target={`${rarityLabels[bisReference.spellRarity]} ou mieux`}
            progress={`${currentBisProgress.spells}/${currentBisProgress.spellsTotal} sorts`}
            complete={currentBisProgress.spells === currentBisProgress.spellsTotal}
          />
        </div>

        <div className={styles.bisStats}>
          <strong>Stats à viser</strong>
          <div>
            {bisReference.stats.map((stat) => (
              <span key={stat.stat}>
                {stat.label}
                {stat.target && <b>{stat.target}</b>}
              </span>
            ))}
          </div>
        </div>
        <p className={styles.bisNote}>{bisReference.note}</p>
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

      <section className={styles.recommendations}>
        <div className={ui.card}>
          <div className={ui.cardHeader}><h2>Les 3 priorités</h2><span className={ui.pill}>Impact maximal</span></div>
          <ol className={styles.priority}>
            {priorities.length ? priorities.map((recommendation, index) => (
              <li key={`${recommendation.title}-${index}`}>
                <div><strong>{recommendation.title}</strong><small>{recommendation.detail}</small></div>
                <span className={styles.gain}>+{format(recommendation.gain, 3)}</span>
              </li>
            )) : <li><div><strong>Aucune recommandation</strong><small>Le moteur n’a rien de significatif à proposer.</small></div></li>}
          </ol>
        </div>
        <div className={ui.card}>
          <div className={ui.cardHeader}><h2>Suite des améliorations</h2></div>
          {Object.entries(grouped).map(([group, recommendations]) => (
            <div key={group}>
              <span className={ui.pill}>{group}</span>
              <ul className={ui.list}>
                {recommendations.map((recommendation, index) => (
                  <li className={ui.listItem} key={`${recommendation.title}-${index}`}>
                    <strong>{recommendation.title}</strong><small>{recommendation.detail}</small>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!Object.keys(grouped).length && <p className={ui.muted}>Aucune recommandation secondaire.</p>}
        </div>
      </section>

      <details className={`${ui.card} ${styles.calculation}`}>
        <summary>Voir le calcul</summary>
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

function AccessChecks({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className={styles.accessGroup}>
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <label key={option.value} className={selected.includes(option.value) ? styles.accessChecked : ""}>
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function BisTarget({
  icon,
  label,
  target,
  progress,
  complete
}: {
  icon: ReactNode;
  label: string;
  target: string;
  progress: string;
  complete: boolean;
}) {
  return (
    <article className={`${styles.bisTarget} ${complete ? styles.bisComplete : ""}`}>
      <div className={styles.bisIcon}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{target}</strong>
      </div>
      <small>{progress}</small>
    </article>
  );
}

function ScenarioCard({ result }: { result: ScenarioResult }) {
  const metric = Object.entries(result.metrics).find(([, value]) => Number(value) > 0);
  return (
    <article className={styles.resultCard}>
      <header><strong>{result.label}</strong><span className={`${ui.pill} ${result.success ? ui.pillGood : ui.pillBad}`}>{result.success ? "Réussi" : "Échec"}</span></header>
      <div className={ui.bar}><span style={{ width: `${Math.max(4, Math.min(100, result.score * 10))}%` }} /></div>
      {metric && <strong>{format(metric[1], 1)} <small>{metric[0]}</small></strong>}
      <p>{result.summary}</p>
    </article>
  );
}

function CompactNumber({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className={ui.field}><span>{label}</span><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} aria-label={`${label}${suffix ? ` en ${suffix}` : ""}`} /></label>;
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
  return recommendations.reduce<Record<string, Recommendation[]>>((groups, recommendation) => {
    const text = `${recommendation.title} ${recommendation.detail} ${recommendation.source || ""}`.toLowerCase();
    const group = text.includes("pet") ? "Pets"
      : text.includes("monture") ? "Monture"
      : text.includes("talent") ? "Talents"
      : text.includes("sort") || text.includes("skill") ? "Sorts"
      : recommendation.kind === "stat" ? "Stats secondaires"
      : "Équipement";
    (groups[group] ||= []).push(recommendation);
    return groups;
  }, {});
}

function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function toggleAccess<T>(values: T[], value: T): T[] {
  if (values.includes(value)) {
    return values.length > 1 ? values.filter((entry) => entry !== value) : values;
  }
  return [...values, value];
}

function format(value: unknown, digits = 0) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: digits });
}
