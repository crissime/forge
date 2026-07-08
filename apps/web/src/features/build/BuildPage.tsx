import type {
  EquipmentSlot,
  NormalizedItem,
  NormalizedMount,
  NormalizedPet,
  NormalizedProfile,
  SecondaryLine,
  StatMap
} from "@forge-master/simulator";
import { ChevronRight, X } from "lucide-react";
import { useWorkshop } from "../../store/workshop";
import type {
  AgeOption,
  CompanionLevels,
  ItemBase,
  ItemConfig,
  MountModel,
  PetModel
} from "../../types";
import {
  availableAges,
  calculateItemValues,
  calculateMountValues,
  calculatePetValues,
  companionAllowsSecondLine,
  firstMountModel,
  firstPetModel,
  itemAllowsSecondLine,
  mountDisplayName,
  mountModelsFor,
  normalizeRarity,
  petDisplayName,
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
import styles from "./BuildPage.module.css";

const slots: EquipmentSlot[] = [
  "Helmet",
  "Body",
  "Gloves",
  "Belt",
  "Weapon",
  "Necklace",
  "Ring",
  "Shoe"
];
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
const gridAreas: Record<EquipmentSlot, string> = {
  Helmet: "helmet",
  Body: "body",
  Gloves: "gloves",
  Belt: "belt",
  Weapon: "weapon",
  Necklace: "necklace",
  Ring: "ring",
  Shoe: "shoe"
};

export function BuildPage() {
  const profile = useWorkshop((state) => state.profile);
  const evaluation = useWorkshop((state) => state.evaluation);
  const selected = useWorkshop((state) => state.selected);
  const setSelected = useWorkshop((state) => state.setSelected);
  const gameData = useWorkshop((state) => state.gameData);
  const petModels = gameData.normalized?.petModels || [];
  const mountModels = gameData.normalized?.mountModels || [];
  if (!profile) return <BuildSkeleton />;

  const complete = [
    ...Object.values(profile.equipment).map((item) => Boolean(item?.recognized)),
    ...Array.from({ length: 3 }, (_, index) => Boolean(profile.pets[index]?.recognized)),
    Boolean(profile.mount?.recognized),
    ...Array.from({ length: 3 }, (_, index) => Boolean(profile.spells[index]))
  ];
  const completion = Math.round((complete.filter(Boolean).length / complete.length) * 100);
  const combat = evaluation?.profile;
  const lineTotal = totalSecondaryLines(profile);
  const alertCount = profile.audit.filter((issue) => issue.severity !== "info").length;

  return (
    <div className={ui.page}>
      <header className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Atelier du build</p>
          <h1>{profile.name}</h1>
        </div>
        <button className={styles.quality} onClick={() => setSelected({ kind: "audit", id: 0 })}>
          <span>Alertes profil</span>
          <strong>{alertCount ? `${alertCount} à vérifier` : "OK"}</strong>
          <ChevronRight size={18} />
        </button>
      </header>

      <section className={styles.summaryStrip} aria-label="Résumé du profil">
        <div className={styles.summaryLead}>
          <strong>{completion}% complété</strong>
          <span>{complete.filter(Boolean).length}/{complete.length} éléments renseignés · {lineTotal} lignes bonus</span>
          <div className={ui.bar}><span style={{ width: `${completion}%` }} /></div>
        </div>
        <SummaryMetric label="Attaque" value={format(profile.base.attack)} />
        <SummaryMetric label="PV" value={format(profile.base.health)} />
        <SummaryMetric label="DPS" value={format(combat?.totalDps)} />
        <SummaryMetric label="Lignes" value={format(lineTotal)} />
      </section>

      <section className={styles.board} aria-label="Plateau d'équipement">
        {slots.map((slot) => (
          <EquipmentSlotButton
            key={slot}
            slot={slot}
            item={profile.equipment[slot]}
            onClick={() => setSelected({ kind: "equipment", id: slot })}
          />
        ))}
        <div className={styles.center}>
          <img className={styles.centerMark} src="/forge-mark.svg" alt="" />
          <div>
            <strong>{profile.base.weaponStyle === "ranged" ? "Build à distance" : "Build mêlée"}</strong>
            <p className={ui.muted}>Les valeurs calculées se mettent à jour après chaque modification.</p>
          </div>
          <div className={styles.centerStats}>
            <span>DPS {format(combat?.totalDps)}</span>
            <span>HPS {format(combat?.healingPerSecond)}</span>
          </div>
        </div>
      </section>

      <section className={styles.companions} aria-label="Compagnons et sorts">
        {Array.from({ length: 3 }, (_, index) => (
          <CompanionButton
            key={`pet-${index}`}
            kind="pet"
            label={`Pet ${index + 1}`}
            name={petDisplayName(profile.pets[index], petModels)}
            detail={profile.pets[index] ? `Niv. ${profile.pets[index].level}` : "Vide"}
            onClick={() => setSelected({ kind: "pet", id: index })}
          />
        ))}
        <CompanionButton
          kind="mount"
          label="Monture"
          name={mountDisplayName(profile.mount, mountModels)}
          detail={profile.mount ? `Niv. ${profile.mount.level}` : "Vide"}
          onClick={() => setSelected({ kind: "mount", id: 0 })}
        />
        {Array.from({ length: 3 }, (_, index) => (
          <CompanionButton
            key={`spell-${index}`}
            kind="spell"
            label={`Sort ${index + 1}`}
            name={profile.spells[index]?.id}
            detail={profile.spells[index] ? `Niv. ${profile.spells[index].level}` : "Vide"}
            onClick={() => setSelected({ kind: "spell", id: index })}
          />
        ))}
      </section>

      {selected && <BuildDrawer />}
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div className={styles.summaryMetric}><span>{label}</span><strong>{value}</strong></div>;
}

function EquipmentSlotButton({
  slot,
  item,
  onClick
}: {
  slot: EquipmentSlot;
  item: NormalizedItem | null;
  onClick: () => void;
}) {
  const visible = item || primitiveDisplayItem(slot);
  const lines = visible.secondaryStats.filter((line) => line.value).map((line) => `${line.stat} ${format(line.value, 1)}`).join(" · ");
  return (
    <button
      className={styles.slot}
      style={{ gridArea: gridAreas[slot] }}
      onClick={onClick}
    >
      <div className={styles.slotTop}>
        <span>{slotLabels[slot]}</span>
        <DomainIcon kind="equipment" />
      </div>
      <strong>{visible.name}</strong>
      <small>{`Niv. ${visible.level} · ATQ ${format(visible.attack)} · PV ${format(visible.health)}${lines ? `\n${lines}` : ""}`}</small>
    </button>
  );
}

function CompanionButton({
  kind,
  label,
  name,
  detail,
  onClick
}: {
  kind: "pet" | "mount" | "spell";
  label: string;
  name?: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button className={styles.companion} onClick={onClick}>
      <div className={styles.slotTop}><span>{label}</span><DomainIcon kind={kind} /></div>
      <strong>{name || "Ajouter"}</strong>
      <small>{detail}</small>
    </button>
  );
}

function DomainIcon({ kind }: { kind: "equipment" | "pet" | "mount" | "spell" | "talent" }) {
  return <span className={`${styles.icon} ${styles[kind]}`} aria-hidden />;
}

function BuildDrawer() {
  const profile = useWorkshop((state) => state.profile)!;
  const selected = useWorkshop((state) => state.selected)!;
  const setSelected = useWorkshop((state) => state.setSelected);
  const editProfile = useWorkshop((state) => state.editProfile);
  const gameData = useWorkshop((state) => state.gameData);
  const stats = gameData.normalized?.stats || [];
  const spells = gameData.normalized?.spells || [];
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

  return (
    <div className={ui.drawerBackdrop} onMouseDown={() => setSelected(null)}>
      <aside className={ui.drawer} onMouseDown={(event) => event.stopPropagation()} aria-label="Éditeur">
        <header className={ui.drawerHeader}>
          <div>
            <p className={ui.eyebrow}>Édition ciblée</p>
            <h2>{editorTitle(selected)}</h2>
          </div>
          <button className={ui.close} onClick={() => setSelected(null)} aria-label="Fermer"><X size={20} /></button>
        </header>

        {selected.kind === "equipment" && (
          <EquipmentEditor
            slot={selected.id as EquipmentSlot}
            item={profile.equipment[selected.id as EquipmentSlot]}
            edit={editProfile}
            stats={stats}
            ageOptions={ageOptions}
            itemBases={itemBases}
            itemConfig={itemConfig}
          />
        )}
        {selected.kind === "pet" && (
          <PetEditor
            index={selected.id}
            pet={profile.pets[selected.id]}
            edit={editProfile}
            stats={stats}
            models={petModels}
            levels={petLevels}
          />
        )}
        {selected.kind === "mount" && (
          <MountEditor
            mount={profile.mount}
            edit={editProfile}
            stats={stats}
            models={mountModels}
            levels={mountLevels}
          />
        )}
        {selected.kind === "spell" && (
          <SpellEditor index={selected.id} edit={editProfile} spells={spells} />
        )}
        {selected.kind === "audit" && (
          <ul className={ui.list}>
            {profile.audit.length ? profile.audit.map((issue, index) => (
              <li className={ui.listItem} key={`${issue.code}-${index}`}>
                <strong>{issue.severity === "error" ? "Erreur" : issue.severity === "warning" ? "À vérifier" : "Information"}</strong>
                <small>{issue.message}</small>
              </li>
            )) : <li className={ui.empty}>Aucune alerte pertinente.</li>}
          </ul>
        )}
      </aside>
    </div>
  );
}

function EquipmentEditor({
  slot,
  item,
  edit,
  stats,
  ageOptions,
  itemBases,
  itemConfig
}: {
  slot: EquipmentSlot;
  item: NormalizedItem | null;
  edit: (recipe: (draft: NormalizedProfile) => void) => void;
  stats: Array<{ id: keyof StatMap; label: string }>;
  ageOptions: AgeOption[];
  itemBases: ItemBase[];
  itemConfig: ItemConfig;
}) {
  const current = item || primitiveDisplayItem(slot);
  const values = calculateItemValues(
    slot,
    Number(current.age || 0),
    Number(current.idx || 0),
    Number(current.level || 1),
    itemBases,
    itemConfig
  );
  const weaponKind = weaponKindFromBase(values.base);
  const ages = availableAges(slot, ageOptions, itemBases);
  return (
    <div className={styles.editor}>
      <div className={ui.grid2}>
        <label className={ui.field}>
          <span>Âge</span>
          <select value={values.age} onChange={(event) => edit((draft) => {
            applyItemSelection(draft, slot, Number(event.target.value), weaponKind, values.level, itemBases, itemConfig, ageOptions);
          })}>
            {ages.map((age) => <option key={age.value} value={age.value}>{age.label}</option>)}
          </select>
        </label>
        {slot === "Weapon" && (
          <label className={ui.field}>
            <span>Type d’arme</span>
            <select value={weaponKind} onChange={(event) => edit((draft) => {
              applyItemSelection(draft, slot, values.age, event.target.value as WeaponKind, values.level, itemBases, itemConfig, ageOptions);
            })}>
              {weaponKindOptions(values.age, itemBases).map((kind) => (
                <option key={kind} value={kind}>{weaponKindLabel(kind)}</option>
              ))}
            </select>
          </label>
        )}
        <NumberField label="Niveau" value={values.level} min={1} integer onChange={(level) => edit((draft) => {
          applyItemSelection(draft, slot, values.age, weaponKind, level, itemBases, itemConfig, ageOptions);
        })} />
      </div>
      <CalculatedPreview attack={values.attack} health={values.health} recognized={Boolean(values.base)} />
      <SecondaryEditor
        lines={current.secondaryStats}
        stats={stats}
        maxLines={itemAllowsSecondLine(values.age) ? 2 : 1}
        onChange={(lines) => edit((draft) => {
          if (!draft.equipment[slot]) applyItemSelection(draft, slot, values.age, weaponKind, values.level, itemBases, itemConfig, ageOptions);
          draft.equipment[slot]!.secondaryStats = lines;
        })}
      />
      <details className={styles.expert}>
        <summary>Détails experts</summary>
        <p className={ui.muted}>Les valeurs finales restent calculées par le simulateur. Cet écran ne modifie que les données source du profil.</p>
      </details>
    </div>
  );
}

function PetEditor({
  index,
  pet,
  edit,
  stats,
  models,
  levels
}: {
  index: number;
  pet?: NormalizedPet;
  edit: (recipe: (draft: NormalizedProfile) => void) => void;
  stats: Array<{ id: keyof StatMap; label: string }>;
  models: PetModel[];
  levels: CompanionLevels[];
}) {
  if (!pet) {
    return <button className={ui.primary} onClick={() => edit((draft) => {
      const model = firstPetModel("Common", models) || models[0];
      if (model) applyPetSelection(draft, index, model.rarity, model.id, 1, models, levels);
    })}>Ajouter ce pet</button>;
  }
  const rarity = normalizeRarity(pet.rarity);
  const values = calculatePetValues(rarity, Number(pet.id || 0), pet.level, models, levels);
  return (
    <div className={styles.editor}>
      <div className={ui.grid2}>
        <RaritySelect value={rarity} onChange={(nextRarity) => {
          const model = firstPetModel(nextRarity, models);
          if (model) edit((draft) => applyPetSelection(draft, index, nextRarity, model.id, values.level, models, levels));
        }} />
        <label className={ui.field}>
          <span>Pet</span>
          <select value={values.id} onChange={(event) => edit((draft) => {
            applyPetSelection(draft, index, rarity, Number(event.target.value), values.level, models, levels);
          })}>
            {petModelsFor(rarity, models).map((model) => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
        </label>
        <NumberField label="Niveau" value={values.level} min={1} max={100} integer onChange={(level) => edit((draft) => {
          applyPetSelection(draft, index, rarity, values.id, level, models, levels);
        })} />
        <div className={styles.petType}>
          <span>Spécialisation</span>
          <strong>{petTypeLabel(values.type)}</strong>
        </div>
      </div>
      <CalculatedPreview attack={values.attack} health={values.health} recognized={values.recognized} />
      <SecondaryEditor
        lines={pet.secondaryStats}
        stats={stats}
        maxLines={companionAllowsSecondLine(rarity) ? 2 : 1}
        onChange={(lines) => edit((draft) => { draft.pets[index].secondaryStats = lines; })}
      />
    </div>
  );
}

function MountEditor({
  mount,
  edit,
  stats,
  models,
  levels
}: {
  mount: NormalizedMount | null;
  edit: (recipe: (draft: NormalizedProfile) => void) => void;
  stats: Array<{ id: keyof StatMap; label: string }>;
  models: MountModel[];
  levels: CompanionLevels[];
}) {
  if (!mount) {
    return <button className={ui.primary} onClick={() => edit((draft) => {
      const model = firstMountModel("Common", models) || models[0];
      if (model) applyMountSelection(draft, model.rarity, model.id, 1, models, levels);
    })}>Ajouter une monture</button>;
  }
  const rarity = normalizeRarity(mount.rarity);
  const values = calculateMountValues(rarity, Number(mount.id || 0), mount.level, models, levels);
  return (
    <div className={styles.editor}>
      <div className={ui.grid2}>
        <RaritySelect value={rarity} onChange={(nextRarity) => {
          const model = firstMountModel(nextRarity, models);
          if (model) edit((draft) => applyMountSelection(draft, nextRarity, model.id, values.level, models, levels));
        }} />
        <label className={ui.field}>
          <span>Monture</span>
          <select value={values.id} onChange={(event) => edit((draft) => {
            applyMountSelection(draft, rarity, Number(event.target.value), values.level, models, levels);
          })}>
            {mountModelsFor(rarity, models).map((model) => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
        </label>
        <NumberField label="Niveau" value={values.level} min={1} max={100} integer onChange={(level) => edit((draft) => {
          applyMountSelection(draft, rarity, values.id, level, models, levels);
        })} />
      </div>
      <CalculatedPreview attack={values.attack} health={values.health} recognized={values.recognized} />
      <SecondaryEditor
        lines={mount.secondaryStats}
        stats={stats}
        maxLines={companionAllowsSecondLine(rarity) ? 2 : 1}
        onChange={(lines) => edit((draft) => { draft.mount!.secondaryStats = lines; })}
      />
    </div>
  );
}

function SpellEditor({
  index,
  edit,
  spells
}: {
  index: number;
  edit: (recipe: (draft: NonNullable<ReturnType<typeof useWorkshop.getState>["profile"]>) => void) => void;
  spells: Array<{ id: string; name: string; rarity: string }>;
}) {
  const current = useWorkshop((state) => state.profile?.spells[index]);
  return (
    <div className={styles.editor}>
      <label className={ui.field}><span>Sort</span><select value={current?.id || ""} onChange={(event) => edit((draft) => {
        const id = event.target.value;
        const next = draft.spells.slice(0, 3);
        if (!id) next.splice(index, 1);
        else next[index] = { id, level: current?.level || 1, rarity: spells.find((spell) => spell.id === id)?.rarity };
        draft.spells = next.filter(Boolean);
      })}>
        <option value="">Aucun</option>
        {spells.map((spell) => <option key={spell.id} value={spell.id}>{spell.name} · {spell.rarity}</option>)}
      </select></label>
      {current && <NumberField label="Niveau" value={current.level} integer onChange={(value) => edit((draft) => { draft.spells[index].level = value; })} />}
    </div>
  );
}

function SecondaryEditor({
  lines,
  stats,
  maxLines = 2,
  onChange
}: {
  lines: SecondaryLine[];
  stats: Array<{ id: keyof StatMap; label: string }>;
  maxLines?: number;
  onChange: (lines: SecondaryLine[]) => void;
}) {
  return (
    <div className={styles.editor}>
      <strong>Stats secondaires</strong>
      {Array.from({ length: maxLines }, (_, index) => {
        const line = lines[index];
        return (
          <div className={styles.statLine} key={index}>
            <label className={ui.field}><span>Ligne {index + 1}</span><select value={line?.stat || ""} onChange={(event) => {
              const next = lines.slice(0, 2);
              const stat = event.target.value as keyof StatMap;
              if (!stat) next.splice(index, 1);
              else next[index] = { stat, sourceId: stat, value: line?.value || 0 };
              onChange(next.filter(Boolean));
            }}>
              <option value="">Aucune</option>
              {stats.map((stat) => <option key={stat.id} value={stat.id}>{stat.label}</option>)}
            </select></label>
            <NumberField label="Valeur" value={line?.value || 0} onChange={(value) => {
              if (!line) return;
              const next = lines.slice(0, 2);
              next[index] = { ...line, value };
              onChange(next);
            }} />
          </div>
        );
      })}
    </div>
  );
}

function NumberField({
  label,
  value,
  min = 0,
  max,
  integer,
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  integer?: boolean;
  onChange: (value: number) => void;
}) {
  return <label className={ui.field}><span>{label}</span><NumericInput value={Number.isFinite(value) ? value : min} min={min} max={max} integer={integer} onChange={onChange} /></label>;
}

function RaritySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className={ui.field}><span>Rareté</span><select value={normalizeRarity(value)} onChange={(event) => onChange(event.target.value)}>
    {rarityValues.map((rarity) => <option key={rarity} value={rarity}>{rarityLabels[rarity]}</option>)}
  </select></label>;
}

function CalculatedPreview({ attack, health, recognized }: { attack: number; health: number; recognized: boolean }) {
  return <div className={styles.calculated}>
    {recognized ? <>
      <div><span>Attaque calculée</span><strong>{format(attack)}</strong></div>
      <div><span>PV calculés</span><strong>{format(health)}</strong></div>
    </> : <p>Données de jeu introuvables pour cette sélection.</p>}
  </div>;
}

function applyItemSelection(
  profile: NormalizedProfile,
  slot: EquipmentSlot,
  age: number,
  weaponKind: WeaponKind,
  level: number,
  itemBases: ItemBase[],
  itemConfig: ItemConfig,
  ageOptions: AgeOption[]
) {
  const selected = resolveItemSelection(slot, age, weaponKind, itemBases, ageOptions);
  const values = calculateItemValues(slot, selected.age, selected.idx, level, itemBases, itemConfig);
  const previous = profile.equipment[slot];
  profile.equipment[slot] = {
    slot,
    name: slotLabels[slot],
    age: values.age,
    idx: values.idx,
    level: values.level,
    attack: values.attack,
    health: values.health,
    secondaryStats: (previous?.secondaryStats || []).slice(0, itemAllowsSecondLine(values.age) ? 2 : 1),
    recognized: Boolean(values.base)
  };
  if (slot === "Weapon" && values.base?.isRanged !== undefined) {
    profile.base.weaponStyle = values.base.isRanged ? "ranged" : "melee";
  }
}

function primitiveDisplayItem(slot: EquipmentSlot): NormalizedItem {
  return {
    slot,
    name: `${slotLabels[slot]} primitive`,
    age: 0,
    idx: slot === "Weapon" ? 1 : 0,
    level: 1,
    attack: 0,
    health: 0,
    secondaryStats: [],
    recognized: false
  };
}

function applyPetSelection(
  profile: NormalizedProfile,
  index: number,
  rarity: string,
  id: number,
  level: number,
  models: PetModel[],
  levels: CompanionLevels[]
) {
  const values = calculatePetValues(rarity, id, level, models, levels);
  const previous = profile.pets[index];
  while (profile.pets.length <= index) profile.pets.push({
    name: `Pet ${profile.pets.length + 1}`,
    level: 1,
    attack: 0,
    health: 0,
    secondaryStats: [],
    recognized: false
  });
  profile.pets[index] = {
    name: values.name,
    rarity: values.rarity,
    id: values.id,
    type: values.type,
    level: values.level,
    attack: values.attack,
    health: values.health,
    secondaryStats: (previous?.secondaryStats || []).slice(0, companionAllowsSecondLine(values.rarity) ? 2 : 1),
    recognized: values.recognized
  };
}

function applyMountSelection(
  profile: NormalizedProfile,
  rarity: string,
  id: number,
  level: number,
  models: MountModel[],
  levels: CompanionLevels[]
) {
  const values = calculateMountValues(rarity, id, level, models, levels);
  profile.mount = {
    name: values.name,
    rarity: values.rarity,
    id: values.id,
    level: values.level,
    attack: values.attack,
    health: values.health,
    secondaryStats: (profile.mount?.secondaryStats || []).slice(0, companionAllowsSecondLine(values.rarity) ? 2 : 1),
    recognized: values.recognized,
    skills: profile.mount?.skills || []
  };
}

function editorTitle(selected: NonNullable<ReturnType<typeof useWorkshop.getState>["selected"]>) {
  if (selected.kind === "equipment") return slotLabels[selected.id as EquipmentSlot];
  if (selected.kind === "pet") return `Pet ${selected.id + 1}`;
  if (selected.kind === "mount") return "Monture";
  if (selected.kind === "spell") return `Sort ${selected.id + 1}`;
  return "Alertes profil";
}

function totalSecondaryLines(profile: NormalizedProfile) {
  return [
    ...Object.values(profile.equipment),
    ...profile.pets.slice(0, 3),
    profile.mount
  ].reduce((total, item) => total + (item?.secondaryStats.filter((line) => line.stat && Number(line.value) > 0).length || 0), 0);
}

function format(value: unknown, digits = 0) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

function BuildSkeleton() {
  return <div className={ui.page}><div className={ui.empty}>Préparation de l’atelier…</div></div>;
}
