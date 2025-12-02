import db from "./db.js";

console.log("🔧 videos 테이블에 stats 필드 추가 중...");

try {
  // views_count 추가
  try {
    db.exec("ALTER TABLE videos ADD COLUMN views_count INTEGER DEFAULT 0");
    console.log("✅ views_count 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      console.log("ℹ️  views_count 컬럼이 이미 존재합니다.");
    } else {
      throw err;
    }
  }

  // likes_count 추가
  try {
    db.exec("ALTER TABLE videos ADD COLUMN likes_count INTEGER DEFAULT 0");
    console.log("✅ likes_count 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      console.log("ℹ️  likes_count 컬럼이 이미 존재합니다.");
    } else {
      throw err;
    }
  }

  // shares_count 추가
  try {
    db.exec("ALTER TABLE videos ADD COLUMN shares_count INTEGER DEFAULT 0");
    console.log("✅ shares_count 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      console.log("ℹ️  shares_count 컬럼이 이미 존재합니다.");
    } else {
      throw err;
    }
  }

  // stats_updated_at 추가
  try {
    db.exec("ALTER TABLE videos ADD COLUMN stats_updated_at TEXT");
    console.log("✅ stats_updated_at 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      console.log("ℹ️  stats_updated_at 컬럼이 이미 존재합니다.");
    } else {
      throw err;
    }
  }

  // stats_updated_by 추가
  try {
    db.exec("ALTER TABLE videos ADD COLUMN stats_updated_by TEXT");
    console.log("✅ stats_updated_by 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      console.log("ℹ️  stats_updated_by 컬럼이 이미 존재합니다.");
    } else {
      throw err;
    }
  }

  // stats_adjustments 로그 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS stats_adjustments (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      old_views INTEGER,
      new_views INTEGER,
      old_likes INTEGER,
      new_likes INTEGER,
      old_shares INTEGER,
      new_shares INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES users(id)
    )
  `);
  console.log("✅ stats_adjustments 로그 테이블 생성됨");

  // 인덱스 생성
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stats_adjustments_video_id ON stats_adjustments(video_id);
    CREATE INDEX IF NOT EXISTS idx_stats_adjustments_admin_id ON stats_adjustments(admin_id);
  `);
  console.log("✅ 인덱스 생성 완료");

  console.log("\n🎉 Stats 필드 추가 완료!");
} catch (err) {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
}



console.log("🔧 videos 테이블에 stats 필드 추가 중...");

try {
  // views_count 추가
  try {
    db.exec("ALTER TABLE videos ADD COLUMN views_count INTEGER DEFAULT 0");
    console.log("✅ views_count 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      console.log("ℹ️  views_count 컬럼이 이미 존재합니다.");
    } else {
      throw err;
    }
  }

  // likes_count 추가
  try {
    db.exec("ALTER TABLE videos ADD COLUMN likes_count INTEGER DEFAULT 0");
    console.log("✅ likes_count 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      console.log("ℹ️  likes_count 컬럼이 이미 존재합니다.");
    } else {
      throw err;
    }
  }

  // shares_count 추가
  try {
    db.exec("ALTER TABLE videos ADD COLUMN shares_count INTEGER DEFAULT 0");
    console.log("✅ shares_count 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      console.log("ℹ️  shares_count 컬럼이 이미 존재합니다.");
    } else {
      throw err;
    }
  }

  // stats_updated_at 추가
  try {
    db.exec("ALTER TABLE videos ADD COLUMN stats_updated_at TEXT");
    console.log("✅ stats_updated_at 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      console.log("ℹ️  stats_updated_at 컬럼이 이미 존재합니다.");
    } else {
      throw err;
    }
  }

  // stats_updated_by 추가
  try {
    db.exec("ALTER TABLE videos ADD COLUMN stats_updated_by TEXT");
    console.log("✅ stats_updated_by 컬럼 추가됨");
  } catch (err) {
    if (err.message.includes("duplicate column")) {
      console.log("ℹ️  stats_updated_by 컬럼이 이미 존재합니다.");
    } else {
      throw err;
    }
  }

  // stats_adjustments 로그 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS stats_adjustments (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      old_views INTEGER,
      new_views INTEGER,
      old_likes INTEGER,
      new_likes INTEGER,
      old_shares INTEGER,
      new_shares INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES users(id)
    )
  `);
  console.log("✅ stats_adjustments 로그 테이블 생성됨");

  // 인덱스 생성
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stats_adjustments_video_id ON stats_adjustments(video_id);
    CREATE INDEX IF NOT EXISTS idx_stats_adjustments_admin_id ON stats_adjustments(admin_id);
  `);
  console.log("✅ 인덱스 생성 완료");

  console.log("\n🎉 Stats 필드 추가 완료!");
} catch (err) {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
}


