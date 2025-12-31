# Backend API Server - Endpoint Documentation

## ✅ 1. GET /creator/videos 엔드포인트 확인

**상태**: ✅ **존재함**

**구현 위치**: `functions/index.js:348-398`

**엔드포인트 경로**: `GET /creator/videos` (정확히 이 경로)

**응답 형식**: JSON (200 OK, `application/json`)

**응답 예시**:
```json
{
  "videos": [
    {
      "id": "video123",
      "site_id": "gods",
      "owner_id": "user123",
      "platform": "youtube",
      "source_url": "https://www.youtube.com/watch?v=...",
      "title": "Video Title",
      "thumbnail_url": "https://img.youtube.com/vi/.../hqdefault.jpg",
      "visibility": "public",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**인증 요구사항**: 
- `Authorization: Bearer <token>` 헤더 필요
- JWT 토큰 검증 필수

**쿼리 파라미터**:
- `site_id` (선택적): 사이트 ID

---

## 📋 2. 전체 엔드포인트 목록

### Auth 엔드포인트

| Method | Path | 설명 | 인증 | 구현 위치 |
|--------|------|------|------|-----------|
| GET | `/health` | 헬스 체크 | ❌ | `functions/index.js:137` |
| POST | `/auth/login` | 로그인 및 JWT 토큰 발급 | ❌ | `functions/index.js:142` |
| POST | `/auth/check-email` | 이메일 존재 여부 확인 | ❌ | `functions/index.js:223` |
| POST | `/auth/change-password` | 비밀번호 변경 | ❌ | `functions/index.js:261` |

### Creator 엔드포인트

| Method | Path | 설명 | 인증 | 구현 위치 |
|--------|------|------|------|-----------|
| GET | `/creator/videos` | Creator 영상 목록 조회 | ✅ (JWT) | `functions/index.js:348` |

### Admin 엔드포인트

**현재 `functions/index.js`에는 Admin 전용 엔드포인트가 없습니다.**

---

## 🔒 3. CORS 설정 확인

**파일**: `functions/index.js:17-56`

**현재 CORS 설정**:

```javascript
const allowedOrigins = [
  "https://cms.godcomfortword.com",  // ✅ 프로덕션 도메인 포함
  "https://gods-comfort-word-cms.web.app",
  "https://gods-comfort-word-cms.firebaseapp.com",
  "https://www.godcomfortword.com",
  "https://godcomfortword.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "Accept", "Origin"],
}));
```

**✅ CORS 설정 올바름**:
- ✅ `https://cms.godcomfortword.com` 허용됨
- ✅ `credentials: true` 설정됨
- ✅ 필요한 HTTP 메서드 허용됨
- ✅ 필요한 헤더 허용됨

**변경 필요 없음**

---

## 🚫 4. HTML Fallback 방지 확인

**파일**: `functions/index.js:400-415`

**404 핸들러** (JSON 반환):
```javascript
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});
```

**에러 핸들러** (JSON 반환):
```javascript
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    statusCode: err.status || 500,
  });
});
```

**✅ HTML Fallback 없음**:
- 모든 응답이 JSON 형식으로 반환됨
- 404 에러도 JSON으로 반환
- HTML 페이지를 반환하는 코드 없음

---

## ✅ 5. GET /health 엔드포인트 확인

**상태**: ✅ **이미 존재함**

**구현 위치**: `functions/index.js:137-139`

**엔드포인트**: `GET /health`

**응답 형식**: JSON

**응답 예시**:
```json
{
  "ok": true,
  "db": "connected"
}
```

**또는 DB 연결 실패 시**:
```json
{
  "ok": true,
  "db": "disconnected"
}
```

**인증**: 불필요

---

## 🧪 6. curl 테스트 명령어

### 테스트 전제 조건

**API 서버 URL** (Firebase Functions):
```
https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

또는 (Firebase Hosting rewrites 사용 시):
```
https://cms.godcomfortword.com
```

---

### 테스트 1: GET /health

```bash
# Firebase Functions 직접 URL
curl -X GET "https://us-central1-gods-comfort-word.cloudfunctions.net/api/health" \
  -H "Content-Type: application/json" \
  -H "Origin: https://cms.godcomfortword.com"

# 또는 Firebase Hosting rewrites (주의: /health는 rewrites에 없어서 작동하지 않을 수 있음)
curl -X GET "https://cms.godcomfortword.com/health" \
  -H "Content-Type: application/json" \
  -H "Origin: https://cms.godcomfortword.com"
```

**예상 응답**:
```json
{"ok":true,"db":"connected"}
```

---

### 테스트 2: POST /auth/login

```bash
curl -X POST "https://us-central1-gods-comfort-word.cloudfunctions.net/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: https://cms.godcomfortword.com" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**예상 응답** (성공):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "role": "creator",
    "site_id": "gods"
  }
}
```

**예상 응답** (실패):
```json
{
  "error": "Unauthorized",
  "message": "이메일 또는 비밀번호가 올바르지 않습니다."
}
```

---

### 테스트 3: POST /auth/check-email

```bash
curl -X POST "https://us-central1-gods-comfort-word.cloudfunctions.net/api/auth/check-email" \
  -H "Content-Type: application/json" \
  -H "Origin: https://cms.godcomfortword.com" \
  -d '{
    "email": "user@example.com"
  }'
```

**예상 응답** (존재하는 경우):
```json
{
  "exists": true,
  "role": "creator"
}
```

**예상 응답** (존재하지 않는 경우):
```json
{
  "exists": false
}
```

---

### 테스트 4: GET /creator/videos (인증 필요)

**먼저 로그인하여 토큰 획득**:
```bash
# 1. 로그인하여 토큰 획득
TOKEN=$(curl -s -X POST "https://us-central1-gods-comfort-word.cloudfunctions.net/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: https://cms.godcomfortword.com" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }' | jq -r '.accessToken')

# 2. 토큰으로 영상 목록 조회
curl -X GET "https://us-central1-gods-comfort-word.cloudfunctions.net/api/creator/videos?site_id=gods" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: https://cms.godcomfortword.com"
```

**예상 응답** (성공):
```json
{
  "videos": [
    {
      "id": "video123",
      "site_id": "gods",
      "owner_id": "user123",
      "platform": "youtube",
      "source_url": "https://www.youtube.com/watch?v=...",
      "title": "Video Title",
      "thumbnail_url": "https://img.youtube.com/vi/.../hqdefault.jpg",
      "visibility": "public",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**예상 응답** (인증 실패):
```json
{
  "error": "Unauthorized",
  "message": "인증 토큰이 필요합니다."
}
```

---

### 테스트 5: 존재하지 않는 엔드포인트 (404 JSON 확인)

```bash
curl -X GET "https://us-central1-gods-comfort-word.cloudfunctions.net/api/nonexistent" \
  -H "Content-Type: application/json" \
  -H "Origin: https://cms.godcomfortword.com"
```

**예상 응답** (HTML이 아닌 JSON):
```json
{
  "error": "Not Found",
  "message": "Route GET /nonexistent not found"
}
```

---

## 📝 요약

### 엔드포인트 경로

- ✅ `GET /health` - 헬스 체크 (JSON 반환)
- ✅ `POST /auth/login` - 로그인 (JSON 반환)
- ✅ `POST /auth/check-email` - 이메일 확인 (JSON 반환)
- ✅ `POST /auth/change-password` - 비밀번호 변경 (JSON 반환)
- ✅ `GET /creator/videos` - Creator 영상 목록 (JSON 반환, 인증 필요)

**모든 엔드포인트는 정확히 위의 경로를 사용합니다. `/api` prefix 없음.**

### CORS 설정

- ✅ `https://cms.godcomfortword.com` 허용됨
- ✅ 변경 필요 없음

### HTML Fallback

- ✅ 모든 응답이 JSON 형식
- ✅ 404도 JSON 반환
- ✅ HTML fallback 없음

### Health 엔드포인트

- ✅ `GET /health` 이미 존재
- ✅ JSON `{ ok: true, db: "connected" }` 반환

---

## 🚀 배포 확인

Firebase Functions에 배포된 API 서버는 다음 URL에서 접근 가능합니다:

```
https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

프론트엔드에서 이 URL을 `VITE_API_BASE_URL`로 설정하면 정상 작동합니다.






