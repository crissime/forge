import type {
  DropComparisonResult,
  DropInput,
  NormalizedProfile,
  Objective,
  ScenarioSettings
} from "@forge-master/simulator";
import type {
  CloudProfile,
  Evaluation,
  GameDataInfo,
  Session
} from "../types";

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Erreur réseau.");
  return payload as T;
}

export const api = {
  session: () => request<Session>("/api/session"),
  profiles: () => request<{ profiles: CloudProfile[] }>("/api/profiles"),
  bisLatest: () => request<any>("/api/bis/latest"),
  gameData: () => request<GameDataInfo>("/api/game-data/current"),
  manualProfile: () =>
    request<{ normalized: NormalizedProfile }>("/api/profiles/manual", {
      method: "POST",
      body: {}
    }),
  evaluate: (
    profile: NormalizedProfile,
    objective: Objective,
    scenarios: ScenarioSettings,
    opponent?: NormalizedProfile | null
  ) =>
    request<Evaluation>("/api/simulations/evaluate", {
      method: "POST",
      body: {
        profile,
        objective,
        scenarios,
        fightDuration: 60,
        opponent: objective === "pvp" || objective === "balanced" ? opponent : undefined
      }
    }),
  compare: (profile: NormalizedProfile, objective: Objective, drop: DropInput, scenarios: ScenarioSettings) =>
    request<DropComparisonResult>("/api/simulations/drop-compare", {
      method: "POST",
      body: { profile, objective, drop, scenarios, fightDuration: 60 }
    }),
  createProfile: (profile: NormalizedProfile) =>
    request<{ profile: CloudProfile }>("/api/profiles", {
      method: "POST",
      body: { name: profile.name, normalized: profile, source: profile.source }
    }),
  saveProfile: (id: string, profile: NormalizedProfile) =>
    request<{ profile: CloudProfile }>(`/api/profiles/${id}`, {
      method: "PUT",
      body: { name: profile.name, normalized: profile, source: profile.source }
    }),
  importProfile: (raw: unknown, name: string) =>
    request<{ normalized: NormalizedProfile; saved?: CloudProfile | null }>(
      "/api/profiles/import/json",
      { method: "POST", body: { profile: raw, name } }
    ),
  auth: (mode: "login" | "register", username: string, password: string) =>
    request<{ username: string }>(`/api/auth/${mode}`, {
      method: "POST",
      body: { username, password }
    }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST", body: {} })
};
