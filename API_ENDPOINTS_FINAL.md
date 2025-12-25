# 최종 API 엔드포인트 목록 (Firebase Cloud Functions)

프론트엔드에서 사용할 수 있는 API 엔드포인트 목록입니다.

## 🔐 인증 (Auth) 엔드포인트

### GET /health
**목적**: 서버 헬스 체크

**응답 (200 OK)**:
```json
{
  "ok": true,
  "db": "connected"
}
```

---

### POST /auth/login
**목적**: 사용자 로그인 및 JWT 토큰 발급

**요청**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**응답 (200 OK)**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "admin",
    "site_id": "site-id"
  }
}
```

**에러 응답 (401 Unauthorized)**:
```json
{
  "error": "Unauthorized",
  "message": "이메일 또는 비밀번호가 올바르지 않습니다."
}
```

---

### POST /auth/check-email
**목적**: 이메일 존재 여부 및 역할 확인

**요청**:
```json
{
  "email": "user@example.com"
}
```

**응답 (200 OK) - 존재하는 경우**:
```json
{
  "exists": true,
  "role": "admin"
}
```

**응답 (200 OK) - 존재하지 않는 경우**:
```json
{
  "exists": false
}
```

---

### POST /auth/change-password
**목적**: 비밀번호 변경 (이메일 기반, JWT 불필요)

**요청**:
```json
{
  "email": "user@example.com",
  "currentPassword": "old_password_123",
  "newPassword": "new_password_456"
}
```

**응답 (200 OK) - 성공**:
```json
{
  "ok": true
}
```

**응답 (200 OK) - 실패**:
```json
{
  "ok": false,
  "message": "현재 비밀번호가 올바르지 않습니다."
}
```

**응답 (403 Forbidden) - 권한 없음**:
```json
{
  "statusCode": 403,
  "error": "FORBIDDEN",
  "message": "비밀번호 변경은 관리자 또는 크리에이터 계정만 가능합니다."
}
```

**검증 항목**:
- ✅ email 존재 확인
- ✅ role이 admin 또는 creator인지 확인 (403 반환)
- ✅ currentPassword가 저장된 해시와 일치하는지 확인
- ✅ 새 비밀번호를 해시하여 DB 업데이트

---

## 🎬 Creator 엔드포인트

### GET /creator/videos
**목적**: Creator 영상 목록 조회

**인증**: JWT 토큰 필요 (`Authorization: Bearer <token>`)

**요청**:
```
GET /creator/videos?site_id=site-id
```

**응답 (200 OK)**:
```json
{
  "videos": [
    {
      "id": "abc123",
      "title": "샘플 영상",
      "platform": "youtube",
      "visibility": "public",
      "thumbnail_url": "https://img.youtube.com/vi/.../hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=...",
      "language": "ko",
      "site_id": "gods",
      "owner_id": "creator-001",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**에러 응답 (401 Unauthorized)**:
```json
{
  "error": "Unauthorized",
  "message": "인증 토큰이 필요합니다."
}
```

---

## 📝 응답 형식

### 성공 응답
모든 성공 응답은 **200 OK** 상태 코드와 함께 JSON 형식으로 반환됩니다.

### 에러 응답
모든 에러 응답은 **JSON 형식**으로 반환됩니다 (HTML 없음):

```json
{
  "error": "Error Type",
  "message": "에러 메시지",
  "statusCode": 400
}
```

또는 비밀번호 변경 실패 시:
```json
{
  "ok": false,
  "message": "에러 메시지"
}
```

---

## 🔒 보안 기능

### 비밀번호 변경
1. **역할 기반 접근 제어**: admin/creator만 비밀번호 변경 가능 (403 반환)
2. **현재 비밀번호 검증**: 반드시 현재 비밀번호 확인
3. **비밀번호 해싱**: scrypt 사용 (기존 프로젝트와 동일)
4. **DB 업데이트**: 비밀번호 변경 시 실제 DB에 해시된 비밀번호 저장

### Creator Videos
1. **JWT 인증**: 모든 요청에 JWT 토큰 필요
2. **역할 기반 필터링**: Creator는 자신의 영상만 조회 가능

---

## 🚀 배포

### Firebase Functions 배포

```bash
# functions 디렉토리로 이동
cd functions

# 의존성 설치
npm install

# Firebase Functions 배포
firebase deploy --only functions:api
```

---

## ✅ 확인 사항

- [x] POST /auth/login - 작동 중
- [x] POST /auth/check-email - JSON 반환, 역할 정보 포함
- [x] POST /auth/change-password - 역할 체크 (403), DB 업데이트, JSON 반환
- [x] GET /creator/videos - JSON 반환, JWT 인증
- [x] GET /health - 헬스 체크
- [x] 모든 에러 응답 - JSON 형식 (HTML 없음)

---

## 📌 주의사항

1. **DB 파일 경로**
   - 기본값: `functions/cms.db`
   - 환경변수 `SQLITE_DB_PATH`로 변경 가능
   - Firebase Functions 배포 시 DB 파일이 포함되어야 함

2. **CORS 설정**
   - 프로덕션 도메인 포함: `https://cms.godcomfortword.com`
   - 로컬 개발 환경 포함: `http://localhost:5173`

3. **JWT 토큰**
   - 현재는 Firebase Admin SDK의 `createCustomToken` 사용
   - 실제 프로덕션에서는 더 강력한 JWT 검증 로직 필요

4. **비밀번호 변경**
   - 역할 체크 실패 시 403 Forbidden 반환
   - 현재 비밀번호 불일치 시 `{ ok: false, message: "..." }` 반환 (200 OK)
