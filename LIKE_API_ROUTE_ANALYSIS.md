# 좋아요 API 라우트 분석 및 Next.js 연동 가이드

## 📋 CMS API(8788) 좋아요 라우트 분석

### 1. 라우트 정보

**엔드포인트**: `POST /public/videos/:id/like`

**위치**: `server.js:377`

**구현 코드**:
```javascript
app.post("/public/videos/:id/like", async (request, reply) => {
  const routeName = "POST /public/videos/:id/like";
  const { id } = request.params;
  // ...
})
```

---

### 2. Video 식별자 규격 분석

#### ✅ CMS API가 사용하는 식별자: **`videos.id` (Primary Key)**

**DB 쿼리 확인** (server.js:422):
```javascript
video = db.prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'").get(id);
```

**결론**: 
- CMS API의 좋아요 라우트는 **`videos` 테이블의 Primary Key인 `id` 컬럼**을 사용합니다.
- 이는 **hex 문자열** 형식입니다 (예: `a1b2c3d4e5f67890abcdef1234567890`).

#### 📊 Videos 테이블 구조

```sql
CREATE TABLE videos (
  id TEXT PRIMARY KEY,                    -- ✅ 좋아요 API가 사용하는 식별자
  management_id TEXT UNIQUE,              -- 관리번호 (YYMMDD-001 형식)
  video_id TEXT,                          -- 플랫폼별 비디오 ID (YouTube, Facebook 등)
  site_id TEXT,
  owner_id TEXT,
  platform TEXT,
  source_url TEXT,
  title TEXT,
  thumbnail_url TEXT,
  -- ... 기타 필드
)
```

**ID 형식별 설명**:

| 필드 | 타입 | 형식 | 용도 | 좋아요 API 사용 여부 |
|------|------|------|------|---------------------|
| `id` | TEXT PRIMARY KEY | hex 문자열 (32자) | Primary Key | ✅ **사용** |
| `management_id` | TEXT UNIQUE | YYMMDD-001 | 관리번호 | ❌ 사용 안 함 |
| `video_id` | TEXT | 플랫폼별 ID | YouTube/Facebook ID | ❌ 사용 안 함 |

---

### 3. ID 형식 검증 규칙

CMS API는 다음 형식을 모두 허용합니다 (server.js:402-414):

```javascript
// ID 형식 검증 (숫자, hex 문자열, UUID 모두 허용)
const trimmedId = id.trim();
const isNumeric = /^\d+$/.test(trimmedId);        // 숫자: "12345"
const isHexString = /^[a-fA-F0-9]+$/.test(trimmedId);  // hex: "a1b2c3d4e5f6..."
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);  // UUID: "550e8400-e29b-41d4-a716-446655440000"

if (!isNumeric && !isHexString && !isUuid) {
  return reply.code(400).send({ 
    error: "Bad Request", 
    message: "videoId는 숫자, hex 문자열, 또는 UUID 형식이어야 합니다.",
  });
}
```

**하지만 실제 DB 조회는**:
```javascript
video = db.prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'").get(id);
```
- 이 쿼리는 **`videos.id` 컬럼(Primary Key, hex 문자열)**과만 매칭됩니다.
- 숫자나 UUID 형식으로 요청해도, 실제 `videos.id`가 hex 문자열이면 매칭되지 않습니다.

---

### 4. /public/videos 응답 구조

**엔드포인트**: `GET /public/videos?site_id=gods&limit=20`

**응답 예시** (server.js:280-298):
```json
{
  "items": [
    {
      "id": "a1b2c3d4e5f67890abcdef1234567890",  // ✅ Primary Key (hex 문자열) - 좋아요 API에 사용
      "managementId": "251216-001",              // 관리번호 (YYMMDD-001 형식)
      "management_id": "251216-001",
      "video_id": "dQw4w9WgXcQ",                // YouTube/Facebook 비디오 ID
      "title": "영상 제목",
      "thumbnail_url": "https://...",
      "likes_count": 42,
      "views_count": 1000,
      "shares_count": 10,
      // ... 기타 필드
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

**중요**: 
- 좋아요 API는 **`id` 필드 (Primary Key)**를 사용합니다.
- `managementId`나 `video_id`가 아닙니다.

---

## 🔧 Next.js(3000) /api/videos/:id/like 수정 가이드

### 현재 상황 추정

Next.js의 `/api/videos/:id/like`가 다음과 같은 경우일 수 있습니다:

1. ❌ `management_id`를 사용하는 경우
2. ❌ `video_id`를 사용하는 경우  
3. ❌ 숫자형 ID를 사용하는 경우
4. ✅ `id` (Primary Key, hex 문자열)를 사용하는 경우 (정상)

### 수정 포인트

#### 1️⃣ Next.js API 라우트 위치 확인

Next.js 프로젝트에서 다음 파일을 확인하세요:
- `pages/api/videos/[id]/like.ts` (또는 `.js`)
- `app/api/videos/[id]/route.ts` (App Router 사용 시)

#### 2️⃣ CMS API 호출 부분 수정

**현재 코드 예시 (잘못된 경우)**:
```typescript
// ❌ 잘못된 예: management_id를 사용하는 경우
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;  // management_id를 받음 (예: "251216-001")
  
  const response = await fetch(`http://localhost:8787/public/videos/${id}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': getClientId(),
    },
    credentials: 'include',
  });
  
  // ...
}
```

**수정된 코드 (올바른 경우)**:
```typescript
// ✅ 올바른 예: videos.id (Primary Key)를 사용
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;  // videos.id (hex 문자열)를 받음 (예: "a1b2c3d4e5f67890abcdef1234567890")
  
  // ID 형식 검증 (선택사항)
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Video ID is required' });
  }
  
  const response = await fetch(`http://localhost:8787/public/videos/${id}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': getClientId(), // localStorage/cookie에서 가져오기
    },
    credentials: 'include', // 쿠키 포함
  });
  
  if (!response.ok) {
    const error = await response.json();
    return res.status(response.status).json(error);
  }
  
  const data = await response.json();
  return res.status(200).json(data);  // { liked: boolean, likeCount: number }
}
```

#### 3️⃣ 홈페이지에서 좋아요 호출 시 ID 확인

**프론트엔드에서 영상 목록을 가져올 때**:
```typescript
// GET /public/videos 응답에서 id 사용
const videos = await fetch('http://localhost:8787/public/videos?site_id=gods&limit=20')
  .then(res => res.json())
  .then(data => data.items);

// 좋아요 버튼 클릭 시
const handleLike = async (videoId: string) => {  // ✅ video.id 사용
  const response = await fetch(`/api/videos/${videoId}/like`, {  // Next.js API 라우트 호출
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  
  const data = await response.json();
  // data: { liked: boolean, likeCount: number }
};
```

**중요**: 
- `video.id`를 사용해야 합니다 (Primary Key, hex 문자열).
- `video.managementId`나 `video.video_id`를 사용하지 마세요.

---

## 🧪 테스트 방법

### 1. CMS API 직접 테스트

```bash
# 1. 영상 목록 조회하여 id 확인
curl "http://localhost:8787/public/videos?site_id=gods&limit=1" | jq '.items[0].id'

# 출력 예시:
# "a1b2c3d4e5f67890abcdef1234567890"

# 2. 해당 id로 좋아요 API 호출
curl -X POST "http://localhost:8787/public/videos/a1b2c3d4e5f67890abcdef1234567890/like" \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client-123" \
  -v

# 응답 예시:
# { "liked": true, "likeCount": 1 }
```

### 2. Next.js API 라우트 테스트

```bash
# Next.js API 라우트를 통해 호출
curl -X POST "http://localhost:3000/api/videos/a1b2c3d4e5f67890abcdef1234567890/like" \
  -H "Content-Type: application/json" \
  -v
```

---

## 📝 요약

### CMS API 좋아요 라우트

| 항목 | 값 |
|------|-----|
| **엔드포인트** | `POST /public/videos/:id/like` |
| **서버 포트** | 8788 |
| **사용하는 식별자** | `videos.id` (Primary Key, TEXT, hex 문자열) |
| **ID 형식** | hex 문자열 (32자, 예: `a1b2c3d4e5f67890abcdef1234567890`) |
| **응답 형식** | `{ liked: boolean, likeCount: number }` |
| **인증** | 불필요 (익명 사용자 허용) |
| **클라이언트 식별** | `X-Client-Id` 헤더 또는 `client_id` 쿠키 |

### Next.js 수정 포인트

1. ✅ **Next.js API 라우트에서 `id` 파라미터를 그대로 CMS API에 전달**
   - `id`는 반드시 `videos.id` (Primary Key, hex 문자열)여야 합니다.
   - `management_id`나 `video_id`를 사용하지 마세요.

2. ✅ **프론트엔드에서 영상 목록 조회 시 `video.id` 사용**
   - `GET /public/videos` 응답의 `items[].id` 필드를 사용합니다.

3. ✅ **CORS 설정 확인**
   - CMS API는 `http://localhost:3000`을 허용합니다.
   - `X-Client-Id` 헤더가 허용됩니다.

4. ✅ **클라이언트 ID 관리**
   - Next.js API 라우트에서 `X-Client-Id` 헤더를 CMS API로 전달하거나,
   - 쿠키(`client_id`)를 CMS API로 전달합니다.

---

## 🚨 주의사항

### ❌ 잘못된 사용 사례

```typescript
// ❌ management_id 사용 (작동하지 않음)
fetch(`/api/videos/${video.managementId}/like`)  // "251216-001"

// ❌ video_id 사용 (작동하지 않음)
fetch(`/api/videos/${video.video_id}/like`)  // "dQw4w9WgXcQ"
```

### ✅ 올바른 사용 사례

```typescript
// ✅ id (Primary Key) 사용
fetch(`/api/videos/${video.id}/like`)  // "a1b2c3d4e5f67890abcdef1234567890"
```

---

## 🔍 디버깅 팁

### 문제: 404 Not Found

**원인**: 
- `id`가 `videos.id`와 일치하지 않음
- `management_id`나 `video_id`를 사용했을 가능성

**해결**:
1. DB에서 실제 `videos.id` 확인:
   ```sql
   SELECT id, management_id, video_id, title FROM videos WHERE visibility = 'public' LIMIT 1;
   ```

2. 프론트엔드에서 사용하는 ID 확인:
   ```typescript
   console.log('Video ID:', video.id);  // ✅ 이것을 사용해야 함
   console.log('Management ID:', video.managementId);  // ❌ 사용하지 마세요
   ```

### 문제: 400 Bad Request

**원인**: 
- ID 형식이 잘못됨
- ID가 빈 문자열이거나 null

**해결**:
- ID가 hex 문자열 형식인지 확인
- ID가 존재하는지 확인

---

## 📚 참고 파일

- **CMS API 좋아요 라우트**: `server.js:377`
- **DB 스키마**: `db.js:28` (videos 테이블)
- **ID 생성 함수**: `db.js:182` (`generateId()` - hex 문자열 생성)



