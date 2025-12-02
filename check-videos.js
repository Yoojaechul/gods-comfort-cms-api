import db from "./db.js";

const videos = db
  .prepare(
    "SELECT id, title, platform, language, status, visibility, created_at FROM videos WHERE site_id = ? ORDER BY created_at DESC"
  )
  .all("gods");

console.log("=== gods 사이트의 영상 목록 ===");
console.log(`총 ${videos.length}개`);
console.log("");

videos.forEach((v, i) => {
  console.log(`${i + 1}. [${v.platform}] [${v.language}] ${v.title}`);
  console.log(`   상태: ${v.status} / 공개: ${v.visibility}`);
  console.log(`   생성일: ${v.created_at}`);
  console.log("");
});

// API 테스트
console.log("\n=== API 응답 테스트 ===");
const apiVideos = db
  .prepare(
    "SELECT * FROM videos v WHERE v.site_id = ? AND v.visibility = 'public' ORDER BY v.created_at DESC LIMIT 20"
  )
  .all("gods");

console.log(`Public 영상: ${apiVideos.length}개`);
apiVideos.forEach((v, i) => {
  console.log(`${i + 1}. [${v.platform}] [${v.language}] ${v.title} (${v.status})`);
});



const videos = db
  .prepare(
    "SELECT id, title, platform, language, status, visibility, created_at FROM videos WHERE site_id = ? ORDER BY created_at DESC"
  )
  .all("gods");

console.log("=== gods 사이트의 영상 목록 ===");
console.log(`총 ${videos.length}개`);
console.log("");

videos.forEach((v, i) => {
  console.log(`${i + 1}. [${v.platform}] [${v.language}] ${v.title}`);
  console.log(`   상태: ${v.status} / 공개: ${v.visibility}`);
  console.log(`   생성일: ${v.created_at}`);
  console.log("");
});

// API 테스트
console.log("\n=== API 응답 테스트 ===");
const apiVideos = db
  .prepare(
    "SELECT * FROM videos v WHERE v.site_id = ? AND v.visibility = 'public' ORDER BY v.created_at DESC LIMIT 20"
  )
  .all("gods");

console.log(`Public 영상: ${apiVideos.length}개`);
apiVideos.forEach((v, i) => {
  console.log(`${i + 1}. [${v.platform}] [${v.language}] ${v.title} (${v.status})`);
});


