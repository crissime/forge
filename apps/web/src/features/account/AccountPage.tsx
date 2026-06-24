import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, FileUp, LogIn, LogOut } from "lucide-react";
import { api } from "../../api/client";
import { emptyProfile, useWorkshop } from "../../store/workshop";
import ui from "../shared/ui.module.css";

export function AccountPage() {
  const session = useWorkshop((state) => state.session);
  const profile = useWorkshop((state) => state.profile);
  const setProfile = useWorkshop((state) => state.setProfile);
  const setSession = useWorkshop((state) => state.setSession);
  const setCloudProfileId = useWorkshop((state) => state.setCloudProfileId);
  const notify = useWorkshop((state) => state.notify);
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const profilesQuery = useQuery({
    queryKey: ["profiles", session.username],
    queryFn: api.profiles,
    enabled: session.authenticated
  });

  const authenticate = async (mode: "login" | "register") => {
    setBusy(true);
    try {
      const result = await api.auth(mode, credentials.username, credentials.password);
      setSession({ authenticated: true, username: result.username });
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      notify(mode === "login" ? "Connexion réussie." : "Compte créé.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  const createManual = async () => {
    try {
      const result = await api.manualProfile();
      setProfile(result.normalized, true);
    } catch {
      setProfile(emptyProfile(), true);
    }
    setCloudProfileId(null);
    notify("Nouveau profil créé.");
  };

  return (
    <div className={ui.page}>
      <header className={ui.heading}>
        <div><p className={ui.eyebrow}>Compte et profils</p><h1>{session.authenticated ? `Bonjour ${session.username}` : "Mode invité"}</h1></div>
        {session.authenticated && <button className={ui.button} onClick={async () => {
          await api.logout();
          setSession({ authenticated: false });
          setCloudProfileId(null);
          notify("Vous êtes déconnecté.");
        }}><LogOut size={18} /> Déconnexion</button>}
      </header>

      {!session.authenticated && (
        <section className={ui.card}>
          <div className={ui.cardHeader}><h2>Synchroniser vos profils</h2><span className={ui.pill}>Optionnel</span></div>
          <div className={ui.grid2}>
            <label className={ui.field}><span>Pseudo</span><input autoComplete="username" value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} /></label>
            <label className={ui.field}><span>Mot de passe</span><input type="password" autoComplete="current-password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label>
          </div>
          <div className={ui.buttonRow} style={{ marginTop: 14 }}>
            <button className={ui.primary} disabled={busy} onClick={() => authenticate("login")}><LogIn size={18} /> Se connecter</button>
            <button className={ui.button} disabled={busy} onClick={() => authenticate("register")}>Créer un compte</button>
          </div>
          <p className={ui.muted} style={{ marginTop: 12 }}>Le profil invité est déjà sauvegardé immédiatement dans ce navigateur.</p>
        </section>
      )}

      <section className={ui.grid2}>
        <div className={ui.card}>
          <div className={ui.cardHeader}><h2>Profil actif</h2><span className={ui.pill}>{profile?.confidence || "local"}</span></div>
          <div className={ui.flatCard}>
            <strong>{profile?.name || "Aucun profil"}</strong>
            <p className={ui.muted}>{profile ? `${profile.source} · données ${profile.dataVersion}` : "Créez ou importez un profil."}</p>
          </div>
          <div className={ui.buttonRow} style={{ marginTop: 14 }}>
            <button className={ui.button} onClick={createManual}><FilePlus2 size={18} /> Nouveau</button>
            <label className={ui.button}>
              <FileUp size={18} /> Importer
              <input hidden type="file" accept=".json,application/json" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const result = await api.importProfile(JSON.parse(await file.text()), file.name.replace(/\.json$/i, ""));
                  setProfile(result.normalized, true);
                  setCloudProfileId(result.saved?.id || null);
                  notify("Profil importé.");
                } catch (error) {
                  notify(error instanceof Error ? error.message : "Import impossible.");
                }
              }} />
            </label>
          </div>
        </div>

        <div className={ui.card}>
          <div className={ui.cardHeader}><h2>Profils synchronisés</h2><span className={ui.pill}>{profilesQuery.data?.profiles.length || 0}</span></div>
          {session.authenticated ? (
            <ul className={ui.list}>
              {profilesQuery.data?.profiles.map((cloud) => (
                <li className={ui.listItem} key={cloud.id}>
                  <button className={ui.ghost} onClick={() => {
                    setProfile(cloud.normalized);
                    setCloudProfileId(cloud.id);
                    notify(`${cloud.name} est maintenant actif.`);
                  }}>
                    <strong>{cloud.name}</strong>
                    <small>Mis à jour le {new Date(cloud.updatedAt).toLocaleString("fr-FR")}</small>
                  </button>
                </li>
              ))}
              {!profilesQuery.data?.profiles.length && <li className={ui.empty}>Le profil actif sera créé lors de la prochaine synchronisation.</li>}
            </ul>
          ) : <div className={ui.empty}>Connectez-vous pour retrouver vos profils sur plusieurs appareils.</div>}
        </div>
      </section>
    </div>
  );
}
