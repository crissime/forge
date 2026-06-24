import { useEffect, useState } from "react";
import { Copy, FileUp, Settings2, X } from "lucide-react";
import type { StatMap } from "@forge-master/simulator";
import { api } from "../../api/client";
import { clone, emptyProfile, useWorkshop } from "../../store/workshop";
import ui from "../shared/ui.module.css";
import { setOpponentSpell, setOpponentStat, setOpponentTotal } from "./pvpProfile";
import styles from "./PvpPage.module.css";

const statLabels: Record<keyof StatMap, string> = {
  damage: "Dégâts",
  health: "PV",
  rangedDamage: "Dégâts distance",
  meleeDamage: "Dégâts mêlée",
  skillDamage: "Dégâts des sorts",
  cooldown: "Réduction cooldown",
  regen: "Régénération",
  lifesteal: "Vol de vie",
  attackSpeed: "Vitesse d’attaque",
  doubleChance: "Double attaque",
  critChance: "Chance critique",
  critDamage: "Dégâts critiques",
  block: "Blocage"
};

export function PvpPage() {
  const profile = useWorkshop((state) => state.profile);
  const opponent = useWorkshop((state) => state.opponent);
  const evaluation = useWorkshop((state) => state.evaluation);
  const gameData = useWorkshop((state) => state.gameData);
  const setObjective = useWorkshop((state) => state.setObjective);
  const setOpponent = useWorkshop((state) => state.setOpponent);
  const editOpponent = useWorkshop((state) => state.editOpponent);
  const notify = useWorkshop((state) => state.notify);
  const [modal, setModal] = useState(false);
  const pvp = evaluation && "pvp" in evaluation ? evaluation.pvp : null;
  const stats = gameData.normalized?.stats || [];
  const spells = gameData.normalized?.spells || [];

  useEffect(() => {
    setObjective("pvp");
    return () => setObjective("progress");
  }, [setObjective]);

  return (
    <div className={ui.page}>
      <header className={ui.heading}>
        <div><p className={ui.eyebrow}>Duel PvP</p><h1>Joueur contre adversaire</h1></div>
        <button className={ui.button} onClick={() => setModal(true)}><Settings2 size={18} /> Actions adversaire</button>
      </header>

      <section className={`${ui.card} ${styles.compact}`}>
        <label className={ui.field}><span>Nom de l’adversaire</span><input value={opponent?.name || ""} onChange={(event) => editOpponent((draft) => { draft.name = event.target.value; })} /></label>
        <NumberField label="Attaque totale" value={opponent?.base.attack || 0} onChange={(value) => editOpponent((draft) => setOpponentTotal(draft, "attack", value))} />
        <NumberField label="PV totaux" value={opponent?.base.health || 0} onChange={(value) => editOpponent((draft) => setOpponentTotal(draft, "health", value))} />
        <label className={ui.field}>
          <span>Style d’attaque</span>
          <select value={opponent?.base.weaponStyle || "ranged"} onChange={(event) => editOpponent((draft) => {
            draft.base.weaponStyle = event.target.value as "melee" | "ranged";
          })}>
            <option value="ranged">Distance</option>
            <option value="melee">Mêlée</option>
          </select>
        </label>
      </section>

      <section className={styles.editorLayout}>
        <article className={ui.card}>
          <div className={ui.cardHeader}>
            <div>
              <h2>Sorts adverses</h2>
              <p className={styles.sectionIntro}>Jusqu’à trois sorts pris en compte dans la chronologie du duel.</p>
            </div>
          </div>
          <div className={styles.spellsGrid}>
            {[0, 1, 2].map((index) => (
              <SpellEditor
                key={index}
                index={index}
                selected={opponent?.spells[index]}
                spells={spells}
                onChange={(id, level) => editOpponent((draft) => setOpponentSpell(draft, index, id, level, spells))}
              />
            ))}
          </div>
        </article>

        <article className={ui.card}>
          <div className={ui.cardHeader}>
            <div>
              <h2>Stats secondaires</h2>
              <p className={styles.sectionIntro}>Valeurs totales du profil adverse, en pourcentage.</p>
            </div>
            <span className={ui.pill}>{stats.length} stats</span>
          </div>
          <div className={styles.statsGrid}>
            {stats.map((stat) => (
              <NumberField
                key={stat.id}
                label={statLabels[stat.id] || stat.label}
                value={opponent?.stats[stat.id] || 0}
                unit="%"
                onChange={(value) => editOpponent((draft) => setOpponentStat(draft, stat.id, value))}
              />
            ))}
          </div>
        </article>
      </section>

      <section className={styles.hero}>
        <div>
          <p className={ui.eyebrow}>Verdict</p>
          <h2>{pvp ? pvp.winner === "player" ? "Avantage joueur" : pvp.winner === "opponent" ? "Avantage adversaire" : "Duel équilibré" : "Simulation en cours…"}</h2>
          <p className={ui.muted}>{pvp ? `Durée estimée : ${format(pvp.duration, 1)} s. Les forces et faiblesses sont calculées avant les détails du duel.` : "Le moteur compare les deux profils."}</p>
        </div>
        <div className={styles.chance}><strong>{format(pvp?.chance, 1)}%</strong><span>chance de victoire</span></div>
      </section>

      <section className={styles.fighters}>
        <Fighter
          name={profile?.name || "Joueur"}
          health={pvp?.player.maxHealth || evaluation?.profile.maxHealth || 0}
          remaining={pvp?.playerRemainingHealth}
          damage={pvp?.playerDamage}
          spellDamage={pvp?.playerSkillDamage}
          duration={pvp?.timeToWin}
        />
        <Fighter
          enemy
          name={opponent?.name || "Adversaire"}
          health={pvp?.opponent.maxHealth || opponent?.base.health || 0}
          remaining={pvp?.opponentRemainingHealth}
          damage={pvp?.opponentDamage}
          spellDamage={pvp?.opponentSkillDamage}
          duration={pvp?.timeToLose}
        />
      </section>

      <section className={ui.grid2}>
        <div className={ui.card}><div className={ui.cardHeader}><h2>Forces</h2></div><div className={styles.tags}>{(pvp?.strengths || ["En attente"]).map((tag) => <span className={`${ui.pill} ${ui.pillGood}`} key={tag}>{tag}</span>)}</div></div>
        <div className={ui.card}><div className={ui.cardHeader}><h2>Faiblesses</h2></div><div className={styles.tags}>{(pvp?.weaknesses || ["En attente"]).map((tag) => <span className={`${ui.pill} ${ui.pillBad}`} key={tag}>{tag}</span>)}</div></div>
      </section>

      {modal && (
        <div className={ui.drawerBackdrop} onMouseDown={() => setModal(false)}>
          <aside className={ui.drawer} onMouseDown={(event) => event.stopPropagation()}>
            <header className={ui.drawerHeader}>
              <div><p className={ui.eyebrow}>Adversaire</p><h2>Choisir le profil</h2></div>
              <button className={ui.close} onClick={() => setModal(false)}><X size={20} /></button>
            </header>
            <div className={styles.modal}>
              <label className={ui.button}>
                <FileUp size={18} /> Importer un profil
                <input hidden type="file" accept=".json,application/json" onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const result = await api.importProfile(JSON.parse(await file.text()), file.name.replace(/\.json$/i, ""));
                    setOpponent(result.normalized);
                    setModal(false);
                  } catch (error) {
                    notify(error instanceof Error ? error.message : "Import impossible.");
                  }
                }} />
              </label>
              <button className={ui.button} onClick={() => {
                if (!profile) return;
                const next = clone(profile);
                next.name = `${profile.name} · adversaire`;
                setOpponent(next);
                setModal(false);
              }}><Copy size={18} /> Copier mon profil</button>
              <button className={ui.button} onClick={async () => {
                try {
                  const result = await api.manualProfile();
                  result.normalized.name = "Adversaire manuel";
                  setOpponent(result.normalized);
                  setModal(false);
                } catch {
                  const fallback = emptyProfile();
                  fallback.name = "Adversaire manuel";
                  setOpponent(fallback);
                  setModal(false);
                }
              }}>Adversaire manuel</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function SpellEditor({
  index,
  selected,
  spells,
  onChange
}: {
  index: number;
  selected?: { id: string; level: number };
  spells: Array<{ id: string; name: string; rarity: string }>;
  onChange: (id: string, level: number) => void;
}) {
  return (
    <article className={styles.spellCard}>
      <strong>Sort {index + 1}</strong>
      <label className={ui.field}>
        <span>Sort</span>
        <select value={selected?.id || ""} onChange={(event) => onChange(event.target.value, selected?.level || 1)}>
          <option value="">Aucun</option>
          {spells.map((spell) => <option key={spell.id} value={spell.id}>{spell.name} · {spell.rarity}</option>)}
        </select>
      </label>
      <NumberField
        label="Niveau"
        value={selected?.level || 1}
        min={1}
        max={100}
        disabled={!selected}
        onChange={(level) => onChange(selected?.id || "", level)}
      />
    </article>
  );
}

function Fighter({
  enemy,
  name,
  health,
  remaining,
  damage,
  spellDamage,
  duration
}: {
  enemy?: boolean;
  name: string;
  health: number;
  remaining?: number;
  damage?: number;
  spellDamage?: number;
  duration?: number | null;
}) {
  const ratio = health ? Math.max(0, Math.min(100, (Number(remaining || 0) / health) * 100)) : 0;
  return (
    <article className={`${styles.fighter} ${enemy ? styles.enemy : ""}`}>
      <header><h2>{name}</h2><span className={ui.pill}>{enemy ? "Adversaire" : "Joueur"}</span></header>
      <div className={styles.hpBar} aria-label={`${format(ratio)}% de PV restants`}><span style={{ width: `${ratio}%` }} /></div>
      <div className={ui.grid2}>
        <Metric label="PV max" value={health} />
        <Metric label="Dégâts" value={damage} />
        <Metric label="Dégâts sorts" value={spellDamage} />
        <Metric label="Durée estimée" value={duration} suffix=" s" />
      </div>
    </article>
  );
}

function Metric({ label, value, suffix = "" }: { label: string; value?: number | null; suffix?: string }) {
  return <div className={ui.metric}><span>{label}</span><strong>{format(value, 1)}{suffix}</strong></div>;
}

function NumberField({
  label,
  value,
  unit,
  min = 0,
  max,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={ui.field}>
      <span>{label}</span>
      <div className={unit ? styles.unitInput : undefined}>
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min={min}
          max={max}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(Number(event.target.value) || min)}
        />
        {unit && <span>{unit}</span>}
      </div>
    </label>
  );
}

function format(value: unknown, digits = 0) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: digits });
}
