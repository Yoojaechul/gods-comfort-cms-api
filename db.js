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
    
    // sites 테이블 생성 (없으면)
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sites (
          id TEXT PRIMARY KEY,
          domain TEXT,
          name TEXT NOT NULL,
          homepage_url TEXT,
          api_base TEXT,
          facebook_key TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      
      // 기존 테이블에 새 컬럼 추가 (마이그레이션)
      const columnsToAdd = [
        { name: "domain", type: "TEXT" },
        { name: "homepage_url", type: "TEXT" },
        { name: "api_base", type: "TEXT" },
        { name: "facebook_key", type: "TEXT" },
      ];
      
      for (const column of columnsToAdd) {
        try {
          db.exec(`ALTER TABLE sites ADD COLUMN ${column.name} ${column.type}`);
          console.log(`✅ sites 테이블에 ${column.name} 컬럼 추가됨`);
        } catch (err) {
          if (!err.message.includes("duplicate column")) {
            throw err;
          }
          // 이미 존재하면 무시
        }
      }
    } catch (err) {
      console.error("❌ sites 테이블 생성 오류:", err.message);
      throw err;
    }
    
    // videos 테이블에 management_id 컬럼 추가 (없으면)
    try {
      const videosTableInfo = db.prepare("PRAGMA table_info('videos')").all();
      const videosColumns = videosTableInfo.map((col) => col.name);
      
      if (!videosColumns.includes("management_id")) {
        db.exec("ALTER TABLE videos ADD COLUMN management_id TEXT");
        console.log("✅ videos 테이블에 management_id 컬럼 추가됨");
      }
      
      // management_id에 unique 인덱스 추가 (없으면)
      try {
        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_management_id ON videos(management_id) WHERE management_id IS NOT NULL");
        console.log("✅ videos 테이블에 management_id unique 인덱스 추가됨");
      } catch (err) {
        if (!err.message.includes("already exists")) {
          console.warn("⚠️  management_id 인덱스 생성 실패:", err.message);
        }
      }
    } catch (err) {
      console.warn("⚠️  videos 테이블 management_id 컬럼/인덱스 추가 실패:", err.message);
    }
    
    // videos 테이블에 대량 등록 관련 컬럼 추가 (없으면)
    try {
      const videosTableInfo = db.prepare("PRAGMA table_info('videos')").all();
      const videosColumns = videosTableInfo.map((col) => col.name);
      
      const batchColumns = [
        { name: "batch_id", type: "TEXT" },
        { name: "batch_order", type: "INTEGER" },
        { name: "batch_created_at", type: "TEXT" },
      ];
      
      for (const column of batchColumns) {
        if (!videosColumns.includes(column.name)) {
          db.exec(`ALTER TABLE videos ADD COLUMN ${column.name} ${column.type}`);
          console.log(`✅ videos 테이블에 ${column.name} 컬럼 추가됨`);
        }
      }
      
      // batch_id와 batch_created_at에 인덱스 추가 (정렬 성능 향상)
      try {
        db.exec("CREATE INDEX IF NOT EXISTS idx_videos_batch_created_at ON videos(batch_created_at DESC) WHERE batch_created_at IS NOT NULL");
        db.exec("CREATE INDEX IF NOT EXISTS idx_videos_batch_order ON videos(batch_order ASC) WHERE batch_order IS NOT NULL");
        console.log("✅ videos 테이블에 batch 관련 인덱스 추가됨");
      } catch (err) {
        if (!err.message.includes("already exists")) {
          console.warn("⚠️  batch 인덱스 생성 실패:", err.message);
        }
      }
    } catch (err) {
      console.warn("⚠️  videos 테이블 batch 컬럼 추가 실패:", err.message);
    }
    
    // 테이블 존재 확인
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`📊 Found ${tables.length} tables in database`);
    
    // sites 테이블이 비어있으면 기본 사이트 생성 (seed)
    const siteCount = db.prepare("SELECT COUNT(*) as count FROM sites").get();
    if (siteCount.count === 0) {
      const defaultSiteId = "gods";
      const defaultSiteName = "God's Comfort Word";
      const defaultDomain = "godcomfortword.com";
      const defaultHomepageUrl = "https://www.godscomfortword.com";
      const runtimePort = Number.parseInt(process.env.PORT || "", 10) || 8787;
      const defaultApiBase = process.env.API_BASE_URL || `http://localhost:${runtimePort}`;
      const defaultFacebookKey = null; // 기본값은 null
      
      try {
        db.prepare(
          "INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
        ).run(
          defaultSiteId,
          defaultDomain,
          defaultSiteName,
          defaultHomepageUrl,
          defaultApiBase,
          defaultFacebookKey
        );
        console.log(`✅ 기본 사이트 생성 (seed): ${defaultSiteId} (${defaultSiteName})`);
        console.log(`   Domain: ${defaultDomain}`);
        console.log(`   Homepage: ${defaultHomepageUrl}`);
      } catch (err) {
        // 이미 존재하면 무시
        if (!err.message.includes("UNIQUE constraint")) {
          console.warn("⚠️  기본 사이트 생성 실패:", err.message);
        }
      }
    }
    
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

/**
 * 영상 관리번호 생성 (YYMMDD-001 형식)
 * 동일 날짜 내에서 순번이 자동으로 증가하며, 동시 등록에도 중복이 발생하지 않도록 원자적 처리
 * @returns {string} 관리번호 (예: "251216-001")
 */
export function generateManagementNo() {
  // 현재 날짜를 YYMMDD 형식으로 변환
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2); // 마지막 2자리
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;
  
  // 트랜잭션을 사용하여 원자적 증가 보장
  const transaction = db.transaction(() => {
    // 오늘 날짜로 시작하는 관리번호 중 가장 큰 순번 조회
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
      // 기존 관리번호에서 순번 추출 (예: "251216-001" -> 1)
      const match = maxNo.management_id.match(/-(\d+)$/);
      if (match) {
        const lastSequence = parseInt(match[1], 10);
        nextSequence = lastSequence + 1;
      }
    }
    
    // 순번을 3자리 문자열로 포맷팅 (001, 002, ...)
    const sequenceStr = String(nextSequence).padStart(3, '0');
    const managementNo = `${datePrefix}-${sequenceStr}`;
    
    return managementNo;
  });
  
  // 트랜잭션 실행 (원자적 보장)
  return transaction();
}

// SQLite DB 인스턴스를 기본 export
export default db;
