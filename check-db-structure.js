import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "cms.db");
const db = new Database(dbPath);

db.pragma("foreign_keys=ON");

console.log("=== PRAGMA foreign_key_list(videos) ===");
const fkList = db.pragma("foreign_key_list(videos)");
if (fkList.length === 0) {
  console.log("  외래키가 정의되어 있지 않습니다.");
} else {
  fkList.forEach(fk => {
    console.log(`  ${fk.from} -> ${fk.table}.${fk.to}`);
  });
}

console.log("\n=== SELECT * FROM sites ===");
const sites = db.prepare("SELECT * FROM sites").all();
if (sites.length === 0) {
  console.log("  sites 테이블이 비어있습니다.");
} else {
  sites.forEach(s => {
    console.log(JSON.stringify(s, null, 2));
  });
}

console.log("\n=== SELECT id, role FROM users ===");
const users = db.prepare("SELECT id, role FROM users").all();
if (users.length === 0) {
  console.log("  users 테이블이 비어있습니다.");
} else {
  users.forEach(u => {
    console.log(`  id: ${u.id}, role: ${u.role}`);
  });
}

db.close();
console.log("\n✅ DB 구조 확인 완료");
