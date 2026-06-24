import crypto from "node:crypto";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import { PrismaClient, type User } from "@prisma/client";
import { z } from "zod";
import { loadGameData, sha256 } from "@forge-master/game-data";
import {
  compareDrop,
  evaluateProfile,
  evaluatePvp,
  manualProfile,
  normalizeOneVcianProfile,
  type DropInput,
  type NormalizedProfile,
  type Objective,
  type ScenarioSettings
} from "@forge-master/simulator";

const PORT = Number(process.env.PORT || 3001);
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || "").toLowerCase() === "true";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{3,24}$/);
const passwordSchema = z.string().min(8).max(256);
const objectiveSchema = z.enum(["progress", "damage", "survival", "pvp", "balanced"]).default("progress");
const scenarioSettingsSchema = z.object({
  levelRange: z.object({
    min: z.number().min(0).max(1000).optional(),
    max: z.number().min(0).max(1000).optional(),
    age: z.number().min(0).max(1000).optional(),
    combat: z.number().min(0).max(1000).optional(),
    difficulty: z.number().min(0).max(1).optional()
  }).partial().optional(),
  endurance: z.object({
    startDamagePct: z.number().min(0).max(100).optional(),
    growthPct: z.number().min(0).max(20).optional(),
    maxSeconds: z.number().min(10).max(7200).optional()
  }).partial().optional(),
  timeToKill: z.object({
    targetSeconds: z.number().min(1).max(600).optional(),
    incomingDamagePct: z.number().min(0).max(100).optional(),
    maxSeconds: z.number().min(5).max(7200).optional()
  }).partial().optional(),
  gauntlet: z.object({
    mobCount: z.number().min(1).max(100).optional(),
    firstMobSeconds: z.number().min(1).max(600).optional(),
    firstDamagePct: z.number().min(0).max(100).optional(),
    healthGrowthPct: z.number().min(-90).max(500).optional(),
    damageGrowthPct: z.number().min(-90).max(500).optional(),
    pauseSeconds: z.number().min(0).max(120).optional(),
    maxSeconds: z.number().min(5).max(7200).optional()
  }).partial().optional()
}).partial().optional();

const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });
const prisma = new PrismaClient();
const gameData = await loadGameData();
const publicGameDataManifest = {
  ...gameData.manifest,
  sourceRepo: "community-configs",
  files: gameData.manifest.files.map((file) => ({
    file: file.file,
    sha256: file.sha256,
    sourceUrl: ""
  }))
};

await app.register(cookie, {
  secret: process.env.COOKIE_SECRET || crypto.randomBytes(32).toString("hex")
});

app.get("/api/healthz", async () => ({ ok: true, dataVersion: gameData.normalized.version }));

app.get("/api/session", async (request) => {
  const user = await getUserFromRequest(request);
  if (!user) return { authenticated: false };
  return { authenticated: true, username: user.username };
});

app.post("/api/auth/register", async (request, reply) => {
  const body = z.object({ username: usernameSchema, password: passwordSchema }).parse(request.body);
  const existing = await prisma.user.findUnique({ where: { username: body.username } });
  if (existing) return reply.code(409).send({ error: "Ce pseudo existe déjà." });
  const hashed = await hashPassword(body.password);
  const user = await prisma.user.create({
    data: {
      username: body.username,
      salt: hashed.salt,
      passwordHash: hashed.hash
    }
  });
  await createSession(reply, user.id);
  return reply.code(201).send({ username: user.username });
});

app.post("/api/auth/login", async (request, reply) => {
  const body = z.object({ username: usernameSchema, password: passwordSchema }).parse(request.body);
  const user = await prisma.user.findUnique({ where: { username: body.username } });
  if (!user || !(await verifyPassword(body.password, user))) return reply.code(401).send({ error: "Identifiants incorrects." });
  await createSession(reply, user.id);
  return { username: user.username };
});

app.post("/api/auth/logout", async (request, reply) => {
  const sessionId = request.cookies.fm_session;
  if (sessionId) await prisma.session.deleteMany({ where: { id: sessionId } });
  reply.clearCookie("fm_session", { path: "/" });
  return { ok: true };
});

app.get("/api/profiles", async (request) => {
  const user = await getUserFromRequest(request);
  if (!user) return { profiles: [] };
  const profiles = await prisma.profile.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, source: true, dataVersion: true, confidence: true, normalized: true, createdAt: true, updatedAt: true }
  });
  return { profiles };
});

app.post("/api/profiles", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const body = z.object({
    name: z.string().min(1).max(80).default("Profil"),
    normalized: z.any(),
    rawProfile: z.any().optional(),
    source: z.string().default("manual")
  }).parse(request.body);
  const profile = body.normalized as NormalizedProfile;
  const saved = await prisma.profile.create({
    data: {
      userId: user.id,
      name: body.name,
      source: body.source,
      rawProfile: body.rawProfile ?? null,
      normalized: profile as any,
      dataVersion: profile.dataVersion || gameData.normalized.version,
      confidence: profile.confidence || "partial"
    }
  });
  return reply.code(201).send({ profile: saved });
});

app.put("/api/profiles/:id", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const params = z.object({ id: z.string() }).parse(request.params);
  const body = z.object({
    name: z.string().min(1).max(80).optional(),
    normalized: z.any().optional(),
    source: z.string().optional()
  }).parse(request.body);
  const existing = await prisma.profile.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return reply.code(404).send({ error: "Profil introuvable." });
  const profile = body.normalized as NormalizedProfile | undefined;
  const saved = await prisma.profile.update({
    where: { id: params.id },
    data: {
      name: body.name ?? existing.name,
      source: body.source ?? existing.source,
      normalized: profile ? profile as any : existing.normalized,
      confidence: profile?.confidence ?? existing.confidence,
      dataVersion: profile?.dataVersion ?? existing.dataVersion
    }
  });
  return { profile: saved };
});

app.delete("/api/profiles/:id", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const params = z.object({ id: z.string() }).parse(request.params);
  await prisma.profile.deleteMany({ where: { id: params.id, userId: user.id } });
  return { ok: true };
});

const importCompatibleProfile = async (request: FastifyRequest, reply: FastifyReply) => {
  const body = z.object({ name: z.string().min(1).max(80).optional(), profile: z.any() }).parse(request.body);
  const normalized = normalizeForgeMasterExport(body.profile, body.name) ||
    normalizeOneVcianProfile({ ...body.profile, name: body.name || body.profile?.name }, gameData);
  const evaluation = evaluateProfile(normalized, gameData, "progress");
  const user = await getUserFromRequest(request);

  if (!user) return { normalized, evaluation, saved: null };

  const saved = await prisma.profile.create({
    data: {
      userId: user.id,
      name: body.name || normalized.name,
      source: normalized.source || "import",
      rawProfile: body.profile,
      normalized: normalized as any,
      dataVersion: normalized.dataVersion,
      confidence: normalized.confidence
    }
  });
  return reply.code(201).send({ normalized, evaluation, saved });
};

app.post("/api/profiles/import/json", importCompatibleProfile);

app.post("/api/simulations/evaluate", async (request) => {
  const body = z.object({
    profile: z.any(),
    objective: objectiveSchema,
    opponent: z.any().optional(),
    fightDuration: z.number().min(5).max(600).default(60),
    scenarios: scenarioSettingsSchema
  }).parse(request.body);
  const profile = body.profile as NormalizedProfile;
  if (body.opponent && (body.objective === "pvp" || body.objective === "balanced")) {
    return evaluatePvp(profile, body.opponent as NormalizedProfile, gameData, body.objective as Objective, body.fightDuration, body.scenarios as ScenarioSettings | undefined);
  }
  return evaluateProfile(profile, gameData, body.objective as Objective, body.fightDuration, body.scenarios as ScenarioSettings | undefined);
});

app.post("/api/simulations/drop-compare", async (request) => {
  const body = z.object({
    profile: z.any(),
    objective: objectiveSchema,
    drop: z.any()
  }).parse(request.body);
  return compareDrop(body.profile as NormalizedProfile, body.drop as DropInput, gameData, body.objective as Objective);
});

app.get("/api/game-data/versions", async () => ({
  versions: [publicGameDataManifest],
  current: gameData.normalized.version
}));

app.get("/api/game-data/current", async () => ({
  manifest: publicGameDataManifest,
  normalized: gameData.normalized
}));

app.get("/api/game-data/sources", async () => ({
  version: gameData.normalized.version,
  sourceRepo: publicGameDataManifest.sourceRepo,
  sourceRef: gameData.manifest.sourceRef,
  generatedAt: gameData.manifest.generatedAt,
  hash: sha256(JSON.stringify(gameData.normalized)),
  files: publicGameDataManifest.files
}));

app.post("/api/profiles/manual", async () => ({
  normalized: manualProfile("Profil manuel", gameData)
}));

function normalizeForgeMasterExport(raw: any, name?: string): NormalizedProfile | null {
  const candidate = raw?.schema === "forge-master-v2-profile" ? raw.profile : raw;
  if (!candidate || typeof candidate !== "object") return null;
  if (!candidate.equipment || !candidate.stats || !candidate.breakdown || !candidate.talentTree) return null;
  const source = candidate.source === "guest" ? "manual" : candidate.source || "manual";
  return {
    ...candidate,
    name: name || candidate.name || "Profil importe",
    source,
    dataVersion: candidate.dataVersion || gameData.normalized.version,
    confidence: candidate.confidence || "partial",
    pets: Array.isArray(candidate.pets) ? candidate.pets : [],
    spells: Array.isArray(candidate.spells) ? candidate.spells : [],
    audit: Array.isArray(candidate.audit) ? candidate.audit : []
  } as NormalizedProfile;
}

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  if (error instanceof z.ZodError) return reply.code(400).send({ error: "Payload invalide.", issues: error.issues });
  const apiError = error as { statusCode?: number; message?: string };
  const statusCode = typeof apiError.statusCode === "number" ? apiError.statusCode : 500;
  if (statusCode >= 400 && statusCode < 500) return reply.code(statusCode).send({ error: apiError.message || "Requete invalide." });
  return reply.code(500).send({ error: "Erreur serveur." });
});

try {
  await prisma.$connect();
  await cleanupExpiredSessions();
  await upsertCurrentGameDataVersion();
  await app.listen({ host: "0.0.0.0", port: PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}

async function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = await new Promise<string>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString("hex"));
    });
  });
  return { salt, hash };
}

async function verifyPassword(password: string, user: Pick<User, "salt" | "passwordHash">) {
  const actual = await hashPassword(password, user.salt);
  const expectedBuffer = Buffer.from(user.passwordHash, "hex");
  const actualBuffer = Buffer.from(actual.hash, "hex");
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

async function createSession(reply: any, userId: string) {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    }
  });
  reply.setCookie("fm_session", sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    maxAge: SESSION_TTL_MS / 1000
  });
}

async function getUserFromRequest(request: any): Promise<User | null> {
  const sessionId = request.cookies.fm_session;
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.deleteMany({ where: { id: sessionId } });
    return null;
  }
  await prisma.session.update({ where: { id: sessionId }, data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
  return session.user;
}

async function requireUser(request: any, reply: any): Promise<User | null> {
  const user = await getUserFromRequest(request);
  if (!user) {
    reply.code(401).send({ error: "Non connecté." });
    return null;
  }
  return user;
}

async function cleanupExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

async function upsertCurrentGameDataVersion() {
  await prisma.gameDataVersion.upsert({
    where: { version: gameData.normalized.version },
    create: {
      version: gameData.normalized.version,
      sourceRepo: gameData.manifest.sourceRepo,
      sourceRef: gameData.manifest.sourceRef,
      manifest: gameData.manifest as any,
      sha256: sha256(JSON.stringify(gameData.normalized))
    },
    update: {
      manifest: gameData.manifest as any,
      sha256: sha256(JSON.stringify(gameData.normalized))
    }
  });
}
