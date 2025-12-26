/**
 * 기존 영상에 management_id(관리번호)를 자동 생성하여 채워주는 마이그레이션 스크립트
 * 
 * 실행 방법:
 * node migrate-videos-management-id.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'cms.db');
const db = new Database(dbPath);

console.log('📦 영상 관리번호 마이그레이션 시작...\n');

try {
  // management_id 컬럼이 없으면 추가
  const tableInfo = db.prepare("PRAGMA table_info('videos')").all();
  const columns = tableInfo.map((col) => col.name);
  
  if (!columns.includes('management_id')) {
    console.log('✅ management_id 컬럼 추가 중...');
    db.exec("ALTER TABLE videos ADD COLUMN management_id TEXT");
    console.log('✅ management_id 컬럼 추가 완료\n');
  }

  // management_id가 비어있는 영상 조회
  const videosWithoutManagementId = db
    .prepare("SELECT id, created_at FROM videos WHERE management_id IS NULL OR management_id = '' ORDER BY created_at ASC")
    .all();

  console.log(`📊 management_id가 없는 영상: ${videosWithoutManagementId.length}개\n`);

  if (videosWithoutManagementId.length === 0) {
    console.log('✅ 모든 영상에 management_id가 이미 설정되어 있습니다.');
    process.exit(0);
  }

  // 날짜별로 그룹화하여 순번 부여
  const videosByDate = {};
  
  videosWithoutManagementId.forEach((video) => {
    const date = new Date(video.created_at);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!videosByDate[dateStr]) {
      videosByDate[dateStr] = [];
    }
    videosByDate[dateStr].push(video);
  });

  let totalUpdated = 0;

  // 각 날짜별로 처리
  for (const [dateStr, videos] of Object.entries(videosByDate)) {
    const date = new Date(dateStr);
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateCode = `${year}${month}${day}`;

    // 해당 날짜에 이미 존재하는 management_id 개수 확인
    const existingCount = db
      .prepare("SELECT COUNT(*) as count FROM videos WHERE DATE(created_at) = DATE(?) AND management_id IS NOT NULL AND management_id LIKE ?")
      .get(dateStr, `${dateCode}-%`);

    let sequence = (existingCount.count || 0) + 1;

    // 해당 날짜의 영상들에 순번 부여
    for (const video of videos) {
      const managementId = `${dateCode}-${sequence.toString().padStart(3, '0')}`;
      
      db.prepare("UPDATE videos SET management_id = ? WHERE id = ?").run(managementId, video.id);
      
      console.log(`✅ ${video.id} → ${managementId}`);
      totalUpdated++;
      sequence++;
    }
  }

  console.log(`\n✅ 마이그레이션 완료: ${totalUpdated}개 영상에 management_id가 생성되었습니다.`);
} catch (error) {
  console.error('❌ 마이그레이션 오류:', error);
  process.exit(1);
} finally {
  db.close();
}















































































