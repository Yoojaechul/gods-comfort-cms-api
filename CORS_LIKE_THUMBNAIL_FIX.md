# CORS, 좋아요 토글, 썸네일 수정 완료 보고서

## ✅ 완료 사항

### 1. CORS 에러 해결 ✅

#### 문제
- 홈페이지(3000)에서 like 호출 시 CORS 에러 (Preflight 204 후 실패)
- `X-Client-Id` 헤더가 허용되지 않음

#### 해결
- **`X-Client-Id` 헤더 추가**: `allowedHeaders`에 `"X-Client-Id"` 추가
- **CORS 설정 확인**: 
  - `http://localhost:3000` ✅ (이미 포함)
  - `http://localhost:5173` ✅ (이미 포함)
  - `credentials: true` ✅ (이미 설정)
  - `preflight: true` ✅ (이미 설정)
  - `optionsSuccessStatus: 204` ✅ (이미 설정)

#### 변경 코드
```diff
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-API-Key",
+   "X-Client-Id",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],
```

---

### 2. 좋아요 토글 수정 ✅

#### 문제
- 좋아요가 토글이 아니라 계속 올라감
- F5 시 초기화
- CMS/홈페이지 숫자 불일치

#### 해결
- **서버 DB 기준 토글**: 이미 구현되어 있음 (COUNT(*) 기반 동기화)
- **에러 응답 형식 통일**: `ok: false` 제거
- **응답 형식**: `{ liked: boolean, likeCount: number }` 유지

#### 현재 구현 상태
1. ✅ **토글 로직**: 
   - `video_like_clients` 테이블에서 기존 좋아요 확인
   - 있으면 삭제 (unlike), 없으면 추가 (like)
   - COUNT(*)로 실제 개수 계산 후 동기화

2. ✅ **사용자 식별**:
   - 우선순위: `X-Client-Id` 헤더 > `client_id` 쿠키 > 자동 생성 UUID
   - 쿠키 자동 관리 (1년 유효)

3. ✅ **중복 방지**:
   - `UNIQUE(video_id, client_id)` 제약조건
   - 같은 사용자는 동일 영상에 1번만 좋아요 가능

4. ✅ **DB 동기화**:
   - `videos.likes_count`는 항상 `video_like_clients`의 COUNT(*)로 동기화
   - 관리자 수정값도 별도로 저장 가능 (PATCH /admin/videos/:id/counters)

#### 변경 코드
```javascript
// 좋아요 토글 (이미 구현됨)
if (isLiked) {
  // 좋아요 취소
  db.prepare("DELETE FROM video_like_clients WHERE video_id = ? AND client_id = ?").run(id, clientId);
  liked = false;
} else {
  // 좋아요 추가
  const likeId = generateId();
  db.prepare("INSERT INTO video_like_clients (id, video_id, client_id) VALUES (?, ?, ?)").run(likeId, id, clientId);
  liked = true;
}

// COUNT(*)로 동기화
const actualCount = (db.prepare("SELECT COUNT(*) as count FROM video_like_clients WHERE video_id = ?").get(id) || { count: 0 }).count || 0;
db.prepare("UPDATE videos SET likes_count = ? WHERE id = ?").run(actualCount, id);

// 응답
return {
  liked: liked,
  likeCount: actualCount,
};
```

---

### 3. 썸네일 필드 추가 ✅

#### 문제
- `/public/videos` 응답에 `thumbnailUrl` 필드가 명시적으로 포함되지 않음
- 페이스북 썸네일이 사라짐

#### 해결
- **응답에 썸네일 필드 명시적 포함**: 
  - `thumbnail_url` (snake_case)
  - `thumbnailUrl` (camelCase, 호환성)

#### 변경 코드
```diff
  return {
    ...video,
    video_id: videoId,
+   // thumbnail_url 명시적으로 포함 (페이스북 썸네일 포함)
+   thumbnail_url: video.thumbnail_url || null,
+   thumbnailUrl: video.thumbnail_url || null, // camelCase 호환성
    // ... 기타 필드
  };
```

#### Bulk 등록 확인
- ✅ Bulk 등록 시 썸네일 저장 확인
  - `enrichMetadata` 함수가 자동으로 썸네일 추출
  - `metadata.thumbnail_url`이 DB에 저장됨
  - Facebook 썸네일도 포함

---

## 📋 변경 파일 목록

1. **server.js**
   - CORS `allowedHeaders`에 `X-Client-Id` 추가
   - `/public/videos` 응답에 `thumbnail_url`, `thumbnailUrl` 명시적 포함
   - 좋아요 에러 응답 형식 통일 (`ok: false` 제거)

---

## 🔧 테스트 방법

### 1. CORS 테스트

```bash
# OPTIONS 프리플라이트 테스트
curl -X OPTIONS "http://localhost:8787/public/videos/test-id/like" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Client-Id,Content-Type" \
  -v

# POST 요청 테스트
curl -X POST "http://localhost:8787/public/videos/test-id/like" \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client-123" \
  -v
```

### 2. 좋아요 토글 테스트

```bash
VIDEO_ID="your_video_id"
CLIENT_ID="test-client-$(date +%s)"

# 첫 번째 좋아요 (추가)
curl -X POST "http://localhost:8787/public/videos/$VIDEO_ID/like" \
  -H "X-Client-Id: $CLIENT_ID" \
  -H "Content-Type: application/json"

# 응답: { "liked": true, "likeCount": 1 }

# 두 번째 좋아요 (같은 client_id로 취소)
curl -X POST "http://localhost:8787/public/videos/$VIDEO_ID/like" \
  -H "X-Client-Id: $CLIENT_ID" \
  -H "Content-Type: application/json"

# 응답: { "liked": false, "likeCount": 0 }

# 세 번째 좋아요 (다시 추가)
curl -X POST "http://localhost:8787/public/videos/$VIDEO_ID/like" \
  -H "X-Client-Id: $CLIENT_ID" \
  -H "Content-Type: application/json"

# 응답: { "liked": true, "likeCount": 1 }
```

### 3. 썸네일 확인

```bash
# /public/videos 응답 확인
curl -X GET "http://localhost:8787/public/videos?site_id=gods&limit=1" | jq '.items[0] | {id, title, thumbnail_url, thumbnailUrl}'
```

---

## 🎯 프론트엔드 동기화 가이드

### 좋아요 토글

프론트엔드는 서버 응답값으로 항상 동기화해야 합니다:

```typescript
// 좋아요 API 호출
const response = await fetch(`http://localhost:8787/public/videos/${videoId}/like`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': getClientId(), // localStorage/cookie에서 가져오기
  },
  credentials: 'include', // 쿠키 포함
});

const data = await response.json();

// 서버 응답값으로 동기화 (optimistic update 후에도)
video.liked = data.liked;
video.likeCount = data.likeCount;
```

### 썸네일 표시

프론트엔드는 `thumbnail_url` 또는 `thumbnailUrl` 필드를 사용:

```typescript
const thumbnailUrl = video.thumbnail_url || video.thumbnailUrl || null;

if (thumbnailUrl) {
  // 썸네일 표시
  <img src={thumbnailUrl} alt={video.title} />
} else {
  // 썸네일 없음 처리
  <div>썸네일 없음</div>
}
```

---

## ✅ 검증 완료

1. ✅ CORS: `X-Client-Id` 헤더 허용
2. ✅ 좋아요 토글: DB 기준 동기화 확인
3. ✅ 썸네일: `/public/videos` 응답에 포함 확인
4. ✅ Bulk 등록: 썸네일 저장 확인
5. ✅ 문법 검사: 통과
6. ✅ 린터 오류: 없음

---

## 📌 참고사항

### CORS 설정

현재 CORS 설정:
- **개발 환경**: `http://localhost:3000`, `http://localhost:5173` 허용
- **운영 환경**: `https://www.godcomfortword.com`, `https://cms.godcomfortword.com` 허용
- **Credentials**: `true` (쿠키 포함)
- **Preflight**: 자동 처리 (`preflight: true`)
- **Max Age**: 24시간 (`maxAge: 86400`)

### 좋아요 토글 동작

1. **첫 클릭**: 좋아요 추가 → `liked: true, likeCount: +1`
2. **두 번째 클릭**: 좋아요 취소 → `liked: false, likeCount: -1`
3. **새로고침**: 쿠키로 `client_id` 유지 → 상태 유지
4. **관리자 수정**: `PATCH /admin/videos/:id/counters`로 직접 수정 가능

### 썸네일 필드

- **DB 필드**: `thumbnail_url` (videos 테이블)
- **응답 필드**: `thumbnail_url` (snake_case), `thumbnailUrl` (camelCase)
- **소스**: 
  - YouTube: 자동 추출
  - Facebook: `enrichMetadata`에서 추출
  - 수동 업로드: `/admin/uploads/thumbnail` 엔드포인트




