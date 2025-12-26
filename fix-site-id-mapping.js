import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// DB 파일 경로
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "cms.db");
console.log(`📂 Database path: ${dbPath}\n`);

const db = new Database(dbPath);
db.pragma("foreign_keys=ON");

// 1. 현재 sites 테이블 확인
console.log("=== 현재 sites 테이블 ===");
const sites = db.prepare("SELECT * FROM sites").all();
sites.forEach(site => {
  console.log(`  id: "${site.id}", name: "${site.name}", domain: ${site.domain || '(null)'}`);
});
console.log();

// 2. 기본 사이트 확인 및 생성
const defaultSiteId = "gods";
let defaultSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(defaultSiteId);

if (!defaultSite) {
  console.log("⚠️  기본 사이트('gods')가 없습니다. 생성합니다...");
  try {
    db.prepare(`
      INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      defaultSiteId,
      "godcomfortword.com",
      "God's Comfort Word",
      "https://www.godcomfortword.com",
      "http://localhost:8787",
      null
    );
    console.log("✅ 기본 사이트 생성 완료\n");
    defaultSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(defaultSiteId);
  } catch (err) {
    console.error("❌ 기본 사이트 생성 실패:", err.message);
    process.exit(1);
  }
} else {
  console.log("✅ 기본 사이트('gods')가 이미 존재합니다.\n");
}

// 3. users 테이블의 site_id 확인 및 수정
console.log("=== users 테이블의 site_id 확인 ===");
const users = db.prepare("SELECT id, name, role, site_id FROM users WHERE role IN ('admin', 'creator')").all();
users.forEach(user => {
  if (!user.site_id || user.site_id !== defaultSiteId) {
    console.log(`  ⚠️  ${user.name} (${user.role}): site_id가 "${user.site_id || '(null)'}" → "${defaultSiteId}"로 변경`);
    db.prepare("UPDATE users SET site_id = ? WHERE id = ?").run(defaultSiteId, user.id);
  } else {
    console.log(`  ✅ ${user.name} (${user.role}): site_id가 "${user.site_id}" (정상)`);
  }
});
console.log();

// 4. videos 테이블의 site_id 확인 및 수정
console.log("=== videos 테이블의 site_id 확인 ===");
const videos = db.prepare("SELECT id, site_id FROM videos").all();
let fixedCount = 0;
videos.forEach(video => {
  if (video.site_id !== defaultSiteId) {
    const siteExists = db.prepare("SELECT id FROM sites WHERE id = ?").get(video.site_id);
    if (!siteExists) {
      console.log(`  ⚠️  video.id: ${video.id}, site_id: "${video.site_id}" → "${defaultSiteId}"로 변경`);
      db.prepare("UPDATE videos SET site_id = ? WHERE id = ?").run(defaultSiteId, video.id);
      fixedCount++;
    }
  }
});
if (fixedCount === 0) {
  console.log("  ✅ 모든 videos의 site_id가 유효합니다.");
} else {
  console.log(`  ✅ ${fixedCount}개의 videos의 site_id를 수정했습니다.`);
}
console.log();

db.close();
console.log("✅ 수정 완료");




































