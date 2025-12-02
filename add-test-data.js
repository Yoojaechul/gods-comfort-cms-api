import db, { generateId } from "./db.js";
import { enrichMetadata } from "./metadata.js";

// 테스트 데이터 추가
async function addTestData() {
  console.log("🚀 테스트 데이터 추가 시작...");

  // 1. gods 사이트 확인/추가
  let site = db.prepare("SELECT * FROM sites WHERE id = ?").get("gods");
  if (!site) {
    db.prepare("INSERT INTO sites (id, name) VALUES (?, ?)").run(
      "gods",
      "God's Comfort Word"
    );
    console.log("✅ 사이트 'gods' 생성됨");
  } else {
    console.log("✅ 사이트 'gods' 이미 존재");
  }

  // 2. Admin 사용자 확인
  const admin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
  if (!admin) {
    console.log("❌ Admin 사용자가 없습니다. 서버를 먼저 실행해주세요.");
    return;
  }
  console.log(`✅ Admin 사용자: ${admin.name}`);

  // 3. 테스트 영상 추가
  const testVideos = [
    {
      platform: "youtube",
      source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Test YouTube Video 1",
      language: "ko",
    },
    {
      platform: "youtube",
      source_url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
      title: "Test YouTube Video 2",
      language: "en",
    },
    {
      platform: "youtube",
      source_url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      title: "Test YouTube Video 3",
      language: "ko",
    },
  ];

  for (const videoData of testVideos) {
    // 메타정보 가져오기
    const metadata = await enrichMetadata(
      videoData.platform,
      videoData.source_url,
      videoData.title
    );

    // video_id 추출
    let videoId = null;
    if (videoData.platform === "youtube") {
      const match = videoData.source_url.match(/[?&]v=([^&]+)/);
      videoId = match ? match[1] : null;
    }

    const id = generateId();

    try {
      db.prepare(
        `INSERT INTO videos 
        (id, site_id, owner_id, platform, video_id, source_url, title, thumbnail_url, embed_url, language, status, visibility) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        "gods",
        admin.id,
        videoData.platform,
        videoId,
        videoData.source_url,
        metadata.title || videoData.title,
        metadata.thumbnail_url,
        metadata.embed_url,
        videoData.language,
        "active",
        "public"
      );

      console.log(`✅ 영상 추가됨: ${metadata.title || videoData.title}`);
    } catch (err) {
      console.error(`❌ 영상 추가 실패:`, err.message);
    }
  }

  // 4. 결과 확인
  const videos = db
    .prepare("SELECT * FROM videos WHERE site_id = 'gods'")
    .all();
  console.log(`\n✅ 총 ${videos.length}개의 영상이 'gods' 사이트에 있습니다.`);
  console.log("\n📊 영상 목록:");
  videos.forEach((v) => {
    console.log(`  - ${v.title} (${v.platform}, ${v.language})`);
  });

  console.log("\n🎉 테스트 데이터 추가 완료!");
  console.log("브라우저에서 http://localhost:3000/test-cms 를 새로고침하세요.");
}

addTestData().catch((err) => {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
});


import { enrichMetadata } from "./metadata.js";

// 테스트 데이터 추가
async function addTestData() {
  console.log("🚀 테스트 데이터 추가 시작...");

  // 1. gods 사이트 확인/추가
  let site = db.prepare("SELECT * FROM sites WHERE id = ?").get("gods");
  if (!site) {
    db.prepare("INSERT INTO sites (id, name) VALUES (?, ?)").run(
      "gods",
      "God's Comfort Word"
    );
    console.log("✅ 사이트 'gods' 생성됨");
  } else {
    console.log("✅ 사이트 'gods' 이미 존재");
  }

  // 2. Admin 사용자 확인
  const admin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
  if (!admin) {
    console.log("❌ Admin 사용자가 없습니다. 서버를 먼저 실행해주세요.");
    return;
  }
  console.log(`✅ Admin 사용자: ${admin.name}`);

  // 3. 테스트 영상 추가
  const testVideos = [
    {
      platform: "youtube",
      source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Test YouTube Video 1",
      language: "ko",
    },
    {
      platform: "youtube",
      source_url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
      title: "Test YouTube Video 2",
      language: "en",
    },
    {
      platform: "youtube",
      source_url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      title: "Test YouTube Video 3",
      language: "ko",
    },
  ];

  for (const videoData of testVideos) {
    // 메타정보 가져오기
    const metadata = await enrichMetadata(
      videoData.platform,
      videoData.source_url,
      videoData.title
    );

    // video_id 추출
    let videoId = null;
    if (videoData.platform === "youtube") {
      const match = videoData.source_url.match(/[?&]v=([^&]+)/);
      videoId = match ? match[1] : null;
    }

    const id = generateId();

    try {
      db.prepare(
        `INSERT INTO videos 
        (id, site_id, owner_id, platform, video_id, source_url, title, thumbnail_url, embed_url, language, status, visibility) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        "gods",
        admin.id,
        videoData.platform,
        videoId,
        videoData.source_url,
        metadata.title || videoData.title,
        metadata.thumbnail_url,
        metadata.embed_url,
        videoData.language,
        "active",
        "public"
      );

      console.log(`✅ 영상 추가됨: ${metadata.title || videoData.title}`);
    } catch (err) {
      console.error(`❌ 영상 추가 실패:`, err.message);
    }
  }

  // 4. 결과 확인
  const videos = db
    .prepare("SELECT * FROM videos WHERE site_id = 'gods'")
    .all();
  console.log(`\n✅ 총 ${videos.length}개의 영상이 'gods' 사이트에 있습니다.`);
  console.log("\n📊 영상 목록:");
  videos.forEach((v) => {
    console.log(`  - ${v.title} (${v.platform}, ${v.language})`);
  });

  console.log("\n🎉 테스트 데이터 추가 완료!");
  console.log("브라우저에서 http://localhost:3000/test-cms 를 새로고침하세요.");
}

addTestData().catch((err) => {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
});


