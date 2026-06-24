// Legacy V2 kept during the V3 migration.
import { useEffect, useMemo, useState } from "react";
import "../styles.css";
import {
  Activity,
  BarChart3,
  Check,
  Database,
  Download,
  FileJson,
  FlaskConical,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  Shield,
  Swords,
  UserPlus
} from "lucide-react";
import type {
  DropComparisonResult,
  EquipmentSlot,
  EvaluationResult,
  NormalizedMount,
  NormalizedPet,
  NormalizedProfile,
  NormalizedSpellSelection,
  Objective,
  PvpResult,
  ScenarioResult,
  SecondaryLine,
  StatMap
} from "@forge-master/simulator";

type Page = "profile" | "audit" | "recommendations" | "compare" | "pvp";
type Session = { authenticated: boolean; username?: string };
type DropTarget = "equipment" | "pet" | "mount";
type CloudProfile = {
  id: string;
  name: string;
  source: string;
  dataVersion: string;
  confidence: string;
  normalized: NormalizedProfile;
  createdAt: string;
  updatedAt: string;
};
type StatId = keyof StatMap;
type StatOption = { id: StatId; label: string; max: number };
type SpellOption = {
  id: string;
  name: string;
  rarity: string;
  cooldown?: number;
  activeDuration?: number;
  mechanics?: {
    kind: "buff" | "damage";
    targetMode: "self" | "single" | "all";
    hitCount: number;
    hitInterval: number;
    castDelay: number;
    damageValueMode: "total" | "per_hit";
    confidence: "high" | "medium" | "low";
  };
};
type AgeOption = { value: number; label: string };
type ItemBase = { slot: EquipmentSlot; age: number; idx: number; attack: number; health: number; isRanged?: boolean };
type ItemConfig = { levelScalingBase: number; meleeDamageMultiplier: number; maxLevel: number };
type PetType = "Balanced" | "Damage" | "Health";
type PetModel = { rarity: string; id: number; type: PetType };
type MountModel = { rarity: string; id: number };
type CompanionLevel = { level: number; attack: number; health: number };
type CompanionLevels = { rarity: string; levels: CompanionLevel[] };
type WeaponKind = "melee" | "meleeHybrid" | "ranged";
type TechTreeName = "Forge" | "Power" | "SkillsPetTech";
type ScenarioFormState = {
  levelRange: { min: number; max: number; age?: number; combat?: number; difficulty?: number };
  endurance: { startDamagePct: number; growthPct: number; maxSeconds: number };
  timeToKill: { targetSeconds: number; incomingDamagePct: number; maxSeconds: number };
  gauntlet: { mobCount: number; firstMobSeconds: number; firstDamagePct: number; healthGrowthPct: number; damageGrowthPct: number; pauseSeconds: number; maxSeconds: number };
};
type TechEffect = { targetType: string; statType: string; valuePerLevel: number; itemType?: number };
type TechNode = {
  tree: TechTreeName;
  id: number;
  tier: number;
  layer: number;
  type: string;
  requirements: number[];
  maxLevel: number;
  effects?: TechEffect[];
};
type GameDataInfo = {
  manifest?: {
    version: string;
    sourceRepo: string;
    sourceRef: string;
    generatedAt: string;
    files: Array<{ file: string; sha256: string; sourceUrl: string }>;
  };
  normalized?: {
    stats: StatOption[];
    techNodes: TechNode[];
    spells: SpellOption[];
    ageOptions: AgeOption[];
    itemBases: ItemBase[];
    petModels: PetModel[];
    mountModels: MountModel[];
    petLevels: CompanionLevels[];
    mountLevels: CompanionLevels[];
    itemConfig: ItemConfig;
  };
};

const GUEST_PROFILE_KEY = "forge-master-v2-guest-profile";
const OPPONENT_PROFILE_KEY = "forge-master-v2-opponent-profile";
const pages: Array<{ id: Page; label: string; icon: typeof FileJson }> = [
  { id: "profile", label: "Profil", icon: FileJson },
  { id: "audit", label: "Audit", icon: Shield },
  { id: "recommendations", label: "Recommandations", icon: BarChart3 },
  { id: "compare", label: "Drop", icon: FlaskConical },
  { id: "pvp", label: "PvP", icon: Swords }
];
const equipmentSlots: EquipmentSlot[] = ["Weapon", "Helmet", "Body", "Gloves", "Belt", "Necklace", "Ring", "Shoe"];
const itemTypeToSlot: EquipmentSlot[] = ["Helmet", "Body", "Gloves", "Necklace", "Ring", "Weapon", "Shoe", "Belt"];
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
const fallbackItemConfig: ItemConfig = { levelScalingBase: 1.01, meleeDamageMultiplier: 1.6, maxLevel: 98 };
const itemSecondaryLine2MinAge = 7;
const rarityOptions = ["Common", "Rare", "Epic", "Legendary", "Ultimate", "Mythic"];
const petMountSecondLineMinRarity = "Legendary";
const defaultScenarios: ScenarioFormState = {
  levelRange: { min: 1, max: 1, difficulty: 0 },
  endurance: { startDamagePct: 2, growthPct: 0.12, maxSeconds: 900 },
  timeToKill: { targetSeconds: 24, incomingDamagePct: 0.35, maxSeconds: 300 },
  gauntlet: { mobCount: 8, firstMobSeconds: 8, firstDamagePct: 0.85, healthGrowthPct: 12, damageGrowthPct: 10, pauseSeconds: 1, maxSeconds: 900 }
};
const fallbackAgeOptions: AgeOption[] = [
  { value: 0, label: "Primitive" },
  { value: 1, label: "Medieval" },
  { value: 2, label: "Debut moderne" },
  { value: 3, label: "Moderne" },
  { value: 4, label: "Espace" },
  { value: 5, label: "Interstellaire" },
  { value: 6, label: "Multiverse" },
  { value: 7, label: "Quantique" },
  { value: 8, label: "Enfers" },
  { value: 9, label: "Divin" }
];
const talentTabs: Array<{ id: TechTreeName; label: string }> = [
  { id: "Forge", label: "Forge" },
  { id: "Power", label: "Puissance" },
  { id: "SkillsPetTech", label: "Competences / animaux / tech" }
];

export default function App() {
  const [page, setPage] = useState<Page>("profile");
  const [session, setSession] = useState<Session>({ authenticated: false });
  const [sessionReady, setSessionReady] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<NormalizedProfile | null>(() => readGuestProfile());
  const [cloudProfiles, setCloudProfiles] = useState<CloudProfile[]>([]);
  const [cloudProfileId, setCloudProfileId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [opponent, setOpponent] = useState<NormalizedProfile | null>(() => readStoredProfile(OPPONENT_PROFILE_KEY));
  const [pvpEditorMode, setPvpEditorMode] = useState<"compact" | "detailed">("compact");
  const [evaluation, setEvaluation] = useState<EvaluationResult | PvpResult | null>(null);
  const [dataInfo, setDataInfo] = useState<GameDataInfo>({});
  const [objective, setObjective] = useState<Objective>("progress");
  const [scenarios, setScenarios] = useState<ScenarioFormState>(defaultScenarios);
  const [drop, setDrop] = useState({
    target: "equipment" as DropTarget,
    slot: "Weapon",
    rarity: "Common",
    id: "0",
    petType: "Balanced" as PetType,
    age: "0",
    idx: "0",
    level: "1",
    stat1: "damage",
    value1: "0",
    stat2: "",
    value2: "0"
  });
  const [dropResult, setDropResult] = useState<DropComparisonResult | null>(null);
  const stats = dataInfo.normalized?.stats || [];
  const techNodes = dataInfo.normalized?.techNodes || [];
  const spells = dataInfo.normalized?.spells || [];
  const ageOptions = dataInfo.normalized?.ageOptions || fallbackAgeOptions;
  const itemBases = dataInfo.normalized?.itemBases || [];
  const petModels = dataInfo.normalized?.petModels || [];
  const mountModels = dataInfo.normalized?.mountModels || [];
  const petLevels = dataInfo.normalized?.petLevels || [];
  const mountLevels = dataInfo.normalized?.mountLevels || [];
  const itemConfig = dataInfo.normalized?.itemConfig || fallbackItemConfig;

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const restored = await api<Session>("/api/session");
        if (!active) return;
        setSession(restored);
        if (restored.authenticated) {
          const result = await api<{ profiles: CloudProfile[] }>("/api/profiles");
          if (!active) return;
          setCloudProfiles(result.profiles);
          if (result.profiles[0]) {
            applyCloudProfile(result.profiles[0]);
            localStorage.removeItem(GUEST_PROFILE_KEY);
          } else if (profile) {
            const created = await createCloudProfile(profile);
            if (!active) return;
            setCloudProfiles([created]);
            setCloudProfileId(created.id);
            localStorage.removeItem(GUEST_PROFILE_KEY);
            setMessage("Profil local synchronise avec le compte.");
          }
        }
      } catch {
        if (active) setMessage("API indisponible.");
      } finally {
        if (active) setSessionReady(true);
      }
    };
    restoreSession();
    api<GameDataInfo>("/api/game-data/current").then(setDataInfo).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (sessionReady && !session.authenticated) {
      localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
    }
    api<EvaluationResult | PvpResult>("/api/simulations/evaluate", {
      method: "POST",
      body: { profile, opponent: usesPvp(objective) ? opponent : undefined, objective, fightDuration: 60, scenarios }
    })
      .then(setEvaluation)
      .catch((error) => setMessage(error.message));
  }, [profile, opponent, objective, scenarios, session.authenticated, sessionReady]);

  useEffect(() => {
    if (opponent) localStorage.setItem(OPPONENT_PROFILE_KEY, JSON.stringify(opponent));
  }, [opponent]);

  const pvp = evaluation && "pvp" in evaluation ? evaluation.pvp : null;
  const recognized = useMemo(() => {
    if (!profile) return { items: 0, pets: 0, mount: 0 };
    return {
      items: Object.values(profile.equipment).filter((item) => item?.recognized).length,
      pets: profile.pets.filter((pet) => pet.recognized).length,
      mount: profile.mount?.recognized ? 1 : 0
    };
  }, [profile]);
  const dropSlot = drop.slot as EquipmentSlot;
  const dropPreview = calculateItemValues(dropSlot, readInputNumber(drop.age), readInputNumber(drop.idx), readInputNumber(drop.level), itemBases, itemConfig);
  const petDropPreview = calculatePetValues(drop.rarity, readInputNumber(drop.id), drop.petType, readInputNumber(drop.level), petModels, petLevels);
  const mountDropPreview = calculateMountValues(drop.rarity, readInputNumber(drop.id), readInputNumber(drop.level), mountModels, mountLevels);
  const dropWeaponKind = weaponKindFromBase(dropPreview.base);
  const dropAllowsSecondLine = drop.target === "equipment"
    ? itemAllowsSecondLine(readInputNumber(drop.age))
    : petMountAllowsSecondLine(drop.rarity);
  const updateDrop = (patch: Partial<typeof drop>) => {
    setDrop((current) => ({ ...current, ...patch }));
    setDropResult(null);
  };

  const importProfile = async (file: File, target: "player" | "opponent") => {
    const raw = JSON.parse(await file.text());
    const result = await api<{ normalized: NormalizedProfile; evaluation?: EvaluationResult; saved?: CloudProfile | null }>("/api/profiles/import/json", {
      method: "POST",
      body: { profile: raw, name: raw.name || raw.profile?.name || file.name.replace(/\.json$/i, "") }
    });
    if (target === "player") {
      setProfile(result.normalized);
      setEvaluation(result.evaluation || null);
      setCloudProfileId(result.saved?.id || null);
      if (result.saved) {
        setCloudProfiles((current) => [result.saved!, ...current.filter((item) => item.id !== result.saved!.id)]);
        localStorage.removeItem(GUEST_PROFILE_KEY);
      }
      setMessage(session.authenticated ? "Profil importé et synchronisé." : "Profil importé en mode invité.");
    } else {
      setOpponent(result.normalized);
      setObjective("pvp");
      setMessage("Adversaire importé.");
    }
  };

  const exportProfile = () => {
    if (!profile) {
      setMessage("Aucun profil a exporter.");
      return;
    }
    const payload = {
      schema: "forge-master-v2-profile",
      exportedAt: new Date().toISOString(),
      dataVersion: profile.dataVersion,
      profile
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(profile.name || "profil")}.forge-master.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage("Profil exporte.");
  };

  const createManual = async () => {
    const result = await api<{ normalized: NormalizedProfile }>("/api/profiles/manual", { method: "POST", body: {} });
    syncManualCompanionValues(result.normalized, petModels, petLevels, mountModels, mountLevels);
    refreshManualTotals(result.normalized, stats, techNodes);
    setProfile(result.normalized);
    setCloudProfileId(null);
    setMessage("Profil manuel prêt.");
  };

  const createManualOpponent = async () => {
    const result = await api<{ normalized: NormalizedProfile }>("/api/profiles/manual", { method: "POST", body: {} });
    syncManualCompanionValues(result.normalized, petModels, petLevels, mountModels, mountLevels);
    refreshManualTotals(result.normalized, stats, techNodes);
    result.normalized.name = "Adversaire manuel";
    setOpponent(result.normalized);
    setObjective("pvp");
    setMessage("Adversaire manuel prêt.");
  };

  const clonePlayerAsOpponent = () => {
    if (!profile) return;
    const cloned = cloneProfile(profile);
    prepareImportedForEditing(cloned, techNodes, stats);
    cloned.name = `${profile.name} - adversaire`;
    setOpponent(cloned);
    setObjective("pvp");
    setMessage("Profil joueur copié comme adversaire.");
  };

  const saveProfile = async () => {
    if (!profile) return;
    if (!session.authenticated) {
      setMessage("Profil sauvegardé localement.");
      return;
    }
    setSyncing(true);
    try {
      const result = cloudProfileId
        ? await api<{ profile: CloudProfile }>(`/api/profiles/${cloudProfileId}`, {
            method: "PUT",
            body: { name: profile.name, normalized: profile, source: profile.source }
          })
        : { profile: await createCloudProfile(profile) };
      const saved = result.profile;
      setCloudProfileId(saved.id);
      setCloudProfiles((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      localStorage.removeItem(GUEST_PROFILE_KEY);
    } finally {
      setSyncing(false);
    }
    setMessage("Profil synchronisé.");
  };

  const runDrop = async () => {
    if (!profile) return;
    const slot = drop.slot as EquipmentSlot;
    const isEquipment = drop.target === "equipment";
    const dropValues = isEquipment
      ? calculateItemValues(slot, readInputNumber(drop.age), readInputNumber(drop.idx), readInputNumber(drop.level), itemBases, itemConfig)
      : null;
    const companionValues = drop.target === "pet" ? petDropPreview : mountDropPreview;
    if (isEquipment && !dropValues?.base) {
      setMessage("Base objet introuvable pour cet age/idx.");
      return;
    }
    if (!isEquipment && !companionValues.recognized) {
      setMessage(`${dropTargetLabel(drop.target)} introuvable pour cette rarete et ce niveau.`);
      return;
    }
    const secondaryStats = [
      drop.stat1 ? { stat: drop.stat1, value: readInputNumber(drop.value1) } : null,
      dropAllowsSecondLine && drop.stat2 ? { stat: drop.stat2, value: readInputNumber(drop.value2) } : null
    ].filter(Boolean);
    const payload = {
      profile,
      objective,
      drop: {
        target: drop.target,
        slot: isEquipment ? slot : undefined,
        rarity: isEquipment ? undefined : companionValues.rarity,
        id: isEquipment ? undefined : companionValues.id,
        petType: drop.target === "pet" ? petDropPreview.type : undefined,
        level: isEquipment ? dropValues!.level : companionValues.level,
        attack: isEquipment ? dropValues!.attack : companionValues.attack,
        health: isEquipment ? dropValues!.health : companionValues.health,
        secondaryStats
      }
    };
    const result = await api<DropComparisonResult>("/api/simulations/drop-compare", { method: "POST", body: payload });
    setDropResult(result);
  };

  const equipComparedDrop = () => {
    if (!profile || !dropResult) return;
    const slot = drop.slot as EquipmentSlot;
    const draft = cloneProfile(profile);
    prepareImportedForEditing(draft, techNodes, stats);
    const lines = [
      drop.stat1 ? { stat: drop.stat1 as StatId, sourceId: drop.stat1, value: readInputNumber(drop.value1) } : null,
      dropAllowsSecondLine && drop.stat2 ? { stat: drop.stat2 as StatId, sourceId: drop.stat2, value: readInputNumber(drop.value2) } : null
    ].filter(Boolean) as SecondaryLine[];

    if (drop.target === "pet") {
      const petIndex = clamp(dropResult.bestPetIndex ?? 0, 0, 2);
      const pet = ensureManualPet(draft, petIndex);
      pet.name = `Pet ${petIndex + 1}`;
      pet.rarity = petDropPreview.rarity;
      pet.id = petDropPreview.id;
      pet.type = petDropPreview.type;
      pet.level = petDropPreview.level;
      pet.attack = petDropPreview.attack;
      pet.health = petDropPreview.health;
      pet.secondaryStats = lines;
      pet.recognized = petDropPreview.recognized;
    } else if (drop.target === "mount") {
      const mount = ensureManualMount(draft);
      mount.name = "Monture";
      mount.rarity = mountDropPreview.rarity;
      mount.id = mountDropPreview.id;
      mount.level = mountDropPreview.level;
      mount.attack = mountDropPreview.attack;
      mount.health = mountDropPreview.health;
      mount.secondaryStats = lines;
      mount.recognized = mountDropPreview.recognized;
    } else {
      const item = ensureManualItem(draft, slot);
      item.age = dropPreview.age;
      item.idx = dropPreview.idx;
      item.level = dropPreview.level;
      item.attack = dropPreview.attack;
      item.health = dropPreview.health;
      item.recognized = true;
      if (slot === "Weapon" && typeof dropPreview.base?.isRanged === "boolean") {
        draft.base.weaponStyle = dropPreview.base.isRanged ? "ranged" : "melee";
      }
      item.secondaryStats = lines;
    }

    refreshManualTotals(draft, stats, techNodes);
    setProfile(draft);
    setDropResult(null);
    setMessage(drop.target === "pet"
      ? `Drop equipe a la place du Pet ${(dropResult.bestPetIndex ?? 0) + 1}.`
      : `${dropTargetLabel(drop.target)} equipe.`);
  };

  const auth = async (mode: "login" | "register") => {
    const username = (document.getElementById("username") as HTMLInputElement | null)?.value || "";
    const password = (document.getElementById("password") as HTMLInputElement | null)?.value || "";
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const result = await api<{ username: string }>(path, { method: "POST", body: { username, password } });
    setSession({ authenticated: true, username: result.username });
    setSessionReady(true);
    const stored = await api<{ profiles: CloudProfile[] }>("/api/profiles");
    if (stored.profiles[0]) {
      setCloudProfiles(stored.profiles);
      applyCloudProfile(stored.profiles[0]);
      localStorage.removeItem(GUEST_PROFILE_KEY);
      setMessage("Connecté. Profil chargé depuis le compte.");
      return;
    }
    if (profile) {
      const created = await createCloudProfile(profile);
      setCloudProfiles([created]);
      setCloudProfileId(created.id);
      localStorage.removeItem(GUEST_PROFILE_KEY);
      setMessage(mode === "login" ? "Connecté. Profil local synchronisé." : "Compte créé et profil synchronisé.");
      return;
    }
    setMessage(mode === "login" ? "Connecté. Aucun profil enregistré." : "Compte créé.");
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {});
    setSession({ authenticated: false });
    setCloudProfiles([]);
    setCloudProfileId(null);
    setProfile(readGuestProfile());
    setEvaluation(null);
    setMessage("Déconnecté.");
  };

  const selectCloudProfile = (id: string) => {
    const selected = cloudProfiles.find((item) => item.id === id);
    if (!selected) return;
    applyCloudProfile(selected);
    setMessage(`Profil "${selected.name}" chargé.`);
  };

  function applyCloudProfile(saved: CloudProfile) {
    setProfile(saved.normalized);
    setCloudProfileId(saved.id);
  }

  async function createCloudProfile(current: NormalizedProfile): Promise<CloudProfile> {
    const result = await api<{ profile: CloudProfile }>("/api/profiles", {
      method: "POST",
      body: { name: current.name, normalized: current, source: current.source }
    });
    return result.profile;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/forge-mark.svg" alt="" />
          <div>
            <strong>Forge Master V2</strong>
            <span>{dataInfo.manifest?.version || "données..."}</span>
          </div>
        </div>
        <nav className="nav-list">
          {pages.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={page === item.id ? "active" : ""}
                aria-current={page === item.id ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                onClick={() => {
                  setPage(item.id);
                  if (item.id === "pvp") setObjective("pvp");
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="account-strip">
          <span>{session.authenticated ? session.username : "Invité"}</span>
          <button type="button" title={session.authenticated ? "Déconnexion" : "Compte"} onClick={session.authenticated ? logout : () => setPage("profile")}>
            {session.authenticated ? <LogOut size={18} /> : <LogIn size={18} />}
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-head">
          <div>
            <h1>{profile?.name || "Aucun profil"}</h1>
            <span className={`confidence ${profile?.confidence || "manual_required"}`}>{labelConfidence(profile?.confidence)}</span>
          </div>
          <div className="head-actions">
            <select value={objective} onChange={(event) => setObjective(event.target.value as Objective)}>
              <option value="progress">Progression PvE</option>
              <option value="damage">DPS PvE</option>
              <option value="survival">Survie PvE</option>
              <option value="balanced">Équilibre PvE/PvP</option>
              <option value="pvp">PvP</option>
            </select>
            <button type="button" onClick={exportProfile} disabled={!profile}><Download size={17} />Exporter</button>
            <button type="button" onClick={() => saveProfile().catch((error) => setMessage(error.message))} disabled={!profile || syncing}>
              <Save size={17} />{syncing ? "Synchronisation..." : session.authenticated ? "Synchroniser" : "Sauver local"}
            </button>
          </div>
        </header>

        {message && <div className="toast">{message}</div>}

        {page === "profile" && (
          <section className="screen">
            <div className="two-col">
              <section className="panel">
                <div className="panel-head"><h2>Import</h2><FileJson size={20} /></div>
                <label className="file-zone">
                  <input type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && importProfile(event.target.files[0], "player").catch((error) => setMessage(error.message))} />
                  <span>Profil JSON compatible</span>
                </label>
                <button className="primary" type="button" onClick={createManual}><RefreshCw size={17} />Profil manuel</button>
                <div className="metric-row">
                  <Metric label="Objets" value={`${recognized.items}/8`} />
                  <Metric label="Pets" value={`${recognized.pets}/3`} />
                  <Metric label="Monture" value={recognized.mount ? "OK" : "vide"} />
                </div>
              </section>

              <section className="panel">
                <div className="panel-head"><h2>Compte</h2><Activity size={20} /></div>
                {session.authenticated ? (
                  <div className="cloud-account">
                    <div className="sync-status">
                      <strong>{session.username}</strong>
                      <span>{cloudProfileId ? "Profil synchronisé dans Postgres" : "Profil actuel pas encore synchronisé"}</span>
                    </div>
                    <label>
                      <span>Profils du compte</span>
                      <select value={cloudProfileId || ""} onChange={(event) => selectCloudProfile(event.target.value)}>
                        <option value="" disabled>{cloudProfiles.length ? "Choisir un profil" : "Aucun profil enregistré"}</option>
                        {cloudProfiles.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} - {formatSyncDate(item.updatedAt)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="storage-hint">Ces données seront retrouvées après connexion sur un autre appareil.</p>
                  </div>
                ) : (
                  <>
                    <div className="auth-grid">
                      <label><span>Utilisateur</span><input id="username" autoComplete="username" /></label>
                      <label><span>Mot de passe</span><input id="password" type="password" autoComplete="current-password" /></label>
                    </div>
                    <div className="button-line">
                      <button type="button" onClick={() => auth("login").catch((error) => setMessage(error.message))}><LogIn size={17} />Connexion</button>
                      <button type="button" onClick={() => auth("register").catch((error) => setMessage(error.message))}><UserPlus size={17} />Créer</button>
                    </div>
                    <p className="storage-hint">En mode invité, le profil reste uniquement sur cet appareil. Créez un compte pour le synchroniser.</p>
                  </>
                )}
                <SourceBlock dataInfo={dataInfo} />
              </section>
            </div>

            <ManualEditor
              profile={profile}
              stats={stats}
              techNodes={techNodes}
              spells={spells}
              ageOptions={ageOptions}
              itemBases={itemBases}
              itemConfig={itemConfig}
              petModels={petModels}
              mountModels={mountModels}
              petLevels={petLevels}
              mountLevels={mountLevels}
              onChange={setProfile}
            />
          </section>
        )}

        {page === "audit" && (
          <section className="screen">
            <div className="metric-row wide">
              <Metric label="Attaque totale" value={format(profile?.base.attack)} />
              <Metric label="PV totaux" value={format(profile?.base.health)} />
              <Metric label="DPS" value={format(evaluation?.profile.totalDps)} />
              <Metric label="Sustain/s" value={format(evaluation?.profile.healingPerSecond)} />
            </div>
            <section className="panel">
              <div className="panel-head"><h2>Audit</h2><Shield size={20} /></div>
              <AuditList profile={profile} />
            </section>
            <section className="panel">
              <div className="panel-head"><h2>Voir le calcul</h2><Database size={20} /></div>
              <Breakdown profile={profile} evaluation={evaluation} stats={stats} techNodes={techNodes} spells={spells} />
            </section>
          </section>
        )}

        {page === "recommendations" && (
          <section className="screen">
            <div className="metric-row wide">
              <Metric label="Score" value={evaluation?.score.toFixed(3)} />
              <Metric label="Confiance" value={labelConfidence(evaluation?.confidence)} />
              <Metric label="Priorité" value={evaluation?.recommendations[0]?.title || "n/a"} />
            </div>
            <ScenarioControls scenarios={scenarios} onChange={setScenarios} />
            <ScenarioSummary scenarios={evaluation?.scenarios || []} />
            <section className="list-grid">
              {(evaluation?.recommendations || []).map((rec) => (
                <article className="action-card" key={`${rec.kind}-${rec.title}`}>
                  <span>{rec.kind}</span>
                  <strong>{rec.title}</strong>
                  <p>{rec.detail}</p>
                  {rec.scenario && <small>{rec.scenario} - {formatSigned(rec.gain, 3)}</small>}
                </article>
              ))}
              {!evaluation?.recommendations?.length && <Empty label="Importe un profil pour calculer les recommandations." />}
            </section>
          </section>
        )}

        {page === "compare" && (
          <section className="screen two-col">
            <section className="panel">
              <div className="panel-head"><h2>Tester un drop</h2><FlaskConical size={20} /></div>
              <div className="form-grid">
                <label>
                  <span>Type de drop</span>
                  <select value={drop.target} onChange={(event) => {
                    const target = event.target.value as DropTarget;
                    const canKeepL2 = target === "equipment"
                      ? itemAllowsSecondLine(readInputNumber(drop.age))
                      : petMountAllowsSecondLine(drop.rarity);
                    updateDrop({ target, stat2: canKeepL2 ? drop.stat2 : "", value2: canKeepL2 ? drop.value2 : "0" });
                  }}>
                    <option value="equipment">Objet</option>
                    <option value="pet">Pet</option>
                    <option value="mount">Monture</option>
                  </select>
                </label>
                {drop.target === "equipment" ? (
                  <>
                    <label><span>Slot</span><select value={drop.slot} onChange={(event) => {
                      const nextSlot = event.target.value as EquipmentSlot;
                      const next = resolveItemSelection(nextSlot, readInputNumber(drop.age), dropWeaponKind, itemBases, ageOptions);
                      updateDrop(clearImpossibleDropSecondLine({ ...drop, slot: nextSlot, age: String(next.age), idx: String(next.idx) }));
                    }}>{equipmentSlots.map((slot) => <option key={slot} value={slot}>{slotLabels[slot]}</option>)}</select></label>
                    <AgeSelect slot={dropSlot} value={readInputNumber(drop.age)} ageOptions={ageOptions} itemBases={itemBases} onChange={(age) => {
                      const next = resolveItemSelection(dropSlot, age, dropWeaponKind, itemBases, ageOptions);
                      updateDrop(clearImpossibleDropSecondLine({ ...drop, age: String(next.age), idx: String(next.idx) }));
                    }} />
                    {dropSlot === "Weapon" && <WeaponKindSelect age={readInputNumber(drop.age)} value={dropWeaponKind} itemBases={itemBases} onChange={(kind) => {
                      const next = resolveItemSelection("Weapon", readInputNumber(drop.age), kind, itemBases, ageOptions);
                      updateDrop(clearImpossibleDropSecondLine({ ...drop, age: String(next.age), idx: String(next.idx) }));
                    }} />}
                    <NumberField label="Niveau" value={drop.level} min={1} max={itemConfig.maxLevel} onChange={(value) => updateDrop({ level: value })} />
                    <ItemValuePreview values={dropPreview} />
                  </>
                ) : (
                  <>
                    <RaritySelect value={drop.rarity} onChange={(rarity) => {
                      const canKeepL2 = petMountAllowsSecondLine(rarity);
                      if (drop.target === "pet") {
                        const model = firstPetModel(rarity, drop.petType, petModels);
                        updateDrop({
                          rarity,
                          id: String(model?.id ?? 0),
                          petType: model?.type || drop.petType,
                          stat2: canKeepL2 ? drop.stat2 : "",
                          value2: canKeepL2 ? drop.value2 : "0"
                        });
                      } else {
                        const model = firstMountModel(rarity, mountModels);
                        updateDrop({
                          rarity,
                          id: String(model?.id ?? 0),
                          stat2: canKeepL2 ? drop.stat2 : "",
                          value2: canKeepL2 ? drop.value2 : "0"
                        });
                      }
                    }} />
                    {drop.target === "pet" ? (
                      <>
                        <PetTypeSelect value={petDropPreview.type} rarity={drop.rarity} models={petModels} onChange={(petType) => {
                          const model = firstPetModel(drop.rarity, petType, petModels);
                          updateDrop({ petType, id: String(model?.id ?? 0) });
                        }} />
                        <PetModelSelect rarity={drop.rarity} type={petDropPreview.type} value={petDropPreview.id} models={petModels} onChange={(id) => updateDrop({ id: String(id) })} />
                        <NumberField label="Niveau" value={drop.level} min={1} max={100} onChange={(value) => updateDrop({ level: value })} />
                        <CompanionValuePreview values={petDropPreview} />
                      </>
                    ) : (
                      <>
                        <MountModelSelect rarity={drop.rarity} value={mountDropPreview.id} models={mountModels} onChange={(id) => updateDrop({ id: String(id) })} />
                        <NumberField label="Niveau" value={drop.level} min={1} max={100} onChange={(value) => updateDrop({ level: value })} />
                        <CompanionValuePreview values={mountDropPreview} />
                      </>
                    )}
                  </>
                )}
                <StatSelect label="Stat 1" value={drop.stat1} stats={stats} onChange={(value) => updateDrop({ stat1: value })} />
                <NumberField label="Valeur 1" value={drop.value1} unit="%" onChange={(value) => updateDrop({ value1: value })} />
                {dropAllowsSecondLine && (
                  <>
                    <StatSelect label="Stat 2" value={drop.stat2} stats={stats} optional onChange={(value) => updateDrop({ stat2: value })} />
                    <NumberField label="Valeur 2" value={drop.value2} unit="%" onChange={(value) => updateDrop({ value2: value })} />
                  </>
                )}
              </div>
              <button className="primary" type="button" onClick={runDrop}><FlaskConical size={17} />Comparer</button>
            </section>
            <section className="panel result-panel">
              <div className="panel-head"><h2>Résultat</h2><BarChart3 size={20} /></div>
              {dropResult ? (
                <>
                  <strong className={dropResult.verdict}>{dropResult.verdict === "better" ? "Meilleur" : dropResult.verdict === "worse" ? "Moins bon" : "Équivalent"}</strong>
                  <p>{dropResult.currentScore.toFixed(3)} → {dropResult.dropScore.toFixed(3)}</p>
                  <span>{formatSigned(dropResult.delta, 3)}</span>
                  {drop.target === "pet" && dropResult.candidates && (
                    <div className="pet-comparison-list">
                      {dropResult.candidates.map((candidate) => (
                        <article className={candidate.petIndex === dropResult.bestPetIndex ? "best" : ""} key={candidate.petIndex}>
                          <span>À la place du Pet {candidate.petIndex + 1}</span>
                          <strong>{formatSigned(candidate.delta, 3)}</strong>
                        </article>
                      ))}
                    </div>
                  )}
                  <button className="primary equip-result" type="button" onClick={equipComparedDrop}>
                    <Check size={17} />
                    {drop.target === "pet" ? `Équiper à la place du Pet ${(dropResult.bestPetIndex ?? 0) + 1}` : "Équiper"}
                  </button>
                </>
              ) : <Empty label="Aucune comparaison lancée." />}
            </section>
          </section>
        )}

        {page === "pvp" && (
          <section className="screen">
            <div className="two-col">
              <section className="panel">
                <div className="panel-head"><h2>Adversaire</h2><Swords size={20} /></div>
                <label className="file-zone">
                  <input type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && importProfile(event.target.files[0], "opponent").catch((error) => setMessage(error.message))} />
                  <span>Importer un profil adverse</span>
                </label>
                <div className="button-line">
                  <button type="button" onClick={() => createManualOpponent().catch((error) => setMessage(error.message))}><RefreshCw size={17} />Adversaire manuel</button>
                  <button type="button" onClick={clonePlayerAsOpponent} disabled={!profile}><UserPlus size={17} />Copier mon profil</button>
                </div>
                <div className="metric-row">
                  <Metric label="Profil" value={opponent?.name || "aucun"} />
                  <Metric label="Confiance" value={labelConfidence(opponent?.confidence)} />
                  <Metric label="Mode" value="Duel 60s" />
                </div>
              </section>
              <section className="panel result-panel">
                <div className="panel-head"><h2>Résultat du duel</h2><Swords size={20} /></div>
                {pvp ? (
                  <>
                    <strong>{format(pvp.chance, 1)}%</strong>
                    <p>{pvp.winner === "player" ? "Victoire estimée" : pvp.winner === "opponent" ? "Défaite estimée" : "Égalité estimée"} en {format(pvp.duration, 1)}s</p>
                    <div className="metric-row pvp-metrics">
                      <Metric label="Vos PV restants" value={format(pvp.playerRemainingHealth)} />
                      <Metric label="PV adverses" value={format(pvp.opponentRemainingHealth)} />
                      <Metric label="Vos dégâts" value={format(pvp.playerDamage)} />
                      <Metric label="Dégâts adverses" value={format(pvp.opponentDamage)} />
                      <Metric label="Vos dégâts sorts" value={format(pvp.playerSkillDamage)} />
                      <Metric label="Sorts adverses" value={format(pvp.opponentSkillDamage)} />
                    </div>
                    <div className="tag-list">{pvp.strengths.map((item) => <span key={item}>{item}</span>)}</div>
                    <div className="tag-list danger">{pvp.weaknesses.map((item) => <span key={item}>{item}</span>)}</div>
                  </>
                ) : <Empty label="Importe ou crée un adversaire pour lancer le duel." />}
              </section>
            </div>
            <div className="editor-mode-toggle" role="tablist" aria-label="Mode de saisie adversaire">
              <button type="button" className={pvpEditorMode === "compact" ? "active" : ""} onClick={() => setPvpEditorMode("compact")} role="tab" aria-selected={pvpEditorMode === "compact"}>Résumé</button>
              <button type="button" className={pvpEditorMode === "detailed" ? "active" : ""} onClick={() => setPvpEditorMode("detailed")} role="tab" aria-selected={pvpEditorMode === "detailed"}>Détaillé</button>
            </div>
            {pvpEditorMode === "compact" ? (
              <CompactOpponentEditor
                profile={opponent}
                stats={stats}
                spells={spells}
                onChange={(next) => {
                  setOpponent(next);
                  setObjective("pvp");
                }}
              />
            ) : (
              <ManualEditor
                title="Construction de l’adversaire"
                profile={opponent}
                stats={stats}
                techNodes={techNodes}
                spells={spells}
                ageOptions={ageOptions}
                itemBases={itemBases}
                itemConfig={itemConfig}
                petModels={petModels}
                mountModels={mountModels}
                petLevels={petLevels}
                mountLevels={mountLevels}
                onChange={(next) => {
                  setOpponent(next);
                  setObjective("pvp");
                }}
              />
            )}
          </section>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value?: string | number }) {
  return <article className="metric"><span>{label}</span><strong>{value ?? "n/a"}</strong></article>;
}

function Empty({ label }: { label: string }) {
  return <p className="empty">{label}</p>;
}

function ScenarioControls({ scenarios, onChange }: { scenarios: ScenarioFormState; onChange: (value: ScenarioFormState) => void }) {
  const update = <Group extends keyof ScenarioFormState, Field extends keyof ScenarioFormState[Group]>(group: Group, field: Field, value: string) => {
    onChange({
      ...scenarios,
      [group]: {
        ...scenarios[group],
        [field]: readInputNumber(value)
      }
    });
  };

  return (
    <section className="panel scenario-panel">
      <div className="panel-head"><h2>Scenarios variables</h2><BarChart3 size={20} /></div>
      <div className="scenario-level-row">
        <label>
          <span>Mode</span>
          <select value={scenarios.levelRange.difficulty || 0} onChange={(event) => update("levelRange", "difficulty", event.target.value)}>
            <option value={0}>Normal</option>
            <option value={1}>Difficile</option>
          </select>
        </label>
        <label>
          <span>Niveau</span>
          <select value={scenarios.levelRange.min} onChange={(event) => update("levelRange", "min", event.target.value)}>
            {Array.from({ length: 11 }, (_, index) => index + 1).map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
        <label>
          <span>Combat</span>
          <select value={scenarios.levelRange.max} onChange={(event) => update("levelRange", "max", event.target.value)}>
            {Array.from({ length: 20 }, (_, index) => index + 1).map((battle) => <option key={battle} value={battle}>{battle}</option>)}
          </select>
        </label>
      </div>
      <details className="scenario-advanced">
        <summary>Ajustements experts</summary>
        <div className="scenario-control-grid">
          <article className="scenario-config-card">
            <strong>Mob intuable</strong>
            <div className="form-grid">
              <NumberField label="Degats depart" value={scenarios.endurance.startDamagePct} unit="% PV/s" onChange={(value) => update("endurance", "startDamagePct", value)} />
              <NumberField label="Progression" value={scenarios.endurance.growthPct} unit="%/s" onChange={(value) => update("endurance", "growthPct", value)} />
              <NumberField label="Plafond" value={scenarios.endurance.maxSeconds} unit="s" onChange={(value) => update("endurance", "maxSeconds", value)} />
            </div>
          </article>
          <article className="scenario-config-card">
            <strong>Mob fragile</strong>
            <div className="form-grid">
              <NumberField label="Vie cible" value={scenarios.timeToKill.targetSeconds} unit="s DPS" onChange={(value) => update("timeToKill", "targetSeconds", value)} />
              <NumberField label="Degats mob" value={scenarios.timeToKill.incomingDamagePct} unit="% PV/s" onChange={(value) => update("timeToKill", "incomingDamagePct", value)} />
              <NumberField label="Plafond" value={scenarios.timeToKill.maxSeconds} unit="s" onChange={(value) => update("timeToKill", "maxSeconds", value)} />
            </div>
          </article>
          <article className="scenario-config-card">
            <strong>Serie de mobs</strong>
            <div className="form-grid">
              <NumberField label="Nombre" value={scenarios.gauntlet.mobCount} onChange={(value) => update("gauntlet", "mobCount", value)} />
              <NumberField label="Vie depart" value={scenarios.gauntlet.firstMobSeconds} unit="s DPS" onChange={(value) => update("gauntlet", "firstMobSeconds", value)} />
              <NumberField label="Degats depart" value={scenarios.gauntlet.firstDamagePct} unit="% PV/s" onChange={(value) => update("gauntlet", "firstDamagePct", value)} />
              <NumberField label="Vie +/mob" value={scenarios.gauntlet.healthGrowthPct} unit="%" onChange={(value) => update("gauntlet", "healthGrowthPct", value)} />
              <NumberField label="Degats +/mob" value={scenarios.gauntlet.damageGrowthPct} unit="%" onChange={(value) => update("gauntlet", "damageGrowthPct", value)} />
              <NumberField label="Pause" value={scenarios.gauntlet.pauseSeconds} unit="s" onChange={(value) => update("gauntlet", "pauseSeconds", value)} />
              <NumberField label="Plafond" value={scenarios.gauntlet.maxSeconds} unit="s" onChange={(value) => update("gauntlet", "maxSeconds", value)} />
            </div>
          </article>
        </div>
      </details>
    </section>
  );
}

function ScenarioSummary({ scenarios }: { scenarios: ScenarioResult[] }) {
  if (!scenarios.length) return null;
  return (
    <section className="scenario-result-grid">
      {scenarios.map((scenario) => (
        <article className={`scenario-result-card ${scenario.success ? "success" : "warning"}`} key={scenario.id}>
          <span>{scenario.label}</span>
          <strong>{scenario.summary}</strong>
          <p>Score {format(scenario.score, 2)} - {scenario.metrics.difficulty ? "difficile" : "normal"} {format(scenario.metrics.age ?? scenario.metrics.levelMin)}-{format(scenario.metrics.combat ?? scenario.metrics.levelMax)}{scenario.metrics.realBattleData ? " - donnees jeu" : ""}</p>
          {scenario.metrics.skillDamage > 0 && (
            <small>
              Sorts {format(scenario.metrics.skillDamage)} dmg
              {scenario.metrics.aoeDamage > 0 ? `, dont ${format(scenario.metrics.aoeDamage)} en zone` : ""}
            </small>
          )}
        </article>
      ))}
    </section>
  );
}

function AuditList({ profile }: { profile: NormalizedProfile | null }) {
  if (!profile) return <Empty label="Aucun profil chargé." />;
  if (!profile.audit.length) return <Empty label="Aucune alerte." />;
  return <ol className="audit-list">{profile.audit.map((issue, index) => <li className={issue.severity} key={`${issue.code}-${index}`}><strong>{issue.code}</strong><span>{issue.message}</span></li>)}</ol>;
}

function Breakdown({
  profile,
  evaluation,
  stats,
  techNodes,
  spells
}: {
  profile: NormalizedProfile | null;
  evaluation: EvaluationResult | PvpResult | null;
  stats: StatOption[];
  techNodes: TechNode[];
  spells: SpellOption[];
}) {
  if (!profile || !evaluation) return <Empty label="Aucun calcul disponible." />;
  return (
    <div className="breakdown-stack">
      <div className="breakdown">
        <Metric label="Joueur base attaque" value={format(profile.breakdown.baseAttack)} />
        <Metric label="Joueur base PV" value={format(profile.breakdown.baseHealth)} />
        <Metric label="Objets attaque" value={format(profile.breakdown.equipmentAttack)} />
        <Metric label="Objets PV" value={format(profile.breakdown.equipmentHealth)} />
        <Metric label="Pets attaque" value={format(profile.breakdown.petAttack)} />
        <Metric label="Pets PV" value={format(profile.breakdown.petHealth)} />
        <Metric label="Monture attaque" value={format(profile.breakdown.mountAttack)} />
        <Metric label="Monture PV" value={format(profile.breakdown.mountHealth)} />
      </div>
      <StatMapBlock title="Stats totales" stats={stats} values={profile.stats} />
      <StatMapBlock title="Lignes objets/pets/monture" stats={stats} values={profile.breakdown.secondaryStats} />
      <StatMapBlock title="Talents" stats={stats} values={profile.breakdown.talentStats} />
      <TalentLevelsBlock profile={profile} techNodes={techNodes} />
      <SkillModelBlock profile={profile} spells={spells} />
      <div className="breakdown">
        {Object.entries(evaluation.profile.breakdown).map(([key, value]) => <Metric key={key} label={key} value={format(value)} />)}
      </div>
    </div>
  );
}

function SkillModelBlock({ profile, spells }: { profile: NormalizedProfile; spells: SpellOption[] }) {
  if (!profile.spells.length) return null;
  return (
    <section className="stat-map-block">
      <h3>Sorts simulés</h3>
      <div className="skill-model-grid">
        {profile.spells.map((selected) => {
          const spell = spells.find((entry) => entry.id === selected.id);
          const mechanics = spell?.mechanics;
          const behavior = mechanics?.kind === "buff"
            ? `Buff ${format(spell?.activeDuration)}s`
            : mechanics?.targetMode === "all"
              ? `Zone, ${format(mechanics.hitCount)} impact${mechanics.hitCount > 1 ? "s" : ""}`
              : `Monocible, ${format(mechanics?.hitCount || 1)} impact${(mechanics?.hitCount || 1) > 1 ? "s" : ""}`;
          return (
            <article className="skill-model-card" key={selected.id}>
              <span>{spell?.rarity || selected.rarity || "Sort"} - niveau {selected.level}</span>
              <strong>{spell?.name || selected.id}</strong>
              <p>{behavior}</p>
              <small>Cooldown {format(spell?.cooldown)}s - confiance {mechanics?.confidence || "faible"}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TalentLevelsBlock({ profile, techNodes }: { profile: NormalizedProfile; techNodes: TechNode[] }) {
  const active = techNodes.filter((node) => Number(profile.talentTree?.[node.tree]?.[node.id] || 0) > 0);
  if (!active.length) return null;
  return (
    <section className="stat-map-block">
      <h3>Talents actifs</h3>
      <div className="stat-chip-grid">
        {active.map((node) => (
          <Metric
            key={`${node.tree}-${node.id}`}
            label={`${node.tree} ${node.id} · ${prettyTechType(node.type)}`}
            value={`${profile.talentTree[node.tree][node.id]}/${node.maxLevel}`}
          />
        ))}
      </div>
    </section>
  );
}

function StatMapBlock({ title, stats, values }: { title: string; stats: StatOption[]; values: StatMap }) {
  const visibleStats = stats.filter((stat) => Math.abs(Number(values?.[stat.id] || 0)) > 0.0001);
  if (!visibleStats.length) return null;
  return (
    <section className="stat-map-block">
      <h3>{title}</h3>
      <div className="stat-chip-grid">
        {visibleStats.map((stat) => <Metric key={stat.id} label={stat.label} value={`${format(values?.[stat.id], 1)}%`} />)}
      </div>
    </section>
  );
}

function SourceBlock({ dataInfo }: { dataInfo: GameDataInfo }) {
  const manifest = dataInfo.manifest;
  return (
    <div className="source-block">
      <strong>Donnees</strong>
      <span>Configs communautaires versionnees</span>
      <span>{manifest?.sourceRef || "n/a"} · {manifest?.files?.length || 0} fichiers</span>
    </div>
  );
}

function StatSelect({ label, value, stats, optional, onChange }: { label: string; value: string; stats: StatOption[]; optional?: boolean; onChange: (value: string) => void }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {optional && <option value="">Aucune</option>}
        {(stats || []).map((stat) => <option key={stat.id} value={stat.id}>{stat.label} ({format(stat.max, 1)}% max)</option>)}
      </select>
    </label>
  );
}

function NumberField({ label, value, unit, min, max, onChange }: { label: string; value: string | number; unit?: string; min?: number; max?: number; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(String(value ?? ""));
  useEffect(() => {
    const next = String(value ?? "");
    if (Math.abs(readInputNumber(next) - readInputNumber(draft)) > 0.0001) setDraft(next);
  }, [value, draft]);

  return (
    <label>
      <span>{label}</span>
      <div className={unit ? "unit-input" : undefined}>
        <input
          type="text"
          inputMode="decimal"
          min={min}
          max={max}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(event.target.value);
          }}
        />
        {unit && <span>{unit}</span>}
      </div>
    </label>
  );
}

function ItemValuePreview({ values }: { values: ReturnType<typeof calculateItemValues> }) {
  if (!values.base) {
    return <div className="item-main-preview missing"><span>Base introuvable</span></div>;
  }
  return (
    <div className="item-main-preview">
      {values.attack > 0 && <span>Attaque <strong>{format(values.attack)}</strong></span>}
      {values.health > 0 && <span>PV <strong>{format(values.health)}</strong></span>}
      {values.attack <= 0 && values.health <= 0 && <span>Valeur <strong>0</strong></span>}
    </div>
  );
}

function CompanionValuePreview({ values }: { values: ReturnType<typeof calculatePetValues> | ReturnType<typeof calculateMountValues> }) {
  if (!values.recognized) {
    return <div className="item-main-preview missing"><span>Données introuvables</span></div>;
  }
  return (
    <div className="item-main-preview">
      <span>Attaque <strong>{format(values.attack)}</strong></span>
      <span>PV <strong>{format(values.health)}</strong></span>
    </div>
  );
}

function AgeSelect({ slot, value, ageOptions, itemBases, onChange }: { slot: EquipmentSlot; value: number; ageOptions: AgeOption[]; itemBases: ItemBase[]; onChange: (value: number) => void }) {
  const options = ageOptions.filter((age) => itemBases.some((item) => item.slot === slot && item.age === age.value));
  const hasCurrent = options.some((age) => age.value === value);
  return (
    <label>
      <span>Age</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {!hasCurrent && <option value={value}>{labelAge(value, ageOptions)}</option>}
        {options.map((age) => <option key={age.value} value={age.value}>{age.label}</option>)}
      </select>
    </label>
  );
}

function WeaponKindSelect({ age, value, itemBases, onChange }: { age: number; value: WeaponKind; itemBases: ItemBase[]; onChange: (value: WeaponKind) => void }) {
  const options = weaponKindOptions(age, itemBases);
  return (
    <label>
      <span>Type arme</span>
      <select value={value} onChange={(event) => onChange(event.target.value as WeaponKind)}>
        {options.map((kind) => <option key={kind} value={kind}>{weaponKindLabel(kind)}</option>)}
      </select>
    </label>
  );
}

function RaritySelect({ label = "Rarete", value, onChange }: { label?: string; value?: string; onChange: (value: string) => void }) {
  const normalized = normalizeRarity(value);
  return (
    <label>
      <span>{label}</span>
      <select value={normalized} onChange={(event) => onChange(event.target.value)}>
        {rarityOptions.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
      </select>
    </label>
  );
}

function PetTypeSelect({ value, rarity, models, onChange }: { value: PetType; rarity: string; models: PetModel[]; onChange: (value: PetType) => void }) {
  const types = (["Balanced", "Damage", "Health"] as PetType[]).filter((type) =>
    models.some((model) => normalizeRarity(model.rarity) === normalizeRarity(rarity) && model.type === type)
  );
  return (
    <label>
      <span>Spécialisation</span>
      <select value={value} onChange={(event) => onChange(event.target.value as PetType)}>
        {types.map((type) => <option key={type} value={type}>{petTypeLabel(type)}</option>)}
      </select>
    </label>
  );
}

function PetModelSelect({ rarity, type, value, models, onChange }: { rarity: string; type: PetType; value: number; models: PetModel[]; onChange: (value: number) => void }) {
  const options = models
    .filter((model) => normalizeRarity(model.rarity) === normalizeRarity(rarity) && model.type === type)
    .sort((left, right) => left.id - right.id);
  return (
    <label>
      <span>Pet</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((model, index) => <option key={`${model.rarity}-${model.id}`} value={model.id}>Modèle {index + 1}</option>)}
      </select>
    </label>
  );
}

function MountModelSelect({ rarity, value, models, onChange }: { rarity: string; value: number; models: MountModel[]; onChange: (value: number) => void }) {
  const options = models
    .filter((model) => normalizeRarity(model.rarity) === normalizeRarity(rarity))
    .sort((left, right) => left.id - right.id);
  return (
    <label>
      <span>Monture</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((model, index) => <option key={`${model.rarity}-${model.id}`} value={model.id}>Modèle {index + 1}</option>)}
      </select>
    </label>
  );
}

function ManualEditor({
  title = "Remplissage manuel",
  profile,
  stats,
  techNodes,
  spells,
  ageOptions,
  itemBases,
  itemConfig,
  petModels,
  mountModels,
  petLevels,
  mountLevels,
  onChange
}: {
  title?: string;
  profile: NormalizedProfile | null;
  stats: StatOption[];
  techNodes: TechNode[];
  spells: SpellOption[];
  ageOptions: AgeOption[];
  itemBases: ItemBase[];
  itemConfig: ItemConfig;
  petModels: PetModel[];
  mountModels: MountModel[];
  petLevels: CompanionLevels[];
  mountLevels: CompanionLevels[];
  onChange: (profile: NormalizedProfile) => void;
}) {
  if (!profile) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>{title}</h2><RefreshCw size={20} /></div>
        <Empty label={title.includes("adversaire") ? "Crée ou importe un adversaire pour ouvrir les champs." : "Clique sur Profil manuel pour ouvrir les champs de saisie."} />
      </section>
    );
  }

  const update = (recipe: (draft: NormalizedProfile) => void) => {
    const draft = cloneProfile(profile);
    prepareImportedForEditing(draft, techNodes, stats);
    syncManualCompanionValues(draft, petModels, petLevels, mountModels, mountLevels);
    recipe(draft);
    refreshManualTotals(draft, stats, techNodes);
    onChange(draft);
  };

  return (
    <section className="panel manual-editor">
      <div className="panel-head"><h2>{title}</h2><FileJson size={20} /></div>
      <div className="form-grid">
        <label><span>Nom du profil</span><input value={profile.name} onChange={(event) => update((draft) => { draft.name = event.target.value; })} /></label>
        <label><span>Style d'arme</span><select value={profile.base.weaponStyle} onChange={(event) => update((draft) => { draft.base.weaponStyle = event.target.value as "melee" | "ranged"; })}><option value="ranged">Distance</option><option value="melee">Melee</option></select></label>
      </div>

      <div className="metric-row wide">
        <Metric label="Base jeu attaque" value={format(profile.breakdown.baseAttack)} />
        <Metric label="Base jeu PV" value={format(profile.breakdown.baseHealth)} />
        <Metric label="Attaque calculée" value={format(profile.base.attack)} />
        <Metric label="PV calculés" value={format(profile.base.health)} />
      </div>

      <h3>Skills équipés</h3>
      <div className="skill-grid">
        {[0, 1, 2].map((index) => <SkillEditor key={index} index={index} profile={profile} spells={spells} update={update} />)}
      </div>

      <h3>Objets équipés</h3>
      <div className="equipment-editor">
        {equipmentSlots.map((slot) => {
          const item = profile.equipment[slot];
          const values = calculateItemValues(slot, Number(item?.age ?? 0), Number(item?.idx ?? 0), Number(item?.level ?? 1), itemBases, itemConfig);
          const weaponKind = weaponKindFromBase(values.base);
          const itemAllowsL2 = itemAllowsSecondLine(values.age);
          return (
            <article className="slot-editor" key={slot}>
              <strong>{slotLabels[slot]}</strong>
              <div className="form-grid">
                <AgeSelect slot={slot} value={Number(item?.age ?? 0)} ageOptions={ageOptions} itemBases={itemBases} onChange={(age) => update((draft) => setManualItemAge(draft, slot, age, weaponKind, itemBases, itemConfig, ageOptions))} />
                {slot === "Weapon" && <WeaponKindSelect age={Number(item?.age ?? 0)} value={weaponKind} itemBases={itemBases} onChange={(kind) => update((draft) => setManualWeaponKind(draft, kind, itemBases, itemConfig, ageOptions))} />}
                <NumberField label="Niveau" value={roundInput(item?.level ?? 1)} min={1} max={itemConfig.maxLevel} onChange={(value) => update((draft) => setManualItemField(draft, slot, "level", readInputNumber(value), itemBases, itemConfig))} />
                <ItemValuePreview values={values} />
                <ManualStatLine stats={stats} lines={item?.secondaryStats || []} index={0} onChange={(stat, value) => update((draft) => setManualItemStat(draft, slot, 0, stat, value))} />
                {itemAllowsL2 && <ManualStatLine stats={stats} lines={item?.secondaryStats || []} index={1} onChange={(stat, value) => update((draft) => setManualItemStat(draft, slot, 1, stat, value))} />}
              </div>
            </article>
          );
        })}
      </div>

      <h3>Pets actifs</h3>
      <div className="pet-mount-grid">
        {[0, 1, 2].map((index) => (
          <PetEditor
            key={index}
            index={index}
            profile={profile}
            stats={stats}
            models={petModels}
            levels={petLevels}
            update={update}
          />
        ))}
      </div>

      <h3>Monture</h3>
      <MountEditor profile={profile} stats={stats} models={mountModels} levels={mountLevels} update={update} />

      <h3>Talents</h3>
      <TalentTreeEditor profile={profile} techNodes={techNodes} update={update} />
    </section>
  );
}

function CompactOpponentEditor({
  profile,
  stats,
  spells,
  onChange
}: {
  profile: NormalizedProfile | null;
  stats: StatOption[];
  spells: SpellOption[];
  onChange: (profile: NormalizedProfile) => void;
}) {
  if (!profile) {
    return (
      <section className="panel">
        <div className="panel-head"><h2>Adversaire résumé</h2><Swords size={20} /></div>
        <Empty label="Crée ou importe un adversaire pour ouvrir la saisie." />
      </section>
    );
  }

  const update = (recipe: (draft: NormalizedProfile) => void) => {
    const draft = cloneProfile(profile);
    flattenOpponentProfile(draft, stats);
    recipe(draft);
    draft.confidence = "partial";
    onChange(draft);
  };

  return (
    <section className="panel compact-opponent-editor">
      <div className="panel-head"><h2>Adversaire résumé</h2><Swords size={20} /></div>
      <div className="compact-primary-stats">
        <NumberField label="Attaque totale" value={roundInput(profile.base.attack)} onChange={(value) => update((draft) => setCompactOpponentBase(draft, "attack", readInputNumber(value)))} />
        <NumberField label="PV totaux" value={roundInput(profile.base.health)} onChange={(value) => update((draft) => setCompactOpponentBase(draft, "health", readInputNumber(value)))} />
      </div>

      <h3>Stats secondaires</h3>
      <div className="stat-editor-grid">
        {stats.map((stat) => (
          <NumberField
            key={stat.id}
            label={stat.label}
            value={roundInput(profile.stats[stat.id] || 0)}
            unit="%"
            onChange={(value) => update((draft) => setCompactOpponentStat(draft, stat.id, readInputNumber(value)))}
          />
        ))}
      </div>

      <h3>Sorts équipés</h3>
      <div className="skill-grid">
        {[0, 1, 2].map((index) => <SkillEditor key={index} index={index} profile={profile} spells={spells} update={update} />)}
      </div>
    </section>
  );
}

function SkillEditor({ index, profile, spells, update }: { index: number; profile: NormalizedProfile; spells: SpellOption[]; update: (recipe: (draft: NormalizedProfile) => void) => void }) {
  const selected = profile.spells[index];
  return (
    <article className="slot-editor">
      <strong>Skill {index + 1}</strong>
      <div className="form-grid">
        <label>
          <span>Skill</span>
          <select value={selected?.id || ""} onChange={(event) => update((draft) => setSpellSelection(draft, index, event.target.value, selected?.level || 1, spells))}>
            <option value="">Aucun</option>
            {spells.map((spell) => <option key={spell.id} value={spell.id}>{spell.name || spell.id}</option>)}
          </select>
        </label>
        <NumberField label="Niveau" value={roundInput(selected?.level || 1)} min={1} max={100} onChange={(value) => update((draft) => setSpellSelection(draft, index, selected?.id || "", readInputNumber(value), spells))} />
      </div>
    </article>
  );
}

function TalentTreeEditor({ profile, techNodes, update }: { profile: NormalizedProfile; techNodes: TechNode[]; update: (recipe: (draft: NormalizedProfile) => void) => void }) {
  const [activeTree, setActiveTree] = useState<TechTreeName>("Forge");
  const treeNodes = techNodes.filter((node) => node.tree === activeTree).sort(sortTalentNodes);
  const tiers = groupTalentTiers(treeNodes);

  return (
    <div className="talent-editor">
      <div className="talent-tree-tabs" role="tablist" aria-label="Arbres de talents">
        {talentTabs.map((tab) => {
          const tabNodes = techNodes.filter((node) => node.tree === tab.id);
          const learned = tabNodes.filter((node) => getTalentLevel(profile, node) > 0).length;
          return (
            <button
              type="button"
              key={tab.id}
              className={activeTree === tab.id ? "active" : ""}
              onClick={() => setActiveTree(tab.id)}
              role="tab"
              aria-selected={activeTree === tab.id}
            >
              <span>{tab.label}</span>
              <strong>{learned}/{tabNodes.length}</strong>
            </button>
          );
        })}
      </div>

      <div className="talent-tree-stage">
        {tiers.map((tier) => {
          const tierLearned = tier.columns.reduce((total, column) => total + column.nodes.filter((node) => getTalentLevel(profile, node) > 0).length, 0);
          const tierTotal = tier.columns.reduce((total, column) => total + column.nodes.length, 0);
          return (
            <section className="talent-tier" key={`${activeTree}-${tier.tier}`}>
              <div className="talent-tier-head">
                <strong>Palier {tier.tier + 1}</strong>
                <span>{tierLearned}/{tierTotal}</span>
              </div>
              <div className="talent-tier-track">
                {tier.columns.map((column) => (
                  <div className="talent-layer" key={`${activeTree}-${tier.tier}-${column.layer}`}>
                    {column.nodes.map((node) => {
                      const current = getTalentLevel(profile, node);
                      const unlocked = isTalentUnlocked(profile, node);
                      const locked = !unlocked && current <= 0;
                      const next = current >= node.maxLevel ? 0 : current + 1;
                      return (
                        <button
                          type="button"
                          key={nodeKey(node)}
                          className={`talent-node ${current > 0 ? "learned" : ""} ${locked ? "locked" : "available"}`}
                          disabled={locked}
                          title={locked ? `Prerequis: ${node.requirements.join(", ")}` : `${prettyTechType(node.type)} ${current}/${node.maxLevel}`}
                          onClick={() => update((draft) => setTalentLevel(draft, node, next, techNodes))}
                        >
                          <span className="talent-node-top">
                            <span>{prettyTechType(node.type)}</span>
                            <strong>{current}/{node.maxLevel}</strong>
                          </span>
                          <span className="talent-node-meta">#{node.id}</span>
                          {node.requirements.length > 0 && <span className="talent-node-req">Req. {node.requirements.join(", ")}</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {!tiers.length && <Empty label="Aucun talent disponible pour cet arbre." />}
      </div>
    </div>
  );
}

function TalentEditor({ profile, techNodes, update }: { profile: NormalizedProfile; techNodes: TechNode[]; update: (recipe: (draft: NormalizedProfile) => void) => void }) {
  const [selectedNode, setSelectedNode] = useState(techNodes[0] ? nodeKey(techNodes[0]) : "");
  const [level, setLevel] = useState("1");
  const activeNodes = techNodes.filter((node) => Number(profile.talentTree?.[node.tree]?.[node.id] || 0) > 0);

  useEffect(() => {
    if (!selectedNode && techNodes[0]) setSelectedNode(nodeKey(techNodes[0]));
  }, [selectedNode, techNodes]);

  return (
    <div className="talent-editor">
      <div className="talent-active-list">
        {activeNodes.map((node) => (
          <div className="talent-row" key={nodeKey(node)}>
            <span>{node.tree} {node.id} · {prettyTechType(node.type)}</span>
            <NumberField label="Niveau" value={roundInput(profile.talentTree[node.tree][node.id])} min={0} max={node.maxLevel} onChange={(value) => update((draft) => setTalentLevel(draft, node, readInputNumber(value)))} />
          </div>
        ))}
        {!activeNodes.length && <Empty label="Aucun talent renseigné." />}
      </div>
      <div className="talent-add-row">
        <label>
          <span>Ajouter / modifier</span>
          <select value={selectedNode} onChange={(event) => setSelectedNode(event.target.value)}>
            {techNodes.map((node) => <option key={nodeKey(node)} value={nodeKey(node)}>{node.tree} {node.id} · {prettyTechType(node.type)}</option>)}
          </select>
        </label>
        <NumberField label="Niveau" value={level} min={0} onChange={setLevel} />
        <button type="button" onClick={() => {
          const node = techNodes.find((entry) => nodeKey(entry) === selectedNode);
          if (node) update((draft) => setTalentLevel(draft, node, readInputNumber(level)));
        }}>Ajouter</button>
      </div>
    </div>
  );
}

function PetEditor({
  index,
  profile,
  stats,
  models,
  levels,
  update
}: {
  index: number;
  profile: NormalizedProfile;
  stats: StatOption[];
  models: PetModel[];
  levels: CompanionLevels[];
  update: (recipe: (draft: NormalizedProfile) => void) => void;
}) {
  const pet = profile.pets[index];
  const rarity = normalizeRarity(pet?.rarity);
  const currentModel = models.find((model) => normalizeRarity(model.rarity) === rarity && model.id === Number(pet?.id));
  const type = pet?.type || currentModel?.type || "Balanced";
  const values = calculatePetValues(rarity, Number(pet?.id ?? 0), type, Number(pet?.level ?? 1), models, levels);
  const canUseL2 = petMountAllowsSecondLine(rarity);
  return (
    <article className="slot-editor">
      <strong>Pet {index + 1}</strong>
      <div className="form-grid">
        <RaritySelect value={rarity} onChange={(nextRarity) => {
          const model = firstPetModel(nextRarity, type, models);
          if (model) update((draft) => setManualPetSelection(draft, index, nextRarity, model.id, model.type, values.level, models, levels));
        }} />
        <PetTypeSelect value={values.type} rarity={rarity} models={models} onChange={(nextType) => {
          const model = firstPetModel(rarity, nextType, models);
          if (model) update((draft) => setManualPetSelection(draft, index, rarity, model.id, nextType, values.level, models, levels));
        }} />
        <PetModelSelect rarity={rarity} type={values.type} value={values.id} models={models} onChange={(id) => {
          update((draft) => setManualPetSelection(draft, index, rarity, id, values.type, values.level, models, levels));
        }} />
        <NumberField label="Niveau" value={roundInput(values.level)} min={1} max={100} onChange={(value) => {
          update((draft) => setManualPetSelection(draft, index, rarity, values.id, values.type, readInputNumber(value), models, levels));
        }} />
        <CompanionValuePreview values={values} />
        <ManualStatLine stats={stats} lines={pet?.secondaryStats || []} index={0} onChange={(stat, value) => update((draft) => setManualPetStat(draft, index, 0, stat, value))} />
        {canUseL2 && <ManualStatLine stats={stats} lines={pet?.secondaryStats || []} index={1} onChange={(stat, value) => update((draft) => setManualPetStat(draft, index, 1, stat, value))} />}
      </div>
    </article>
  );
}

function MountEditor({
  profile,
  stats,
  models,
  levels,
  update
}: {
  profile: NormalizedProfile;
  stats: StatOption[];
  models: MountModel[];
  levels: CompanionLevels[];
  update: (recipe: (draft: NormalizedProfile) => void) => void;
}) {
  const mount = profile.mount;
  const rarity = normalizeRarity(mount?.rarity);
  const values = calculateMountValues(rarity, Number(mount?.id ?? 0), Number(mount?.level ?? 1), models, levels);
  const canUseL2 = petMountAllowsSecondLine(rarity);
  return (
    <article className="slot-editor">
      <strong>Monture</strong>
      <div className="form-grid">
        <RaritySelect value={rarity} onChange={(nextRarity) => {
          const model = firstMountModel(nextRarity, models);
          if (model) update((draft) => setManualMountSelection(draft, nextRarity, model.id, values.level, models, levels));
        }} />
        <MountModelSelect rarity={rarity} value={values.id} models={models} onChange={(id) => {
          update((draft) => setManualMountSelection(draft, rarity, id, values.level, models, levels));
        }} />
        <NumberField label="Niveau" value={roundInput(values.level)} min={1} max={100} onChange={(value) => {
          update((draft) => setManualMountSelection(draft, rarity, values.id, readInputNumber(value), models, levels));
        }} />
        <CompanionValuePreview values={values} />
        <ManualStatLine stats={stats} lines={mount?.secondaryStats || []} index={0} onChange={(stat, value) => update((draft) => setManualMountStat(draft, 0, stat, value))} />
        {canUseL2 && <ManualStatLine stats={stats} lines={mount?.secondaryStats || []} index={1} onChange={(stat, value) => update((draft) => setManualMountStat(draft, 1, stat, value))} />}
      </div>
    </article>
  );
}

function ManualStatLine({ stats, lines, index, onChange }: { stats: StatOption[]; lines: SecondaryLine[]; index: number; onChange: (stat: string, value: number) => void }) {
  const line = lines[index];
  return (
    <>
      <StatSelect label={`Stat ${index + 1}`} value={line?.stat || ""} stats={stats} optional onChange={(stat) => onChange(stat, Number(line?.value || 0))} />
      <NumberField label={`Valeur ${index + 1}`} value={roundInput(line?.value || 0)} unit="%" onChange={(value) => onChange(line?.stat || "", readInputNumber(value))} />
    </>
  );
}

async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Erreur API");
  return payload as T;
}

function readGuestProfile(): NormalizedProfile | null {
  return readStoredProfile(GUEST_PROFILE_KEY);
}

function readStoredProfile(key: string): NormalizedProfile | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cloneProfile(profile: NormalizedProfile): NormalizedProfile {
  return JSON.parse(JSON.stringify(profile)) as NormalizedProfile;
}

function clearImpossibleDropSecondLine<T extends { age: string; stat2: string; value2: string }>(drop: T): T {
  return itemAllowsSecondLine(readInputNumber(drop.age)) ? drop : { ...drop, stat2: "", value2: "0" };
}

function safeFileName(value: string): string {
  return String(value || "profil")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "profil";
}

function dropTargetLabel(target: DropTarget): string {
  if (target === "pet") return "Pet";
  if (target === "mount") return "Monture";
  return "Objet";
}

function formatSyncDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function readInputNumber(value: string): number {
  const normalized = String(value || "0").trim().toLowerCase().replace(",", ".").replace(/\s+/g, "");
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)([a-z]*)$/);
  if (!match) return 0;
  const multipliers: Record<string, number> = {
    k: 1_000,
    m: 1_000_000,
    million: 1_000_000,
    millions: 1_000_000,
    b: 1_000_000_000,
    g: 1_000_000_000,
    md: 1_000_000_000,
    bn: 1_000_000_000,
    t: 1_000_000_000_000
  };
  const parsed = Number(match[1]) * (multipliers[match[2]] || 1);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundInput(value: unknown): string {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return "0";
  return String(Math.round(numberValue * 100) / 100);
}

function itemAllowsSecondLine(age: number): boolean {
  return Math.round(Number(age || 0)) >= itemSecondaryLine2MinAge;
}

function normalizeRarity(rarity?: string): string {
  const normalized = String(rarity || "Common").toLowerCase();
  return rarityOptions.find((entry) => entry.toLowerCase() === normalized) || "Common";
}

function rarityRank(rarity?: string): number {
  const normalized = normalizeRarity(rarity).toLowerCase();
  const index = rarityOptions.findIndex((entry) => entry.toLowerCase() === normalized);
  return index >= 0 ? index : 0;
}

function petMountAllowsSecondLine(rarity?: string): boolean {
  return rarityRank(rarity) >= rarityRank(petMountSecondLineMinRarity);
}

function trimImpossibleItemSecondLine(item: { age?: number; secondaryStats: SecondaryLine[] }) {
  if (!itemAllowsSecondLine(Number(item.age ?? 0))) item.secondaryStats = item.secondaryStats.slice(0, 1);
}

function trimImpossiblePetMountSecondLine(entity: { rarity?: string; secondaryStats: SecondaryLine[] }) {
  entity.rarity = normalizeRarity(entity.rarity);
  if (!petMountAllowsSecondLine(entity.rarity)) entity.secondaryStats = entity.secondaryStats.slice(0, 1);
}

function setManualItemField(profile: NormalizedProfile, slot: EquipmentSlot, field: "level", value: number, itemBases: ItemBase[], itemConfig: ItemConfig) {
  const item = ensureManualItem(profile, slot);
  if (field === "level") item.level = Math.max(1, Math.round(Number(value || 1)));
  applyManualItemValues(profile, slot, itemBases, itemConfig);
}

function setManualItemAge(profile: NormalizedProfile, slot: EquipmentSlot, age: number, weaponKind: WeaponKind, itemBases: ItemBase[], itemConfig: ItemConfig, ageOptions: AgeOption[]) {
  const item = ensureManualItem(profile, slot);
  const next = resolveItemSelection(slot, age, weaponKind, itemBases, ageOptions);
  item.age = next.age;
  item.idx = next.idx;
  applyManualItemValues(profile, slot, itemBases, itemConfig);
}

function setManualWeaponKind(profile: NormalizedProfile, weaponKind: WeaponKind, itemBases: ItemBase[], itemConfig: ItemConfig, ageOptions: AgeOption[]) {
  const item = ensureManualItem(profile, "Weapon");
  const next = resolveItemSelection("Weapon", Number(item.age ?? 0), weaponKind, itemBases, ageOptions);
  item.age = next.age;
  item.idx = next.idx;
  applyManualItemValues(profile, "Weapon", itemBases, itemConfig);
}

function applyManualItemValues(profile: NormalizedProfile, slot: EquipmentSlot, itemBases: ItemBase[], itemConfig: ItemConfig) {
  const item = ensureManualItem(profile, slot);
  const values = calculateItemValues(slot, Number(item.age ?? 0), Number(item.idx ?? 0), Number(item.level ?? 1), itemBases, itemConfig);
  item.age = values.age;
  item.idx = values.idx;
  item.level = values.level;
  item.attack = values.attack;
  item.health = values.health;
  item.recognized = Boolean(values.base);
  trimImpossibleItemSecondLine(item);
  if (slot === "Weapon" && values.base && typeof values.base.isRanged === "boolean") {
    profile.base.weaponStyle = values.base.isRanged ? "ranged" : "melee";
  }
}

function calculateItemValues(slot: EquipmentSlot, age: number, idx: number, level: number, itemBases: ItemBase[], itemConfig: ItemConfig) {
  const cleanAge = Math.round(Number(age || 0));
  const cleanIdx = Math.round(Number(idx || 0));
  const cleanLevel = Math.max(1, Math.round(Number(level || 1)));
  const base = resolveItemBase(slot, cleanAge, cleanIdx, itemBases);
  const levelMulti = Math.pow(Number(itemConfig.levelScalingBase || 1.01), Math.max(0, cleanLevel - 1));
  const meleeMulti = slot === "Weapon" && base?.isRanged === false ? Number(itemConfig.meleeDamageMultiplier || 1) : 1;
  return {
    age: cleanAge,
    idx: base?.idx ?? cleanIdx,
    level: cleanLevel,
    base,
    attack: Number(base?.attack || 0) * levelMulti * meleeMulti,
    health: Number(base?.health || 0) * levelMulti
  };
}

function calculatePetValues(rarity: string, id: number, type: PetType, level: number, models: PetModel[], levels: CompanionLevels[]) {
  const cleanRarity = normalizeRarity(rarity);
  const cleanLevel = clamp(Math.round(Number(level || 1)), 1, 100);
  const model = models.find((entry) =>
    normalizeRarity(entry.rarity) === cleanRarity &&
    entry.id === Math.round(Number(id || 0)) &&
    entry.type === type
  ) || firstPetModel(cleanRarity, type, models) || models.find((entry) => normalizeRarity(entry.rarity) === cleanRarity);
  const levelInfo = companionLevelAt(cleanRarity, cleanLevel, levels);
  const multiplier = petTypeMultiplier(model?.type || type);
  return {
    rarity: cleanRarity,
    id: model?.id ?? Math.round(Number(id || 0)),
    type: model?.type || type,
    level: cleanLevel,
    attack: Number(levelInfo?.attack || 0) * multiplier.attack,
    health: Number(levelInfo?.health || 0) * multiplier.health,
    recognized: Boolean(model && levelInfo)
  };
}

function calculateMountValues(rarity: string, id: number, level: number, models: MountModel[], levels: CompanionLevels[]) {
  const cleanRarity = normalizeRarity(rarity);
  const cleanLevel = clamp(Math.round(Number(level || 1)), 1, 100);
  const model = models.find((entry) =>
    normalizeRarity(entry.rarity) === cleanRarity &&
    entry.id === Math.round(Number(id || 0))
  ) || firstMountModel(cleanRarity, models);
  const levelInfo = companionLevelAt(cleanRarity, cleanLevel, levels);
  return {
    rarity: cleanRarity,
    id: model?.id ?? Math.round(Number(id || 0)),
    level: cleanLevel,
    attack: Number(levelInfo?.attack || 0),
    health: Number(levelInfo?.health || 0),
    recognized: Boolean(model && levelInfo)
  };
}

function companionLevelAt(rarity: string, level: number, groups: CompanionLevels[]) {
  return groups
    .find((group) => normalizeRarity(group.rarity) === normalizeRarity(rarity))
    ?.levels.find((entry) => entry.level === level);
}

function firstPetModel(rarity: string, type: PetType, models: PetModel[]) {
  return models
    .filter((entry) => normalizeRarity(entry.rarity) === normalizeRarity(rarity) && entry.type === type)
    .sort((left, right) => left.id - right.id)[0];
}

function firstMountModel(rarity: string, models: MountModel[]) {
  return models
    .filter((entry) => normalizeRarity(entry.rarity) === normalizeRarity(rarity))
    .sort((left, right) => left.id - right.id)[0];
}

function petTypeMultiplier(type: PetType) {
  if (type === "Damage") return { attack: 1.5, health: 0.5 };
  if (type === "Health") return { attack: 0.5, health: 1.5 };
  return { attack: 1, health: 1 };
}

function petTypeLabel(type: PetType) {
  if (type === "Damage") return "Dégâts";
  if (type === "Health") return "PV";
  return "Équilibré";
}

function resolveItemSelection(slot: EquipmentSlot, requestedAge: number, weaponKind: WeaponKind, itemBases: ItemBase[], ageOptions: AgeOption[]) {
  const age = itemBases.some((item) => item.slot === slot && item.age === requestedAge)
    ? Math.round(requestedAge)
    : ageOptions.find((option) => itemBases.some((item) => item.slot === slot && item.age === option.value))?.value ?? 0;
  const base = slot === "Weapon"
    ? firstWeaponBaseForKind(age, weaponKind, itemBases) || firstItemBase(slot, age, itemBases)
    : firstItemBase(slot, age, itemBases);
  return { age, idx: base?.idx ?? 0 };
}

function resolveItemBase(slot: EquipmentSlot, age: number, idx: number, itemBases: ItemBase[]) {
  if (slot === "Weapon") return itemBases.find((entry) => entry.slot === slot && entry.age === age && entry.idx === idx);
  return firstItemBase(slot, age, itemBases);
}

function firstItemBase(slot: EquipmentSlot, age: number, itemBases: ItemBase[]) {
  return itemBases
    .filter((entry) => entry.slot === slot && entry.age === age)
    .sort((left, right) => left.idx - right.idx)[0];
}

function firstWeaponBaseForKind(age: number, kind: WeaponKind, itemBases: ItemBase[]) {
  return itemBases
    .filter((entry) => entry.slot === "Weapon" && entry.age === age && weaponKindFromBase(entry) === kind)
    .sort((left, right) => left.idx - right.idx)[0];
}

function weaponKindOptions(age: number, itemBases: ItemBase[]): WeaponKind[] {
  const kinds = new Set(itemBases.filter((entry) => entry.slot === "Weapon" && entry.age === age).map(weaponKindFromBase));
  return (["melee", "meleeHybrid", "ranged"] as WeaponKind[]).filter((kind) => kinds.has(kind));
}

function weaponKindFromBase(base?: ItemBase): WeaponKind {
  if (base?.isRanged) return "ranged";
  if (Number(base?.health || 0) > 0) return "meleeHybrid";
  return "melee";
}

function weaponKindLabel(kind: WeaponKind) {
  if (kind === "ranged") return "Distance";
  if (kind === "meleeHybrid") return "Corps a corps + vie";
  return "Corps a corps";
}

function labelAge(value: number, ageOptions: AgeOption[]) {
  return ageOptions.find((age) => age.value === value)?.label || `Age ${value}`;
}

function setSpellSelection(profile: NormalizedProfile, index: number, id: string, level: number, spells: SpellOption[]) {
  const next = profile.spells.slice(0, 3);
  if (!id) {
    next.splice(index, 1);
  } else {
    const spell = spells.find((entry) => entry.id === id);
    next[index] = { id, level: clamp(Math.round(level || 1), 1, 100), rarity: spell?.rarity } as NormalizedSpellSelection;
  }
  profile.spells = next.filter((entry) => entry?.id);
}

function setManualItemStat(profile: NormalizedProfile, slot: EquipmentSlot, index: number, stat: string, value: number) {
  const item = ensureManualItem(profile, slot);
  if (index > 0 && !itemAllowsSecondLine(Number(item.age ?? 0))) return;
  item.secondaryStats = setLine(item.secondaryStats, index, stat, value);
  trimImpossibleItemSecondLine(item);
}

function ensureManualItem(profile: NormalizedProfile, slot: EquipmentSlot) {
  if (!profile.equipment[slot]) {
    profile.equipment[slot] = {
      slot,
      name: slot,
      age: 0,
      idx: 0,
      level: 1,
      attack: 0,
      health: 0,
      secondaryStats: [],
      recognized: false
    };
  }
  return profile.equipment[slot]!;
}

function setManualPetSelection(
  profile: NormalizedProfile,
  index: number,
  rarity: string,
  id: number,
  type: PetType,
  level: number,
  models: PetModel[],
  levels: CompanionLevels[]
) {
  const pet = ensureManualPet(profile, index);
  const values = calculatePetValues(rarity, id, type, level, models, levels);
  pet.name = `Pet ${index + 1}`;
  pet.rarity = values.rarity;
  pet.id = values.id;
  pet.type = values.type;
  pet.level = values.level;
  pet.attack = values.attack;
  pet.health = values.health;
  pet.recognized = values.recognized;
  trimImpossiblePetMountSecondLine(pet);
}

function setManualPetStat(profile: NormalizedProfile, petIndex: number, lineIndex: number, stat: string, value: number) {
  const pet = ensureManualPet(profile, petIndex);
  if (lineIndex > 0 && !petMountAllowsSecondLine(pet.rarity)) return;
  pet.secondaryStats = setLine(pet.secondaryStats, lineIndex, stat, value);
  trimImpossiblePetMountSecondLine(pet);
}

function ensureManualPet(profile: NormalizedProfile, index: number): NormalizedPet {
  while (profile.pets.length <= index) {
    profile.pets.push({
      name: `Pet ${profile.pets.length + 1}`,
      rarity: "Common",
      level: 1,
      attack: 0,
      health: 0,
      secondaryStats: [],
      recognized: false
    });
  }
  return profile.pets[index];
}

function setManualMountSelection(
  profile: NormalizedProfile,
  rarity: string,
  id: number,
  level: number,
  models: MountModel[],
  levels: CompanionLevels[]
) {
  const mount = ensureManualMount(profile);
  const values = calculateMountValues(rarity, id, level, models, levels);
  mount.name = "Monture";
  mount.rarity = values.rarity;
  mount.id = values.id;
  mount.level = values.level;
  mount.attack = values.attack;
  mount.health = values.health;
  mount.recognized = values.recognized;
  trimImpossiblePetMountSecondLine(mount);
}

function syncManualCompanionValues(
  profile: NormalizedProfile,
  petModels: PetModel[],
  petLevels: CompanionLevels[],
  mountModels: MountModel[],
  mountLevels: CompanionLevels[]
) {
  if (!petModels.length || !petLevels.length || !mountModels.length || !mountLevels.length) return;
  for (let index = 0; index < 3; index += 1) {
    const pet = ensureManualPet(profile, index);
    const rarity = normalizeRarity(pet.rarity);
    const model = petModels.find((entry) => normalizeRarity(entry.rarity) === rarity && entry.id === Number(pet.id));
    const type = pet.type || model?.type || "Balanced";
    const selected = calculatePetValues(rarity, Number(pet.id ?? 0), type, Number(pet.level || 1), petModels, petLevels);
    setManualPetSelection(profile, index, selected.rarity, selected.id, selected.type, selected.level, petModels, petLevels);
  }
  const mount = ensureManualMount(profile);
  const selectedMount = calculateMountValues(
    normalizeRarity(mount.rarity),
    Number(mount.id ?? 0),
    Number(mount.level || 1),
    mountModels,
    mountLevels
  );
  setManualMountSelection(profile, selectedMount.rarity, selectedMount.id, selectedMount.level, mountModels, mountLevels);
}

function setManualMountStat(profile: NormalizedProfile, lineIndex: number, stat: string, value: number) {
  const mount = ensureManualMount(profile);
  if (lineIndex > 0 && !petMountAllowsSecondLine(mount.rarity)) return;
  mount.secondaryStats = setLine(mount.secondaryStats, lineIndex, stat, value);
  trimImpossiblePetMountSecondLine(mount);
}

function ensureManualMount(profile: NormalizedProfile): NormalizedMount {
  if (!profile.mount) {
    profile.mount = {
      name: "Monture",
      rarity: "Common",
      level: 1,
      attack: 0,
      health: 0,
      secondaryStats: [],
      recognized: false,
      skills: []
    };
  }
  return profile.mount;
}

function setLine(lines: SecondaryLine[], index: number, stat: string, value: number): SecondaryLine[] {
  const next = lines.slice(0, 2);
  if (!stat) {
    next.splice(index, 1);
  } else {
    next[index] = { stat: stat as StatId, sourceId: stat, value: Number(value || 0) };
  }
  return next.filter((line) => line?.stat);
}

function flattenOpponentProfile(profile: NormalizedProfile, stats: StatOption[]) {
  const attack = Number(profile.base.attack || 0);
  const health = Number(profile.base.health || 0);
  profile.source = "manual";
  profile.equipment = Object.fromEntries(equipmentSlots.map((slot) => [slot, null])) as Record<EquipmentSlot, null>;
  profile.pets = [];
  profile.mount = null;
  profile.talentTree = { Forge: {}, Power: {}, SkillsPetTech: {} };
  profile.breakdown.baseAttack = attack;
  profile.breakdown.baseHealth = health;
  profile.breakdown.equipmentAttack = 0;
  profile.breakdown.equipmentHealth = 0;
  profile.breakdown.petAttack = 0;
  profile.breakdown.petHealth = 0;
  profile.breakdown.mountAttack = 0;
  profile.breakdown.mountHealth = 0;
  profile.breakdown.secondaryStats = createStatMap(stats, profile);
  profile.breakdown.talentStats = createStatMap(stats);
  profile.audit = profile.audit.filter((issue) => issue.code !== "compact_opponent");
  profile.audit.push({ severity: "info", code: "compact_opponent", message: "Adversaire saisi avec ses totaux PvP." });
}

function setCompactOpponentBase(profile: NormalizedProfile, field: "attack" | "health", value: number) {
  const safeValue = Math.max(0, Number(value || 0));
  profile.base[field] = safeValue;
  if (field === "attack") profile.breakdown.baseAttack = safeValue;
  else profile.breakdown.baseHealth = safeValue;
}

function setCompactOpponentStat(profile: NormalizedProfile, stat: StatId, value: number) {
  const safeValue = Math.max(0, Number(value || 0));
  profile.stats[stat] = safeValue;
  profile.breakdown.secondaryStats[stat] = safeValue;
  profile.breakdown.talentStats[stat] = 0;
}

function getTalentLevel(profile: NormalizedProfile, node: TechNode) {
  return Number(profile.talentTree?.[node.tree]?.[node.id] || 0);
}

function isTalentUnlocked(profile: NormalizedProfile, node: TechNode) {
  return node.requirements.every((requirement) => Number(profile.talentTree?.[node.tree]?.[requirement] || 0) > 0);
}

function setTalentLevel(profile: NormalizedProfile, node: TechNode, value: number, techNodes: TechNode[] = []) {
  const level = clamp(Math.round(value), 0, node.maxLevel || 5);
  if (!profile.talentTree[node.tree]) profile.talentTree[node.tree] = {};
  if (level <= 0) delete profile.talentTree[node.tree][node.id];
  else profile.talentTree[node.tree][node.id] = level;
  if (level <= 0) removeLockedTalentChildren(profile, techNodes);
}

function removeLockedTalentChildren(profile: NormalizedProfile, techNodes: TechNode[]) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of techNodes) {
      if (getTalentLevel(profile, node) <= 0 || isTalentUnlocked(profile, node)) continue;
      delete profile.talentTree[node.tree][node.id];
      changed = true;
    }
  }
}

function sortTalentNodes(left: TechNode, right: TechNode) {
  return left.tier - right.tier || left.layer - right.layer || left.id - right.id;
}

function groupTalentTiers(nodes: TechNode[]) {
  const tierMap = new Map<number, Map<number, TechNode[]>>();
  for (const node of nodes) {
    if (!tierMap.has(node.tier)) tierMap.set(node.tier, new Map());
    const layerMap = tierMap.get(node.tier)!;
    if (!layerMap.has(node.layer)) layerMap.set(node.layer, []);
    layerMap.get(node.layer)!.push(node);
  }
  return Array.from(tierMap.entries())
    .sort(([left], [right]) => left - right)
    .map(([tier, layerMap]) => ({
      tier,
      columns: Array.from(layerMap.entries())
        .sort(([left], [right]) => left - right)
        .map(([layer, layerNodes]) => ({ layer, nodes: layerNodes.sort(sortTalentNodes) }))
    }));
}

function prepareImportedForEditing(profile: NormalizedProfile, techNodes: TechNode[], stats: StatOption[]) {
  if (profile.source === "manual" || profile.source === "guest") return;
  const effects = computeTalentEffects(techNodes, profile.talentTree, stats);
  for (const slot of equipmentSlots) {
    const item = profile.equipment[slot];
    if (!item) continue;
    item.attack = divideByMultiplier(item.attack, effects.equipment[slot].damagePct);
    item.health = divideByMultiplier(item.health, effects.equipment[slot].healthPct);
    item.name = slot;
  }
  for (const pet of profile.pets) {
    pet.attack = divideByMultiplier(pet.attack, effects.petDamagePct);
    pet.health = divideByMultiplier(pet.health, effects.petHealthPct);
  }
  if (profile.mount) {
    profile.mount.attack = divideByMultiplier(profile.mount.attack, effects.mountDamagePct);
    profile.mount.health = divideByMultiplier(profile.mount.health, effects.mountHealthPct);
  }
  profile.source = "manual";
  profile.audit = profile.audit.filter((issue) => issue.code !== "import_editable");
  profile.audit.push({ severity: "info", code: "import_editable", message: "Profil importé passé en édition: les valeurs peuvent être ajustées manuellement." });
}

function divideByMultiplier(value: number, pct: number) {
  const multiplier = 1 + Number(pct || 0);
  return multiplier === 0 ? Number(value || 0) : Number(value || 0) / multiplier;
}

function refreshManualTotals(profile: NormalizedProfile, stats: StatOption[], techNodes: TechNode[]) {
  const talentEffects = computeTalentEffects(techNodes, profile.talentTree, stats);
  const secondaryStats = createStatMap(stats, profile);
  let equipmentAttack = 0;
  let equipmentHealth = 0;

  for (const slot of equipmentSlots) {
    const item = profile.equipment[slot];
    if (!item) continue;
    trimImpossibleItemSecondLine(item);
    addLinesToStats(secondaryStats, item.secondaryStats);
    item.name = slot;
    item.recognized = hasSourceValues(item.attack, item.health, item.secondaryStats);
    equipmentAttack += Number(item.attack || 0) * (1 + talentEffects.equipment[slot].damagePct);
    equipmentHealth += Number(item.health || 0) * (1 + talentEffects.equipment[slot].healthPct);
  }

  let petAttack = 0;
  let petHealth = 0;
  for (const pet of profile.pets) {
    trimImpossiblePetMountSecondLine(pet);
    addLinesToStats(secondaryStats, pet.secondaryStats);
    pet.recognized = hasSourceValues(pet.attack, pet.health, pet.secondaryStats);
    petAttack += Number(pet.attack || 0) * (1 + talentEffects.petDamagePct);
    petHealth += Number(pet.health || 0) * (1 + talentEffects.petHealthPct);
  }

  let mountAttack = 0;
  let mountHealth = 0;
  if (profile.mount) {
    trimImpossiblePetMountSecondLine(profile.mount);
    addLinesToStats(secondaryStats, profile.mount.secondaryStats);
    profile.mount.recognized = hasSourceValues(profile.mount.attack, profile.mount.health, profile.mount.secondaryStats);
    mountAttack = Number(profile.mount.attack || 0) * (1 + talentEffects.mountDamagePct);
    mountHealth = Number(profile.mount.health || 0) * (1 + talentEffects.mountHealthPct);
  }

  profile.breakdown.equipmentAttack = equipmentAttack;
  profile.breakdown.equipmentHealth = equipmentHealth;
  profile.breakdown.petAttack = petAttack;
  profile.breakdown.petHealth = petHealth;
  profile.breakdown.mountAttack = mountAttack;
  profile.breakdown.mountHealth = mountHealth;
  profile.breakdown.secondaryStats = secondaryStats;
  profile.breakdown.talentStats = talentEffects.globalStats;
  profile.stats = sumStats(secondaryStats, talentEffects.globalStats, stats, profile);
  profile.base.attack = Number(profile.breakdown.baseAttack || 0) + equipmentAttack + petAttack + mountAttack;
  profile.base.health = Number(profile.breakdown.baseHealth || 0) + equipmentHealth + petHealth + mountHealth;
  profile.confidence = "partial";
  profile.audit = profile.audit.filter((issue) => issue.code !== "manual_profile");
  profile.audit.push({ severity: "info", code: "manual_profile", message: "Profil renseigné manuellement: les totaux sont reconstruits depuis objets, pets, monture et talents." });
}

function computeTalentEffects(techNodes: TechNode[], tree: NormalizedProfile["talentTree"], stats: StatOption[]) {
  const effects = {
    equipment: Object.fromEntries(equipmentSlots.map((slot) => [slot, { damagePct: 0, healthPct: 0 }])) as Record<EquipmentSlot, { damagePct: number; healthPct: number }>,
    petDamagePct: 0,
    petHealthPct: 0,
    mountDamagePct: 0,
    mountHealthPct: 0,
    globalStats: createStatMap(stats)
  };

  for (const node of techNodes) {
    const level = Number(tree?.[node.tree]?.[node.id] || 0);
    if (level <= 0) continue;
    for (const effect of node.effects || []) {
      const value = Number(effect.valuePerLevel || 0) * level;
      if (effect.targetType === "WeaponStatTarget") applySlotEffect(effects, "Weapon", effect.statType, value);
      if (effect.targetType === "EquipmentStatTarget") {
        const slot = typeof effect.itemType === "number" ? itemTypeToSlot[effect.itemType] : undefined;
        if (slot) applySlotEffect(effects, slot, effect.statType, value);
      }
      if (effect.targetType === "PetStatTarget") {
        if (isDamageTalent(effect.statType)) effects.petDamagePct += value;
        if (isHealthTalent(effect.statType)) effects.petHealthPct += value;
      }
      if (effect.targetType === "MountStatTarget") {
        if (isDamageTalent(effect.statType)) effects.mountDamagePct += value;
        if (isHealthTalent(effect.statType)) effects.mountHealthPct += value;
      }
      if (effect.targetType === "ActiveSkillStatTarget" || effect.targetType === "PassiveSkillStatTarget") {
        if (isDamageTalent(effect.statType)) effects.globalStats.skillDamage += value * 100;
        if (isHealthTalent(effect.statType)) effects.globalStats.health += value * 100;
      }
    }
  }

  return effects;
}

function applySlotEffect(effects: ReturnType<typeof computeTalentEffects>, slot: EquipmentSlot, statType: string, value: number) {
  if (isDamageTalent(statType)) effects.equipment[slot].damagePct += value;
  if (isHealthTalent(statType)) effects.equipment[slot].healthPct += value;
}

function isDamageTalent(statType: string) {
  return statType === "Damage" || statType === "TechTreeDamage" || statType === "SkillDamage";
}

function isHealthTalent(statType: string) {
  return statType === "Health" || statType === "TechTreeHealth" || statType === "SkillHealth";
}

function addLinesToStats(target: StatMap, lines: SecondaryLine[]) {
  for (const line of lines) target[line.stat] += Number(line.value || 0);
}

function sumStats(left: StatMap, right: StatMap, stats: StatOption[], profile: NormalizedProfile): StatMap {
  const out = createStatMap(stats, profile);
  for (const key of Object.keys(out) as StatId[]) out[key] = Number(left[key] || 0) + Number(right[key] || 0);
  return out;
}

function createStatMap(stats: StatOption[], profile?: NormalizedProfile): StatMap {
  const keys = stats.length ? stats.map((stat) => stat.id) : Object.keys(profile?.stats || {}) as StatId[];
  return Object.fromEntries(keys.map((key) => [key, 0])) as StatMap;
}

function hasSourceValues(attack: number, health: number, lines: SecondaryLine[]) {
  return Number(attack || 0) !== 0 || Number(health || 0) !== 0 || lines.some((line) => Number(line.value || 0) !== 0);
}

function prettyTechType(value: string) {
  return value.replace(/([A-Z])/g, " $1").trim();
}

function nodeKey(node: TechNode) {
  return `${node.tree}:${node.id}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function usesPvp(objective: Objective) {
  return objective === "pvp" || objective === "balanced";
}

function labelConfidence(confidence?: string) {
  if (confidence === "complete") return "complet";
  if (confidence === "partial") return "partiel";
  if (confidence === "manual_required") return "manuel requis";
  return "non évalué";
}

function format(value: unknown, digits = 0) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatSigned(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${format(value, digits)}`;
}
