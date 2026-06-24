import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const PORT = Number(process.env.PORT || 3000);
const API_ORIGIN = process.env.API_ORIGIN || "http://127.0.0.1:3001";
const root = path.resolve(process.cwd(), "apps", "web", "dist");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};
const blockedProxyHeaders = new Set([
  "host",
  "connection",
  "expect",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return proxyApi(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return text(res, 405, "Method not allowed");
    const served = await serveStatic(res, url.pathname);
    if (!served) text(res, 404, "Not found");
  } catch (error) {
    console.error(error);
    if (!res.headersSent) text(res, 500, "Server error");
  }
}).listen(PORT, () => {
  console.log(`Forge Master web listening on :${PORT}`);
});

async function proxyApi(req, res, url) {
  const target = new URL(`${url.pathname}${url.search}`, API_ORIGIN);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (blockedProxyHeaders.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) headers.set(key, value.join(","));
    else if (value !== undefined) headers.set(key, value);
  }
  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
      duplex: "half"
    });
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    if (req.method === "HEAD") return res.end();
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) text(res, 502, "API proxy error");
  }
}

async function serveStatic(res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(path.join(root, safePath));
  if (!resolved.startsWith(root)) return false;
  try {
    const data = await fs.readFile(resolved);
    const noCache = pathname === "/" || pathname === "/index.html";
    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(resolved)] || "application/octet-stream",
      "Cache-Control": noCache ? "no-cache" : "public, max-age=3600"
    });
    res.end(data);
    return true;
  } catch (error) {
    if (error.code === "ENOENT" && !path.extname(pathname)) {
      const data = await fs.readFile(path.join(root, "index.html"));
      res.writeHead(200, { "Content-Type": contentTypes[".html"], "Cache-Control": "no-cache" });
      res.end(data);
      return true;
    }
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function text(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}
