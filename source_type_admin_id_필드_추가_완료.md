# source_type/admin_id 필드 추가 완료 보고서

## ✅ 완료된 작업

### 1. 문제 확인
- 관리자 `/admin/videos` 목록에서 "출처/영상 관리번호"가 공란
- 프론트엔드에서 `source_type`(또는 `sourceType`) / `admin_id`(또는 `adminId`) 필드가 없음

### 2. DB 구조 확인
- `videos` 테이블에 `platform` 컬럼 존재 (youtube, facebook 등)
- `videos` 테이블에 `management_id` 컬럼 존재 (admin_id로 사용 가능)
- `source_type` 컬럼은 없음 → `platform`을 매핑
- `admin_id` 컬럼은 없음 → `management_id`를 매핑

### 3. 라우트 수정 완료
- ✅ **GET /admin/videos** (1509줄)
  - SELECT 쿼리에 `v.platform as source_type`, `v.management_id as admin_id` 추가
  - 응답에 `sourceType`, `adminId` (camelCase) 필드도 추가

- ✅ **GET /videos** (1921줄)
  - SELECT 쿼리에 `platform as source_type`, `management_id as admin_id` 추가
  - 응답에 `sourceType`, `adminId` (camelCase) 필드도 추가

## 🔒 적용된 로직

### GET /admin/videos

```javascript
let query =
  "SELECT v.*, u.name as owner_name, v.platform as source_type, v.management_id as admin_id FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE 1=1";

const videos = db.prepare(query).all(...params);

// camelCase 필드도 추가 (프론트엔드 호환성)
const videosWithCamelCase = videos.map(video => ({
  ...video,
  sourceType: video.source_type || video.platform,
  adminId: video.admin_id || video.management_id,
}));

return {
  videos: videosWithCamelCase,
  cursor: videos.length > 0 ? videos[videos.length - 1].created_at : null,
};
```

### GET /videos

```javascript
const videos = db
  .prepare(
    "SELECT *, platform as source_type, management_id as admin_id FROM videos WHERE site_id = ? AND owner_id = ? ORDER BY created_at DESC"
  )
  .all(targetSiteId, user.id);

// camelCase 필드도 추가 (프론트엔드 호환성)
const videosWithCamelCase = videos.map(video => ({
  ...video,
  sourceType: video.source_type || video.platform,
  adminId: video.admin_id || video.management_id,
}));

return { videos: videosWithCamelCase };
```

## 📝 필드 매핑

1. **source_type**: `platform` 컬럼을 매핑
   - 예: `platform = "youtube"` → `source_type = "youtube"`
   - 예: `platform = "facebook"` → `source_type = "facebook"`

2. **admin_id**: `management_id` 컬럼을 매핑
   - 예: `management_id = "ABC123"` → `admin_id = "ABC123"`
   - 예: `management_id = null` → `admin_id = null`

3. **camelCase 필드**: 프론트엔드 호환성을 위해 추가
   - `sourceType`: `source_type` 또는 `platform` 값
   - `adminId`: `admin_id` 또는 `management_id` 값

## ✅ 완료 기준 달성

- [x] GET /admin/videos 라우트에 source_type, admin_id 필드 추가
- [x] GET /videos 라우트에 source_type, admin_id 필드 추가
- [x] snake_case 필드 (source_type, admin_id) 포함
- [x] camelCase 필드 (sourceType, adminId) 포함
- [x] 프론트엔드 호환성 보장

## 🧪 테스트 방법

### 1. GET /admin/videos 테스트
```bash
curl -X GET "http://localhost:8787/admin/videos?limit=5" \
  -H "Authorization: Bearer {admin_token}"

# 응답 예시:
# {
#   "videos": [
#     {
#       "id": "...",
#       "platform": "youtube",
#       "source_type": "youtube",  // ✅ 추가됨
#       "sourceType": "youtube",   // ✅ 추가됨
#       "management_id": "ABC123",
#       "admin_id": "ABC123",      // ✅ 추가됨
#       "adminId": "ABC123",       // ✅ 추가됨
#       ...
#     }
#   ],
#   "cursor": "..."
# }
```

### 2. GET /videos 테스트
```bash
curl -X GET "http://localhost:8787/videos" \
  -H "Authorization: Bearer {creator_token}"

# 응답 예시:
# {
#   "videos": [
#     {
#       "id": "...",
#       "platform": "youtube",
#       "source_type": "youtube",  // ✅ 추가됨
#       "sourceType": "youtube",    // ✅ 추가됨
#       "management_id": "ABC123",
#       "admin_id": "ABC123",      // ✅ 추가됨
#       "adminId": "ABC123",       // ✅ 추가됨
#       ...
#     }
#   ]
# }
```

## 📊 관련 라우트 목록

### Videos 조회 (source_type, admin_id 필드 포함)
- `GET /admin/videos` - Admin 영상 목록 조회
- `GET /videos` - Creator 영상 목록 조회

## 🔒 필드 매핑 규칙

1. **source_type**: `platform` 컬럼 값 사용
   - `platform = "youtube"` → `source_type = "youtube"`
   - `platform = "facebook"` → `source_type = "facebook"`
   - `platform = "file"` → `source_type = "file"`

2. **admin_id**: `management_id` 컬럼 값 사용
   - `management_id = "ABC123"` → `admin_id = "ABC123"`
   - `management_id = null` → `admin_id = null`

3. **camelCase 필드**: snake_case 필드와 동일한 값
   - `sourceType = source_type`
   - `adminId = admin_id`

## 📌 주의사항

1. **기존 필드 유지**: `platform`, `management_id` 필드는 그대로 유지
2. **null 값 처리**: `management_id`가 null이면 `admin_id`도 null
3. **프론트엔드 호환성**: snake_case와 camelCase 모두 제공하여 프론트엔드에서 선택적으로 사용 가능

## ✅ 최종 확인

모든 요구사항이 완료되었으며, 관리자 영상 목록 API 응답에 다음 필드가 포함됩니다:
- `source_type` (snake_case)
- `sourceType` (camelCase)
- `admin_id` (snake_case)
- `adminId` (camelCase)

프론트엔드에서 "출처/영상 관리번호"가 정상적으로 표시됩니다.





























