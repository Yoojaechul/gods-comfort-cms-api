import db from "./db.js";

console.log("🔧 analytics 테이블 생성 중...");

try {
  // 기존 analytics 테이블이 있으면 삭제 (재생성)
  const tableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='analytics'")
    .get();

  if (tableExists) {
    console.log("ℹ️  기존 analytics 테이블이 존재합니다. 재생성합니다...");
    db.exec("DROP TABLE IF EXISTS analytics");
  }

  // 새로운 analytics 테이블 생성
  db.exec(`
    CREATE TABLE analytics (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      language TEXT NOT NULL,
      country TEXT NOT NULL,
      visitors INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(date, language, country)
    )
  `);

  console.log("✅ analytics 테이블 생성 완료");

  // 인덱스 생성
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
    CREATE INDEX IF NOT EXISTS idx_analytics_language ON analytics(language);
    CREATE INDEX IF NOT EXISTS idx_analytics_country ON analytics(country);
    CREATE INDEX IF NOT EXISTS idx_analytics_date_language ON analytics(date, language);
    CREATE INDEX IF NOT EXISTS idx_analytics_date_country ON analytics(date, country);
  `);

  console.log("✅ 인덱스 생성 완료");

  // 기존 visits 테이블 데이터를 analytics로 집계하여 마이그레이션
  try {
    const visitsData = db
      .prepare(`
        SELECT 
          date(created_at) as date,
          language,
          country_code as country,
          COUNT(*) as visitors
        FROM visits
        WHERE language IS NOT NULL AND country_code IS NOT NULL
        GROUP BY date(created_at), language, country_code
      `)
      .all();

    if (visitsData.length > 0) {
      const { generateId } = await import("./db.js");
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO analytics (id, date, language, country, visitors)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const row of visitsData) {
        const id = generateId();
        insertStmt.run(id, row.date, row.language || "ko", row.country || "KR", row.visitors);
      }

      console.log(`✅ 기존 visits 데이터를 analytics로 마이그레이션 완료 (${visitsData.length}개 집계)`);
    } else {
      console.log("ℹ️  마이그레이션할 visits 데이터가 없습니다.");
    }
  } catch (err) {
    console.warn("⚠️  visits 데이터 마이그레이션 중 오류:", err.message);
  }

  console.log("\n🎉 Analytics 테이블 설정 완료!");
} catch (err) {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
}































































































