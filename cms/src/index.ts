import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

setGlobalOptions({ maxInstances: 10 });

const ALLOWED_ORIGINS = new Set([
  "https://gods-comfort-word-cms.web.app",
  "https://gods-comfort-word-cms.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function setCors(req: any, res: any) {
  const origin = req.headers.origin as string | undefined;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export const api = onRequest((req, res) => {
  setCors(req, res);

  // Preflight
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  // GET /health
  if (req.method === "GET" && path === "/health") {
    res.status(200).json({ ok: true });
    return;
  }

  // POST /auth/login (임시)
  if (req.method === "POST" && path === "/auth/login") {
    let body: any = {};
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
    } catch (_) {}

    const email = (body.email ?? "").toString();

    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    logger.info("[auth/login] success (dev)", { email });

    res.status(200).json({
      token: "dev-token",
      user: { email, role: "admin" },
    });
    return;
  }

  res.status(404).json({ error: "Not Found", path });
});
