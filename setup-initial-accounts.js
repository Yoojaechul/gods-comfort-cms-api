import db, { hashPassword, generateId, hashApiKey, generateApiKey } from "./db.js";

console.log("🔧 초기 계정 설정 시작...\n");

// 1. gods 사이트 확인/생성
let site = db.prepare("SELECT * FROM sites WHERE id = ?").get("gods");
if (!site) {
  db.prepare("INSERT INTO sites (id, name) VALUES (?, ?)").run("gods", "God's Comfort Word");
  console.log("✅ 사이트 'gods' 생성됨");
} else {
  console.log("✅ 사이트 'gods' 이미 존재");
}

// 2. 기존 계정 삭제 (초기화)
db.prepare("DELETE FROM users WHERE email IN (?, ?)").run(
  "consulting_manager@naver.com",
  "01023942042"
);
console.log("ℹ️  기존 계정 초기화 완료");

// 3. 관리자 계정 생성 (비밀번호 미설정 - 최초 로그인 시 설정)
const adminId = generateId();
const adminApiKey = generateApiKey();
const { hash: adminKeyHash, salt: adminKeySalt } = hashApiKey(adminApiKey);

db.prepare(
  `INSERT INTO users 
   (id, site_id, name, email, password_hash, role, status, api_key_hash, api_key_salt) 
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(
  adminId,
  null, // site_id null (관리자는 모든 사이트 접근)
  "Manager",
  "consulting_manager@naver.com",
  null, // password_hash null (최초 로그인 시 설정)
  "admin",
  "active",
  adminKeyHash,
  adminKeySalt
);

console.log("\n" + "=".repeat(70));
console.log("✅ 관리자 계정 생성 완료!");
console.log("=".repeat(70));
console.log("이메일: consulting_manager@naver.com");
console.log("비밀번호: (최초 로그인 시 설정)");
console.log("역할: Admin");
console.log("API Key:", adminApiKey);
console.log("⚠️  최초 로그인 시 비밀번호를 설정해야 합니다.");
console.log("=".repeat(70));

// 4. 크리에이터 계정 생성 (비밀번호 미설정 - 최초 로그인 시 ID와 비밀번호 설정)
const creatorId = generateId();
const creatorApiKey = generateApiKey();
const { hash: creatorKeyHash, salt: creatorKeySalt } = hashApiKey(creatorApiKey);

db.prepare(
  `INSERT INTO users 
   (id, site_id, name, email, password_hash, role, status, api_key_hash, api_key_salt) 
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(
  creatorId,
  "gods",
  "Creator",
  "01023942042", // 임시 ID (최초 로그인 시 변경)
  null, // password_hash null (최초 로그인 시 설정)
  "creator",
  "active",
  creatorKeyHash,
  creatorKeySalt
);

console.log("\n" + "=".repeat(70));
console.log("✅ 크리에이터 계정 생성 완료!");
console.log("=".repeat(70));
console.log("초기 ID: 01023942042");
console.log("비밀번호: (최초 로그인 시 설정)");
console.log("역할: Creator");
console.log("API Key:", creatorApiKey);
console.log("⚠️  최초 로그인 시 ID와 비밀번호를 설정해야 합니다.");
console.log("=".repeat(70));

console.log("\n🎉 초기 계정 설정 완료!");
console.log("\n📝 다음 단계:");
console.log("1. 관리자: consulting_manager@naver.com 로 로그인 → 비밀번호 설정");
console.log("2. 크리에이터: 01023942042 로 로그인 → ID와 비밀번호 설정");

