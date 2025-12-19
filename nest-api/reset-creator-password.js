/**
 * Creator 계정 비밀번호 초기화 스크립트
 * 
 * 사용법: node reset-creator-password.js
 */

const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');

// DB 경로 설정
const dbPath = path.join(__dirname, '..', 'cms.db');
const CREATOR_EMAIL = '01023942042';
const NEW_PASSWORD = 'creator123!';

console.log('='.repeat(60));
console.log('🔐 Creator 계정 비밀번호 초기화 스크립트');
console.log('='.repeat(60));
console.log(`📂 DB 경로: ${dbPath}`);
console.log(`👤 계정: ${CREATOR_EMAIL}`);
console.log(`🔑 새 비밀번호: ${NEW_PASSWORD}`);
console.log('='.repeat(60));

// DB 연결
let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  console.log('✅ SQLite 데이터베이스 연결 성공\n');
} catch (error) {
  console.error('❌ DB 연결 실패:', error.message);
  process.exit(1);
}

async function resetCreatorPassword() {
  try {
    // 1. Creator 계정 조회
    console.log('📋 1단계: Creator 계정 조회 중...');
    const user = db
      .prepare("SELECT * FROM users WHERE email = ? AND role = 'creator'")
      .get(CREATOR_EMAIL);

    if (!user) {
      console.error(`❌ Creator 계정을 찾을 수 없습니다: ${CREATOR_EMAIL}`);
      console.log('\n💡 전체 users 테이블 조회:');
      const allUsers = db.prepare("SELECT id, email, role, status FROM users").all();
      allUsers.forEach(u => {
        console.log(`  - ${u.email} (${u.role}, ${u.status})`);
      });
      process.exit(1);
    }

    console.log(`✅ Creator 계정 발견:`);
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Name: ${user.name || 'N/A'}`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - Status: ${user.status}`);
    console.log(`   - 현재 password_hash: ${user.password_hash ? '설정됨' : 'NULL'}`);
    console.log(`   - 현재 api_key_salt: ${user.api_key_salt ? '설정됨' : 'NULL'}\n`);

    // 2. Status 확인 및 수정
    console.log('📋 2단계: Status 확인 및 수정 중...');
    if (user.status !== 'active') {
      console.log(`⚠️  Status가 '${user.status}'입니다. 'active'로 변경합니다.`);
      const statusResult = db
        .prepare("UPDATE users SET status = 'active' WHERE id = ?")
        .run(user.id);
      console.log(`✅ Status 업데이트 완료 (영향받은 행: ${statusResult.changes})\n`);
    } else {
      console.log(`✅ Status가 이미 'active'입니다.\n`);
    }

    // 3. 비밀번호 해시 생성
    console.log('📋 3단계: 비밀번호 해시 생성 중...');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(NEW_PASSWORD, saltRounds);
    
    // 기존 salt가 있으면 재사용, 없으면 새로 생성
    let salt = user.api_key_salt;
    if (!salt) {
      // 간단한 salt 생성 (실제로는 더 복잡한 방식 사용 가능)
      salt = await bcrypt.genSalt(10);
      console.log(`⚠️  기존 salt가 없어 새로 생성했습니다.`);
    }

    console.log(`✅ 비밀번호 해시 생성 완료`);
    console.log(`   - password_hash 길이: ${passwordHash.length}`);
    console.log(`   - salt 길이: ${salt.length}`);
    console.log(`   - password_hash (처음 50자): ${passwordHash.substring(0, 50)}...\n`);

    // 4. 비밀번호 업데이트
    console.log('📋 4단계: 데이터베이스 업데이트 중...');
    
    // updated_at 컬럼 존재 여부 확인
    let updateQuery;
    try {
      // 먼저 updated_at 컬럼이 있는지 확인
      const tableInfo = db.prepare("PRAGMA table_info('users')").all();
      const hasUpdatedAt = tableInfo.some(col => col.name === 'updated_at');
      
      if (hasUpdatedAt) {
        updateQuery = db.prepare(
          "UPDATE users SET password_hash = ?, api_key_salt = ?, updated_at = datetime('now') WHERE id = ?"
        );
      } else {
        updateQuery = db.prepare(
          "UPDATE users SET password_hash = ?, api_key_salt = ? WHERE id = ?"
        );
      }
      
      const result = updateQuery.run(passwordHash, salt, user.id);
      
      if (result.changes === 0) {
        console.error(`❌ 업데이트된 행이 없습니다. User ID: ${user.id}`);
        process.exit(1);
      }
      
      console.log(`✅ 비밀번호 업데이트 완료 (영향받은 행: ${result.changes})\n`);
    } catch (error) {
      console.error(`❌ 업데이트 실패:`, error.message);
      process.exit(1);
    }

    // 5. 업데이트 확인
    console.log('📋 5단계: 업데이트 확인 중...');
    const updatedUser = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(user.id);

    console.log(`✅ 업데이트 확인:`);
    console.log(`   - Email: ${updatedUser.email}`);
    console.log(`   - Role: ${updatedUser.role}`);
    console.log(`   - Status: ${updatedUser.status}`);
    console.log(`   - password_hash: ${updatedUser.password_hash ? '설정됨' : 'NULL'}`);
    console.log(`   - api_key_salt: ${updatedUser.api_key_salt ? '설정됨' : 'NULL'}\n`);

    // 6. 비밀번호 검증 테스트
    console.log('📋 6단계: 비밀번호 검증 테스트 중...');
    const isValid = await bcrypt.compare(NEW_PASSWORD, updatedUser.password_hash);
    if (isValid) {
      console.log(`✅ 비밀번호 검증 성공!\n`);
    } else {
      console.error(`❌ 비밀번호 검증 실패!`);
      process.exit(1);
    }

    // 완료 메시지
    console.log('='.repeat(60));
    console.log('✅ Creator 계정 비밀번호 초기화 완료!');
    console.log('='.repeat(60));
    console.log(`📧 이메일: ${CREATOR_EMAIL}`);
    console.log(`🔑 비밀번호: ${NEW_PASSWORD}`);
    console.log(`📊 Status: ${updatedUser.status}`);
    console.log('='.repeat(60));
    console.log('\n🧪 로그인 테스트 방법:');
    console.log(`   POST http://localhost:8788/auth/login`);
    console.log(`   Body: { "email": "${CREATOR_EMAIL}", "password": "${NEW_PASSWORD}" }`);
    console.log('\n');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    db.close();
    console.log('📂 데이터베이스 연결 종료');
  }
}

// 스크립트 실행
resetCreatorPassword().catch(error => {
  console.error('❌ 치명적 오류:', error);
  process.exit(1);
});



























































































