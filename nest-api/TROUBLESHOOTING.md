# 🔧 Troubleshooting Guide - 500 에러 해결

## 문제: POST /auth/setup-password 500 에러

### 증상
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

### 해결 과정

#### 1. 원인 분석

**가능한 원인**:
- ❌ `.env` 파일 누락 → DB 경로를 찾지 못함
- ❌ DB 파일(`cms.db`)이 존재하지 않음
- ❌ users 테이블에 해당 이메일의 사용자가 없음
- ❌ 예외 처리가 되지 않아 500으로 노출

#### 2. 적용된 해결책

##### A. 로깅 추가 (AuthService)
```typescript
// 각 단계별 로그 추가
this.logger.log(`🔐 비밀번호 설정 시도: ${email}`);
this.logger.debug(`사용자 조회 결과: ${user ? '발견됨' : 'null'}`);
this.logger.warn(`❌ 사용자를 찾을 수 없음: ${email}`);
this.logger.log(`✅ 비밀번호 설정 완료: ${updateEmail}`);
```

##### B. 예외 처리 강화
```typescript
try {
  // 비즈니스 로직
} catch (error) {
  // HttpException은 그대로 전달
  if (error instanceof NotFoundException || ...) {
    throw error;
  }
  
  // 예상치 못한 에러는 로깅 후 500으로 처리
  this.logger.error(`🔥 예상치 못한 에러:`, error);
  throw new InternalServerErrorException('...');
}
```

##### C. DB 쿼리 에러 처리 (DatabaseService)
```typescript
try {
  const result = this.db.prepare(...).run(...);
  this.logger.debug(`DB 업데이트 완료 - 영향받은 행: ${result.changes}`);
} catch (error) {
  this.logger.error(`❌ DB 업데이트 에러:`, error);
  throw error;
}
```

##### D. 명확한 에러 메시지
- `User not found` → `해당 이메일의 사용자를 찾을 수 없습니다.`
- `Password already set` → `이미 비밀번호가 설정된 계정입니다.`
- `Email already exists` → `이미 사용 중인 이메일입니다.`

---

## 테스트 시나리오

### ✅ 정상 케이스

**요청**:
```http
POST http://localhost:8788/auth/setup-password
Content-Type: application/json

{
  "email": "consulting_manager@naver.com",
  "new_password": "secure_password_123"
}
```

**예상 응답 (200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2025-12-11T...",
  "user": {
    "id": "abc123...",
    "name": "Manager",
    "email": "consulting_manager@naver.com",
    "role": "admin",
    "site_id": null
  }
}
```

**서버 로그**:
```
[AuthService] 🔐 비밀번호 설정 시도: consulting_manager@naver.com
[DatabaseService] 사용자 조회 (consulting_manager@naver.com): 발견
[AuthService] 사용자 조회 결과: 발견됨
[AuthService] 비밀번호 해싱 중...
[AuthService] DB 업데이트 시작 - User ID: abc123...
[DatabaseService] DB 업데이트 완료 - 영향받은 행: 1
[AuthService] ✅ 비밀번호 설정 완료: consulting_manager@naver.com
```

---

### ❌ 에러 케이스

#### 1. 사용자를 찾을 수 없음 (404)

**요청**:
```json
{
  "email": "nonexistent@example.com",
  "new_password": "password123"
}
```

**응답**:
```json
{
  "statusCode": 404,
  "message": "해당 이메일의 사용자를 찾을 수 없습니다.",
  "error": "Not Found"
}
```

**서버 로그**:
```
[AuthService] 🔐 비밀번호 설정 시도: nonexistent@example.com
[DatabaseService] 사용자 조회 (nonexistent@example.com): 없음
[AuthService] 사용자 조회 결과: null
[AuthService] ❌ 사용자를 찾을 수 없음: nonexistent@example.com
```

---

#### 2. 이미 비밀번호가 설정됨 (400)

**요청**:
```json
{
  "email": "consulting_manager@naver.com",
  "new_password": "password123"
}
```

**응답**:
```json
{
  "statusCode": 400,
  "message": "이미 비밀번호가 설정된 계정입니다. 비밀번호 변경 기능을 사용하세요.",
  "error": "Bad Request"
}
```

**서버 로그**:
```
[AuthService] 🔐 비밀번호 설정 시도: consulting_manager@naver.com
[DatabaseService] 사용자 조회 (consulting_manager@naver.com): 발견
[AuthService] 사용자 조회 결과: 발견됨
[AuthService] ⚠️  이미 비밀번호가 설정된 계정: consulting_manager@naver.com
```

---

#### 3. 이메일 중복 (409)

**요청**:
```json
{
  "email": "consulting_manager@naver.com",
  "new_password": "password123",
  "new_email": "existing_email@example.com"
}
```

**응답**:
```json
{
  "statusCode": 409,
  "message": "이미 사용 중인 이메일입니다.",
  "error": "Conflict"
}
```

---

## 디버깅 체크리스트

### 서버 시작 시 확인사항

1. **환경변수 로딩 확인**
   ```
   [ConfigModule] Configuration loaded
   ```

2. **DB 연결 확인**
   ```
   [DatabaseService] 📂 Opening SQLite database: ../cms.db
   [DatabaseService] ✅ SQLite database connected successfully
   [DatabaseService] 📊 Found 6 tables in database
   ```

3. **서버 시작 확인**
   ```
   ✅ NestJS API Server running on http://localhost:8788
   📚 Swagger UI: http://localhost:8788/api-docs
   ```

---

### API 호출 시 확인사항

1. **요청이 도착했는지**
   ```
   [AuthService] 🔐 비밀번호 설정 시도: [email]
   ```

2. **사용자 조회 결과**
   ```
   [DatabaseService] 사용자 조회 ([email]): 발견 또는 없음
   ```

3. **DB 업데이트 결과**
   ```
   [DatabaseService] DB 업데이트 완료 - 영향받은 행: 1
   ```

4. **최종 성공 여부**
   ```
   [AuthService] ✅ 비밀번호 설정 완료: [email]
   ```

---

## 여전히 500 에러가 발생한다면?

### 1. 서버 로그 확인

NestJS 서버 콘솔에서 에러 스택 트레이스를 확인하세요:
```
[AuthService] 🔥 예상치 못한 에러 발생: Error: ...
```

### 2. DB 파일 확인

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"
dir cms.db
```

DB 파일이 존재하는지 확인하세요.

### 3. 환경변수 확인

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"
type .env
```

`SQLITE_DB_PATH=../cms.db`가 제대로 설정되어 있는지 확인하세요.

### 4. 사용자 존재 확인

기존 Fastify 서버를 통해 사용자가 있는지 확인:
```http
GET http://localhost:8787/health
```

Fastify 서버가 정상 작동하면, users 테이블에 기본 관리자가 있습니다.

### 5. 의존성 재설치

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"
rm -r node_modules
npm install
```

---

## 문의

위 방법으로도 해결되지 않으면, 다음 정보를 포함하여 문의하세요:

1. 서버 콘솔의 전체 에러 로그
2. `.env` 파일 내용 (JWT_SECRET 제외)
3. `cms.db` 파일 존재 여부
4. 요청한 이메일 주소
5. 해당 이메일의 사용자가 users 테이블에 있는지 여부








































































































