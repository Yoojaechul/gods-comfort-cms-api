# Video API 테스트 명령어

## 1. 영상 생성 (POST /creator/videos)

### 요구사항 확인
- ✅ `management_id`가 자동 생성됨 (YYMMDD-01 형식, 서울시간 기준)
- ✅ 프론트 호환 필드 포함 (youtube_id, source_url, url)

### 테스트 명령어

```bash
# 1. 로그인하여 JWT 토큰 획득
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "creator@example.com",
    "password": "password123"
  }'

# 응답에서 token 추출 후 아래 명령어에 사용

# 2. 영상 생성 (YouTube)
curl -X POST http://localhost:3000/creator/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "sourceType": "youtube",
    "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "테스트 영상",
    "language": "ko",
    "status": "active",
    "visibility": "public"
  }'

# 3. 영상 생성 (Facebook)
curl -X POST http://localhost:3000/creator/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "sourceType": "facebook",
    "sourceUrl": "https://www.facebook.com/videos/123456789",
    "title": "Facebook 테스트 영상",
    "language": "ko",
    "status": "active",
    "visibility": "public"
  }'

# 예상 응답:
# {
#   "video": {
#     "id": "...",
#     "management_id": "250115-01",  // 자동 생성됨
#     "youtube_id": "dQw4w9WgXcQ",     // 프론트 호환 필드
#     "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
#     "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  // null이면 youtube_url로 채움
#     "view_count": 0,
#     "views": 0,  // alias
#     ...
#   }
# }
```

## 2. Creator 영상 목록 조회 (GET /creator/videos)

### 요구사항 확인
- ✅ 프론트 호환 필드 포함 (youtube_id, source_url, url)
- ✅ view_count / views 일관성 유지

### 테스트 명령어

```bash
# Creator 영상 목록 조회
curl -X GET "http://localhost:3000/creator/videos?site_id=gods" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 예상 응답:
# {
#   "videos": [
#     {
#       "id": "...",
#       "management_id": "250115-01",
#       "youtube_id": "dQw4w9WgXcQ",
#       "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
#       "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
#       "view_count": 0,
#       "views": 0,
#       ...
#     }
#   ]
# }
```

## 3. Creator 영상 단건 조회 (GET /creator/videos/:id)

### 요구사항 확인
- ✅ id 또는 management_id로 조회 가능
- ✅ 프론트 호환 필드 포함

### 테스트 명령어

```bash
# ID로 조회
curl -X GET "http://localhost:3000/creator/videos/VIDEO_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# management_id로 조회
curl -X GET "http://localhost:3000/creator/videos/250115-01" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 예상 응답:
# {
#   "id": "...",
#   "management_id": "250115-01",
#   "youtube_id": "dQw4w9WgXcQ",
#   "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
#   "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
#   "view_count": 0,
#   "views": 0,
#   ...
# }
```

## 4. 공개 영상 목록 조회 (GET /public/videos)

### 요구사항 확인
- ✅ site_id, language 필터 지원
- ✅ status/published 조건 점검
- ✅ url 필드가 null인 경우 처리

### 테스트 명령어

```bash
# 기본 조회
curl -X GET "http://localhost:3000/public/videos"

# language 필터
curl -X GET "http://localhost:3000/public/videos?language=ko"

# platform 필터
curl -X GET "http://localhost:3000/public/videos?platform=youtube"

# site_id 필터
curl -X GET "http://localhost:3000/public/videos?site_id=gods"

# 복합 필터
curl -X GET "http://localhost:3000/public/videos?language=ko&platform=youtube&site_id=gods&limit=20"

# 예상 응답:
# {
#   "videos": [
#     {
#       "id": "...",
#       "management_id": "250115-01",
#       "youtube_id": "dQw4w9WgXcQ",
#       "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
#       "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  // null이면 youtube_url로 채움
#       "view_count": 0,
#       "views": 0,
#       "visibility": "public",
#       "status": "active",
#       ...
#     }
#   ]
# }
```

## 5. 공개 영상 상세 조회 (GET /public/videos/:id)

```bash
curl -X GET "http://localhost:3000/public/videos/VIDEO_ID"

# 예상 응답:
# {
#   "id": "...",
#   "management_id": "250115-01",
#   "youtube_id": "dQw4w9WgXcQ",
#   "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
#   "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
#   "view_count": 0,
#   "views": 0,
#   ...
# }
```

## 6. 영상 조회수 증가 (POST /creator/videos/:managementId/view)

```bash
curl -X POST "http://localhost:3000/creator/videos/250115-01/view" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 예상 응답:
# {
#   "viewCount": 1
# }
```

## 7. 영상 삭제 (DELETE /creator/videos/:id)

```bash
# ID로 삭제
curl -X DELETE "http://localhost:3000/creator/videos/VIDEO_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# management_id로 삭제
curl -X DELETE "http://localhost:3000/creator/videos/250115-01" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 주요 변경사항 요약

1. **management_id 자동 생성**
   - 형식: YYMMDD-01, YYMMDD-02 ... (서울시간 기준)
   - 같은 날짜 내에서 증가
   - 동시 등록에도 중복 방지 (BEGIN IMMEDIATE 트랜잭션 사용)

2. **프론트 호환 필드**
   - `youtube_id`: video_id 값 매핑
   - `source_url`: youtube_url 값 매핑
   - `url`: null이면 youtube_url로 채움
   - `view_count` / `views`: 일관성 유지

3. **홈페이지 공개 목록 API**
   - `site_id` 필터 추가
   - `status` = 'active' 조건 추가 (컬럼이 있는 경우)
   - `published` = 1 조건 추가 (컬럼이 있는 경우)
   - `url` 필드가 null인 경우 처리







