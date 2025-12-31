import Database from "better-sqlite3";
import { randomBytes, scryptSync } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
// ✅ DB Path Fix (Windows-safe)
// - 기본값: 프로젝트 루트의 cms.db  (999. cms_api/cms.db)
// - SQLITE_DB_PATH 환경변수가 있으면 우선 사용
// - 환경변수 경로의 디렉터리가 없으면 자동 생성
// --------------------------------------------------
const defaultDbPath = path.join(__dirname, "cms.db");
const dbPath = process.env.SQLITE_DB_PATH
  ? path.isAbsolute(process.env.SQLITE_DB_PATH)
    ? process.env.SQLITE_DB_PATH
    : path.join(__dirname, process.env.SQLITE_DB_PATH)
  : defaultDbPath;

// 디렉터리 존재 보장 (better-sqlite3 에러 방지)
try {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 DB directory created: ${dir}`);
  }
} catch (e) {
  console.warn("⚠️ DB directory ensure failed:", e?.message || e);
}

// better-sqlite3로 DB 열기 (동기 방식)
const db = new Database(dbPath);

// 성능 옵션
db.pragma("journal_mode = WAL");
// ✅ FK 활성화 (중요)
db.pragma("foreign_keys = ON");

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function tableExists(name) {
  return !!db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(name);
}

function addColumnIfMissing(tableName, columnName, columnType) {
  if (!tableExists(tableName)) return;

  const cols = db.prepare(`PRAGMA table_info('${tableName}')`).all().map((c) => c.name);
  if (!cols.includes(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
    console.log(`✅ ${tableName} 테이블에 ${columnName} 컬럼 추가됨`);
  }
}

function ensureSchema() {
  // ✅ 서버가 "테이블 없음"으로 부팅 실패하지 않도록 최소 스키마를 무조건 보장
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

    CREATE TABLE IF NOT EXISTS user_provider_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      key_name TEXT NOT NULL,
      key_value TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE(user_id, provider, key_name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
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
      likes_count INTEGER DEFAULT 0,
      shares_count INTEGER DEFAULT 0,
      management_id TEXT,
      batch_id TEXT,
      batch_order INTEGER,
      batch_created_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      stats_updated_at TEXT,
      stats_updated_by TEXT,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      ip_address TEXT,
      country_code TEXT,
      country_name TEXT,
      language TEXT,
      page_url TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stats_adjustments (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      old_views INTEGER,
      new_views INTEGER,
      old_likes INTEGER,
      new_likes INTEGER,
      old_shares INTEGER,
      new_shares INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_like_clients (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(video_id, client_id)
    );

    -- 인덱스
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_site_id ON users(site_id);

    CREATE INDEX IF NOT EXISTS idx_videos_site_id ON videos(site_id);
    CREATE INDEX IF NOT EXISTS idx_videos_creator_id ON videos(creator_id);
    CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility);
    CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_management_id
      ON videos(management_id)
      WHERE management_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_videos_batch_created_at
      ON videos(batch_created_at DESC)
      WHERE batch_created_at IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_videos_batch_order
      ON videos(batch_order ASC)
      WHERE batch_order IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_visits_site_id ON visits(site_id);
    CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);

    CREATE INDEX IF NOT EXISTS idx_video_like_clients_video_id ON video_like_clients(video_id);
    CREATE INDEX IF NOT EXISTS idx_video_like_clients_client_id ON video_like_clients(client_id);
  `);
}

// SQLite 초기화 (호환성을 위해 async 함수로 유지)
export async function initDB() {
  try {
    console.log(`📂 SQLite database: ${dbPath}`);
    console.log("✅ SQLite database opened successfully");

    // ✅ 1) 스키마를 먼저 100% 보장 (가장 중요)
    ensureSchema();

    // ✅ 2) 혹시 기존 DB에 누락 컬럼이 있으면 보강(마이그레이션)
    addColumnIfMissing("sites", "domain", "TEXT");
    addColumnIfMissing("sites", "homepage_url", "TEXT");
    addColumnIfMissing("sites", "api_base", "TEXT");
    addColumnIfMissing("sites", "facebook_key", "TEXT");
    addColumnIfMissing("sites", "updated_at", "TEXT");

    addColumnIfMissing("videos", "management_id", "TEXT");
    addColumnIfMissing("videos", "batch_id", "TEXT");
    addColumnIfMissing("videos", "batch_order", "INTEGER");
    addColumnIfMissing("videos", "batch_created_at", "TEXT");

    // 테이블 존재 확인
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`📊 Found ${tables.length} tables in database`);

    // ✅ 3) 기본 사이트(seed) 보장
    const defaultSiteId = "gods";
    const site = db.prepare("SELECT id FROM sites WHERE id = ?").get(defaultSiteId);

    if (!site) {
      const defaultSiteName = "God's Comfort Word";
      const defaultDomain = "godcomfortword.com";
      const defaultHomepageUrl = "https://www.godcomfortword.com";
      const runtimePort = Number.parseInt(process.env.PORT || "", 10) || 8787;
      const defaultApiBase = process.env.API_BASE_URL || `http://localhost:${runtimePort}`;

      db.prepare(
        "INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(
        defaultSiteId,
        defaultDomain,
        defaultSiteName,
        defaultHomepageUrl,
        defaultApiBase,
        null
      );

      console.log(`✅ 기본 사이트 생성 (seed): ${defaultSiteId} (${defaultSiteName})`);
      console.log(`   Domain: ${defaultDomain}`);
      console.log(`   Homepage: ${defaultHomepageUrl}`);
    }

    return true;
  } catch (error) {
    console.error("❌ SQLite initialization error:", error.message);
    throw error;
  }
}

// --------------------------------------------------
// Security / Utility
// --------------------------------------------------
export function hashApiKey(apiKey) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(apiKey, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyApiKey(apiKey, hash, salt) {
  try {
    const testHash = scryptSync(apiKey, salt, 64).toString("hex");
    return testHash === hash;
  } catch {
    return false;
  }
}

export function generateApiKey() {
  return randomBytes(32).toString("hex");
}

export function generateId() {
  return randomBytes(16).toString("hex");
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  try {
    const testHash = scryptSync(password, salt, 64).toString("hex");
    return testHash === hash;
  } catch {
    return false;
  }
}

/**
 * 영상 관리번호 생성 (YYMMDD-001 형식)
 */
export function generateManagementNo() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const datePrefix = `${year}${month}${day}`;

  const transaction = db.transaction(() => {
    const maxNo = db
      .prepare(
        `SELECT management_id FROM videos
         WHERE management_id LIKE ?
         ORDER BY management_id DESC
         LIMIT 1`
      )
      .get(`${datePrefix}-%`);

    let nextSequence = 1;
    if (maxNo && maxNo.management_id) {
      const match = String(maxNo.management_id).match(/-(\\d+)$/);
      if (match) nextSequence = parseInt(match[1], 10) + 1;
    }

    const sequenceStr = String(nextSequence).padStart(3, "0");
    return `${datePrefix}-${sequenceStr}`;
  });

  return transaction();
}

export default db;
