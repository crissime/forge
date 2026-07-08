import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Crown, PawPrint, ScanLine, ShieldCheck, WandSparkles } from "lucide-react";
import { api } from "../../api/client";
import { useWorkshop } from "../../store/workshop";
import { rarityLabels, rarityValues } from "../shared/gameData";
import ui from "../shared/ui.module.css";
import {
  bisAccessFromProfile,
  bisProgress,
  bisReferenceForAccess
} from "./bisGuide";
import styles from "./SimulationPage.module.css";

export function BisPage() {
  const profile = useWorkshop((state) => state.profile);
  const gameData = useWorkshop((state) => state.gameData);
  const bisAccess = useWorkshop((state) => state.bisAccess);
  const setBisAccess = useWorkshop((state) => state.setBisAccess);
  const ageOptions = gameData.normalized?.ageOptions || [];
  const spellOptions = gameData.normalized?.spells || [];
  const effectiveBisAccess = {
    equipmentAges: bisAccess.equipmentAges?.length ? bisAccess.equipmentAges : [0],
    petRarities: bisAccess.petRarities?.length ? bisAccess.petRarities : ["Common"],
    mountRarities: bisAccess.mountRarities?.length ? bisAccess.mountRarities : ["Common"],
    spellRarities: bisAccess.spellRarities?.length ? bisAccess.spellRarities : ["Common"]
  };
  const bisQuery = useQuery({ queryKey: ["bis-latest"], queryFn: api.bisLatest, retry: false, staleTime: 30_000 });
  const bisReference = bisReferenceForAccess(effectiveBisAccess, ageOptions, "progress", bisQuery.data);
  const currentBisProgress = bisProgress(profile, bisReference, spellOptions);

  return (
    <div className={ui.page}>
      <header className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>BIS</p>
          <h1>Meilleur build accessible</h1>
          <p className={ui.muted}>Choisis ce que tu peux obtenir. Cette page indique quoi viser.</p>
        </div>
        <button className={ui.button} onClick={() => setBisAccess(bisAccessFromProfile(profile, spellOptions))}>
          <ScanLine size={18} aria-hidden />
          Depuis mon profil
        </button>
      </header>

      <section className={styles.bisSection} aria-labelledby="bis-title">
        <header className={styles.bisHeader}>
          <div>
            <p className={ui.eyebrow}>Cible</p>
            <h2 id="bis-title">BIS théorique accessible</h2>
            <p className={ui.muted}>
              Repère {bisReference.ageLabel} : pets {rarityLabels[bisReference.petRarity]},
              monture {rarityLabels[bisReference.mountRarity]}, sorts {rarityLabels[bisReference.spellRarity]}.
            </p>
          </div>
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

function toggleAccess<T>(values: T[], value: T): T[] {
  if (values.includes(value)) {
    return values.length > 1 ? values.filter((entry) => entry !== value) : values;
  }
  return [...values, value];
}
