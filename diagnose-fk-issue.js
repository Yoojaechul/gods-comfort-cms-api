import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// DB 파일 경로 확인
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "cms.db");
console.log(`📂 Database path: ${dbPath}`);

let db;
try {
  db = new Database(dbPath);
  console.log("✅ DB 연결 성공\n");
} catch (err) {
  console.error("❌ DB 연결 실패:", err.message);
  process.exit(1);
}

// 외래키 활성화
db.pragma("foreign_keys=ON");
console.log("✅ FOREIGN KEYS 활성화\n");

// 1. 테이블 목록
console.log("=== 1. 테이블 목록 ===");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tables.forEach(t => console.log(`  - ${t.name}`));
console.log();

// 2. videos 테이블 스키마
console.log("=== 2. videos 테이블 스키마 ===");
const videoInfo = db.pragma("table_info(videos)");
videoInfo.forEach(col => {
  console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
});
console.log();

// 3. videos 테이블 외래키
console.log("=== 3. videos 테이블 외래키 ===");
const fkList = db.pragma("foreign_key_list(videos)");
if (fkList.length === 0) {
  console.log("  ⚠️  외래키가 정의되어 있지 않습니다.");
} else {
  fkList.forEach(fk => {
    console.log(`  - ${fk.from} -> ${fk.table}.${fk.to}`);
  });
}
console.log();

// 4. sites 테이블 스키마
console.log("=== 4. sites 테이블 스키마 ===");
const siteInfo = db.pragma("table_info(sites)");
siteInfo.forEach(col => {
  console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
});
console.log();

// 5. sites 테이블 데이터
console.log("=== 5. sites 테이블 데이터 ===");
const sites = db.prepare("SELECT * FROM sites").all();
if (sites.length === 0) {
  console.log("  ⚠️  sites 테이블이 비어있습니다!");
} else {
  sites.forEach(site => {
    console.log(`  - id: ${site.id}, name: ${site.name}, domain: ${site.domain || '(null)'}`);
  });
}
console.log();

// 6. users 테이블 스키마
console.log("=== 6. users 테이블 스키마 ===");
const userInfo = db.pragma("table_info(users)");
userInfo.forEach(col => {
  console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
});
console.log();

// 7. users 테이블 데이터 (admin/creator만)
console.log("=== 7. users 테이블 데이터 (admin/creator) ===");
const users = db.prepare("SELECT id, name, email, role, site_id, status FROM users WHERE role IN ('admin', 'creator')").all();
if (users.length === 0) {
  console.log("  ⚠️  admin/creator 사용자가 없습니다!");
} else {
  users.forEach(user => {
    console.log(`  - id: ${user.id}, name: ${user.name || '(null)'}, role: ${user.role}, site_id: ${user.site_id || '(null)'}, status: ${user.status || '(null)'}`);
  });
}
console.log();

// 8. videos 테이블의 site_id 분포
console.log("=== 8. videos 테이블의 site_id 분포 ===");
const siteIdDist = db.prepare(`
  SELECT site_id, COUNT(*) as count 
  FROM videos 
  GROUP BY site_id
`).all();
siteIdDist.forEach(row => {
  const siteExists = db.prepare("SELECT id FROM sites WHERE id = ?").get(row.site_id);
  if (siteExists) {
    console.log(`  ✅ site_id: ${row.site_id}, count: ${row.count}`);
  } else {
    console.log(`  ❌ site_id: ${row.site_id}, count: ${row.count} (sites 테이블에 없음!)`);
  }
});
console.log();

// 9. videos 테이블의 owner_id 분포
console.log("=== 9. videos 테이블의 owner_id 분포 ===");
const ownerIdDist = db.prepare(`
  SELECT owner_id, COUNT(*) as count 
  FROM videos 
  GROUP BY owner_id
`).all();
ownerIdDist.forEach(row => {
  const userExists = db.prepare("SELECT id FROM users WHERE id = ?").get(row.owner_id);
  if (userExists) {
    console.log(`  ✅ owner_id: ${row.owner_id}, count: ${row.count}`);
  } else {
    console.log(`  ❌ owner_id: ${row.owner_id}, count: ${row.count} (users 테이블에 없음!)`);
  }
});
console.log();

// 10. 문제가 있는 videos 레코드
console.log("=== 10. 문제가 있는 videos 레코드 ===");
const allVideos = db.prepare("SELECT id, site_id, owner_id FROM videos").all();
const invalidVideos = [];
allVideos.forEach(video => {
  const siteExists = db.prepare("SELECT id FROM sites WHERE id = ?").get(video.site_id);
  const ownerExists = db.prepare("SELECT id FROM users WHERE id = ?").get(video.owner_id);
  
  if (!siteExists || !ownerExists) {
    invalidVideos.push({
      id: video.id,
      site_id: video.site_id,
      owner_id: video.owner_id,
      site_exists: !!siteExists,
      owner_exists: !!ownerExists
    });
  }
});

if (invalidVideos.length === 0) {
  console.log("  ✅ 모든 videos의 FK가 유효합니다.");
} else {
  console.log(`  ⚠️  ${invalidVideos.length}개의 videos가 유효하지 않은 FK를 가지고 있습니다:`);
  invalidVideos.forEach(v => {
    console.log(`  - video.id: ${v.id}`);
    if (!v.site_exists) {
      console.log(`    ❌ site_id: ${v.site_id} (sites 테이블에 없음)`);
    }
    if (!v.owner_exists) {
      console.log(`    ❌ owner_id: ${v.owner_id} (users 테이블에 없음)`);
    }
  });
}
console.log();

// 11. 외래키 제약조건 테스트
console.log("=== 11. 외래키 제약조건 테스트 ===");
try {
  // 유효하지 않은 site_id로 INSERT 시도
  const testSiteId = "invalid_site_id_" + Date.now();
  const testOwnerId = users.length > 0 ? users[0].id : "invalid_owner_id";
  
  db.prepare(`
    INSERT INTO videos (id, site_id, owner_id, platform, source_url, title, visibility) 
    VALUES (?, ?, ?, 'youtube', 'https://test.com', 'Test', 'public')
  `).run("test_id_" + Date.now(), testSiteId, testOwnerId);
  console.log("  ⚠️  외래키 제약조건이 작동하지 않습니다!");
} catch (err) {
  if (err.message.includes("FOREIGN KEY constraint failed")) {
    console.log("  ✅ 외래키 제약조건이 정상 작동합니다.");
    console.log(`     에러: ${err.message}`);
  } else {
    console.log(`  ⚠️  예상치 못한 에러: ${err.message}`);
  }
}
console.log();

db.close();
console.log("✅ 진단 완료");








































