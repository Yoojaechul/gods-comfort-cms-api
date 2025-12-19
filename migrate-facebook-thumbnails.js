/**
 * 기존 Facebook 영상 중 thumbnail_url이 비어있는 것들에 썸네일을 자동으로 가져와서 채워주는 마이그레이션 스크립트
 * 
 * 실행 방법:
 * node migrate-facebook-thumbnails.js
 * 
 * 환경 변수:
 * FACEBOOK_ACCESS_TOKEN - Facebook Graph API Access Token (필수)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fetch = require('node-fetch');

const dbPath = path.join(__dirname, 'cms.db');
const db = new Database(dbPath);

// 환경 변수에서 Access Token 읽기
const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN;

if (!facebookAccessToken) {
  console.error('❌ FACEBOOK_ACCESS_TOKEN 환경 변수가 설정되지 않았습니다.');
  console.error('   .env 파일에 FACEBOOK_ACCESS_TOKEN=your_token 을 추가하거나');
  console.error('   환경 변수로 설정해주세요.');
  process.exit(1);
}

console.log('📦 Facebook 썸네일 마이그레이션 시작...\n');

/**
 * Facebook 썸네일 가져오기
 */
async function fetchFacebookThumbnail(sourceUrl, accessToken) {
  try {
    const oembedUrl = `https://graph.facebook.com/v11.0/oembed_video?url=${encodeURIComponent(sourceUrl)}&access_token=${accessToken}`;
    const response = await fetch(oembedUrl, { timeout: 5000 });
    
    if (response.ok) {
      const data = await response.json();
      if (data.thumbnail_url) {
        return data.thumbnail_url;
      }
    } else {
      console.warn(`⚠️ Facebook oEmbed API 호출 실패: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.warn(`⚠️ Facebook 썸네일 가져오기 오류: ${err.message}`);
  }

  return null;
}

try {
  // thumbnail_url이 비어있고 platform이 facebook인 영상 조회
  const videosWithoutThumbnail = db
    .prepare("SELECT id, source_url, title FROM videos WHERE platform = 'facebook' AND (thumbnail_url IS NULL OR thumbnail_url = '') AND source_url IS NOT NULL AND source_url != ''")
    .all();

  console.log(`📊 썸네일이 없는 Facebook 영상: ${videosWithoutThumbnail.length}개\n`);

  if (videosWithoutThumbnail.length === 0) {
    console.log('✅ 모든 Facebook 영상에 썸네일이 이미 설정되어 있습니다.');
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;

  // 각 영상에 대해 썸네일 가져오기
  for (const video of videosWithoutThumbnail) {
    try {
      console.log(`처리 중: ${video.id} - ${video.title || '제목 없음'}`);
      console.log(`  URL: ${video.source_url}`);
      
      const thumbnailUrl = await fetchFacebookThumbnail(video.source_url, facebookAccessToken);
      
      if (thumbnailUrl) {
        db.prepare("UPDATE videos SET thumbnail_url = ? WHERE id = ?").run(thumbnailUrl, video.id);
        console.log(`  ✅ 썸네일 가져오기 성공: ${thumbnailUrl}`);
        successCount++;
      } else {
        console.log(`  ⚠️ 썸네일을 가져올 수 없습니다.`);
        failCount++;
      }
      
      // API Rate Limit 방지를 위해 약간의 지연
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`  ❌ 오류 발생: ${err.message}`);
      failCount++;
    }
    console.log('');
  }

  console.log(`\n✅ 마이그레이션 완료:`);
  console.log(`   성공: ${successCount}개`);
  console.log(`   실패: ${failCount}개`);
} catch (error) {
  console.error('❌ 마이그레이션 오류:', error);
  process.exit(1);
} finally {
  db.close();
}







































































