import db, { generateId } from "./db.js";

console.log("🔧 videos 테이블에 Actual/Display 통계 필드 추가 중...");

try {
  // 기존 통계 필드 확인
  const tableInfo = db.prepare("PRAGMA table_info('videos')").all();
  const existingColumns = tableInfo.map((col) => col.name);

  // Actual 필드 추가
  const actualFields = [
    { name: "views_actual", type: "INTEGER DEFAULT 0" },
    { name: "likes_actual", type: "INTEGER DEFAULT 0" },
    { name: "shares_actual", type: "INTEGER DEFAULT 0" },
  ];

  // Display 필드 추가
  const displayFields = [
    { name: "views_display", type: "INTEGER DEFAULT 0" },
    { name: "likes_display", type: "INTEGER DEFAULT 0" },
    { name: "shares_display", type: "INTEGER DEFAULT 0" },
  ];

  // videoType 필드 추가 (youtube | facebook)
  if (!existingColumns.includes("video_type")) {
    try {
      db.exec("ALTER TABLE videos ADD COLUMN video_type TEXT CHECK(video_type IN ('youtube', 'facebook'))");
      console.log("✅ video_type 컬럼 추가됨");
    } catch (err) {
      if (!err.message.includes("duplicate column")) {
        throw err;
      }
    }
  }

  // youtubeId, facebookUrl 필드 추가
  if (!existingColumns.includes("youtube_id")) {
    try {
      db.exec("ALTER TABLE videos ADD COLUMN youtube_id TEXT");
      console.log("✅ youtube_id 컬럼 추가됨");
    } catch (err) {
      if (!err.message.includes("duplicate column")) {
        throw err;
      }
    }
  }

  if (!existingColumns.includes("facebook_url")) {
    try {
      db.exec("ALTER TABLE videos ADD COLUMN facebook_url TEXT");
      console.log("✅ facebook_url 컬럼 추가됨");
    } catch (err) {
      if (!err.message.includes("duplicate column")) {
        throw err;
      }
    }
  }

  // creatorId 필드 추가 (owner_id와 동일하지만 명시적으로)
  if (!existingColumns.includes("creator_id")) {
    try {
      db.exec("ALTER TABLE videos ADD COLUMN creator_id TEXT");
      console.log("✅ creator_id 컬럼 추가됨");
      // 기존 데이터 마이그레이션: owner_id -> creator_id
      db.exec("UPDATE videos SET creator_id = owner_id WHERE creator_id IS NULL");
      console.log("✅ 기존 owner_id 데이터를 creator_id로 마이그레이션 완료");
    } catch (err) {
      if (!err.message.includes("duplicate column")) {
        throw err;
      }
    }
  }

  // Actual 필드 추가
  for (const field of actualFields) {
    if (!existingColumns.includes(field.name)) {
      try {
        db.exec(`ALTER TABLE videos ADD COLUMN ${field.name} ${field.type}`);
        console.log(`✅ ${field.name} 컬럼 추가됨`);
      } catch (err) {
        if (!err.message.includes("duplicate column")) {
          throw err;
        }
      }
    } else {
      console.log(`ℹ️  ${field.name} 컬럼이 이미 존재합니다.`);
    }
  }

  // Display 필드 추가
  for (const field of displayFields) {
    if (!existingColumns.includes(field.name)) {
      try {
        db.exec(`ALTER TABLE videos ADD COLUMN ${field.name} ${field.type}`);
        console.log(`✅ ${field.name} 컬럼 추가됨`);
      } catch (err) {
        if (!err.message.includes("duplicate column")) {
          throw err;
        }
      }
    } else {
      console.log(`ℹ️  ${field.name} 컬럼이 이미 존재합니다.`);
    }
  }

  // 기존 views_count, likes_count, shares_count가 있으면 Actual로 마이그레이션
  if (existingColumns.includes("views_count")) {
    try {
      db.exec("UPDATE videos SET views_actual = views_count WHERE views_actual = 0 AND views_count > 0");
      db.exec("UPDATE videos SET views_display = views_count WHERE views_display = 0 AND views_count > 0");
      console.log("✅ 기존 views_count 데이터를 Actual/Display로 마이그레이션 완료");
    } catch (err) {
      console.warn("⚠️  views_count 마이그레이션 중 오류:", err.message);
    }
  }

  if (existingColumns.includes("likes_count")) {
    try {
      db.exec("UPDATE videos SET likes_actual = likes_count WHERE likes_actual = 0 AND likes_count > 0");
      db.exec("UPDATE videos SET likes_display = likes_count WHERE likes_display = 0 AND likes_count > 0");
      console.log("✅ 기존 likes_count 데이터를 Actual/Display로 마이그레이션 완료");
    } catch (err) {
      console.warn("⚠️  likes_count 마이그레이션 중 오류:", err.message);
    }
  }

  if (existingColumns.includes("shares_count")) {
    try {
      db.exec("UPDATE videos SET shares_actual = shares_count WHERE shares_actual = 0 AND shares_count > 0");
      db.exec("UPDATE videos SET shares_display = shares_count WHERE shares_display = 0 AND shares_count > 0");
      console.log("✅ 기존 shares_count 데이터를 Actual/Display로 마이그레이션 완료");
    } catch (err) {
      console.warn("⚠️  shares_count 마이그레이션 중 오류:", err.message);
    }
  }

  // platform과 video_type 동기화
  try {
    db.exec("UPDATE videos SET video_type = platform WHERE video_type IS NULL AND platform IN ('youtube', 'facebook')");
    console.log("✅ platform 데이터를 video_type으로 동기화 완료");
  } catch (err) {
    console.warn("⚠️  video_type 동기화 중 오류:", err.message);
  }

  // video_id를 youtubeId로 마이그레이션 (platform이 youtube인 경우)
  try {
    db.exec("UPDATE videos SET youtube_id = video_id WHERE platform = 'youtube' AND youtube_id IS NULL AND video_id IS NOT NULL");
    console.log("✅ video_id를 youtube_id로 마이그레이션 완료 (YouTube)");
  } catch (err) {
    console.warn("⚠️  youtube_id 마이그레이션 중 오류:", err.message);
  }

  // source_url을 facebook_url로 마이그레이션 (platform이 facebook인 경우)
  try {
    db.exec("UPDATE videos SET facebook_url = source_url WHERE platform = 'facebook' AND facebook_url IS NULL AND source_url IS NOT NULL");
    console.log("✅ source_url을 facebook_url로 마이그레이션 완료 (Facebook)");
  } catch (err) {
    console.warn("⚠️  facebook_url 마이그레이션 중 오류:", err.message);
  }

  console.log("\n🎉 Video 통계 필드 마이그레이션 완료!");
} catch (err) {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
}




































































































