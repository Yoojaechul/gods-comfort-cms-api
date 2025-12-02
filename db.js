import Database from "better-sqlite3";
import { randomBytes, scryptSync } from "crypto";

const db = new Database("cms.db");

// DB 초기화
export function initDB() {
  // sites 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // users 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      site_id TEXT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'creator')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
      api_key_hash TEXT NOT NULL,
      api_key_salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id)
    )
  `);

  // user_provider_keys 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_provider_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('youtube', 'facebook', 'other')),
      key_name TEXT NOT NULL,
      key_value TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, provider, key_name)
    )
  `);

  // videos 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('youtube', 'facebook', 'other')),
      video_id TEXT,
      source_url TEXT NOT NULL,
      title TEXT,
      thumbnail_url TEXT,
      embed_url TEXT,
      language TEXT DEFAULT 'en',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'draft')),
      visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public', 'private')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  // 인덱스 생성
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_site_id ON videos(site_id);
    CREATE INDEX IF NOT EXISTS idx_videos_owner_id ON videos(owner_id);
    CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility);
    CREATE INDEX IF NOT EXISTS idx_users_site_id ON users(site_id);
    CREATE INDEX IF NOT EXISTS idx_user_provider_keys_user_id ON user_provider_keys(user_id);
  `);

  // 마이그레이션: 기존 videos 테이블에 새 컬럼 추가
  try {
    // video_id 컬럼 추가 (nullable)
    db.exec(`ALTER TABLE videos ADD COLUMN video_id TEXT`);
    console.log("✅ Migration: video_id 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      // 이미 컬럼이 존재하면 무시
    } else {
      console.warn("⚠️ video_id 컬럼 추가 실패:", err.message);
    }
  }

  try {
    // language 컬럼 추가
    db.exec(`ALTER TABLE videos ADD COLUMN language TEXT DEFAULT 'en'`);
    console.log("✅ Migration: language 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      // 이미 컬럼이 존재하면 무시
    } else {
      console.warn("⚠️ language 컬럼 추가 실패:", err.message);
    }
  }

  try {
    // status 컬럼 추가
    db.exec(`ALTER TABLE videos ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'draft'))`);
    console.log("✅ Migration: status 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      // 이미 컬럼이 존재하면 무시
    } else {
      console.warn("⚠️ status 컬럼 추가 실패:", err.message);
    }
  }
}

// API Key 해싱
export function hashApiKey(apiKey) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(apiKey, salt, 64).toString("hex");
  return { hash, salt };
}

// API Key 검증
export function verifyApiKey(apiKey, hash, salt) {
  try {
    const testHash = scryptSync(apiKey, salt, 64).toString("hex");
    return testHash === hash;
  } catch {
    return false;
  }
}

// 랜덤 API Key 생성
export function generateApiKey() {
  return randomBytes(32).toString("hex");
}

// 랜덤 ID 생성
export function generateId() {
  return randomBytes(16).toString("hex");
}

// 비밀번호 해싱 (scrypt 사용)
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

// 비밀번호 검증
export function verifyPassword(password, hash, salt) {
  try {
    const testHash = scryptSync(password, salt, 64).toString("hex");
    return testHash === hash;
  } catch {
    return false;
  }
}

export default db;
