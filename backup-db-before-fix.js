import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB 경로 확인
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "cms.db");

if (!fs.existsSync(dbPath)) {
  console.error(`❌ DB 파일을 찾을 수 없습니다: ${dbPath}`);
  process.exit(1);
}

// 백업 파일명 생성 (YYYYMMDD_HHMM 형식)
const now = new Date();
const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, "");
const backupPath = dbPath.replace(/\.db$/, `_backup_${dateStr}_${timeStr}.db`);

try {
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ DB 백업 완료:`);
  console.log(`   원본: ${dbPath}`);
  console.log(`   백업: ${backupPath}`);
} catch (err) {
  console.error(`❌ 백업 실패: ${err.message}`);
  process.exit(1);
}


































