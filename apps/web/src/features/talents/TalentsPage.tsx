import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { X } from "lucide-react";
import { useWorkshop } from "../../store/workshop";
import type { TechNode, TechTreeName } from "../../types";
import ui from "../shared/ui.module.css";
import styles from "./TalentsPage.module.css";

const trees: Array<{ id: TechTreeName; label: string }> = [
  { id: "Forge", label: "Forge" },
  { id: "Power", label: "Puissance" },
  { id: "SkillsPetTech", label: "Compétences / animaux / tech" }
];

export function TalentsPage() {
  const profile = useWorkshop((state) => state.profile);
  const gameData = useWorkshop((state) => state.gameData);
  const techNodes = gameData.normalized?.techNodes || [];
  const editProfile = useWorkshop((state) => state.editProfile);
  const [tree, setTree] = useState<TechTreeName>("Forge");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const visible = useMemo(() => techNodes.filter((node) => node.tree === tree), [techNodes, tree]);
  const nodes = useMemo<Node[]>(() => visible.map((node) => {
    const level = Number(profile?.talentTree[tree]?.[node.id] || 0);
    const unlocked = node.requirements.every((id) => Number(profile?.talentTree[tree]?.[id] || 0) > 0);
    const status = !unlocked && !level ? "locked" : level >= node.maxLevel ? "maximum" : level ? "learned" : "available";
    return {
      id: String(node.id),
      position: { x: node.layer * 235, y: node.tier * 154 },
      className: `${styles.node} ${styles[status]}`,
      data: {
        label: <><strong>{pretty(node.type)}</strong><span>Niv. {level}/{node.maxLevel} · #{node.id}</span></>
      },
      draggable: false,
      selectable: true
    };
  }), [profile, tree, visible]);
  const edges = useMemo<Edge[]>(() => visible.flatMap((node) =>
    node.requirements.map((requirement) => ({
      id: `${requirement}-${node.id}`,
      source: String(requirement),
      target: String(node.id),
      animated: Number(profile?.talentTree[tree]?.[node.id] || 0) > 0,
      style: { stroke: Number(profile?.talentTree[tree]?.[node.id] || 0) > 0 ? "#2f7852" : "#aeb5af", strokeWidth: 2 }
    }))
  ), [profile, tree, visible]);
  const selected = visible.find((node) => node.id === selectedId) || null;

  const setLevel = (node: TechNode, level: number) => {
    if (!profile) return;
    const current = Number(profile.talentTree[node.tree]?.[node.id] || 0);
    const next = Math.max(0, Math.min(node.maxLevel, level));
    if (next > current && !node.requirements.every((id) => Number(profile.talentTree[node.tree]?.[id] || 0) > 0)) return;
    const dependents = activeDependents(node, visible, profile.talentTree[node.tree]);
    if (next === 0 && dependents.length && !window.confirm(`Retirer ce prérequis retirera aussi : ${dependents.map((item) => pretty(item.type)).join(", ")}.`)) return;
    editProfile((draft) => {
      if (next) draft.talentTree[node.tree][node.id] = next;
      else delete draft.talentTree[node.tree][node.id];
      pruneLocked(draft.talentTree[node.tree], visible);
    });
  };

  return (
    <div className={ui.page}>
      <header className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Talents</p>
          <h1>Arbre de progression</h1>
        </div>
        <div className={ui.segmented}>
          {trees.map((item) => (
            <button
              key={item.id}
              className={`${ui.tab} ${tree === item.id ? ui.tabActive : ""}`}
              onClick={() => { setTree(item.id); setSelectedId(null); }}
            >{item.label}</button>
          ))}
        </div>
      </header>

      <div className={styles.canvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={(_, node) => setSelectedId(Number(node.id))}
          fitView
          minZoom={0.25}
          maxZoom={1.5}
          nodesConnectable={false}
        >
          <Background color="#d9dcd7" gap={24} size={1} />
          <MiniMap pannable zoomable nodeColor={(node) => node.className?.includes(styles.learned) ? "#2f7852" : "#a35f32"} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {selected && (
        <div className={ui.drawerBackdrop} onMouseDown={() => setSelectedId(null)}>
          <aside className={ui.drawer} onMouseDown={(event) => event.stopPropagation()}>
            <header className={ui.drawerHeader}>
              <div><p className={ui.eyebrow}>{tree}</p><h2>{pretty(selected.type)}</h2></div>
              <button className={ui.close} onClick={() => setSelectedId(null)} aria-label="Fermer"><X size={20} /></button>
            </header>
            <div className={styles.detail}>
              <div className={styles.detailMeta}>
                <span>Tier {selected.tier + 1}</span>
                <span>Maximum {selected.maxLevel}</span>
              </div>
              <p className={ui.muted}>
                {selected.requirements.length ? `Prérequis : ${selected.requirements.map((id) => `#${id}`).join(", ")}.` : "Talent de départ."}
              </p>
              <div className={styles.stepper}>
                <button onClick={() => setLevel(selected, Number(profile?.talentTree[tree]?.[selected.id] || 0) - 1)}>−</button>
                <strong>{Number(profile?.talentTree[tree]?.[selected.id] || 0)} / {selected.maxLevel}</strong>
                <button onClick={() => setLevel(selected, Number(profile?.talentTree[tree]?.[selected.id] || 0) + 1)}>+</button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
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
      if (!node.requirements.every((id) => Number(levels[id]) > 0)) {
        delete levels[node.id];
        changed = true;
      }
    }
  }
}

function pretty(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}
