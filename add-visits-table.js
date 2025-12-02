import db from "./db.js";

// visits 테이블 추가
console.log("🔧 visits 테이블 생성 중...");

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      country_code TEXT,
      country_name TEXT,
      language TEXT,
      page_url TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    )
  `);

  console.log("✅ visits 테이블 생성 완료");

  // 인덱스 생성
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_visits_site_id ON visits(site_id);
    CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);
    CREATE INDEX IF NOT EXISTS idx_visits_country_code ON visits(country_code);
    CREATE INDEX IF NOT EXISTS idx_visits_language ON visits(language);
  `);

  console.log("✅ 인덱스 생성 완료");

  // 테스트 데이터 추가 (선택사항)
  const testData = [
    { country_code: "KR", country_name: "South Korea", language: "ko" },
    { country_code: "US", country_name: "United States", language: "en" },
    { country_code: "JP", country_name: "Japan", language: "ja" },
    { country_code: "CN", country_name: "China", language: "zh" },
  ];

  const { generateId } = await import("./db.js");
  
  for (const data of testData) {
    for (let i = 0; i < 5; i++) {
      db.prepare(
        "INSERT INTO visits (id, site_id, ip_address, country_code, country_name, language, page_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        generateId(),
        "gods",
        `192.168.0.${Math.floor(Math.random() * 255)}`,
        data.country_code,
        data.country_name,
        data.language,
        "/videos"
      );
    }
  }

  console.log("✅ 테스트 데이터 추가 완료 (20개)");
  console.log("\n🎉 visits 테이블 설정 완료!");
} catch (err) {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
}



// visits 테이블 추가
console.log("🔧 visits 테이블 생성 중...");

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      country_code TEXT,
      country_name TEXT,
      language TEXT,
      page_url TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    )
  `);

  console.log("✅ visits 테이블 생성 완료");

  // 인덱스 생성
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_visits_site_id ON visits(site_id);
    CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);
    CREATE INDEX IF NOT EXISTS idx_visits_country_code ON visits(country_code);
    CREATE INDEX IF NOT EXISTS idx_visits_language ON visits(language);
  `);

  console.log("✅ 인덱스 생성 완료");

  // 테스트 데이터 추가 (선택사항)
  const testData = [
    { country_code: "KR", country_name: "South Korea", language: "ko" },
    { country_code: "US", country_name: "United States", language: "en" },
    { country_code: "JP", country_name: "Japan", language: "ja" },
    { country_code: "CN", country_name: "China", language: "zh" },
  ];

  const { generateId } = await import("./db.js");
  
  for (const data of testData) {
    for (let i = 0; i < 5; i++) {
      db.prepare(
        "INSERT INTO visits (id, site_id, ip_address, country_code, country_name, language, page_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        generateId(),
        "gods",
        `192.168.0.${Math.floor(Math.random() * 255)}`,
        data.country_code,
        data.country_name,
        data.language,
        "/videos"
      );
    }
  }

  console.log("✅ 테스트 데이터 추가 완료 (20개)");
  console.log("\n🎉 visits 테이블 설정 완료!");
} catch (err) {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
}


