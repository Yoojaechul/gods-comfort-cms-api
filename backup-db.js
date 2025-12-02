import fs from 'fs';
import path from 'path';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(process.cwd(), 'backups');
const backupPath = path.join(backupDir, `cms_${timestamp}.db`);

console.log('🎯 CMS 데이터베이스 백업 시작\n');

// 백업 디렉토리 생성
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log('✅ 백업 디렉토리 생성:', backupDir);
}

// 데이터베이스 백업
try {
  if (!fs.existsSync('cms.db')) {
    console.error('❌ cms.db 파일을 찾을 수 없습니다!');
    process.exit(1);
  }

  fs.copyFileSync('cms.db', backupPath);
  console.log(`✅ 백업 완료: ${backupPath}`);
  
  // 파일 크기 확인
  const stats = fs.statSync(backupPath);
  console.log(`   파일 크기: ${(stats.size / 1024).toFixed(2)} KB`);
  
  if (stats.size === 0) {
    console.warn('⚠️ 경고: 백업 파일 크기가 0입니다!');
  }
} catch (err) {
  console.error('❌ 백업 실패:', err.message);
  process.exit(1);
}

// 7일 이상 된 백업 삭제
console.log('\n🗑️ 오래된 백업 정리 중...');
const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
const files = fs.readdirSync(backupDir);
let deletedCount = 0;

files.forEach(file => {
  if (!file.startsWith('cms_') || !file.endsWith('.db')) return;
  
  const filePath = path.join(backupDir, file);
  const stats = fs.statSync(filePath);
  
  if (stats.mtimeMs < sevenDaysAgo) {
    fs.unlinkSync(filePath);
    console.log(`   🗑️ 삭제: ${file}`);
    deletedCount++;
  }
});

if (deletedCount === 0) {
  console.log('   ℹ️ 삭제할 오래된 백업 없음');
} else {
  console.log(`   ✅ ${deletedCount}개 오래된 백업 삭제됨`);
}

console.log('\n✅ 백업 프로세스 완료!');


