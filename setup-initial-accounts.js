import db, { generateId, hashApiKey, generateApiKey } from "./db.js";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// .env 파일 로드
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, ".env") });

// ✅ server.js와 동일한 pbkdf2 해시 함수 (재사용)
function pbkdf2HashPassword(password) {
  const iterations = 100_000;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
  // 저장 포맷: pbkdf2$iterations$salt$hash
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

console.log("🔧 초기 계정 설정 시작...\n");

// password_salt 컬럼은 server.js에서 사용하지 않으므로 제거

// 환경변수에서 계정 정보 가져오기 (기본값 제공)
// ✅ 원하시는 기본값으로 고정(환경변수로 덮어쓰기는 가능)
const adminEmail = process.env.CMS_TEST_ADMIN_EMAIL || "consulting_manager@naver.com";
const adminUsername = process.env.CMS_TEST_ADMIN_USERNAME || "admin";
const adminPassword = process.env.CMS_TEST_ADMIN_PASSWORD || "123456";

const creatorEmail = process.env.CMS_TEST_CREATOR_EMAIL || "j1dly1@naver.com";
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

  // Password Hash (server.js와 동일한 pbkdf2 형식)
  const passwordHash = pbkdf2HashPassword(adminPassword);

  db.prepare(
    `INSERT INTO users 
     (id, site_id, name, email, password_hash, role, status, api_key_hash, api_key_salt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    adminId,
    null, // admin은 전체 사이트 접근 개념이면 NULL 유지
    adminUsername,
    adminEmail,
    passwordHash,
    "admin",
    "active",
    adminKeyHash,
    adminKeySalt
  );

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
  const passwordHash = pbkdf2HashPassword(adminPassword);

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

  // Password Hash (server.js와 동일한 pbkdf2 형식)
  const passwordHash = pbkdf2HashPassword(creatorPassword);

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
  const passwordHash = pbkdf2HashPassword(creatorPassword);

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
