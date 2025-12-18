import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// DB 파일 경로 확인
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "cms.db");
console.log(`📂 Database path: ${dbPath}`);
console.log(`   파일 존재: ${fs.existsSync(dbPath) ? '✅' : '❌'}`);
console.log(`   파일 크기: ${fs.existsSync(dbPath) ? (fs.statSync(dbPath).size / 1024).toFixed(2) + ' KB' : 'N/A'}\n`);

if (!fs.existsSync(dbPath)) {
  console.error("❌ DB 파일을 찾을 수 없습니다!");
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("foreign_keys=ON");

console.log("✅ DB 연결 성공\n");

// 1. 테이블 목록
console.log("=== 1. 테이블 목록 ===");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tables.forEach(t => console.log(`  - ${t.name}`));
console.log();

// 2. videos 테이블 스키마
console.log("=== 2. videos 테이블 스키마 ===");
const videoInfo = db.pragma("table_info(videos)");
videoInfo.forEach(col => {
  const constraints = [];
  if (col.notnull) constraints.push("NOT NULL");
  if (col.dflt_value !== null) constraints.push(`DEFAULT ${col.dflt_value}`);
  if (col.pk) constraints.push("PRIMARY KEY");
  console.log(`  ${col.name}: ${col.type} ${constraints.join(' ')}`);
});
console.log();

// 3. videos 테이블 외래키 상세
console.log("=== 3. videos 테이블 외래키 상세 ===");
const fkList = db.pragma("foreign_key_list(videos)");
if (fkList.length === 0) {
  console.log("  ⚠️  외래키가 정의되어 있지 않습니다.");
} else {
  fkList.forEach(fk => {
    console.log(`  - ${fk.from} -> ${fk.table}.${fk.to}`);
    console.log(`    on_update: ${fk.on_update || 'NO ACTION'}, on_delete: ${fk.on_delete || 'NO ACTION'}`);
  });
}
console.log();

// 4. sites 테이블 스키마 및 데이터
console.log("=== 4. sites 테이블 스키마 ===");
const siteInfo = db.pragma("table_info(sites)");
siteInfo.forEach(col => {
  const constraints = [];
  if (col.notnull) constraints.push("NOT NULL");
  if (col.dflt_value !== null) constraints.push(`DEFAULT ${col.dflt_value}`);
  if (col.pk) constraints.push("PRIMARY KEY");
  console.log(`  ${col.name}: ${col.type} ${constraints.join(' ')}`);
});
console.log();

console.log("=== 5. sites 테이블 데이터 ===");
const sites = db.prepare("SELECT * FROM sites").all();
if (sites.length === 0) {
  console.log("  ⚠️  sites 테이블이 비어있습니다!");
} else {
  sites.forEach(site => {
    console.log(`  - id: "${site.id}"`);
    console.log(`    name: "${site.name || '(null)'}"`);
    console.log(`    domain: ${site.domain || '(null)'}`);
    console.log(`    homepage_url: ${site.homepage_url || '(null)'}`);
    console.log(`    api_base: ${site.api_base || '(null)'}`);
    console.log(`    created_at: ${site.created_at || '(null)'}`);
    console.log();
  });
}
console.log();

// 6. users 테이블 스키마 및 데이터
console.log("=== 6. users 테이블 스키마 ===");
const userInfo = db.pragma("table_info(users)");
userInfo.forEach(col => {
  const constraints = [];
  if (col.notnull) constraints.push("NOT NULL");
  if (col.dflt_value !== null) constraints.push(`DEFAULT ${col.dflt_value}`);
  if (col.pk) constraints.push("PRIMARY KEY");
  console.log(`  ${col.name}: ${col.type} ${constraints.join(' ')}`);
});
console.log();

console.log("=== 7. users 테이블 데이터 (admin/creator) ===");
const users = db.prepare("SELECT id, name, email, role, site_id, status FROM users WHERE role IN ('admin', 'creator')").all();
if (users.length === 0) {
  console.log("  ⚠️  admin/creator 사용자가 없습니다!");
} else {
  users.forEach(user => {
    console.log(`  - id: ${user.id}`);
    console.log(`    name: "${user.name || '(null)'}"`);
    console.log(`    email: ${user.email || '(null)'}`);
    console.log(`    role: ${user.role}`);
    console.log(`    site_id: ${user.site_id || '(null)'}`);
    console.log(`    status: ${user.status || '(null)'}`);
    console.log();
  });
}
console.log();

// 8. videos 테이블의 FK 무결성 검사
console.log("=== 8. videos 테이블 FK 무결성 검사 ===");
const allVideos = db.prepare("SELECT id, site_id, owner_id FROM videos").all();
let invalidSiteIdCount = 0;
let invalidOwnerIdCount = 0;
const invalidSiteIds = new Set();
const invalidOwnerIds = new Set();

allVideos.forEach(video => {
  const siteExists = db.prepare("SELECT id FROM sites WHERE id = ?").get(video.site_id);
  const ownerExists = db.prepare("SELECT id FROM users WHERE id = ?").get(video.owner_id);
  
  if (!siteExists) {
    invalidSiteIdCount++;
    invalidSiteIds.add(video.site_id);
  }
  if (!ownerExists) {
    invalidOwnerIdCount++;
    invalidOwnerIds.add(video.owner_id);
  }
});

if (invalidSiteIdCount === 0 && invalidOwnerIdCount === 0) {
  console.log("  ✅ 모든 videos의 FK가 유효합니다.");
} else {
  if (invalidSiteIdCount > 0) {
    console.log(`  ❌ ${invalidSiteIdCount}개의 videos가 유효하지 않은 site_id를 가지고 있습니다:`);
    invalidSiteIds.forEach(siteId => {
      console.log(`    - site_id: "${siteId}" (sites 테이블에 없음)`);
    });
  }
  if (invalidOwnerIdCount > 0) {
    console.log(`  ❌ ${invalidOwnerIdCount}개의 videos가 유효하지 않은 owner_id를 가지고 있습니다:`);
    invalidOwnerIds.forEach(ownerId => {
      console.log(`    - owner_id: "${ownerId}" (users 테이블에 없음)`);
    });
  }
}
console.log();

// 9. 외래키 제약조건 테스트
console.log("=== 9. 외래키 제약조건 테스트 ===");
try {
  const testSiteId = "test_invalid_site_" + Date.now();
  const testOwnerId = users.length > 0 ? users[0].id : "test_invalid_owner";
  
  db.prepare(`
    INSERT INTO videos (id, site_id, owner_id, platform, source_url, title, visibility) 
    VALUES (?, ?, ?, 'youtube', 'https://test.com', 'Test', 'public')
  `).run("test_id_" + Date.now(), testSiteId, testOwnerId);
  console.log("  ⚠️  외래키 제약조건이 작동하지 않습니다!");
} catch (err) {
  if (err.message.includes("FOREIGN KEY constraint failed")) {
    console.log("  ✅ 외래키 제약조건이 정상 작동합니다.");
    console.log(`     에러 메시지: ${err.message}`);
  } else {
    console.log(`  ⚠️  예상치 못한 에러: ${err.message}`);
  }
}
console.log();

// 10. 현재 로그인 가능한 사용자 확인
console.log("=== 10. 현재 로그인 가능한 사용자 ===");
const activeUsers = db.prepare("SELECT id, name, role, site_id FROM users WHERE status = 'active' AND role IN ('admin', 'creator')").all();
activeUsers.forEach(user => {
  const site = user.site_id ? db.prepare("SELECT id, name FROM sites WHERE id = ?").get(user.site_id) : null;
  console.log(`  - ${user.name} (${user.role})`);
  console.log(`    id: ${user.id}`);
  console.log(`    site_id: ${user.site_id || '(null)'}`);
  if (site) {
    console.log(`    site 정보: "${site.name}" (${site.id})`);
  } else if (user.site_id) {
    console.log(`    ⚠️  site_id "${user.site_id}"가 sites 테이블에 없습니다!`);
  }
  console.log();
});

db.close();
console.log("✅ 진단 완료");
