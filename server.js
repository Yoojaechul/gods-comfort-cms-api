/**
 * server.js
 * Cloud Run + Fastify CMS API
 * - CORS / Preflight(OPTIONS) 확실히 처리
 * - /auth/login 실제 구현 (email/password)
 * - Production에서도 ADMIN_EMAIL/ADMIN_PASSWORD로 최초 관리자 생성 가능
 * 
 * 주요 라우트:
 * - GET /health (인증 불필요) -> { ok: true, service: "cms-api", ts: "..." }
 * - POST /auth/login (인증 불필요) -> { token, user }
 * - POST /auth/change-password (인증 불필요) -> { ok: true }
 * - GET /auth/me (JWT required) -> { user }
 * - GET /creator/videos (JWT required) -> { videos: [...] }
 * 
 * 로컬 테스트:
 *   1. node server.js
 *   2. curl -i http://localhost:8787/health
 *   3. curl -i -X POST http://localhost:8787/auth/change-password \
 *        -H "Content-Type: application/json" \
 *        -d '{"email":"j1dly1@naver.com","currentPassword":"123456789QWER","newPassword":"123456789"}'
 * 
 * 배포 후 확인:
 *   curl -i https://api.godcomfortword.com/health
 *   curl -i -X POST https://api.godcomfortword.com/auth/change-password \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"j1dly1@naver.com","currentPassword":"123456789QWER","newPassword":"123456789"}'
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

// Creator 계정 자동 생성 (배포 환경용)
const CREATOR_EMAIL = process.env.CREATOR_EMAIL || "";
const CREATOR_PASSWORD = process.env.CREATOR_PASSWORD || "";

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

// ✅ 공개 라우트 정의 (인증 불필요)
const PUBLIC_ROUTES = [
  { method: "GET", path: "/health" },
  { method: "POST", path: "/auth/change-password" },
  { method: "POST", path: "/auth/login" },
  { method: "GET", path: "/" },
];

function isPublicRoute(req) {
  return PUBLIC_ROUTES.some(
    (r) => r.method === req.method && r.path === req.url.split("?")[0]
  );
}

// ✅ 전역 OPTIONS 처리 (라우트 없어도 404 방지)
fastify.addHook("onRequest", async (req, reply) => {
  if (req.method === "OPTIONS") {
    // @fastify/cors가 헤더를 셋업한 뒤 여기로 들어오는 경우가 많음
    return reply.code(204).send();
  }
  
  // 공개 라우트는 인증 미들웨어를 건너뛰도록 표시
  // (현재 전역 인증 미들웨어는 없지만, 향후 추가 시 대비)
  if (isPublicRoute(req)) {
    req.isPublicRoute = true;
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
  fastify.log.info(`[bootstrap] ensureAdminFromEnv() 시작 - DB_PATH: ${DB_PATH}`);
  
  // admin 존재하면 스킵
  const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
  if (admin) {
    fastify.log.info(`[bootstrap] Admin 계정 이미 존재 (id: ${admin.id.substring(0, 8)}...)`);
    return;
  }

  fastify.log.info(`[bootstrap] Admin 계정 없음 - ADMIN_EMAIL: ${ADMIN_EMAIL ? ADMIN_EMAIL.substring(0, 3) + "***" : "NOT SET"}, ADMIN_PASSWORD: ${ADMIN_PASSWORD ? "SET" : "NOT SET"}`);

  // env가 없으면 스킵 (운영에서는 반드시 넣는 것을 권장)
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    fastify.log.warn(
      "⚠️ [bootstrap] No admin user exists, and ADMIN_EMAIL/ADMIN_PASSWORD env is not set. Login will fail until an admin is created."
    );
    return;
  }

  const id = generateId();
  const password_hash = pbkdf2HashPassword(ADMIN_PASSWORD);

  db.prepare(`
    INSERT INTO users (id, site_id, name, email, role, status, password_hash)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `).run(id, "gods", "Admin", ADMIN_EMAIL, "admin", password_hash);

  fastify.log.info(`✅ [bootstrap] Admin user created from ENV (email: ${ADMIN_EMAIL.substring(0, 3)}***)`);
}

// ==================== Creator Bootstrap ====================
function ensureCreatorFromEnv() {
  fastify.log.info(`[bootstrap] ensureCreatorFromEnv() 시작 - DB_PATH: ${DB_PATH}`);
  fastify.log.info(`[bootstrap] CREATOR_EMAIL: ${CREATOR_EMAIL ? CREATOR_EMAIL.substring(0, 3) + "***" : "NOT SET"}, CREATOR_PASSWORD: ${CREATOR_PASSWORD ? "SET" : "NOT SET"}`);
  
  // creator가 이미 존재하면 스킵
  if (CREATOR_EMAIL) {
    const existingCreator = db.prepare("SELECT id FROM users WHERE email = ?").get(CREATOR_EMAIL);
    if (existingCreator) {
      fastify.log.info(`[bootstrap] Creator 계정 이미 존재 (id: ${existingCreator.id.substring(0, 8)}...)`);
      // 기존 계정이 있으면 비밀번호 업데이트
      if (CREATOR_PASSWORD) {
        const password_hash = pbkdf2HashPassword(CREATOR_PASSWORD);
        db.prepare(`
          UPDATE users 
          SET password_hash = ?, status = 'active', site_id = 'gods'
          WHERE email = ?
        `).run(password_hash, CREATOR_EMAIL);
        fastify.log.info(`✅ [bootstrap] Creator user password updated from ENV (email: ${CREATOR_EMAIL.substring(0, 3)}***)`);
      }
      return;
    }

    // 새 creator 생성
    if (CREATOR_PASSWORD) {
      const id = generateId();
      const password_hash = pbkdf2HashPassword(CREATOR_PASSWORD);

      db.prepare(`
        INSERT INTO users (id, site_id, name, email, role, status, password_hash)
        VALUES (?, ?, ?, ?, ?, 'active', ?)
      `).run(id, "gods", "Creator", CREATOR_EMAIL, "creator", password_hash);

      fastify.log.info(`✅ [bootstrap] Creator user created from ENV (email: ${CREATOR_EMAIL.substring(0, 3)}***)`);
    } else {
      fastify.log.warn(`⚠️ [bootstrap] CREATOR_EMAIL은 설정되었지만 CREATOR_PASSWORD가 없습니다.`);
    }
  } else {
    fastify.log.warn(`⚠️ [bootstrap] CREATOR_EMAIL이 설정되지 않았습니다. Creator 계정이 자동 생성되지 않습니다.`);
  }
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

fastify.get("/health", async () => {
  return {
    ok: true,
    service: "cms-api",
    ts: new Date().toISOString(),
  };
});
fastify.get("/public/health", async () => ({ status: "ok", service: "cms-api", message: "CMS API is running" }));
fastify.get("/public/healthz", async () => ({ status: "healthy", timestamp: new Date().toISOString() }));

/**
 * ✅ YouTube 메타데이터 조회 (Public API)
 * GET /public/videos/youtube/metadata?url=https://www.youtube.com/watch?v=...
 * response: { title: "..." }
 */
fastify.get("/public/videos/youtube/metadata", async (req, reply) => {
  const url = (req.query?.url || "").toString().trim();

  if (!url) {
    return reply.code(400).send({
      error: "BAD_REQUEST",
      message: "url query parameter is required",
    });
  }

  try {
    // YouTube oEmbed API 호출
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;

    // 5초 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(oembedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CMS-API/1.0)",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        fastify.log.warn(`YouTube oEmbed API failed: ${response.status} ${response.statusText}`);
        return reply.code(502).send({
          error: "BAD_GATEWAY",
          message: "Failed to fetch YouTube metadata",
        });
      }

      const data = await response.json();
      const title = data?.title || null;

      if (!title) {
        fastify.log.warn("YouTube oEmbed response missing title");
        return reply.code(404).send({
          error: "NOT_FOUND",
          message: "Title not found in YouTube metadata",
        });
      }

      return reply.send({ title });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === "AbortError") {
        fastify.log.warn("YouTube oEmbed API timeout after 5 seconds");
        return reply.code(504).send({
          error: "GATEWAY_TIMEOUT",
          message: "YouTube metadata fetch timeout",
        });
      }

      throw fetchError;
    }
  } catch (error) {
    fastify.log.error("YouTube metadata fetch error:", error);
    return reply.code(502).send({
      error: "BAD_GATEWAY",
      message: "Failed to fetch YouTube metadata",
    });
  }
});

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

  // 로그인 실패 시 로깅 (보안을 위해 민감 정보 마스킹)
  if (!user) {
    fastify.log.warn(`[auth/login] Login failed: user not found (email: ${email.substring(0, 3)}***)`);
    return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
  }

  if (user.status !== "active") {
    fastify.log.warn(`[auth/login] Login failed: inactive user (email: ${email.substring(0, 3)}***, role: ${user.role || "unknown"}, site_id: ${user.site_id ? user.site_id.substring(0, 3) + "***" : "null"})`);
    return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
  }

  if (!pbkdf2VerifyPassword(password, user.password_hash)) {
    fastify.log.warn(`[auth/login] Login failed: password mismatch (email: ${email.substring(0, 3)}***, role: ${user.role || "unknown"}, site_id: ${user.site_id ? user.site_id.substring(0, 3) + "***" : "null"})`);
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

/**
 * ✅ 비밀번호 변경
 * body: { email, currentPassword, newPassword }
 * response: { ok: true }
 */
fastify.post("/auth/change-password", async (req, reply) => {
  const body = req.body || {};
  const email = (body.email || "").toString().trim().toLowerCase();
  const currentPassword = (body.currentPassword || "").toString();
  const newPassword = (body.newPassword || "").toString();

  if (!email || !currentPassword || !newPassword) {
    return reply.code(400).send({ error: "BAD_REQUEST", message: "email, currentPassword, and newPassword are required" });
  }

  // 새 비밀번호 길이 검증
  if (newPassword.length < 8) {
    return reply.code(400).send({ error: "BAD_REQUEST", message: "newPassword must be at least 8 characters" });
  }

  // 사용자 조회
  const user = db
    .prepare("SELECT id, email, role, status, password_hash FROM users WHERE email = ? LIMIT 1")
    .get(email);

  if (!user) {
    fastify.log.warn(`[auth/change-password] User not found: ${email.substring(0, 3)}***`);
    return reply.code(404).send({ error: "NOT_FOUND", message: "User not found" });
  }

  if (user.status !== "active") {
    fastify.log.warn(`[auth/change-password] Inactive user: ${email.substring(0, 3)}***`);
    return reply.code(403).send({ error: "FORBIDDEN", message: "User account is not active" });
  }

  // admin 또는 creator만 비밀번호 변경 가능
  if (user.role !== "admin" && user.role !== "creator") {
    fastify.log.warn(`[auth/change-password] Unauthorized role: ${user.role}`);
    return reply.code(403).send({ error: "FORBIDDEN", message: "Only admin and creator can change password" });
  }

  // 비밀번호가 설정되지 않은 경우
  if (!user.password_hash) {
    fastify.log.warn(`[auth/change-password] Password not set: ${email.substring(0, 3)}***`);
    return reply.code(400).send({ error: "BAD_REQUEST", message: "Password not set. Please use setup-password first." });
  }

  // 현재 비밀번호 검증
  if (!pbkdf2VerifyPassword(currentPassword, user.password_hash)) {
    fastify.log.warn(`[auth/change-password] Invalid current password: ${email.substring(0, 3)}***`);
    return reply.code(400).send({ error: "BAD_REQUEST", message: "Current password is incorrect" });
  }

  // 새 비밀번호 해시 (기존 pbkdf2HashPassword 함수 재사용)
  const newPasswordHash = pbkdf2HashPassword(newPassword);

  // 비밀번호 업데이트
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newPasswordHash, user.id);

  fastify.log.info(`✅ [auth/change-password] Password changed successfully: ${email.substring(0, 3)}***`);

  return reply.send({ ok: true });
});

/**
 * Creator 영상 목록 조회 핸들러 (재사용 가능)
 */
async function getCreatorVideosHandler(req, reply) {
  const user = req.user;
  const siteId = (req.query.site_id || user.site_id || "").toString();

  // Creator는 자신의 site_id만 접근 가능
  if (user.role === "creator" && siteId !== user.site_id) {
    return reply.code(403).send({ error: "FORBIDDEN", message: "Access denied to this site_id" });
  }

  const targetSiteId = siteId || user.site_id;

  // owner_id와 site_id 모두 사용하여 영상 조회
  const videos = db
    .prepare("SELECT * FROM videos WHERE site_id = ? AND owner_id = ? ORDER BY created_at DESC")
    .all(targetSiteId, user.id);

  return { videos: videos || [] };
}

/**
 * ✅ Creator 영상 목록 조회
 * GET /creator/videos?site_id=xxx
 * JWT 인증 필요
 */
fastify.get("/creator/videos", { preHandler: requireAuth }, getCreatorVideosHandler);

// ==================== Boot ====================
async function start() {
  fastify.log.info("============================================================");
  fastify.log.info("🚀 CMS API 서버 시작");
  fastify.log.info(`📂 DB Path: ${DB_PATH}`);
  fastify.log.info(`🌍 NODE_ENV: ${NODE_ENV}`);
  fastify.log.info(`🔐 JWT_SECRET: ${JWT_SECRET ? "SET" : "NOT SET"}`);
  fastify.log.info("============================================================");

  fastify.log.info("[start] ensureSchema() 실행 중...");
  ensureSchema();
  fastify.log.info("✅ [start] Schema 확인 완료");

  fastify.log.info("[start] ensureDefaultSiteRow() 실행 중...");
  ensureDefaultSiteRow();
  fastify.log.info("✅ [start] Default site 확인 완료");

  fastify.log.info("[start] ensureAdminFromEnv() 실행 중...");
  ensureAdminFromEnv();
  fastify.log.info("✅ [start] Admin 계정 부트스트랩 완료");

  fastify.log.info("[start] ensureCreatorFromEnv() 실행 중...");
  ensureCreatorFromEnv();
  fastify.log.info("✅ [start] Creator 계정 부트스트랩 완료");

  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  
  fastify.log.info("============================================================");
  fastify.log.info(`✅ CMS API running on port ${PORT}`);
  fastify.log.info(`📂 DB Path: ${DB_PATH}`);
  fastify.log.info(`🌍 NODE_ENV: ${NODE_ENV}`);
  fastify.log.info(`🔐 JWT_SECRET: ${JWT_SECRET ? "SET" : "NOT SET"}`);
  fastify.log.info(`📋 주요 라우트:`);
  fastify.log.info(`   - GET /health (인증 불필요)`);
  fastify.log.info(`   - POST /auth/login (인증 불필요)`);
  fastify.log.info(`   - POST /auth/change-password (인증 불필요)`);
  fastify.log.info(`   - GET /auth/me (JWT required)`);
  fastify.log.info(`   - GET /creator/videos (JWT required)`);
  fastify.log.info("============================================================");
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
