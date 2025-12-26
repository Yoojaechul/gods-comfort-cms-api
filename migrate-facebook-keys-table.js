import db from "./db.js";

console.log("🔧 facebook_keys 테이블 생성 중...");

try {
  // facebook_keys 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS facebook_keys (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      facebook_access_token TEXT,
      page_id TEXT,
      user_id TEXT,
      app_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  console.log("✅ facebook_keys 테이블 생성 완료");

  // 인덱스 생성
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_facebook_keys_creator_id ON facebook_keys(creator_id);
  `);

  console.log("✅ 인덱스 생성 완료");

  // 기존 user_provider_keys 테이블에서 Facebook 관련 키를 마이그레이션
  try {
    const existingKeys = db
      .prepare(`
        SELECT user_id, key_name, key_value
        FROM user_provider_keys
        WHERE provider = 'facebook'
      `)
      .all();

    if (existingKeys.length > 0) {
      const { generateId } = await import("./db.js");
      const insertStmt = db.prepare(`
        INSERT INTO facebook_keys (id, creator_id, facebook_access_token, note)
        VALUES (?, ?, ?, ?)
      `);

      for (const key of existingKeys) {
        const id = generateId();
        const accessToken = key.key_name === "access_token" || key.key_name === "facebook_access_token" 
          ? key.key_value 
          : null;
        
        insertStmt.run(
          id,
          key.user_id,
          accessToken,
          `마이그레이션: ${key.key_name}`
        );
      }

      console.log(`✅ 기존 user_provider_keys 데이터를 facebook_keys로 마이그레이션 완료 (${existingKeys.length}개)`);
    } else {
      console.log("ℹ️  마이그레이션할 Facebook 키 데이터가 없습니다.");
    }
  } catch (err) {
    console.warn("⚠️  user_provider_keys 마이그레이션 중 오류:", err.message);
  }

  console.log("\n🎉 Facebook Keys 테이블 설정 완료!");
} catch (err) {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
}
































































































