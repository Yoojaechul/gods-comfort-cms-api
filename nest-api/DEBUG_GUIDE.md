# 🐛 500 에러 디버깅 가이드

## 📋 적용된 수정사항

### 1. **DatabaseService - 상세 로깅 및 에러 처리**

#### ✅ **onModuleInit() - 스키마 자동 로깅**
서버 시작 시 users 테이블의 실제 스키마를 자동으로 로깅합니다.

```typescript
private logUsersTableSchema(): void {
  const schema = this.db.prepare("PRAGMA table_info('users')").all();
  // 모든 컬럼명, 타입, 제약조건 출력
}
```

**서버 시작 시 예상 로그**:
```
[DatabaseService] 📂 Opening SQLite database: ../cms.db
[DatabaseService] ✅ SQLite database connected successfully
[DatabaseService] 📊 Found 6 tables in database
[DatabaseService] ============================================================
[DatabaseService] 📋 users 테이블 스키마:
[DatabaseService]   - id (TEXT) NOT NULL PRIMARY KEY
[DatabaseService]   - site_id (TEXT)
[DatabaseService]   - name (TEXT) NOT NULL
[DatabaseService]   - email (TEXT)
[DatabaseService]   - password_hash (TEXT)
[DatabaseService]   - role (TEXT) NOT NULL
[DatabaseService]   - status (TEXT) NOT NULL
[DatabaseService]   - api_key_hash (TEXT) NOT NULL
[DatabaseService]   - api_key_salt (TEXT) NOT NULL
[DatabaseService]   - created_at (TEXT)
[DatabaseService]   - updated_at (TEXT)
[DatabaseService] ============================================================
```

---

#### ✅ **findUserByEmail() - 상세 로깅**

```typescript
findUserByEmail(email: string): any {
  try {
    const user = this.db.prepare(...).get(email);
    
    if (user) {
      this.logger.debug(
        `✅ 사용자 발견 (${email}): id=${user.id}, password_hash=${user.password_hash ? 'SET' : 'NULL'}`,
      );
    } else {
      this.logger.debug(`❌ 사용자 없음 (${email})`);
    }
    
    return user;
  } catch (error) {
    this.logger.error(`❌ 사용자 조회 DB 에러:`, error.message);
    this.logger.error('상세 에러:', error);
    throw error;
  }
}
```

**예상 로그**:
```
[DatabaseService] ✅ 사용자 발견 (consulting_manager@naver.com): id=abc123, password_hash=NULL
```

---

#### ✅ **updateUserEmailAndPassword() - 파라미터 및 결과 로깅**

```typescript
updateUserEmailAndPassword(...): void {
  try {
    this.logger.debug(
      `이메일/비밀번호 업데이트 시작 - User ID: ${userId}, Email: ${email}`,
    );
    this.logger.debug(`  - passwordHash 길이: ${passwordHash.length}`);
    this.logger.debug(`  - salt 길이: ${salt.length}`);

    const result = this.db.prepare(...).run(...);

    this.logger.debug(
      `✅ 이메일/비밀번호 업데이트 완료 - 영향받은 행: ${result.changes}`,
    );
  } catch (error) {
    this.logger.error(`❌ 이메일/비밀번호 업데이트 DB 에러:`, error.message);
    this.logger.error('상세 에러:', error);
    throw error;
  }
}
```

**예상 로그**:
```
[DatabaseService] 이메일/비밀번호 업데이트 시작 - User ID: abc123, Email: consulting_manager@naver.com
[DatabaseService]   - passwordHash 길이: 60
[DatabaseService]   - salt 길이: 32
[DatabaseService] ✅ 이메일/비밀번호 업데이트 완료 - 영향받은 행: 1
```

---

### 2. **AuthService - 예외 처리 강화**

#### ✅ **setupPassword() - 단계별 로깅 및 에러 처리**

```typescript
async setupPassword(setupPasswordDto: SetupPasswordDto) {
  this.logger.log(`🔐 비밀번호 설정 시도: ${email}`);

  try {
    // 각 단계별 로깅...
  } catch (error) {
    // HttpException은 그대로 전달
    if (error instanceof NotFoundException || ...) {
      throw error;
    }
    
    // 예상치 못한 에러는 로깅 후 500으로 처리
    this.logger.error(`🔥 예상치 못한 에러:`, error.message);
    this.logger.error('에러 스택:', error.stack);
    throw new InternalServerErrorException('서버 내부 오류가 발생했습니다.');
  }
}
```

---

## 🧪 테스트 시나리오

### **서버 재시작**

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"
npm run start:dev
```

### **1단계: 서버 로그 확인**

서버 시작 시 다음을 확인하세요:

✅ **DB 연결 성공**:
```
[DatabaseService] 📂 Opening SQLite database: ../cms.db
[DatabaseService] ✅ SQLite database connected successfully
```

✅ **users 테이블 스키마**:
```
[DatabaseService] 📋 users 테이블 스키마:
  - id (TEXT) NOT NULL PRIMARY KEY
  - email (TEXT)
  - password_hash (TEXT)
  - api_key_salt (TEXT)
  - updated_at (TEXT)
  ...
```

❌ **만약 에러가 나면**:
- `SQLITE_DB_PATH` 환경변수 확인
- `cms.db` 파일 존재 여부 확인
- users 테이블이 있는지 확인

---

### **2단계: API 테스트**

#### **요청**:
```http
POST http://localhost:8788/auth/setup-password
Content-Type: application/json

{
  "email": "consulting_manager@naver.com",
  "new_password": "secure_password_123"
}
```

---

### **3단계: 서버 로그 분석**

#### ✅ **정상 케이스 (200 OK)**

**서버 로그**:
```
[AuthService] 🔐 비밀번호 설정 시도: consulting_manager@naver.com
[DatabaseService] ✅ 사용자 발견 (consulting_manager@naver.com): id=abc123, password_hash=NULL
[AuthService] 사용자 조회 결과: 발견됨
[AuthService] 비밀번호 해싱 중...
[AuthService] DB 업데이트 시작 - User ID: abc123
[DatabaseService] 이메일/비밀번호 업데이트 시작 - User ID: abc123, Email: consulting_manager@naver.com
[DatabaseService]   - passwordHash 길이: 60
[DatabaseService]   - salt 길이: 32
[DatabaseService] ✅ 이메일/비밀번호 업데이트 완료 - 영향받은 행: 1
[AuthService] ✅ 비밀번호 설정 완료: consulting_manager@naver.com
[DatabaseService] ✅ 사용자 발견 (ID: abc123)
```

**클라이언트 응답**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2025-12-11T...",
  "user": {
    "id": "abc123",
    "name": "Manager",
    "email": "consulting_manager@naver.com",
    "role": "admin",
    "site_id": null
  }
}
```

---

#### ❌ **에러 케이스 1: 사용자 없음 (404)**

**서버 로그**:
```
[AuthService] 🔐 비밀번호 설정 시도: nonexistent@example.com
[DatabaseService] ❌ 사용자 없음 (nonexistent@example.com)
[AuthService] 사용자 조회 결과: null
[AuthService] ❌ 사용자를 찾을 수 없음: nonexistent@example.com
```

**클라이언트 응답**:
```json
{
  "statusCode": 404,
  "message": "해당 이메일의 사용자를 찾을 수 없습니다.",
  "error": "Not Found"
}
```

---

#### ❌ **에러 케이스 2: DB 쿼리 에러 (500)**

**서버 로그 예시** (updated_at 컬럼이 없을 경우):
```
[AuthService] 🔐 비밀번호 설정 시도: consulting_manager@naver.com
[DatabaseService] ✅ 사용자 발견 (consulting_manager@naver.com): id=abc123, password_hash=NULL
[AuthService] 사용자 조회 결과: 발견됨
[AuthService] 비밀번호 해싱 중...
[AuthService] DB 업데이트 시작 - User ID: abc123
[DatabaseService] ❌ 이메일/비밀번호 업데이트 DB 에러: no such column: updated_at
[DatabaseService] SQL 쿼리 파라미터: { userId: 'abc123', email: '...', ... }
[DatabaseService] 상세 에러: SqliteError: no such column: updated_at
[AuthService] 🔥 예상치 못한 에러: no such column: updated_at
```

**해결책**:
1. users 테이블에 `updated_at` 컬럼이 없음
2. ALTER TABLE 또는 마이그레이션 필요
3. 또는 쿼리에서 `updated_at` 제거

---

## 🔍 문제 진단 체크리스트

### 1. **DB 연결 확인**

- [ ] `.env` 파일에 `SQLITE_DB_PATH=../cms.db` 설정됨
- [ ] `cms.db` 파일이 부모 디렉터리에 존재
- [ ] 서버 로그에 "✅ SQLite database connected successfully" 출력

### 2. **users 테이블 스키마 확인**

- [ ] 서버 로그에 users 테이블 스키마 출력됨
- [ ] `email` 컬럼 존재
- [ ] `password_hash` 컬럼 존재
- [ ] `api_key_salt` 컬럼 존재
- [ ] `updated_at` 컬럼 존재 (없으면 쿼리 수정 필요)

### 3. **사용자 존재 확인**

- [ ] `consulting_manager@naver.com` 사용자가 users 테이블에 존재
- [ ] `status = 'active'`
- [ ] `password_hash = NULL` (최초 설정 시)

### 4. **API 호출 확인**

- [ ] 요청 JSON이 올바른 형식
- [ ] Content-Type이 application/json
- [ ] 포트가 8788 (NestJS)

---

## 📊 HTTP 상태 코드별 원인

| 상태 코드 | 상황 | 원인 |
|----------|------|------|
| **200 OK** | 성공 | 모든 단계가 정상적으로 완료됨 |
| **400 Bad Request** | 이미 비밀번호 설정됨 | `user.password_hash`가 이미 값이 있음 |
| **404 Not Found** | 사용자 없음 | 해당 이메일의 사용자가 users 테이블에 없거나 `status != 'active'` |
| **409 Conflict** | 이메일 중복 | `new_email`이 이미 다른 사용자가 사용 중 |
| **500 Internal Server Error** | DB 에러 | • `updated_at` 컬럼 없음<br>• DB 연결 실패<br>• 예상치 못한 쿼리 에러 |

---

## 🛠️ 500 에러 해결 방법

### **문제: `no such column: updated_at`**

**해결책 1**: users 테이블에 컬럼 추가
```sql
ALTER TABLE users ADD COLUMN updated_at TEXT;
```

**해결책 2**: 쿼리에서 updated_at 제거
```typescript
// database.service.ts
const result = this.db
  .prepare(
    "UPDATE users SET email = ?, password_hash = ?, api_key_salt = ? WHERE id = ?",
  )
  .run(email, passwordHash, salt, userId);
```

---

### **문제: `cannot open database file`**

**해결책**:
1. `.env` 파일의 `SQLITE_DB_PATH` 확인
2. 절대 경로로 변경 시도:
   ```env
   SQLITE_DB_PATH=C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\cms.db
   ```

---

## 📞 추가 지원

위 방법으로도 해결되지 않으면:

1. **서버 전체 로그** 제공
2. **users 테이블 스키마** (`PRAGMA table_info('users')` 결과)
3. **요청 JSON** 및 **응답**
4. **`.env` 파일 내용** (JWT_SECRET 제외)

이 정보를 포함하여 문의하세요.



























































































