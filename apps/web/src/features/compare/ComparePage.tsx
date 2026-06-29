import { useState } from "react";
import type {
  DropComparisonResult,
  DropInput,
  EquipmentSlot,
  StatMap
} from "@forge-master/simulator";
import { ArrowRight } from "lucide-react";
import { api } from "../../api/client";
import { useWorkshop } from "../../store/workshop";
import {
  availableAges,
  calculateItemValues,
  calculateMountValues,
  calculatePetValues,
  firstMountModel,
  firstPetModel,
  mountModelsFor,
  normalizeRarity,
  petModelsFor,
  petTypeLabel,
  rarityLabels,
  rarityValues,
  resolveItemSelection,
  weaponKindFromBase,
  weaponKindLabel,
  weaponKindOptions,
  type WeaponKind
} from "../shared/gameData";
import { NumericInput } from "../shared/NumericInput";
import ui from "../shared/ui.module.css";
import styles from "./ComparePage.module.css";

type Target = "equipment" | "pet" | "mount";
const slots: EquipmentSlot[] = ["Weapon", "Helmet", "Body", "Gloves", "Belt", "Necklace", "Ring", "Shoe"];
const slotLabels: Record<EquipmentSlot, string> = {
  Weapon: "Arme",
  Helmet: "Casque",
  Body: "Armure",
  Gloves: "Gants",
  Belt: "Ceinture",
  Necklace: "Collier",
  Ring: "Anneau",
  Shoe: "Bottes"
};

export function ComparePage() {
  const profile = useWorkshop((state) => state.profile);
  const objective = useWorkshop((state) => state.objective);
  const gameData = useWorkshop((state) => state.gameData);
  const history = useWorkshop((state) => state.comparisonHistory);
  const addComparison = useWorkshop((state) => state.addComparison);
  const editProfile = useWorkshop((state) => state.editProfile);
  const notify = useWorkshop((state) => state.notify);
  const stats = gameData.normalized?.stats || [];
  const ageOptions = gameData.normalized?.ageOptions || [];
  const itemBases = gameData.normalized?.itemBases || [];
  const itemConfig = gameData.normalized?.itemConfig || {
    levelScalingBase: 1.01,
    meleeDamageMultiplier: 1.6,
    maxLevel: 98
  };
  const petModels = gameData.normalized?.petModels || [];
  const mountModels = gameData.normalized?.mountModels || [];
  const petLevels = gameData.normalized?.petLevels || [];
  const mountLevels = gameData.normalized?.mountLevels || [];

  const [target, setTarget] = useState<Target>("equipment");
  const [slot, setSlot] = useState<EquipmentSlot>("Weapon");
  const [form, setForm] = useState({
    age: 0,
    idx: 0,
    rarity: "Common",
    id: 0,
    level: 1,
    stat: "damage" as keyof StatMap,
    value: 0
  });
  const [result, setResult] = useState<DropComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  const itemPreview = calculateItemValues(slot, form.age, form.idx, form.level, itemBases, itemConfig);
  const weaponKind = weaponKindFromBase(itemPreview.base);
  const petPreview = calculatePetValues(form.rarity, form.id, form.level, petModels, petLevels);
  const mountPreview = calculateMountValues(form.rarity, form.id, form.level, mountModels, mountLevels);
  const preview = target === "equipment" ? itemPreview : target === "pet" ? petPreview : mountPreview;
  const candidateLabel = comparisonLabel(
    target,
    slot,
    form.age,
    form.rarity,
    form.level,
    ageOptions,
    target === "pet" ? petPreview.name : target === "mount" ? mountPreview.name : undefined
  );

  const drop: DropInput = {
    target,
    slot: target === "equipment" ? slot : undefined,
    name: candidateLabel,
    age: target === "equipment" ? itemPreview.age : undefined,
    idx: target === "equipment" ? itemPreview.idx : undefined,
    rarity: target === "pet" ? petPreview.rarity : target === "mount" ? mountPreview.rarity : undefined,
    id: target === "pet" ? petPreview.id : target === "mount" ? mountPreview.id : undefined,
    petType: target === "pet" ? petPreview.type : undefined,
    level: preview.level,
    attack: preview.attack,
    health: preview.health,
    secondaryStats: form.value ? [{ stat: form.stat, value: form.value }] : []
  };

  const run = async () => {
    if (!profile) return;
    if (target === "equipment" && !itemPreview.base) return notify("Aucune base d’objet ne correspond à cette sélection.");
    if (target === "pet" && !petPreview.recognized) return notify("Les données de ce pet sont introuvables.");
    if (target === "mount" && !mountPreview.recognized) return notify("Les données de cette monture sont introuvables.");
    setLoading(true);
    try {
      const next = await api.compare(profile, objective === "pvp" ? "progress" : objective, drop);
      setResult(next);
      addComparison({
        at: new Date().toISOString(),
        label: candidateLabel,
        result: next
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Comparaison impossible.");
    } finally {
      setLoading(false);
    }
  };

  const equip = () => {
    if (!result) return;
    editProfile((draft) => {
      const lines = form.value ? [{ stat: form.stat, sourceId: form.stat, value: form.value }] : [];
      if (target === "equipment") {
        draft.equipment[slot] = {
          slot,
          name: slotLabels[slot],
          age: itemPreview.age,
          idx: itemPreview.idx,
          level: itemPreview.level,
          attack: itemPreview.attack,
          health: itemPreview.health,
          secondaryStats: lines,
          recognized: Boolean(itemPreview.base)
        };
        if (slot === "Weapon" && itemPreview.base?.isRanged !== undefined) {
          draft.base.weaponStyle = itemPreview.base.isRanged ? "ranged" : "melee";
        }
      }
      if (target === "mount") {
        draft.mount = {
          name: mountPreview.name,
          rarity: mountPreview.rarity,
          id: mountPreview.id,
          level: mountPreview.level,
          attack: mountPreview.attack,
          health: mountPreview.health,
          secondaryStats: lines,
          recognized: mountPreview.recognized,
          skills: []
        };
      }
      if (target === "pet") {
        const index = result.bestPetIndex ?? 0;
        while (draft.pets.length <= index) {
          draft.pets.push({ name: `Pet ${draft.pets.length + 1}`, level: 1, attack: 0, health: 0, secondaryStats: [], recognized: false });
        }
        draft.pets[index] = {
          name: petPreview.name,
          rarity: petPreview.rarity,
          id: petPreview.id,
          type: petPreview.type,
          level: petPreview.level,
          attack: petPreview.attack,
          health: petPreview.health,
          secondaryStats: lines,
          recognized: petPreview.recognized
        };
      }
    });
    notify("Le drop a été équipé.");
    setResult(null);
  };

  const updateTarget = (nextTarget: Target) => {
    setTarget(nextTarget);
    setResult(null);
    if (nextTarget === "pet") {
      const model = firstPetModel(form.rarity, petModels) || petModels[0];
      if (model) setForm((current) => ({ ...current, rarity: model.rarity, id: model.id }));
    }
    if (nextTarget === "mount") {
      const model = firstMountModel(form.rarity, mountModels) || mountModels[0];
      if (model) setForm((current) => ({ ...current, rarity: model.rarity, id: model.id }));
    }
  };

  return (
    <div className={ui.page}>
      <header className={ui.heading}>
        <div><p className={ui.eyebrow}>Comparateur</p><h1>Trouver la meilleure destination</h1></div>
        <div className={ui.segmented}>
          {([["equipment", "Objet"], ["pet", "Pet"], ["mount", "Monture"]] as const).map(([id, label]) => (
            <button key={id} className={`${ui.tab} ${target === id ? ui.tabActive : ""}`} onClick={() => updateTarget(id)}>{label}</button>
          ))}
        </div>
      </header>

      <div className={styles.layout}>
        <section className={`${ui.card} ${styles.dropForm}`}>
          <div className={ui.cardHeader}><h2>Drop candidat</h2><span className={ui.pill}>Valeurs automatiques</span></div>

          {target === "equipment" ? (
            <>
              <label className={ui.field}><span>Emplacement</span><select value={slot} onChange={(event) => {
                const nextSlot = event.target.value as EquipmentSlot;
                const selected = resolveItemSelection(nextSlot, form.age, weaponKind, itemBases, ageOptions);
                setSlot(nextSlot);
                setForm({ ...form, age: selected.age, idx: selected.idx });
                setResult(null);
              }}>{slots.map((item) => <option key={item} value={item}>{slotLabels[item]}</option>)}</select></label>
              <div className={ui.grid2}>
                <label className={ui.field}><span>Âge</span><select value={itemPreview.age} onChange={(event) => {
                  const selected = resolveItemSelection(slot, Number(event.target.value), weaponKind, itemBases, ageOptions);
                  setForm({ ...form, age: selected.age, idx: selected.idx });
                  setResult(null);
                }}>{availableAges(slot, ageOptions, itemBases).map((age) => <option key={age.value} value={age.value}>{age.label}</option>)}</select></label>
                {slot === "Weapon" && <label className={ui.field}><span>Type d’arme</span><select value={weaponKind} onChange={(event) => {
                  const selected = resolveItemSelection(slot, form.age, event.target.value as WeaponKind, itemBases, ageOptions);
                  setForm({ ...form, age: selected.age, idx: selected.idx });
                  setResult(null);
                }}>{weaponKindOptions(form.age, itemBases).map((kind) => <option key={kind} value={kind}>{weaponKindLabel(kind)}</option>)}</select></label>}
                <NumberField label="Niveau" value={form.level} min={1} integer onChange={(level) => { setForm({ ...form, level }); setResult(null); }} />
              </div>
            </>
          ) : (
            <div className={ui.grid2}>
              <RaritySelect value={form.rarity} onChange={(rarity) => {
                if (target === "pet") {
                  const model = firstPetModel(rarity, petModels);
                  if (model) setForm({ ...form, rarity, id: model.id });
                } else {
                  const model = firstMountModel(rarity, mountModels);
                  if (model) setForm({ ...form, rarity, id: model.id });
                }
                setResult(null);
              }} />
              {target === "pet" && <>
                <label className={ui.field}><span>Pet</span><select value={petPreview.id} onChange={(event) => { setForm({ ...form, id: Number(event.target.value) }); setResult(null); }}>{petModelsFor(form.rarity, petModels).map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>
                <div className={styles.petType}>
                  <span>Spécialisation</span>
                  <strong>{petTypeLabel(petPreview.type)}</strong>
                </div>
              </>}
              {target === "mount" && <label className={ui.field}><span>Monture</span><select value={mountPreview.id} onChange={(event) => { setForm({ ...form, id: Number(event.target.value) }); setResult(null); }}>{mountModelsFor(form.rarity, mountModels).map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>}
              <NumberField label="Niveau" value={form.level} min={1} max={100} integer onChange={(level) => { setForm({ ...form, level }); setResult(null); }} />
            </div>
          )}

          <div className={styles.calculated}>
            <div><span>Attaque calculée</span><strong>{format(preview.attack)}</strong></div>
            <div><span>PV calculés</span><strong>{format(preview.health)}</strong></div>
          </div>

          <div className={ui.grid2}>
            <label className={ui.field}><span>Stat secondaire</span><select value={form.stat} onChange={(event) => {
              setForm({ ...form, stat: event.target.value as keyof StatMap });
              setResult(null);
            }}>{stats.map((stat) => <option key={stat.id} value={stat.id}>{stat.label}</option>)}</select></label>
            <NumberField label="Valeur" value={form.value} min={0} onChange={(value) => setForm({ ...form, value })} />
          </div>
          <button className={ui.primary} onClick={run} disabled={!profile || loading}>{loading ? "Comparaison…" : "Comparer maintenant"}</button>
        </section>

        <section className={`${ui.card} ${styles.result}`}>
          <div className={ui.cardHeader}><h2>Résultat</h2>{result && <span className={`${ui.pill} ${result.verdict === "better" ? ui.pillGood : result.verdict === "worse" ? ui.pillBad : ""}`}>{verdict(result.verdict)}</span>}</div>
          {result ? <>
            <div className={styles.comparison}>
              <div className={styles.comparisonSide}><span>Actuel</span><strong>{format(result.currentScore, 3)}</strong><small>Score du profil</small></div>
              <div className={`${styles.delta} ${result.delta < 0 ? styles.deltaBad : ""}`}>{signed(result.delta)}</div>
              <div className={styles.comparisonSide}><span>Candidat</span><strong>{format(result.dropScore, 3)}</strong><small>{format(preview.attack)} ATQ · {format(preview.health)} PV</small></div>
            </div>
            {result.candidates && <div className={styles.candidateList}>
              {result.candidates.map((candidate) => (
                <div className={`${styles.candidate} ${candidate.petIndex === result.bestPetIndex ? styles.best : ""}`} key={candidate.petIndex}>
                  <span>Pet {candidate.petIndex + 1}{candidate.petIndex === result.bestPetIndex ? " · meilleure destination" : ""}</span>
                  <strong>{signed(candidate.delta)}</strong>
                </div>
              ))}
            </div>}
            <button className={ui.primary} onClick={equip}>Équiper <ArrowRight size={18} /></button>
          </> : <div className={ui.empty}>Choisissez le type, le niveau et les bonus du drop pour lancer la comparaison.</div>}
        </section>
      </div>

      {history.length > 0 && <section className={ui.card}>
        <div className={ui.cardHeader}><h2>10 dernières comparaisons</h2></div>
        <ul className={ui.list}>{history.map((entry, index) => (
          <li className={ui.listItem} key={`${entry.at}-${index}`}><strong>{entry.label} · {signed(entry.result.delta)}</strong><small>{new Date(entry.at).toLocaleString("fr-FR")}</small></li>
        ))}</ul>
      </section>}
    </div>
  );
}

function RaritySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className={ui.field}><span>Rareté</span><select value={normalizeRarity(value)} onChange={(event) => onChange(event.target.value)}>
    {rarityValues.map((rarity) => <option key={rarity} value={rarity}>{rarityLabels[rarity]}</option>)}
  </select></label>;
}

function NumberField({ label, value, min, max, integer, onChange }: { label: string; value: number; min: number; max?: number; integer?: boolean; onChange: (value: number) => void }) {
  return <label className={ui.field}><span>{label}</span><NumericInput value={value} min={min} max={max} integer={integer} onChange={onChange} /></label>;
}

function comparisonLabel(
  target: Target,
  slot: EquipmentSlot,
  age: number,
  rarity: string,
  level: number,
  ages: Array<{ value: number; label: string }>,
  companionName?: string
) {
  if (target === "equipment") return `${slotLabels[slot]} · ${ages.find((entry) => entry.value === age)?.label || `Âge ${age}`} · niv. ${level}`;
  if (target === "pet") return `${companionName || "Pet"} · ${rarityLabels[normalizeRarity(rarity)]} · niv. ${level}`;
  return `${companionName || "Monture"} · ${rarityLabels[normalizeRarity(rarity)]} · niv. ${level}`;
}

function verdict(value: DropComparisonResult["verdict"]) {
  return value === "better" ? "Meilleur" : value === "worse" ? "Moins bon" : "Équivalent";
}

function format(value: unknown, digits = 0) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${format(value, 3)}`;
}
