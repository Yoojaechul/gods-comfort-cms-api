# API 테스트 가이드

Thunder Client 또는 Postman으로 Auth API를 테스트하는 방법입니다.

## 🌐 서버 정보

- **Base URL**: `http://localhost:8788`
- **Swagger UI**: `http://localhost:8788/api-docs`

## 📡 엔드포인트 테스트

### 1️⃣ 헬스 체크

**목적**: Auth 모듈이 정상 동작하는지 확인

```http
GET http://localhost:8788/auth/health
```

**예상 응답** (200 OK):
```json
{
  "status": "ok",
  "message": "Auth module is healthy",
  "timestamp": "2025-12-04T12:53:00.000Z"
}
```

---

### 2️⃣ 최초 비밀번호 설정

**목적**: 관리자 또는 크리에이터 계정의 최초 비밀번호 설정

```http
POST http://localhost:8788/auth/setup-password
Content-Type: application/json

{
  "email": "consulting_manager@naver.com",
  "new_password": "secure_password_123"
}
```

**선택 사항 - 이메일 변경**:
```json
{
  "email": "consulting_manager@naver.com",
  "new_password": "secure_password_123",
  "new_email": "newemail@example.com"
}
```

**예상 응답** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-12-11T12:53:00.000Z",
  "user": {
    "id": "abc123def456...",
    "name": "Manager",
    "email": "consulting_manager@naver.com",
    "role": "admin",
    "site_id": null
  }
}
```

**에러 응답 예시**:

**400 Bad Request** (이미 비밀번호 설정됨):
```json
{
  "statusCode": 400,
  "message": "Password already set. Use change-password instead.",
  "error": "Bad Request"
}
```

**404 Not Found** (사용자 없음):
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

**409 Conflict** (이메일 중복):
```json
{
  "statusCode": 409,
  "message": "Email already exists",
  "error": "Conflict"
}
```

---

### 3️⃣ 로그인

**목적**: 이메일/비밀번호로 로그인하여 JWT 토큰 발급

```http
POST http://localhost:8788/auth/login
Content-Type: application/json

{
  "email": "consulting_manager@naver.com",
  "password": "secure_password_123"
}
```

**예상 응답** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-12-11T12:53:00.000Z",
  "user": {
    "id": "abc123def456...",
    "name": "Manager",
    "email": "consulting_manager@naver.com",
    "role": "admin",
    "site_id": null
  }
}
```

**에러 응답 예시**:

**401 Unauthorized** (잘못된 이메일 또는 비밀번호):
```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "error": "Unauthorized"
}
```

**403 Forbidden** (비밀번호 미설정):
```json
{
  "statusCode": 403,
  "message": {
    "error": "Password not set",
    "requires_setup": true,
    "user_id": "abc123def456...",
    "email": "consulting_manager@naver.com",
    "role": "admin"
  },
  "error": "Forbidden"
}
```

---

## 🔐 JWT 토큰 사용 예시

로그인 후 받은 `token`을 이용하여 보호된 엔드포인트에 접근할 때:

```http
GET http://localhost:8788/some-protected-endpoint
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🧪 Thunder Client 테스트 시나리오

### 시나리오 1: 신규 계정 설정 및 로그인

1. **헬스 체크**
   ```
   GET http://localhost:8788/auth/health
   ```

2. **최초 비밀번호 설정**
   ```
   POST http://localhost:8788/auth/setup-password
   Body:
   {
     "email": "consulting_manager@naver.com",
     "new_password": "mypassword123"
   }
   ```

3. **로그인**
   ```
   POST http://localhost:8788/auth/login
   Body:
   {
     "email": "consulting_manager@naver.com",
     "password": "mypassword123"
   }
   ```

4. **토큰 복사**
   - 응답에서 `token` 값을 복사
   - 이후 보호된 엔드포인트 호출 시 사용

---

### 시나리오 2: 기존 계정 로그인

1. **로그인**
   ```
   POST http://localhost:8788/auth/login
   Body:
   {
     "email": "01023942042",
     "password": "creator_password"
   }
   ```

2. **토큰 사용**
   - 받은 토큰으로 다른 API 호출

---

## 🌐 Swagger UI로 테스트

1. 브라우저에서 `http://localhost:8788/api-docs` 접속
2. `auth` 태그 클릭하여 엔드포인트 확인
3. `Try it out` 버튼 클릭
4. Request body 입력
5. `Execute` 버튼 클릭
6. Response 확인

**장점**:
- 시각적 인터페이스
- 자동 문서화
- 실시간 테스트 가능
- 응답 예시 제공

---

## ⚠️ 주의사항

### 기존 Fastify 계정 사용

기존 Fastify 서버에서 생성된 계정 정보는 그대로 사용 가능합니다:

- **Admin**: `consulting_manager@naver.com`
- **Creator**: `01023942042`

단, **비밀번호 해시 방식**에 주의:
- Fastify: `scrypt` 사용 (기존)
- NestJS: `bcrypt` 사용 (신규)

**해결책**:
1. 기존 계정은 `/auth/setup-password`로 다시 비밀번호 설정
2. 또는 DatabaseService에서 scrypt 호환 추가 (선택사항)

### 포트 구분

- **Fastify**: `http://localhost:8787`
- **NestJS**: `http://localhost:8788`

테스트 시 포트를 정확히 입력하세요!

---

## 📝 테스트 체크리스트

- [ ] 헬스 체크 성공 (`/auth/health`)
- [ ] 최초 비밀번호 설정 성공 (`/auth/setup-password`)
- [ ] 로그인 성공 (`/auth/login`)
- [ ] JWT 토큰 발급 확인
- [ ] 잘못된 비밀번호로 로그인 시 401 에러
- [ ] 비밀번호 미설정 계정 로그인 시 403 에러
- [ ] Swagger UI 접속 및 문서 확인
- [ ] Validation 에러 확인 (필수 필드 누락 시)





































































































