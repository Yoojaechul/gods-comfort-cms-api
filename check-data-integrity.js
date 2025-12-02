import db from './db.js';

console.log('=== 데이터 무결성 점검 ===\n');

let hasError = false;

// 1. site_id 검증
const noSiteId = db.prepare("SELECT COUNT(*) as count FROM videos WHERE site_id IS NULL OR site_id = ''").get();
console.log('1. site_id 없는 영상:', noSiteId.count, noSiteId.count === 0 ? '✅' : '❌');
if (noSiteId.count > 0) hasError = true;

// 2. owner_id 검증
const orphaned = db.prepare(`
  SELECT COUNT(*) as count 
  FROM videos v 
  LEFT JOIN users u ON v.owner_id = u.id 
  WHERE u.id IS NULL
`).get();
console.log('2. owner 없는 영상:', orphaned.count, orphaned.count === 0 ? '✅' : '❌');
if (orphaned.count > 0) hasError = true;

// 3. platform 검증
const invalidPlatform = db.prepare(`
  SELECT COUNT(*) as count 
  FROM videos 
  WHERE platform NOT IN ('youtube', 'facebook', 'other')
`).get();
console.log('3. 잘못된 platform:', invalidPlatform.count, invalidPlatform.count === 0 ? '✅' : '❌');
if (invalidPlatform.count > 0) hasError = true;

// 4. stats 음수 검증
const negativeStats = db.prepare(`
  SELECT COUNT(*) as count 
  FROM videos 
  WHERE views_count < 0 OR likes_count < 0 OR shares_count < 0
`).get();
console.log('4. 음수 stats:', negativeStats.count, negativeStats.count === 0 ? '✅' : '❌');
if (negativeStats.count > 0) hasError = true;

// 5. 필수 필드 검증 (title)
const noTitle = db.prepare("SELECT COUNT(*) as count FROM videos WHERE title IS NULL OR title = ''").get();
console.log('5. 제목 없는 영상:', noTitle.count, noTitle.count === 0 ? '✅' : '❌');
if (noTitle.count > 0) hasError = true;

// 6. 중복 이메일 검증
const duplicateEmails = db.prepare(`
  SELECT email, COUNT(*) as count 
  FROM users 
  WHERE email IS NOT NULL 
  GROUP BY email 
  HAVING count > 1
`).all();
console.log('6. 중복 이메일:', duplicateEmails.length, duplicateEmails.length === 0 ? '✅' : '❌');
if (duplicateEmails.length > 0) {
  duplicateEmails.forEach(e => console.log('   -', e.email, ':', e.count, '개'));
  hasError = true;
}

// 7. 활성 admin 계정 확인
const activeAdmins = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active'").get();
console.log('7. 활성 admin 계정:', activeAdmins.count, activeAdmins.count > 0 ? '✅' : '❌');
if (activeAdmins.count === 0) hasError = true;

// 8. 인덱스 확인
const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'").all();
console.log('8. 생성된 인덱스:', indexes.length, indexes.length >= 10 ? '✅' : '⚠️');

console.log('\n=== 점검 결과 ===');
if (hasError) {
  console.log('❌ 문제 발견! 데이터를 수정해주세요.');
  process.exit(1);
} else {
  console.log('✅ 모든 검증 통과! 배포 가능합니다.');
  process.exit(0);
}

