/**
 * 백필 스크립트: management_id가 null인 기존 영상들에 management_id 부여
 * 
 * 실행 방법:
 *   node backfill-management-id.js
 * 
 * 동작:
 *   - management_id가 null인 rows를 created_at 기준으로 같은 날짜/같은 site_id 안에서 001부터 재부여
 *   - 이미 값 있는 건 건드리지 않음
 *   - Asia/Seoul 시간대 기준으로 날짜 계산
 */

const Database = require('better-sqlite3');
const path = require('path');

// DB 경로 설정 (환경변수 또는 기본값)
const dbPath = process.env.SQLITE_DB_PATH || process.env.DB_PATH || path.join(__dirname, 'data', 'cms.db');

console.log(`Using DB path: ${dbPath}`);

try {
  const db = new Database(dbPath);
  
  // WAL 모드 활성화
  db.pragma('journal_mode = WAL');
  
  console.log('✅ Database connected');
  
  // management_id가 null인 영상들 조회 (site_id, created_at 기준 정렬)
  const nullManagementIdVideos = db
    .prepare(`
      SELECT id, site_id, created_at 
      FROM videos 
      WHERE management_id IS NULL 
      ORDER BY site_id, created_at ASC
    `)
    .all();
  
  console.log(`\n📊 Found ${nullManagementIdVideos.length} videos with null management_id`);
  
  if (nullManagementIdVideos.length === 0) {
    console.log('✅ No videos need backfilling. Exiting.');
    db.close();
    process.exit(0);
  }
  
  // site_id별, 날짜별로 그룹화
  const groupedVideos = {};
  
  for (const video of nullManagementIdVideos) {
    // created_at을 Asia/Seoul 시간대로 변환
    const createdAt = new Date(video.created_at);
    const seoulTime = new Date(createdAt.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const year = seoulTime.getFullYear().toString().slice(-2); // YY
    const month = String(seoulTime.getMonth() + 1).padStart(2, '0'); // MM
    const day = String(seoulTime.getDate()).padStart(2, '0'); // DD
    const dateKey = `${year}${month}${day}`;
    
    const groupKey = `${video.site_id}_${dateKey}`;
    
    if (!groupedVideos[groupKey]) {
      groupedVideos[groupKey] = {
        siteId: video.site_id,
        datePrefix: dateKey,
        videos: [],
      };
    }
    
    groupedVideos[groupKey].videos.push({
      id: video.id,
      createdAt: video.created_at,
    });
  }
  
  console.log(`\n📅 Grouped into ${Object.keys(groupedVideos).length} groups (by site_id + date)`);
  
  // BEGIN IMMEDIATE 트랜잭션으로 안전하게 업데이트
  const updateTransaction = db.transaction((group) => {
    const { siteId, datePrefix, videos } = group;
    
    // 해당 그룹에서 기존에 가장 큰 management_id 번호 찾기
    const prefix = `${datePrefix}-`;
    const maxRow = db
      .prepare(`
        SELECT management_id 
        FROM videos 
        WHERE site_id = ? AND management_id LIKE ?
        ORDER BY management_id DESC 
        LIMIT 1
      `)
      .get(siteId, `${prefix}%`);
    
    let startNumber = 1;
    
    if (maxRow?.management_id) {
      // 기존 최대값에서 번호 추출 (예: "251227-005" -> 5)
      const match = maxRow.management_id.match(/^(\d{6})-(\d+)$/);
      if (match && match[2]) {
        startNumber = parseInt(match[2], 10) + 1;
      }
    }
    
    // 각 영상에 management_id 부여
    const updateStmt = db.prepare('UPDATE videos SET management_id = ? WHERE id = ?');
    
    for (let i = 0; i < videos.length; i++) {
      const number = startNumber + i;
      const managementId = `${datePrefix}-${String(number).padStart(3, '0')}`;
      
      updateStmt.run(managementId, videos[i].id);
      console.log(`  ✓ ${videos[i].id} -> ${managementId}`);
    }
    
    return videos.length;
  });
  
  // 각 그룹에 대해 트랜잭션 실행
  let totalUpdated = 0;
  
  for (const groupKey of Object.keys(groupedVideos)) {
    const group = groupedVideos[groupKey];
    console.log(`\n🔄 Processing group: ${group.siteId} / ${group.datePrefix} (${group.videos.length} videos)`);
    
    try {
      const count = updateTransaction.immediate(group);
      totalUpdated += count;
      console.log(`  ✅ Updated ${count} videos`);
    } catch (error) {
      console.error(`  ❌ Error processing group ${groupKey}:`, error.message);
      throw error;
    }
  }
  
  console.log(`\n✅ Backfill completed! Total updated: ${totalUpdated} videos`);
  
  // 검증: null management_id가 남아있는지 확인
  const remainingNullCount = db
    .prepare('SELECT COUNT(*) as count FROM videos WHERE management_id IS NULL')
    .get().count;
  
  if (remainingNullCount > 0) {
    console.log(`⚠️  Warning: ${remainingNullCount} videos still have null management_id`);
  } else {
    console.log('✅ All videos now have management_id');
  }
  
  db.close();
  console.log('\n✅ Done!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
  process.exit(1);
}

