import { useMemo, useState } from "react";
import { LockKeyhole, Minus, Plus } from "lucide-react";
import { useWorkshop } from "../../store/workshop";
import type { TechNode, TechTreeName } from "../../types";
import ui from "../shared/ui.module.css";
import styles from "./TalentsPage.module.css";

const trees: Array<{ id: TechTreeName; label: string }> = [
  { id: "Forge", label: "Forge" },
  { id: "Power", label: "Puissance" },
  { id: "SkillsPetTech", label: "Compétences" }
];

export function TalentsPage() {
  const profile = useWorkshop((state) => state.profile);
  const techNodes = useWorkshop((state) => state.gameData.normalized?.techNodes || []);
  const editProfile = useWorkshop((state) => state.editProfile);
  const [tree, setTree] = useState<TechTreeName>("Forge");
  const [tier, setTier] = useState(0);

  const treeNodes = useMemo(
    () => techNodes.filter((node) => node.tree === tree).sort((a, b) => a.layer - b.layer),
    [techNodes, tree]
  );
  const visible = treeNodes.filter((node) => node.tier === tier);
  const levels = profile?.talentTree[tree] || {};
  const byId = new Map(treeNodes.map((node) => [node.id, node]));

  const setLevel = (node: TechNode, requestedLevel: number) => {
    if (!profile) return;
    const current = Number(levels[node.id] || 0);
    const next = Math.max(0, Math.min(node.maxLevel, requestedLevel));
    if (next > current && !isUnlocked(node, levels)) return;
    const dependents = activeDependents(node, treeNodes, levels);
    if (next === 0 && dependents.length && !window.confirm(`Retirer ce prérequis retirera aussi : ${dependents.map((item) => pretty(item.type)).join(", ")}.`)) return;
    editProfile((draft) => {
      if (next) draft.talentTree[node.tree][node.id] = next;
      else delete draft.talentTree[node.tree][node.id];
      pruneLocked(draft.talentTree[node.tree], treeNodes);
    });
  };

  return (
    <div className={ui.page}>
      <header className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Talents</p>
          <h1>Arbre de progression</h1>
          <p className={ui.muted}>Choisis une branche, puis avance palier par palier.</p>
        </div>
        <div className={`${ui.segmented} ${styles.treeNav}`}>
          {trees.map((item) => (
            <button
              key={item.id}
              className={`${ui.tab} ${tree === item.id ? ui.tabActive : ""}`}
              onClick={() => { setTree(item.id); setTier(0); }}
            >{item.label}</button>
          ))}
        </div>
      </header>

      <nav className={styles.tierNav} aria-label="Paliers de talents">
        {Array.from({ length: 5 }, (_, index) => {
          const nodes = treeNodes.filter((node) => node.tier === index);
          const learned = nodes.filter((node) => Number(levels[node.id]) > 0).length;
          return (
            <button
              key={index}
              className={tier === index ? styles.tierActive : undefined}
              onClick={() => setTier(index)}
              aria-current={tier === index ? "step" : undefined}
            >
              <span>Palier {index + 1}</span>
              <small>{learned}/{nodes.length}</small>
            </button>
          );
        })}
      </nav>

      <section className={styles.talentGrid} aria-label={`Talents du palier ${tier + 1}`}>
        {visible.map((node) => {
          const level = Number(levels[node.id] || 0);
          const unlocked = isUnlocked(node, levels);
          const maximum = level >= node.maxLevel;
          const requirements = node.requirements
            .map((id) => byId.get(id))
            .filter((item): item is TechNode => Boolean(item));
          return (
            <article
              key={node.id}
              className={`${styles.talent} ${!unlocked && !level ? styles.locked : level ? styles.learned : ""} ${maximum ? styles.maximum : ""}`}
            >
              <div className={styles.talentTop}>
                <div>
                  <small>{maximum ? "Maximum" : level ? "Appris" : unlocked ? "Disponible" : "Verrouillé"}</small>
                  <h2>{pretty(node.type)}</h2>
                </div>
                {!unlocked && !level && <LockKeyhole size={19} aria-hidden />}
              </div>
              <p>
                {requirements.length
                  ? `Prérequis : ${requirements.map((item) => pretty(item.type)).join(" + ")}`
                  : "Talent de départ"}
              </p>
              <div className={styles.stepper}>
                <button
                  onClick={() => setLevel(node, level - 1)}
                  disabled={!level}
                  aria-label={`Réduire ${pretty(node.type)}`}
                ><Minus size={18} /></button>
                <strong>Niv. {level} / {node.maxLevel}</strong>
                <button
                  onClick={() => setLevel(node, level + 1)}
                  disabled={!unlocked || maximum}
                  aria-label={`Améliorer ${pretty(node.type)}`}
                ><Plus size={18} /></button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function isUnlocked(node: TechNode, levels: Record<string, number>) {
  return node.requirements.every((id) => Number(levels[id]) > 0);
}

function activeDependents(node: TechNode, nodes: TechNode[], levels: Record<string, number>) {
  const found = new Set<number>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of nodes) {
      if (!Number(levels[candidate.id]) || found.has(candidate.id)) continue;
      if (candidate.requirements.some((id) => id === node.id || found.has(id))) {
        found.add(candidate.id);
        changed = true;
      }
    }
  }
  return nodes.filter((candidate) => found.has(candidate.id));
}

function pruneLocked(levels: Record<string, number>, nodes: TechNode[]) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (!Number(levels[node.id])) continue;
      if (!isUnlocked(node, levels)) {
        delete levels[node.id];
        changed = true;
      }
    }
  }
}

function pretty(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}
