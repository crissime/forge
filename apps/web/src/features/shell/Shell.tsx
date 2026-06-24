import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  GitCompareArrows,
  Hammer,
  Redo2,
  Swords,
  Undo2,
  UserRound,
  WandSparkles
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../../api/client";
import { emptyProfile, useWorkshop } from "../../store/workshop";
import styles from "./Shell.module.css";

const nav = [
  { to: "/build", label: "Build", icon: Hammer },
  { to: "/simulate", label: "Simuler", icon: WandSparkles },
  { to: "/compare", label: "Comparer", icon: GitCompareArrows },
  { to: "/pvp", label: "PvP", icon: Swords }
];

const mobileNav = [
  ...nav,
  { to: "/account", label: "Compte", icon: UserRound }
];

const syncLabels = {
  modified: "Modifié",
  calculating: "Calcul en cours",
  saved: "Sauvegardé localement",
  saving: "Sauvegarde",
  synced: "Synchronisé",
  error: "Erreur — copie locale conservée"
};

export function Shell() {
  const profile = useWorkshop((state) => state.profile);
  const past = useWorkshop((state) => state.past);
  const future = useWorkshop((state) => state.future);
  const undo = useWorkshop((state) => state.undo);
  const redo = useWorkshop((state) => state.redo);
  const syncStatus = useWorkshop((state) => state.syncStatus);
  const toast = useWorkshop((state) => state.toast);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <NavLink className={styles.brand} to="/build">
          <img src="/forge-mark.svg" alt="" />
          <span>Atelier</span>
        </NavLink>
        <nav className={styles.nav} aria-label="Navigation principale">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? styles.active : undefined}>
              <Icon size={21} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <NavLink className={styles.accountLink} to="/account" aria-label="Compte">
          <UserRound size={20} />
        </NavLink>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.profile}>
            <strong>{profile?.name || "Chargement du profil…"}</strong>
            <span>{syncLabels[syncStatus]}</span>
          </div>
          <div className={styles.actions}>
            <button className={styles.iconButton} onClick={undo} disabled={!past.length} aria-label="Annuler">
              <Undo2 size={19} />
            </button>
            <button className={styles.iconButton} onClick={redo} disabled={!future.length} aria-label="Rétablir">
              <Redo2 size={19} />
            </button>
            <button className={`${styles.iconButton} ${styles.secondary}`} onClick={() => exportProfile(profile)} disabled={!profile} aria-label="Exporter">
              <Download size={19} />
            </button>
            <NavLink className={`${styles.iconButton} ${styles.secondary}`} to="/account" aria-label="Compte">
              <UserRound size={19} />
            </NavLink>
          </div>
        </header>

        <main className={styles.content}>
          <Bootstrap />
          <Outlet />
        </main>
      </div>

      <nav className={styles.mobileNav} aria-label="Navigation mobile">
        {mobileNav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? styles.active : undefined}>
            <Icon size={20} aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </div>
  );
}

function Bootstrap() {
  const profile = useWorkshop((state) => state.profile);
  const opponent = useWorkshop((state) => state.opponent);
  const objective = useWorkshop((state) => state.objective);
  const scenarios = useWorkshop((state) => state.scenarios);
  const session = useWorkshop((state) => state.session);
  const cloudProfileId = useWorkshop((state) => state.cloudProfileId);
  const setProfile = useWorkshop((state) => state.setProfile);
  const setOpponent = useWorkshop((state) => state.setOpponent);
  const setEvaluation = useWorkshop((state) => state.setEvaluation);
  const setGameData = useWorkshop((state) => state.setGameData);
  const setSession = useWorkshop((state) => state.setSession);
  const setCloudProfileId = useWorkshop((state) => state.setCloudProfileId);
  const setSyncStatus = useWorkshop((state) => state.setSyncStatus);
  const notify = useWorkshop((state) => state.notify);
  const debouncedProfile = useDebounced(profile, 400);
  const debouncedOpponent = useDebounced(opponent, 400);
  const [onlineTick, setOnlineTick] = useState(0);

  const sessionQuery = useQuery({ queryKey: ["session"], queryFn: api.session });
  const gameDataQuery = useQuery({ queryKey: ["game-data"], queryFn: api.gameData });
  const manualQuery = useQuery({
    queryKey: ["manual-profile"],
    queryFn: api.manualProfile,
    enabled: !profile,
    retry: false
  });
  const evaluationQuery = useQuery({
    queryKey: ["evaluation", debouncedProfile, debouncedOpponent, objective, scenarios],
    queryFn: () => api.evaluate(debouncedProfile!, objective, scenarios, debouncedOpponent),
    enabled: Boolean(debouncedProfile)
  });

  useEffect(() => {
    if (sessionQuery.data) setSession(sessionQuery.data);
  }, [sessionQuery.data, setSession]);

  useEffect(() => {
    if (gameDataQuery.data) setGameData(gameDataQuery.data);
  }, [gameDataQuery.data, setGameData]);

  useEffect(() => {
    if (profile) return;
    if (manualQuery.data) setProfile(manualQuery.data.normalized);
    if (manualQuery.isError) setProfile(emptyProfile());
  }, [manualQuery.data, manualQuery.isError, profile, setProfile]);

  useEffect(() => {
    if (!opponent && profile) {
      const clone = structuredClone(profile);
      clone.name = "Adversaire";
      setOpponent(clone);
    }
  }, [opponent, profile, setOpponent]);

  useEffect(() => {
    if (!profile) return;
    setSyncStatus("modified");
  }, [profile, setSyncStatus]);

  useEffect(() => {
    if (evaluationQuery.isFetching) setSyncStatus("calculating");
    if (evaluationQuery.data) {
      setEvaluation(evaluationQuery.data);
      if (!session.authenticated) setSyncStatus("saved");
    }
    if (evaluationQuery.isError) setSyncStatus("error");
  }, [
    evaluationQuery.data,
    evaluationQuery.isError,
    evaluationQuery.isFetching,
    session.authenticated,
    setEvaluation,
    setSyncStatus
  ]);

  useEffect(() => {
    const onOnline = () => setOnlineTick((value) => value + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    if (!profile || !session.authenticated) return;
    const timeout = window.setTimeout(async () => {
      setSyncStatus("saving");
      try {
        const saved = cloudProfileId
          ? await api.saveProfile(cloudProfileId, profile)
          : await api.createProfile(profile);
        setCloudProfileId(saved.profile.id);
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
        notify("La synchronisation a échoué. La version locale est conservée.");
      }
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [
    profile,
    session.authenticated,
    cloudProfileId,
    onlineTick,
    notify,
    setCloudProfileId,
    setSyncStatus
  ]);

  return null;
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

function exportProfile(profile: ReturnType<typeof useWorkshop.getState>["profile"]) {
  if (!profile) return;
  const blob = new Blob([
    `${JSON.stringify({
      schema: "forge-master-v2-profile",
      exportedAt: new Date().toISOString(),
      dataVersion: profile.dataVersion,
      profile
    }, null, 2)}\n`
  ], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${profile.name.replace(/[^\w-]+/g, "-").toLowerCase() || "profil"}.forge-master.json`;
  link.click();
  URL.revokeObjectURL(url);
}
