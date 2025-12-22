/**
 * server.js
 * Cloud Run + Fastify CMS API
 * - CORS / Preflight(OPTIONS) 확실히 처리
 * - /auth/login 실제 구현 (email/password)
 * - Production에서도 ADMIN_EMAIL/ADMIN_PASSWORD로 최초 관리자 생성 가능
 */

import Fastify from "fastify";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import crypto from "crypto";
import cors from "@fastify/cors";

dotenv.config();

// ==================== ENV ====================
const PORT = Number(process.env.PORT || 8080);
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// Cloud Run에서는 컨테이너 파일시스템이 기본적으로 ephemeral 입니다.
// (재시작/재배포 시 DB 파일이 초기화될 수 있음)
// 현재 구조를 유지하되, DB_PATH를 바꿀 수 있게 열어둡니다.
const DB_PATH = process.env.DB_PATH || "cms.db";

// CORS 허용 Origin (필요 시 env로 추가 가능)
const EXTRA_ALLOWED_ORIGINS = (process.env.EXTRA_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// JWT
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_IN_PRODUCTION";
const JWT_EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN_SECONDS || 60 * 60 * 24); // 1 day

// Production에서도 최초 관리자 만들기 (권장)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// ==================== Fastify ====================
const fastify = Fastify({ logger: true });

// ==================== CORS ====================
const ALLOWED_ORIGINS = new Set([
  "https://cms.godcomfortword.com",
  "https://godcomfortword.com",
  "https://www.godcomfortword.com",

  // Firebase Hosting 기본 도메인
  "https://gods-comfort-word-cms.web.app",
  "https://gods-comfort-word-cms.firebaseapp.com",
  "https://gods-comfort-word.web.app",
  "https://gods-comfort-word.firebaseapp.com",

  // 로컬
  "http://localhost:5173",
  "http://localhost:3000",

  ...EXTRA_ALLOWED_ORIGINS,
]);

await fastify.register(cors, {
  origin: (origin, cb) => {
    // server-to-server / health check는 origin이 없는 경우가 많음 → 허용
    if (!origin) return cb(null, true);

    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);

    fastify.log.warn(`[CORS] Blocked origin: ${origin}`);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "content-type",
    "authorization",
    "x-requested-with",
    "accept",
    "origin",
  ],
  maxAge: 86400,
});

// ✅ 전역 OPTIONS 처리 (라우트 없어도 404 방지)
fastify.addHook("onRequest", async (req, reply) => {
  if (req.method === "OPTIONS") {
    // @fastify/cors가 헤더를 셋업한 뒤 여기로 들어오는 경우가 많음
    return reply.code(204).send();
  }
});

// ==================== DB ====================
const db = new Database(DB_PATH);

// ==================== Utils ====================
function generateId() {
  return crypto.randomBytes(16).toString("hex");
}

function pbkdf2HashPassword(password) {
  const iterations = 100_000;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  // 저장 포맷: pbkdf2$iterations$salt$hash
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function pbkdf2VerifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;

  // pbkdf2$iterations$salt$hash
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    // 과거 포맷이 있다면 여기서 호환 처리 가능
    return false;
  }

  const iterations = Number(parts[1]);
  const salt = parts[2];
  const hash = parts[3];

  const computed = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload, expiresInSeconds = JWT_EXPIRES_IN_SECONDS) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };

  const encHeader = base64url(JSON.stringify(header));
  const encBody = base64url(JSON.stringify(body));
  const data = `${encHeader}.${encBody}`;

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signature}`;
}

function verifyJwt(token) {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;

    const data = `${h}.${p}`;
    const expected = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(data)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    if (expected !== s) return null;

    const payload = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

// ==================== Schema ====================
function ensureSchema() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      domain TEXT,
      name TEXT NOT NULL,
      homepage_url TEXT,
      api_base TEXT,
      facebook_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      site_id TEXT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      password_hash TEXT,
      api_key_hash TEXT,
      api_key_salt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      video_id TEXT,
      source_url TEXT NOT NULL,
      title TEXT,
      thumbnail_url TEXT,
      embed_url TEXT,
      language TEXT DEFAULT 'en',
      status TEXT DEFAULT 'active',
      visibility TEXT DEFAULT 'public',
      views_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (site_id) REFERENCES sites(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );
  `);
}

// ==================== Default Site ====================
function ensureDefaultSiteRow() {
  const exists = db.prepare("SELECT id FROM sites WHERE id = ?").get("gods");
  if (!exists) {
    db.prepare(`
      INSERT INTO sites (id, domain, name, homepage_url, api_base)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "gods",
      "godcomfortword.com",
      "God's Comfort Word",
      "https://www.godcomfortword.com",
      "" // 운영에서는 프론트에서 API_BASE_URL 사용하므로 필수 아님
    );

    fastify.log.info("✅ Default site created");
  }
}

// ==================== Admin Bootstrap ====================
function ensureAdminFromEnv() {
  // admin 존재하면 스킵
  const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
  if (admin) return;

  // env가 없으면 스킵 (운영에서는 반드시 넣는 것을 권장)
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    fastify.log.warn(
      "⚠ No admin user exists, and ADMIN_EMAIL/ADMIN_PASSWORD env is not set. Login will fail until an admin is created."
    );
    return;
  }

  const id = generateId();
  const password_hash = pbkdf2HashPassword(ADMIN_PASSWORD);

  db.prepare(`
    INSERT INTO users (id, site_id, name, email, role, status, password_hash)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `).run(id, "gods", "Admin", ADMIN_EMAIL, "admin", password_hash);

  fastify.log.info("✅ Admin user created from ENV (ADMIN_EMAIL/ADMIN_PASSWORD).");
}

// ==================== Auth Guard (선택) ====================
async function requireAuth(req, reply) {
  const token = getBearerToken(req);
  if (!token) return reply.code(401).send({ error: "UNAUTHORIZED" });

  const payload = verifyJwt(token);
  if (!payload?.userId) return reply.code(401).send({ error: "UNAUTHORIZED" });

  const user = db.prepare("SELECT id, site_id, name, email, role, status FROM users WHERE id=?").get(payload.userId);
  if (!user || user.status !== "active") return reply.code(401).send({ error: "UNAUTHORIZED" });

  req.user = user;
}

// ==================== Routes ====================

// root
fastify.get("/", async () => ({ service: "cms-api", status: "running" }));

fastify.get("/health", async () => ({ status: "ok", service: "cms-api", message: "CMS API is running" }));
fastify.get("/public/health", async () => ({ status: "ok", service: "cms-api", message: "CMS API is running" }));
fastify.get("/public/healthz", async () => ({ status: "healthy", timestamp: new Date().toISOString() }));

/**
 * ✅ 로그인 (실제 구현)
 * body: { email, password }
 * response: { token, user }
 */
fastify.post("/auth/login", async (req, reply) => {
  const body = req.body || {};
  const email = (body.email || "").toString().trim().toLowerCase();
  const password = (body.password || "").toString();

  if (!email || !password) {
    return reply.code(400).send({ error: "BAD_REQUEST", message: "email and password are required" });
  }

  const user = db
    .prepare("SELECT id, site_id, name, email, role, status, password_hash FROM users WHERE email = ? LIMIT 1")
    .get(email);

  // 보안상 "계정 없음/비번 틀림" 구분하지 않음
  if (!user || user.status !== "active" || !pbkdf2VerifyPassword(password, user.password_hash)) {
    return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
  }

  const token = signJwt({ userId: user.id, role: user.role, siteId: user.site_id });

  return reply.send({
    token,
    user: {
      id: user.id,
      site_id: user.site_id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

/**
 * (선택) 내 정보 확인
 */
fastify.get("/auth/me", { preHandler: requireAuth }, async (req) => {
  return { user: req.user };
});

// ==================== Boot ====================
async function start() {
  ensureSchema();
  ensureDefaultSiteRow();
  ensureAdminFromEnv();

  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  fastify.log.info(`🚀 CMS API running on port ${PORT}`);
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});


// ⚠️ 임시: creator 생성 (1회 실행 후 삭제 권장)
fastify.get("/__bootstrap/creator", async () => {
  const exists = db.prepare("SELECT id FROM users WHERE email=?").get("j1dly1@naver.com");
  if (exists) return { status: "already-exists" };

  const id = generateId();
  const password_hash = pbkdf2HashPassword("123456789QWER");

  db.prepare(`
    INSERT INTO users (id, site_id, name, email, role, status, password_hash)
    VALUES (?, 'gods', 'Creator', ?, 'creator', 'active', ?)
  `).run(id, "j1dly1@naver.com", password_hash);

  return { status: "creator-created" };
});
