const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), "data", "users.json");
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_BODY_BYTES = 256 * 1024;
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || "").toLowerCase() === "true";

const sessions = new Map();
let db = { users: {} };
let writeQueue = Promise.resolve();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function json(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

function text(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function validateUsername(username) {
  return /^[a-z0-9_-]{3,24}$/.test(username);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 256;
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function sessionCookie(sessionId, maxAge = SESSION_TTL_MS / 1000) {
  const secure = COOKIE_SECURE ? "; Secure" : "";
  return `fm_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function ensureDb() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    db = JSON.parse(raw);
    if (!db || typeof db !== "object" || !db.users) db = { users: {} };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await saveDb();
  }
}

function saveDb() {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, DATA_FILE);
  });
  return writeQueue;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve({ salt, hash: key.toString("hex") });
    });
  });
}

async function verifyPassword(password, user) {
  const result = await hashPassword(password, user.salt);
  const expected = Buffer.from(user.passwordHash, "hex");
  const actual = Buffer.from(result.hash, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function createSession(username) {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  sessions.set(sessionId, {
    username,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return sessionId;
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.fm_session;
  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { sessionId, ...session };
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error("Payload trop volumineux"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON invalide"));
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/register" && req.method === "POST") {
    const body = await readBody(req);
    const username = normalizeUsername(body.username);
    const password = body.password;

    if (!validateUsername(username)) {
      return json(res, 400, { error: "Pseudo invalide: 3-24 caracteres, lettres/chiffres/_/-." });
    }
    if (!validatePassword(password)) {
      return json(res, 400, { error: "Mot de passe invalide: 8 caracteres minimum." });
    }
    if (db.users[username]) {
      return json(res, 409, { error: "Ce pseudo existe deja." });
    }

    const hashed = await hashPassword(password);
    db.users[username] = {
      username,
      salt: hashed.salt,
      passwordHash: hashed.hash,
      profile: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveDb();

    const sessionId = createSession(username);
    return json(res, 201, { username, profile: null }, { "Set-Cookie": sessionCookie(sessionId) });
  }

  if (pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const username = normalizeUsername(body.username);
    const user = db.users[username];

    if (!user || !(await verifyPassword(body.password || "", user))) {
      return json(res, 401, { error: "Identifiants incorrects." });
    }

    const sessionId = createSession(username);
    return json(res, 200, { username, profile: user.profile || null }, { "Set-Cookie": sessionCookie(sessionId) });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const session = getSession(req);
    if (session) sessions.delete(session.sessionId);
    return json(res, 200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
  }

  if (pathname === "/api/me" && req.method === "GET") {
    const session = getSession(req);
    if (!session || !db.users[session.username]) {
      return json(res, 200, { authenticated: false });
    }
    const user = db.users[session.username];
    return json(res, 200, {
      authenticated: true,
      username: user.username,
      profile: user.profile || null
    });
  }

  if (pathname === "/api/profile" && req.method === "GET") {
    const session = getSession(req);
    if (!session || !db.users[session.username]) return json(res, 401, { error: "Non connecte." });
    return json(res, 200, { profile: db.users[session.username].profile || null });
  }

  if (pathname === "/api/profile" && req.method === "PUT") {
    const session = getSession(req);
    if (!session || !db.users[session.username]) return json(res, 401, { error: "Non connecte." });

    const body = await readBody(req);
    if (!body.profile || typeof body.profile !== "object") {
      return json(res, 400, { error: "Profil invalide." });
    }

    db.users[session.username].profile = body.profile;
    db.users[session.username].updatedAt = new Date().toISOString();
    await saveDb();
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: "Route inconnue." });
}

async function serveStatic(req, res, pathname) {
  const distRoot = path.join(process.cwd(), "dist");
  const hasDist = await fs
    .access(distRoot)
    .then(() => true)
    .catch(() => false);

  if (!hasDist) return false;

  const root = distRoot;
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(distRoot, safePath);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root)) return false;

  try {
    const data = await fs.readFile(resolved);
    const type = contentTypes[path.extname(resolved)] || "application/octet-stream";
    const noCache = pathname === "/" || pathname === "/index.html";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": noCache ? "no-cache" : "public, max-age=3600"
    });
    res.end(data);
    return true;
  } catch (error) {
    if (error.code === "ENOENT" && !path.extname(pathname)) {
      const data = await fs.readFile(path.join(distRoot, "index.html"));
      res.writeHead(200, {
        "Content-Type": contentTypes[".html"],
        "Cache-Control": "no-cache"
      });
      res.end(data);
      return true;
    }
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function requestHandler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (pathname === "/healthz") return json(res, 200, { ok: true });
    if (pathname.startsWith("/api/")) return handleApi(req, res, pathname);

    if (req.method !== "GET" && req.method !== "HEAD") {
      return text(res, 405, "Method not allowed");
    }

    const served = await serveStatic(req, res, pathname);
    if (!served) text(res, 404, "Not found");
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: "Erreur serveur." });
  }
}

ensureDb()
  .then(() => {
    http.createServer(requestHandler).listen(PORT, () => {
      console.log(`Forge Master simulator listening on :${PORT}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
