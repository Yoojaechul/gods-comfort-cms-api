import db, { hashPassword, generateId, hashApiKey, generateApiKey } from "./db.js";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// .env 파일 로드
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, ".env") });

console.log("🔧 초기 계정 설정 시작...\n");

// ===== 유틸: users 테이블에 특정 컬럼이 있는지 확인 (스키마 변화에 안전) =====
function hasUserColumn(columnName) {
  try {
    const cols = db.prepare("PRAGMA table_info(users)").all();
    return cols.some((c) => c.name === columnName);
  } catch (e) {
    console.warn("⚠️ PRAGMA table_info(users) 확인 실패:", e?.message || e);
    return false;
  }
}

const HAS_PASSWORD_SALT = hasUserColumn("password_salt");

// 환경변수에서 계정 정보 가져오기 (기본값 제공)
// ✅ 원하시는 기본값으로 고정(환경변수로 덮어쓰기는 가능)
const adminEmail = process.env.CMS_TEST_ADMIN_EMAIL || "consulting_manager@naver.com";
const adminUsername = process.env.CMS_TEST_ADMIN_USERNAME || "admin";
const adminPassword = process.env.CMS_TEST_ADMIN_PASSWORD || "123456";

const creatorEmail = process.env.CMS_TEST_CREATOR_EMAIL || "j1d1y1@naver.com";
const creatorUsername = process.env.CMS_TEST_CREATOR_USERNAME || "creator";
// ✅ 여기 핵심 수정: 기본 비번을 123456789QWER로
const creatorPassword = process.env.CMS_TEST_CREATOR_PASSWORD || "123456789QWER";

// 1. gods 사이트 확인/생성
let site = db.prepare("SELECT * FROM sites WHERE id = ?").get("gods");
if (!site) {
  db.prepare("INSERT INTO sites (id, name) VALUES (?, ?)").run("gods", "God's Comfort Word");
  console.log("✅ 사이트 'gods' 생성됨");
} else {
  console.log("✅ 사이트 'gods' 이미 존재");
}

// ====== 2. 관리자 계정 생성/업데이트 ======
let existingAdmin = db
  .prepare("SELECT * FROM users WHERE email = ? OR name = ?")
  .get(adminEmail, adminUsername);

if (!existingAdmin) {
  // 새로 생성
  const adminId = generateId();

  // API Key 생성/저장 (최초 생성시에만)
  const adminApiKey = generateApiKey();
  const { hash: adminKeyHash, salt: adminKeySalt } = hashApiKey(adminApiKey);

  // Password Hash
  const { hash: passwordHash, salt: passwordSalt } = hashPassword(adminPassword);

  if (HAS_PASSWORD_SALT) {
    db.prepare(
      `INSERT INTO users 
       (id, site_id, name, email, password_hash, password_salt, role, status, api_key_hash, api_key_salt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      adminId,
      null, // admin은 전체 사이트 접근 개념이면 NULL 유지
      adminUsername,
      adminEmail,
      passwordHash,
      passwordSalt,
      "admin",
      "active",
      adminKeyHash,
      adminKeySalt
    );
  } else {
    db.prepare(
      `INSERT INTO users 
       (id, site_id, name, email, password_hash, role, status, api_key_hash, api_key_salt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      adminId,
      null,
      adminUsername,
      adminEmail,
      passwordHash,
      "admin",
      "active",
      adminKeyHash,
      adminKeySalt
    );
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ 관리자 계정 생성 완료!");
  console.log("=".repeat(70));
  console.log(`이메일: ${adminEmail}`);
  console.log(`사용자명: ${adminUsername}`);
  console.log(`비밀번호: ${adminPassword}`);
  console.log("역할: Admin");
  console.log("=".repeat(70));
} else {
  // 기존 계정 업데이트 (비밀번호 덮어쓰기)
  const { hash: passwordHash, salt: passwordSalt } = hashPassword(adminPassword);

  // ✅ 버그 수정: api_key_salt에 passwordSalt 넣지 않음
  if (HAS_PASSWORD_SALT) {
    db.prepare(
      `UPDATE users
       SET name = ?,
           email = ?,
           password_hash = ?,
           password_salt = ?,
           status = 'active',
           role = 'admin',
           site_id = NULL
       WHERE id = ?`
    ).run(adminUsername, adminEmail, passwordHash, passwordSalt, existingAdmin.id);
  } else {
    db.prepare(
      `UPDATE users
       SET name = ?,
           email = ?,
           password_hash = ?,
           status = 'active',
           role = 'admin',
           site_id = NULL
       WHERE id = ?`
    ).run(adminUsername, adminEmail, passwordHash, existingAdmin.id);
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ 관리자 계정 업데이트 완료!");
  console.log("=".repeat(70));
  console.log(`이메일: ${adminEmail}`);
  console.log(`사용자명: ${adminUsername}`);
  console.log(`비밀번호: ${adminPassword} (업데이트됨)`);
  console.log("역할: Admin");
  console.log("=".repeat(70));
}

// ====== 3. 크리에이터 계정 생성/업데이트 ======
let existingCreator = db
  .prepare("SELECT * FROM users WHERE email = ? OR name = ?")
  .get(creatorEmail, creatorUsername);

if (!existingCreator) {
  // 새로 생성
  const creatorId = generateId();

  // API Key 생성/저장 (최초 생성시에만)
  const creatorApiKey = generateApiKey();
  const { hash: creatorKeyHash, salt: creatorKeySalt } = hashApiKey(creatorApiKey);

  // Password Hash
  const { hash: passwordHash, salt: passwordSalt } = hashPassword(creatorPassword);

  if (HAS_PASSWORD_SALT) {
    db.prepare(
      `INSERT INTO users 
       (id, site_id, name, email, password_hash, password_salt, role, status, api_key_hash, api_key_salt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      creatorId,
      "gods",
      creatorUsername,
      creatorEmail,
      passwordHash,
      passwordSalt,
      "creator",
      "active",
      creatorKeyHash,
      creatorKeySalt
    );
  } else {
    db.prepare(
      `INSERT INTO users 
       (id, site_id, name, email, password_hash, role, status, api_key_hash, api_key_salt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      creatorId,
      "gods",
      creatorUsername,
      creatorEmail,
      passwordHash,
      "creator",
      "active",
      creatorKeyHash,
      creatorKeySalt
    );
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ 크리에이터 계정 생성 완료!");
  console.log("=".repeat(70));
  console.log(`이메일: ${creatorEmail}`);
  console.log(`사용자명: ${creatorUsername}`);
  console.log(`비밀번호: ${creatorPassword}`);
  console.log("역할: Creator");
  console.log("=".repeat(70));
} else {
  // 기존 계정 업데이트 (비밀번호 덮어쓰기)
  const { hash: passwordHash, salt: passwordSalt } = hashPassword(creatorPassword);

  // ✅ 버그 수정: api_key_salt에 passwordSalt 넣지 않음
  if (HAS_PASSWORD_SALT) {
    db.prepare(
      `UPDATE users
       SET name = ?,
           email = ?,
           password_hash = ?,
           password_salt = ?,
           status = 'active',
           role = 'creator',
           site_id = 'gods'
       WHERE id = ?`
    ).run(creatorUsername, creatorEmail, passwordHash, passwordSalt, existingCreator.id);
  } else {
    db.prepare(
      `UPDATE users
       SET name = ?,
           email = ?,
           password_hash = ?,
           status = 'active',
           role = 'creator',
           site_id = 'gods'
       WHERE id = ?`
    ).run(creatorUsername, creatorEmail, passwordHash, existingCreator.id);
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ 크리에이터 계정 업데이트 완료!");
  console.log("=".repeat(70));
  console.log(`이메일: ${creatorEmail}`);
  console.log(`사용자명: ${creatorUsername}`);
  console.log(`비밀번호: ${creatorPassword} (업데이트됨)`);
  console.log("역할: Creator");
  console.log("=".repeat(70));
}

console.log("\n🎉 초기 계정 설정 완료!");
console.log("\n📝 로그인 정보:");
console.log(`1. 관리자: 이메일 "${adminEmail}" 또는 사용자명 "${adminUsername}", 비밀번호 "${adminPassword}"`);
console.log(`2. 크리에이터: 이메일 "${creatorEmail}" 또는 사용자명 "${creatorUsername}", 비밀번호 "${creatorPassword}"`);
console.log("\n" + "=".repeat(70));
console.log("💡 비밀번호 변경 방법:");
console.log("=".repeat(70));
console.log("방법 1: .env 파일 수정 후 스크립트 재실행 (권장)");
console.log("  1. .env 파일에서 CMS_TEST_ADMIN_PASSWORD 또는 CMS_TEST_CREATOR_PASSWORD 수정");
console.log("  2. node setup-initial-accounts.js 실행");
console.log("  3. 서버 재시작");
console.log("");
console.log("방법 2: 웹 UI에서 변경");
console.log("  1. 로그인 후 비밀번호 변경 메뉴 접속");
console.log("=".repeat(70));
