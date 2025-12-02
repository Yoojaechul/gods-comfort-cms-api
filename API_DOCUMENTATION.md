# 📚 CMS API 문서

## 목차

- [인증](#인증)
- [공용 API](#공용-api)
- [인증 공통](#인증-공통)
- [Admin 전용 API](#admin-전용-api)
- [Creator 전용 API](#creator-전용-api)

---

## 인증

### 방법 1: JWT 토큰 (이메일 로그인)
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 방법 2: API Key
```
x-api-key: abc123def456...
```

---

## 공용 API

### GET /health

서버 상태 확인

#### Request
```
GET /health
```

인증 불필요

#### Response
```json
{
  "ok": true,
  "time": "2025-12-02T09:00:00.000Z"
}
```

**필드:**
- `ok` (boolean, 필수): 서버 상태
- `time` (string, 필수): 현재 시간 (ISO 8601)

---

### GET /public/videos

공개 영상 목록 조회 (인증 불필요)

#### Request
```
GET /public/videos?site_id=gods&platform=youtube&limit=20&cursor=2025-12-02T08:00:00
```

**Query Parameters:**
- `site_id` (string, **필수**): 사이트 ID
- `platform` (string, 선택): 플랫폼 필터 (`youtube`, `facebook`, `other`)
- `limit` (integer, 선택): 개수 제한 (기본: 20, 최대: 100)
- `cursor` (string, 선택): 페이지네이션 커서 (created_at 값)

#### Response
```json
{
  "videos": [
    {
      "id": "abc123def456",
      "site_id": "gods",
      "owner_id": "user123",
      "platform": "youtube",
      "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "title": "Rick Astley - Never Gonna Give You Up",
      "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "visibility": "public",
      "created_at": "2025-12-02 09:30:00",
      "updated_at": "2025-12-02 09:30:00",
      "owner_name": "John Doe"
    }
  ],
  "cursor": "2025-12-02 09:30:00"
}
```

**응답 필드:**

`videos` (array, 필수):
- `id` (string, 필수): 영상 ID
- `site_id` (string, 필수): 사이트 ID
- `owner_id` (string, 필수): 작성자 ID
- `platform` (string, 필수): 플랫폼 (`youtube`, `facebook`, `other`)
- `source_url` (string, 필수): 원본 URL
- `title` (string, nullable): 제목
- `thumbnail_url` (string, nullable): 썸네일 URL
- `embed_url` (string, nullable): Embed URL (iframe src용)
- `visibility` (string, 필수): 공개 여부 (`public`, `private`)
- `created_at` (string, 필수): 생성 시간
- `updated_at` (string, 필수): 수정 시간
- `owner_name` (string, nullable): 작성자 이름

`cursor` (string, nullable): 다음 페이지 커서

---

## 인증 공통

### POST /auth/login

이메일/비밀번호 로그인

#### Request
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**필드:**
- `email` (string, **필수**): 이메일
- `password` (string, **필수**): 비밀번호

#### Response (성공)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFiYzEyMyIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsInJvbGUiOiJjcmVhdG9yIiwic2l0ZV9pZCI6ImdvZHMiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAxMDgwMH0.signature",
  "expiresAt": 1700010800000,
  "user": {
    "id": "abc123def456",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "creator",
    "site_id": "gods"
  }
}
```

**필드:**
- `token` (string, 필수): JWT 토큰 (3시간 유효)
- `expiresAt` (integer, 필수): 만료 시간 (Unix timestamp, 밀리초)
- `user` (object, 필수): 사용자 정보
  - `id` (string): 사용자 ID
  - `name` (string): 이름
  - `email` (string): 이메일
  - `role` (string): 역할 (`admin`, `creator`)
  - `site_id` (string, nullable): 사이트 ID

#### Response (실패)
```json
{
  "error": "Invalid email or password"
}
```

---

### GET /me

현재 로그인한 사용자 정보

#### Request
```
GET /me
Authorization: Bearer {token}
또는
x-api-key: {api_key}
```

#### Response
```json
{
  "id": "abc123def456",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "creator",
  "status": "active",
  "site_id": "gods",
  "site": {
    "id": "gods",
    "name": "Gods Site",
    "created_at": "2025-12-02 09:00:00"
  }
}
```

**필드:**
- `id` (string, 필수): 사용자 ID
- `name` (string, 필수): 이름
- `email` (string, nullable): 이메일
- `role` (string, 필수): 역할
- `status` (string, 필수): 상태 (`active`, `suspended`)
- `site_id` (string, nullable): 사이트 ID
- `site` (object, nullable): 사이트 정보

---

## Admin 전용 API

### POST /admin/sites

사이트 생성

#### Request
```json
{
  "id": "gods",
  "name": "Gods Site"
}
```

**필드:**
- `id` (string, **필수**): 사이트 ID (고유값)
- `name` (string, **필수**): 사이트 이름

**인증:** Admin API Key 또는 Admin JWT 필요

#### Response (성공)
```json
{
  "id": "gods",
  "name": "Gods Site"
}
```

#### Response (실패 - 중복)
```json
{
  "error": "Site ID already exists"
}
```

---

### GET /admin/sites

사이트 목록 조회

#### Request
```
GET /admin/sites
x-api-key: {admin_api_key}
```

**인증:** Admin API Key 또는 Admin JWT 필요

#### Response
```json
{
  "sites": [
    {
      "id": "gods",
      "name": "Gods Site",
      "created_at": "2025-12-02 09:00:00"
    },
    {
      "id": "site2",
      "name": "Another Site",
      "created_at": "2025-12-02 10:00:00"
    }
  ]
}
```

**필드:**
- `sites` (array, 필수): 사이트 목록
  - `id` (string): 사이트 ID
  - `name` (string): 사이트 이름
  - `created_at` (string): 생성 시간

---

### POST /admin/creators

Creator 생성

#### Request
```json
{
  "site_id": "gods",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**필드:**
- `site_id` (string, **필수**): 사이트 ID
- `name` (string, **필수**): Creator 이름
- `email` (string, 선택): 이메일 (이메일 로그인용)
- `password` (string, 선택): 비밀번호 (이메일 로그인용, 최소 8자)

**주의:** 
- `email`과 `password`는 둘 다 입력하거나 둘 다 비워야 함
- 비워두면 API Key만 사용 가능

**인증:** Admin API Key 또는 Admin JWT 필요

#### Response (성공)
```json
{
  "id": "creator123abc",
  "site_id": "gods",
  "name": "John Doe",
  "email": "john@example.com",
  "api_key": "abc123def456789...xyz"
}
```

**필드:**
- `id` (string, 필수): Creator ID
- `site_id` (string, 필수): 사이트 ID
- `name` (string, 필수): 이름
- `email` (string, nullable): 이메일
- `api_key` (string, 필수): API Key (평문, **1회만 표시**)

#### Response (실패 - 이메일 중복)
```json
{
  "error": "Email already exists"
}
```

---

### GET /admin/creators

Creator 목록 조회

#### Request
```
GET /admin/creators?site_id=gods
x-api-key: {admin_api_key}
```

**Query Parameters:**
- `site_id` (string, 선택): 사이트 ID 필터

**인증:** Admin API Key 또는 Admin JWT 필요

#### Response
```json
{
  "creators": [
    {
      "id": "creator123abc",
      "site_id": "gods",
      "name": "John Doe",
      "role": "creator",
      "status": "active",
      "created_at": "2025-12-02 09:15:00"
    }
  ]
}
```

**필드:**
- `creators` (array, 필수): Creator 목록
  - `id` (string): Creator ID
  - `site_id` (string): 사이트 ID
  - `name` (string): 이름
  - `role` (string): 역할 (항상 `creator`)
  - `status` (string): 상태 (`active`, `suspended`)
  - `created_at` (string): 생성 시간

---

### PATCH /admin/creators/:id

Creator 정보 수정

#### Request
```json
{
  "status": "suspended",
  "name": "John Doe (Updated)"
}
```

**Path Parameters:**
- `id` (string, **필수**): Creator ID

**Body 필드:**
- `status` (string, 선택): 상태 (`active`, `suspended`)
- `name` (string, 선택): 이름

**인증:** Admin API Key 또는 Admin JWT 필요

#### Response (성공)
```json
{
  "id": "creator123abc",
  "site_id": "gods",
  "name": "John Doe (Updated)",
  "role": "creator",
  "status": "suspended",
  "created_at": "2025-12-02 09:15:00"
}
```

---

### POST /admin/creators/:id/rotate-key

Creator API Key 재발급

#### Request
```
POST /admin/creators/creator123abc/rotate-key
x-api-key: {admin_api_key}
```

**Path Parameters:**
- `id` (string, **필수**): Creator ID

**인증:** Admin API Key 또는 Admin JWT 필요

#### Response
```json
{
  "id": "creator123abc",
  "api_key": "new_abc123def456789...xyz"
}
```

**필드:**
- `id` (string, 필수): Creator ID
- `api_key` (string, 필수): 새 API Key (평문, **1회만 표시**)

---

## Creator 전용 API

### GET /videos

내 영상 목록 조회

#### Request
```
GET /videos?site_id=gods
Authorization: Bearer {token}
또는
x-api-key: {creator_api_key}
```

**Query Parameters:**
- `site_id` (string, 선택): 사이트 ID (Creator는 자기 site_id로 강제됨)

**인증:** Creator JWT 또는 Creator API Key 필요

#### Response
```json
{
  "videos": [
    {
      "id": "video123abc",
      "site_id": "gods",
      "owner_id": "creator123abc",
      "platform": "youtube",
      "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "title": "Rick Astley - Never Gonna Give You Up",
      "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "visibility": "public",
      "created_at": "2025-12-02 09:30:00",
      "updated_at": "2025-12-02 09:30:00"
    }
  ]
}
```

**필드:**
- `videos` (array, 필수): 영상 목록 (본인 소유만)
  - `id` (string): 영상 ID
  - `site_id` (string): 사이트 ID
  - `owner_id` (string): 작성자 ID
  - `platform` (string): 플랫폼
  - `source_url` (string): 원본 URL
  - `title` (string, nullable): 제목
  - `thumbnail_url` (string, nullable): 썸네일 URL
  - `embed_url` (string, nullable): Embed URL
  - `visibility` (string): 공개 여부
  - `created_at` (string): 생성 시간
  - `updated_at` (string): 수정 시간

---

### POST /videos

영상 등록

#### Request
```json
{
  "platform": "youtube",
  "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "My Custom Title",
  "thumbnail_url": "https://example.com/thumb.jpg",
  "visibility": "public"
}
```

**필드:**
- `platform` (string, **필수**): 플랫폼 (`youtube`, `facebook`, `other`)
- `source_url` (string, **필수**): 원본 영상 URL
- `title` (string, 선택): 제목 (비우면 자동 생성 시도)
- `thumbnail_url` (string, 선택): 썸네일 URL (비우면 자동 생성 시도)
- `visibility` (string, 선택): 공개 여부 (기본: `public`)

**인증:** Creator JWT 또는 Creator API Key 필요

**자동 생성 규칙:**
- **YouTube**: `title`, `thumbnail_url`, `embed_url` 자동 생성
- **Facebook**: `embed_url`만 자동 생성
- 사용자 입력값이 있으면 우선 적용

#### Response (성공)
```json
{
  "id": "video123abc",
  "site_id": "gods",
  "owner_id": "creator123abc",
  "platform": "youtube",
  "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "visibility": "public",
  "created_at": "2025-12-02 09:30:00",
  "updated_at": "2025-12-02 09:30:00"
}
```

---

### PATCH /videos/:id

영상 수정

#### Request
```json
{
  "title": "Updated Title",
  "thumbnail_url": "https://example.com/new-thumb.jpg",
  "visibility": "private"
}
```

**Path Parameters:**
- `id` (string, **필수**): 영상 ID

**Body 필드:** (모두 선택, 최소 1개 필요)
- `platform` (string, 선택): 플랫폼
- `source_url` (string, 선택): 원본 URL
- `title` (string, 선택): 제목
- `thumbnail_url` (string, 선택): 썸네일 URL
- `visibility` (string, 선택): 공개 여부

**인증:** Creator JWT 또는 Creator API Key 필요
**권한:** 본인 소유 영상만 수정 가능

#### Response (성공)
```json
{
  "id": "video123abc",
  "site_id": "gods",
  "owner_id": "creator123abc",
  "platform": "youtube",
  "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Updated Title",
  "thumbnail_url": "https://example.com/new-thumb.jpg",
  "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "visibility": "private",
  "created_at": "2025-12-02 09:30:00",
  "updated_at": "2025-12-02 10:00:00"
}
```

#### Response (실패 - 권한 없음)
```json
{
  "error": "Video not found or access denied"
}
```

---

### DELETE /videos/:id

영상 삭제

#### Request
```
DELETE /videos/video123abc
Authorization: Bearer {token}
또는
x-api-key: {creator_api_key}
```

**Path Parameters:**
- `id` (string, **필수**): 영상 ID

**인증:** Creator JWT 또는 Creator API Key 필요
**권한:** 본인 소유 영상만 삭제 가능

#### Response (성공)
```json
{
  "success": true
}
```

#### Response (실패)
```json
{
  "error": "Video not found or access denied"
}
```

---

### GET /my/provider-keys

내 플랫폼 키 목록 조회

#### Request
```
GET /my/provider-keys
Authorization: Bearer {token}
또는
x-api-key: {creator_api_key}
```

**인증:** Creator JWT 또는 Creator API Key 필요

#### Response
```json
{
  "keys": [
    {
      "id": "key123abc",
      "user_id": "creator123abc",
      "provider": "youtube",
      "key_name": "api_key",
      "key_value": "AIzaSyABC123DEF456...",
      "created_at": "2025-12-02 09:00:00",
      "updated_at": "2025-12-02 09:00:00"
    },
    {
      "id": "key456def",
      "user_id": "creator123abc",
      "provider": "facebook",
      "key_name": "access_token",
      "key_value": "EAABwzLixnjYBO...",
      "created_at": "2025-12-02 09:05:00",
      "updated_at": "2025-12-02 09:05:00"
    }
  ]
}
```

**필드:**
- `keys` (array, 필수): 플랫폼 키 목록
  - `id` (string): 키 ID
  - `user_id` (string): 사용자 ID
  - `provider` (string): 플랫폼 (`youtube`, `facebook`, `other`)
  - `key_name` (string): 키 이름 (예: `api_key`, `access_token`)
  - `key_value` (string): 키 값 (평문 저장)
  - `created_at` (string): 생성 시간
  - `updated_at` (string): 수정 시간

---

### PUT /my/provider-keys

플랫폼 키 저장/수정 (Upsert)

#### Request
```json
{
  "provider": "youtube",
  "key_name": "api_key",
  "key_value": "AIzaSyABC123DEF456..."
}
```

**필드:**
- `provider` (string, **필수**): 플랫폼 (`youtube`, `facebook`, `other`)
- `key_name` (string, **필수**): 키 이름
- `key_value` (string, **필수**): 키 값

**인증:** Creator JWT 또는 Creator API Key 필요

**동작:**
- 같은 `provider` + `key_name` 조합이 있으면 **업데이트**
- 없으면 **새로 생성**

#### Response (생성)
```json
{
  "id": "key123abc",
  "user_id": "creator123abc",
  "provider": "youtube",
  "key_name": "api_key",
  "key_value": "AIzaSyABC123DEF456...",
  "created_at": "2025-12-02 09:00:00",
  "updated_at": "2025-12-02 09:00:00"
}
```

#### Response (업데이트)
```json
{
  "id": "key123abc",
  "user_id": "creator123abc",
  "provider": "youtube",
  "key_name": "api_key",
  "key_value": "AIzaSyNEW_KEY_VALUE...",
  "created_at": "2025-12-02 09:00:00",
  "updated_at": "2025-12-02 10:30:00"
}
```

---

### DELETE /my/provider-keys/:id

플랫폼 키 삭제

#### Request
```
DELETE /my/provider-keys/key123abc
Authorization: Bearer {token}
또는
x-api-key: {creator_api_key}
```

**Path Parameters:**
- `id` (string, **필수**): 키 ID

**인증:** Creator JWT 또는 Creator API Key 필요
**권한:** 본인 소유 키만 삭제 가능

#### Response (성공)
```json
{
  "success": true
}
```

#### Response (실패)
```json
{
  "error": "Key not found or access denied"
}
```

---

## 에러 응답 형식

모든 에러는 다음 형식으로 반환됩니다:

```json
{
  "error": "Error message here"
}
```

### 일반적인 HTTP 상태 코드

- `200 OK`: 성공
- `400 Bad Request`: 잘못된 요청 (필수 필드 누락, 유효성 검증 실패)
- `401 Unauthorized`: 인증 실패 (API Key/토큰 없음 또는 유효하지 않음)
- `403 Forbidden`: 권한 없음 (Admin 전용 API를 Creator가 호출)
- `404 Not Found`: 리소스 없음
- `409 Conflict`: 중복 (이메일, 사이트 ID 등)
- `500 Internal Server Error`: 서버 오류

---

## 페이지네이션

### Cursor 기반 페이지네이션

`/public/videos` 엔드포인트는 cursor 기반 페이지네이션을 지원합니다.

#### 첫 페이지
```
GET /public/videos?site_id=gods&limit=20
```

#### 다음 페이지
응답의 `cursor` 값을 사용:
```
GET /public/videos?site_id=gods&limit=20&cursor=2025-12-02 09:30:00
```

`cursor`가 `null`이면 마지막 페이지입니다.

---

## 메타정보 자동 생성

### YouTube

**지원 URL 형식:**
- `https://www.youtube.com/watch?v=VIDEOID`
- `https://youtu.be/VIDEOID`
- `https://www.youtube.com/shorts/VIDEOID`

**자동 생성:**
- ✅ `title`: YouTube oEmbed API로 가져오기
- ✅ `thumbnail_url`: `https://img.youtube.com/vi/VIDEOID/hqdefault.jpg`
- ✅ `embed_url`: `https://www.youtube.com/embed/VIDEOID`

### Facebook

**지원 URL 형식:**
- `https://www.facebook.com/watch/?v=123456789`
- `https://www.facebook.com/username/videos/123456789`

**자동 생성:**
- ✅ `embed_url`: Facebook 플러그인 URL
- ❌ `title`: 수동 입력 필요
- ❌ `thumbnail_url`: 수동 입력 필요

**주의:** `/share/v/xxxxx/` 형식은 embed 불가

---

## 사용 예제

### JavaScript (Fetch API)

```javascript
// 공개 영상 조회
fetch('http://localhost:8787/public/videos?site_id=gods&limit=10')
  .then(r => r.json())
  .then(data => {
    data.videos.forEach(video => {
      console.log(video.title, video.embed_url);
    });
  });

// 이메일 로그인
fetch('http://localhost:8787/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'john@example.com',
    password: 'password123'
  })
})
.then(r => r.json())
.then(data => {
  localStorage.setItem('token', data.token);
  console.log('로그인 성공:', data.user);
});

// JWT로 영상 등록
fetch('http://localhost:8787/videos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    platform: 'youtube',
    source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    visibility: 'public'
  })
})
.then(r => r.json())
.then(console.log);
```

### cURL

```bash
# 공개 영상 조회
curl "http://localhost:8787/public/videos?site_id=gods&limit=10"

# 이메일 로그인
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'

# JWT로 영상 등록
curl -X POST http://localhost:8787/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "platform":"youtube",
    "source_url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "visibility":"public"
  }'

# API Key로 영상 등록
curl -X POST http://localhost:8787/videos \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "platform":"youtube",
    "source_url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "visibility":"public"
  }'
```

---

## 보안 고려사항

1. **JWT 토큰**: 3시간 후 자동 만료
2. **API Key**: 만료 없음, 재발급으로만 무효화
3. **비밀번호**: scrypt 해싱으로 저장
4. **CORS**: 설정된 도메인만 허용
5. **권한**: Creator는 자기 데이터만 접근

---

## 라이선스

ISC

