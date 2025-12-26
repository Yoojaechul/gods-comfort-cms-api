# Public Videos 좋아요/공유 API 구현 완료 보고서

## ✅ 완료된 작업

### 1. 좋아요 토글 API 구현
- ✅ **POST /public/videos/:id/like** - 좋아요 토글 (추가/취소)
  - IP + User-Agent 기반 중복 방지
  - `video_likes` 테이블 자동 생성
  - 응답: `{ success, likedByMe, likesCount, likes_count }`

- ✅ **POST /public/videos/:id/unlike** - 좋아요 취소 (별도 엔드포인트)
  - 프론트엔드 호환성을 위해 추가
  - 동일한 중복 방지 로직 적용

### 2. 공유 API 개선
- ✅ **POST /public/videos/:id/share** - 공유 수 증가
  - 응답 형식 개선: `shareCount`, `sharesCount`, `shares_count` 모두 포함
  - 에러 처리 강화

### 3. CORS 설정 확인
- ✅ `http://localhost:3000` 허용 확인됨
- ✅ `http://localhost:5173` 허용 확인됨
- ✅ 운영 환경 도메인 허용 확인됨

## 🔒 적용된 수정 사항

### 좋아요 토글 API (POST /public/videos/:id/like)

**이전 코드**:
```javascript
// 단순 증가만 지원
app.post("/public/videos/:id/like", async (request, reply) => {
  // 좋아요 증가만
  const currentLikes = video.likes_count ?? 0;
  db.prepare("UPDATE videos SET likes_count = ? WHERE id = ?").run(currentLikes + 1, id);
  return { success: true, likes_count: updatedVideo.likes_count ?? 0 };
});
```

**수정된 코드**:
```javascript
// 좋아요 토글 (추가/취소)
app.post("/public/videos/:id/like", async (request, reply) => {
  // 클라이언트 식별자 생성 (IP + User-Agent)
  const clientIp = request.ip || request.headers['x-forwarded-for'] || 'unknown';
  const userAgent = request.headers['user-agent'] || 'unknown';
  const clientKey = `${clientIp}:${userAgent}`.substring(0, 100);

  // video_likes 테이블 자동 생성
  // 기존 좋아요 확인
  const existingLike = db.prepare("SELECT * FROM video_likes WHERE video_id = ? AND client_key = ?").get(id, clientKey);
  const isLiked = !!existingLike;

  if (isLiked) {
    // 좋아요 취소
    db.prepare("DELETE FROM video_likes WHERE video_id = ? AND client_key = ?").run(id, clientKey);
    newLikesCount = Math.max(0, currentLikes - 1);
    likedByMe = false;
  } else {
    // 좋아요 추가
    db.prepare("INSERT INTO video_likes (id, video_id, client_key) VALUES (?, ?, ?)").run(likeId, id, clientKey);
    newLikesCount = currentLikes + 1;
    likedByMe = true;
  }

  return {
    success: true,
    likedByMe,
    likesCount: newLikesCount,
    likes_count: newLikesCount, // 호환성
  };
});
```

### 좋아요 취소 API (POST /public/videos/:id/unlike)

**새로 추가**:
```javascript
app.post("/public/videos/:id/unlike", async (request, reply) => {
  // 좋아요 취소 전용 엔드포인트
  // 동일한 중복 방지 로직 적용
  // 응답: { success, likedByMe: false, likesCount, likes_count }
});
```

### 공유 API 개선 (POST /public/videos/:id/share)

**이전 코드**:
```javascript
return {
  success: true,
  shares_count: updatedVideo.shares_count ?? 0,
};
```

**수정된 코드**:
```javascript
return {
  success: true,
  shareCount: newSharesCount,      // camelCase
  sharesCount: newSharesCount,      // camelCase (호환성)
  shares_count: newSharesCount,    // snake_case (호환성)
};
```

### DB 스키마 (video_likes 테이블)

```sql
CREATE TABLE IF NOT EXISTS video_likes (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  client_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(video_id, client_key)
);

CREATE INDEX idx_video_likes_video_id ON video_likes(video_id);
CREATE INDEX idx_video_likes_client_key ON video_likes(client_key);
```

## 📝 API 스펙

### 1. 좋아요 토글 API

**엔드포인트**: `POST /public/videos/:id/like`

**인증**: 불필요 (익명 사용자 허용)

**요청**:
```http
POST /public/videos/{video_id}/like
Content-Type: application/json
```

**응답 (좋아요 추가 시)**:
```json
{
  "success": true,
  "likedByMe": true,
  "likesCount": 45,
  "likes_count": 45
}
```

**응답 (좋아요 취소 시)**:
```json
{
  "success": true,
  "likedByMe": false,
  "likesCount": 44,
  "likes_count": 44
}
```

**에러 응답 (404)**:
```json
{
  "error": "Video not found",
  "message": "영상을 찾을 수 없습니다."
}
```

### 2. 좋아요 취소 API (별도 엔드포인트)

**엔드포인트**: `POST /public/videos/:id/unlike`

**인증**: 불필요 (익명 사용자 허용)

**요청**:
```http
POST /public/videos/{video_id}/unlike
Content-Type: application/json
```

**응답**:
```json
{
  "success": true,
  "likedByMe": false,
  "likesCount": 44,
  "likes_count": 44
}
```

### 3. 공유 API

**엔드포인트**: `POST /public/videos/:id/share`

**인증**: 불필요 (익명 사용자 허용)

**요청**:
```http
POST /public/videos/{video_id}/share
Content-Type: application/json
```

**응답 (성공)**:
```json
{
  "success": true,
  "shareCount": 12,
  "sharesCount": 12,
  "shares_count": 12
}
```

**에러 응답 (404)**:
```json
{
  "error": "Video not found",
  "message": "영상을 찾을 수 없습니다."
}
```

**에러 응답 (500)**:
```json
{
  "error": "Failed to update share count",
  "message": "공유 수 업데이트에 실패했습니다.",
  "details": "..."
}
```

## 🔒 중복 방지 메커니즘

### 좋아요 중복 방지

- **방식**: IP + User-Agent 기반 클라이언트 식별
- **저장**: `video_likes` 테이블에 `(video_id, client_key)` UNIQUE 제약조건
- **동작**: 같은 클라이언트가 같은 영상에 좋아요를 중복으로 누를 수 없음
- **제한**: 
  - 같은 IP + User-Agent 조합은 하나의 좋아요만 가능
  - VPN/프록시 사용 시 IP가 변경되면 중복 가능 (의도된 동작)

### 공유 중복 방지

- **현재**: 중복 방지 없음 (공유는 여러 번 가능)
- **이유**: 공유는 실제로 여러 번 발생할 수 있는 정상적인 동작

## 📊 수정된 파일 목록

### 1. server.js
- **POST /public/videos/:id/like**: 좋아요 토글 기능으로 변경
- **POST /public/videos/:id/unlike**: 좋아요 취소 엔드포인트 추가
- **POST /public/videos/:id/share**: 응답 형식 개선 (camelCase 필드 추가)

### 2. DB 스키마 (자동 생성)
- **video_likes 테이블**: 좋아요 기록 저장
- **인덱스**: `video_id`, `client_key` 인덱스 자동 생성

## 🧪 테스트 방법

### 1. 좋아요 토글 테스트

```bash
# 좋아요 추가
curl -X POST "http://localhost:8787/public/videos/{video_id}/like" \
  -H "Content-Type: application/json"

# 응답:
# {
#   "success": true,
#   "likedByMe": true,
#   "likesCount": 1,
#   "likes_count": 1
# }

# 같은 요청을 다시 보내면 좋아요 취소됨
curl -X POST "http://localhost:8787/public/videos/{video_id}/like" \
  -H "Content-Type: application/json"

# 응답:
# {
#   "success": true,
#   "likedByMe": false,
#   "likesCount": 0,
#   "likes_count": 0
# }
```

### 2. 좋아요 취소 테스트

```bash
# 좋아요 취소
curl -X POST "http://localhost:8787/public/videos/{video_id}/unlike" \
  -H "Content-Type: application/json"

# 응답:
# {
#   "success": true,
#   "likedByMe": false,
#   "likesCount": 0,
#   "likes_count": 0
# }
```

### 3. 공유 API 테스트

```bash
# 공유 수 증가
curl -X POST "http://localhost:8787/public/videos/{video_id}/share" \
  -H "Content-Type: application/json"

# 응답:
# {
#   "success": true,
#   "shareCount": 1,
#   "sharesCount": 1,
#   "shares_count": 1
# }
```

## 🔒 CORS 설정

### 허용된 Origin
- **개발 환경**:
  - `http://localhost:3000` (Next.js 홈페이지)
  - `http://localhost:5173` (Vite CMS 프론트엔드)
  - `http://127.0.0.1:3000`
  - `http://127.0.0.1:5173`

- **운영 환경**:
  - `https://www.godcomfortword.com`
  - `https://cms.godcomfortword.com`

### CORS 설정 코드
```javascript
await app.register(cors, {
  origin: (origin, cb) => {
    // localhost:3000 허용 확인됨
    if (allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "Accept", "Origin", "X-Requested-With"],
});
```

## 📌 프론트엔드 호출 경로 정리

### 현재 구현된 API 엔드포인트

| 기능 | 메서드 | 경로 | 인증 | 상태 |
|------|--------|------|------|------|
| 좋아요 토글 | POST | `/public/videos/:id/like` | 불필요 | ✅ 구현 완료 |
| 좋아요 취소 | POST | `/public/videos/:id/unlike` | 불필요 | ✅ 구현 완료 |
| 공유 증가 | POST | `/public/videos/:id/share` | 불필요 | ✅ 구현 완료 |
| 조회수 증가 | POST | `/public/videos/:id/view` | 불필요 | ✅ 기존 구현 |

### 프론트엔드 호출 예시

**홈페이지 (3000)에서 호출**:
```typescript
// 좋아요 토글
const response = await fetch(`${API_BASE_URL}/public/videos/${videoId}/like`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
});

// 좋아요 취소 (별도 엔드포인트)
const response = await fetch(`${API_BASE_URL}/public/videos/${videoId}/unlike`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
});

// 공유
const response = await fetch(`${API_BASE_URL}/public/videos/${videoId}/share`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
});
```

**API_BASE_URL**: `http://localhost:8787` (개발 환경)

## ✅ 완료 기준 달성

- [x] 좋아요 토글 API 구현 (POST /public/videos/:id/like)
- [x] 좋아요 취소 API 구현 (POST /public/videos/:id/unlike)
- [x] 공유 API 개선 (POST /public/videos/:id/share)
- [x] 중복 방지 메커니즘 구현 (IP + User-Agent 기반)
- [x] 응답 형식 개선 (camelCase + snake_case 호환성)
- [x] CORS 설정 확인 (localhost:3000 허용)
- [x] 에러 처리 강화 (명확한 메시지)

## 📌 주의사항

1. **중복 방지 제한**: IP + User-Agent 기반이므로, 같은 네트워크의 여러 사용자가 같은 IP를 공유하면 중복 방지가 제한적일 수 있습니다. 향후 개선 시 쿠키 기반 또는 로그인 사용자 기반으로 확장 가능합니다.

2. **좋아요 토글**: `/public/videos/:id/like`는 토글 방식이므로, 이미 좋아요가 있으면 취소되고, 없으면 추가됩니다.

3. **프론트엔드 호환성**: 프론트엔드는 `likesCount`, `sharesCount` (camelCase)와 `likes_count`, `shares_count` (snake_case) 모두 지원하므로, 두 형식 모두 반환합니다.

## ✅ 최종 확인

모든 요구사항이 완료되었으며, public 영상에 대한 좋아요/공유 API가 정상적으로 동작합니다:
- 좋아요 토글 API 구현 완료
- 좋아요 취소 API 구현 완료
- 공유 API 개선 완료
- 중복 방지 메커니즘 구현 완료
- CORS 설정 확인 완료
- 프론트엔드 호출 경로 정리 완료

























