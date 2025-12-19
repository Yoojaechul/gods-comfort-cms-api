# CMS API 테스트 명령어 (curl)

## 환경 설정
- 서버 주소: `http://localhost:8787` (기본 포트)
- 테스트용 videoId: 실제 DB에 존재하는 video ID 사용

---

## 1. 좋아요 토글 API

### 1-1. 헤더로 client_id 전송 (권장 - 개발 단계)
```bash
# 첫 번째 좋아요 (추가)
curl -X POST "http://localhost:8787/public/videos/YOUR_VIDEO_ID/like" \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client-12345"

# 두 번째 호출 (같은 client_id로 취소)
curl -X POST "http://localhost:8787/public/videos/YOUR_VIDEO_ID/like" \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client-12345"
```

**예상 응답:**
```json
{
  "liked": true,
  "likeCount": 1
}
```
두 번째 호출 시:
```json
{
  "liked": false,
  "likeCount": 0
}
```

### 1-2. 쿠키로 client_id 자동 관리
```bash
# 첫 번째 호출 (쿠키 자동 생성)
curl -X POST "http://localhost:8787/public/videos/YOUR_VIDEO_ID/like" \
  -H "Content-Type: application/json" \
  -c cookies.txt

# 같은 쿠키로 두 번째 호출 (좋아요 취소)
curl -X POST "http://localhost:8787/public/videos/YOUR_VIDEO_ID/like" \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

### 1-3. Body 없이 호출 (400 에러 없음)
```bash
curl -X POST "http://localhost:8787/public/videos/YOUR_VIDEO_ID/like" \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client-12345"
```

---

## 2. 좋아요 취소 API (별도 엔드포인트)

```bash
curl -X POST "http://localhost:8787/public/videos/YOUR_VIDEO_ID/unlike" \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: test-client-12345"
```

**예상 응답:**
```json
{
  "liked": false,
  "likeCount": 0
}
```

---

## 3. 조회수 증가 API

```bash
# Body 없이 호출 가능
curl -X POST "http://localhost:8787/public/videos/YOUR_VIDEO_ID/view" \
  -H "Content-Type: application/json"
```

**예상 응답:**
```json
{
  "viewCount": 123
}
```

---

## 4. 공유 수 증가 API

```bash
# Body 없이 호출 가능
curl -X POST "http://localhost:8787/public/videos/YOUR_VIDEO_ID/share" \
  -H "Content-Type: application/json"
```

**예상 응답:**
```json
{
  "shareCount": 45
}
```

---

## 5. 관리자 카운터 업데이트 API

### 5-1. 인증 토큰 획득 (먼저 로그인 필요)
```bash
curl -X POST "http://localhost:8787/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

응답에서 `token` 값을 복사합니다.

### 5-2. 카운터 직접 설정
```bash
# 좋아요 수를 100으로 설정
curl -X PATCH "http://localhost:8787/admin/videos/YOUR_VIDEO_ID/counters" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "likes_count": 100,
    "views_count": 500,
    "shares_count": 25
  }'
```

**예상 응답:**
```json
{
  "success": true,
  "videoId": "YOUR_VIDEO_ID",
  "views_count": 500,
  "likes_count": 100,
  "shares_count": 25,
  "updated_at": "2024-01-01T12:00:00.000Z",
  "updated_by": "admin_user_id"
}
```

### 5-3. 부분 업데이트 (일부 필드만)
```bash
# 좋아요 수만 업데이트
curl -X PATCH "http://localhost:8787/admin/videos/YOUR_VIDEO_ID/counters" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "likes_count": 200
  }'
```

---

## 에러 응답 예시

### 400 Bad Request (잘못된 videoId)
```json
{
  "error": "Bad Request",
  "message": "videoId는 숫자, hex 문자열, 또는 UUID 형식이어야 합니다."
}
```

### 404 Not Found (영상 없음)
```json
{
  "error": "Video not found",
  "message": "영상을 찾을 수 없거나 비공개 영상입니다."
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "좋아요 처리 중 오류가 발생했습니다."
}
```

---

## 테스트 시나리오

### 시나리오 1: 좋아요 토글 테스트
```bash
VIDEO_ID="your_video_id"
CLIENT_ID="test-client-$(date +%s)"

# 1. 좋아요 추가
curl -X POST "http://localhost:8787/public/videos/$VIDEO_ID/like" \
  -H "X-Client-Id: $CLIENT_ID" \
  -H "Content-Type: application/json"

# 2. 같은 client_id로 다시 호출 (취소 확인)
curl -X POST "http://localhost:8787/public/videos/$VIDEO_ID/like" \
  -H "X-Client-Id: $CLIENT_ID" \
  -H "Content-Type: application/json"

# 3. 다른 client_id로 호출 (다른 사용자 좋아요)
curl -X POST "http://localhost:8787/public/videos/$VIDEO_ID/like" \
  -H "X-Client-Id: another-client-123" \
  -H "Content-Type: application/json"
```

### 시나리오 2: 관리자 카운터 수정 후 홈페이지 반영 확인
```bash
# 1. 관리자가 카운터 수정
curl -X PATCH "http://localhost:8787/admin/videos/$VIDEO_ID/counters" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"likes_count": 999}'

# 2. 공개 API로 확인 (홈페이지에서 조회하는 것과 동일)
curl -X GET "http://localhost:8787/public/videos/$VIDEO_ID"
```

---

## 주의사항

1. **client_id 우선순위**: `X-Client-Id` 헤더 > 쿠키 `client_id` > 자동 생성
2. **토글 동작**: 같은 `client_id`로 호출하면 좋아요 상태가 토글됨 (있으면 취소, 없으면 추가)
3. **0 미만 방지**: likes_count는 0 미만으로 내려가지 않음
4. **동기화**: 좋아요 토글 후 `videos.likes_count`가 `video_like_clients` 테이블의 실제 개수와 동기화됨
5. **관리자 수정**: 관리자가 직접 수정한 값은 `video_like_clients` 테이블과 무관하게 저장됨 (단일 소스 원칙)









