import Database from "better-sqlite3";
import { randomBytes, scryptSync } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경변수에서 DB 경로 가져오기 (없으면 기본값)
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "cms.db");

// better-sqlite3로 DB 열기 (동기 방식이므로 즉시 사용 가능)
const db = new Database(dbPath);

// WAL 모드 활성화 (성능 향상)
db.pragma("journal_mode = WAL");

// SQLite 초기화 (호환성을 위해 async 함수로 유지)
export async function initDB() {
  try {
    console.log(`📂 SQLite database: ${dbPath}`);
    console.log("✅ SQLite database opened successfully");
    
    // 테이블 존재 확인
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`📊 Found ${tables.length} tables in database`);
    
  } catch (error) {
    console.error("❌ SQLite initialization error:", error.message);
    throw error;
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

// SQLite DB 인스턴스를 기본 export
export default db;
