import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB 경로 확인
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "cms.db");
console.log(`📂 Database path: ${dbPath}`);

const db = new Database(dbPath);

console.log("\n=== 데이터베이스 스키마 점검 ===\n");

// 1. 테이블 목록
console.log("1. 테이블 목록:");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
tables.forEach((t) => console.log(`   - ${t.name}`));

// 2. videos 테이블 스키마
console.log("\n2. videos 테이블 스키마:");
const videosSchema = db.prepare("PRAGMA table_info(videos)").all();
videosSchema.forEach((col) => {
  console.log(`   ${col.name}: ${col.type} ${col.notnull ? "NOT NULL" : ""} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ""}`);
});

// 3. sites 테이블 스키마
console.log("\n3. sites 테이블 스키마:");
const sitesSchema = db.prepare("PRAGMA table_info(sites)").all();
sitesSchema.forEach((col) => {
  console.log(`   ${col.name}: ${col.type} ${col.notnull ? "NOT NULL" : ""} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ""}`);
});

// 4. videos 테이블의 외래키
console.log("\n4. videos 테이블 외래키:");
const videosFKs = db.prepare("PRAGMA foreign_key_list(videos)").all();
if (videosFKs.length === 0) {
  console.log("   ⚠️  외래키가 정의되어 있지 않습니다.");
} else {
  videosFKs.forEach((fk) => {
    console.log(`   - ${fk.from} -> ${fk.table}.${fk.to}`);
  });
}

// 5. sites 테이블 데이터 확인
console.log("\n5. sites 테이블 데이터:");
const sites = db.prepare("SELECT * FROM sites").all();
if (sites.length === 0) {
  console.log("   ⚠️  sites 테이블이 비어있습니다!");
} else {
  sites.forEach((site) => {
    console.log(`   - id: ${site.id}, name: ${site.name}, domain: ${site.domain || "(null)"}`);
  });
}

// 6. videos 테이블의 site_id 값 확인
console.log("\n6. videos 테이블의 site_id 분포:");
const videoSiteIds = db.prepare("SELECT site_id, COUNT(*) as count FROM videos GROUP BY site_id").all();
if (videoSiteIds.length === 0) {
  console.log("   videos 테이블이 비어있습니다.");
} else {
  videoSiteIds.forEach((row) => {
    const siteExists = db.prepare("SELECT id FROM sites WHERE id = ?").get(row.site_id);
    const status = siteExists ? "✅" : "❌ (sites 테이블에 없음!)";
    console.log(`   ${status} site_id: ${row.site_id || "(null)"}, count: ${row.count}`);
  });
}

// 7. videos 테이블의 owner_id 값 확인
console.log("\n7. videos 테이블의 owner_id 분포:");
const videoOwnerIds = db.prepare("SELECT owner_id, COUNT(*) as count FROM videos GROUP BY owner_id LIMIT 10").all();
if (videoOwnerIds.length === 0) {
  console.log("   videos 테이블이 비어있습니다.");
} else {
  videoOwnerIds.forEach((row) => {
    const ownerExists = db.prepare("SELECT id FROM users WHERE id = ?").get(row.owner_id);
    const status = ownerExists ? "✅" : "❌ (users 테이블에 없음!)";
    console.log(`   ${status} owner_id: ${row.owner_id || "(null)"}, count: ${row.count}`);
  });
}

// 8. 문제가 있는 videos 레코드 확인
console.log("\n8. 문제가 있는 videos 레코드:");
const brokenVideos = db.prepare(`
  SELECT v.id, v.site_id, v.owner_id
  FROM videos v
  LEFT JOIN sites s ON v.site_id = s.id
  WHERE v.site_id IS NOT NULL AND s.id IS NULL
`).all();

if (brokenVideos.length === 0) {
  console.log("   ✅ 모든 videos의 site_id가 유효합니다.");
} else {
  console.log(`   ⚠️  ${brokenVideos.length}개의 videos가 유효하지 않은 site_id를 가지고 있습니다:`);
  brokenVideos.forEach((v) => {
    console.log(`   - video.id: ${v.id}, site_id: ${v.site_id} (sites 테이블에 없음)`);
  });
}

const brokenOwnerVideos = db.prepare(`
  SELECT v.id, v.owner_id
  FROM videos v
  LEFT JOIN users u ON v.owner_id = u.id
  WHERE v.owner_id IS NOT NULL AND u.id IS NULL
`).all();

if (brokenOwnerVideos.length === 0) {
  console.log("   ✅ 모든 videos의 owner_id가 유효합니다.");
} else {
  console.log(`   ⚠️  ${brokenOwnerVideos.length}개의 videos가 유효하지 않은 owner_id를 가지고 있습니다:`);
  brokenOwnerVideos.forEach((v) => {
    console.log(`   - video.id: ${v.id}, owner_id: ${v.owner_id} (users 테이블에 없음)`);
  });
}

db.close();
console.log("\n✅ 스키마 점검 완료");



























