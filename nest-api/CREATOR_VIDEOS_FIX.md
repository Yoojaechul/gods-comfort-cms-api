# POST /creator/videos 라우트 추가 완료

## 📋 변경 사항 요약

### 1. 확인 완료
- ✅ `src/app.module.ts`에 `VideosModule`이 이미 `imports`에 포함되어 있음
- ✅ `src/videos/videos.module.ts`에 `CreatorVideosController`가 이미 등록되어 있음
- ✅ `src/videos/videos.controller.ts`에 `@Get('videos')` 엔드포인트가 이미 존재함

### 2. 추가된 내용
- ✅ `src/videos/dto/create-video.dto.ts` - 영상 생성 DTO 생성
- ✅ `src/videos/videos.service.ts` - `createCreatorVideo()` 메서드 추가
- ✅ `src/videos/videos.controller.ts` - `@Post('videos')` 엔드포인트 추가

## 📁 변경된 파일 목록

1. **`src/videos/dto/create-video.dto.ts`** (신규 생성)
   - `CreateVideoDto` 클래스 정의
   - 필수 필드: `sourceType`, `sourceUrl`
   - 선택 필드: `title`, `thumbnailUrl`, `language`, `status`, `visibility`, `site_id`

2. **`src/videos/videos.service.ts`** (수정)
   - `createCreatorVideo()` 메서드 추가
   - YouTube/Facebook video ID 추출
   - embed_url 자동 생성
   - YouTube 썸네일 자동 생성

3. **`src/videos/videos.controller.ts`** (수정)
   - `CreateVideoDto` import 추가
   - `BadRequestException` import 추가
   - `@Post('videos')` 엔드포인트 추가
   - JWT 인증 가드 적용
   - creator/admin 역할 검증

## 🧪 로컬 테스트

### 1. 서버 실행

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"
npm run start:prod
```

### 2. 라우트 존재 확인 (404가 나오면 안됨)

```powershell
# 빈 body로 테스트 (400 또는 401이 나와야 함, 404가 아니어야 함)
curl.exe -i -X POST http://localhost:8080/creator/videos -H "Content-Type: application/json" -d "{}"
```

**예상 응답:**
- ✅ 400 Bad Request (필수 필드 누락) 또는
- ✅ 401 Unauthorized (JWT 토큰 없음)
- ❌ 404 Not Found (라우트가 존재하지 않음) - 이제 발생하지 않음

### 3. 정상 요청 테스트

```powershell
# 1. 로그인하여 토큰 받기
$loginResponse = Invoke-RestMethod -Method POST -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"consulting_manager@naver.com","password":"123456"}'

$token = $loginResponse.accessToken

# 2. 영상 생성 요청
$body = @{
    sourceType = "youtube"
    sourceUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    title = "테스트 영상"
    language = "ko"
    visibility = "public"
} | ConvertTo-Json

Invoke-RestMethod -Method POST -Uri "http://localhost:8080/creator/videos" `
  -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} `
  -Body $body
```

**예상 응답 (201 Created):**
```json
{
  "video": {
    "id": "abc123def456...",
    "site_id": "gods",
    "owner_id": "creator-001",
    "platform": "youtube",
    "video_id": "dQw4w9WgXcQ",
    "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "테스트 영상",
    "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "language": "ko",
    "status": "active",
    "visibility": "public",
    "created_at": "2025-01-15T10:00:00.000Z"
  }
}
```

## ☁️ Cloud Run 배포

### 방법 1: nest-api 폴더에서 직접 배포 (Dockerfile 사용)

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"

# gcloud CLI 로그인 및 프로젝트 설정
gcloud auth login
gcloud config set project esoteric-throne-471613-j6

# Cloud Run에 배포 (--source . 옵션으로 Dockerfile 자동 감지)
gcloud run deploy cms-api `
  --source . `
  --region asia-northeast3 `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars "JWT_SECRET=your-jwt-secret,SQLITE_DB_PATH=/app/data/cms.db,CMS_TEST_ADMIN_EMAIL=consulting_manager@naver.com,CMS_TEST_ADMIN_PASSWORD=123456,CMS_TEST_CREATOR_EMAIL=j1dly1@naver.com,CMS_TEST_CREATOR_PASSWORD=123456789QWER,DEBUG_ENDPOINTS=true"
```

### 방법 2: Cloud Build 사용 (프로젝트 루트)

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"

# Cloud Build 실행
gcloud builds submit --config cloudbuild.yaml
```

**참고**: `cloudbuild.yaml`이 `nest-api` 폴더의 Dockerfile을 사용하도록 수정되어 있어야 합니다.

### 방법 3: Docker 이미지 빌드 후 배포

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"

# Docker 이미지 빌드
docker build -t gcr.io/esoteric-throne-471613-j6/cms-api:latest .

# GCR에 푸시
docker push gcr.io/esoteric-throne-471613-j6/cms-api:latest

# Cloud Run 배포
gcloud run deploy cms-api `
  --image gcr.io/esoteric-throne-471613-j6/cms-api:latest `
  --region asia-northeast3 `
  --platform managed `
  --allow-unauthenticated `
  --port 8080
```

## ✅ 배포 후 확인

```powershell
# 1. Health Check
Invoke-RestMethod -Method GET -Uri "https://api.godcomfortword.com/health"

# 2. 라우트 존재 확인 (404가 나오면 안됨)
curl.exe -i -X POST https://api.godcomfortword.com/creator/videos `
  -H "Content-Type: application/json" `
  -d "{}"

# 3. 정상 요청 테스트 (JWT 토큰 필요)
$loginResponse = Invoke-RestMethod -Method POST -Uri "https://api.godcomfortword.com/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"consulting_manager@naver.com","password":"123456"}'

$token = $loginResponse.accessToken

$body = @{
    sourceType = "youtube"
    sourceUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    title = "테스트 영상"
    language = "ko"
    visibility = "public"
} | ConvertTo-Json

Invoke-RestMethod -Method POST -Uri "https://api.godcomfortword.com/creator/videos" `
  -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} `
  -Body $body
```

## 📝 API 스펙

### POST /creator/videos

**인증**: JWT 토큰 필요 (Bearer Token)

**권한**: creator 또는 admin

**Request Body:**
```json
{
  "sourceType": "youtube",  // 필수: "youtube" 또는 "facebook"
  "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  // 필수
  "title": "샘플 영상",  // 선택
  "thumbnailUrl": "https://img.youtube.com/vi/.../maxresdefault.jpg",  // 선택
  "language": "ko",  // 선택, 기본값: "en"
  "status": "active",  // 선택, 기본값: "active"
  "visibility": "public",  // 선택, 기본값: "public"
  "site_id": "gods"  // 선택 (admin만 설정 가능, creator는 자동으로 자신의 site_id 사용)
}
```

**Response (201 Created):**
```json
{
  "video": {
    "id": "abc123def456...",
    "site_id": "gods",
    "owner_id": "creator-001",
    "platform": "youtube",
    "video_id": "dQw4w9WgXcQ",
    "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "샘플 영상",
    "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "language": "ko",
    "status": "active",
    "visibility": "public",
    "created_at": "2025-01-15T10:00:00.000Z"
  }
}
```

**에러 응답:**
- 400 Bad Request: 필수 필드 누락 또는 잘못된 sourceType
- 401 Unauthorized: JWT 토큰 없음 또는 만료
- 403 Forbidden: creator/admin 역할이 아님
- 500 Internal Server Error: 서버 내부 오류

## 🔍 GET /creator/videos

기존에 이미 구현되어 있었으며, 정상 동작합니다.

**인증**: JWT 토큰 필요 (Bearer Token)

**권한**: creator 또는 admin

**Query Parameters:**
- `site_id` (선택): 사이트 ID (JWT에서 가져온 값 사용)

**Response (200 OK):**
```json
{
  "videos": [
    {
      "id": "abc123",
      "title": "샘플 영상",
      "platform": "youtube",
      "visibility": "public",
      "thumbnail_url": "https://img.youtube.com/vi/.../hqdefault.jpg",
      "source_url": "https://www.youtube.com/watch?v=...",
      "language": "ko",
      "site_id": "gods",
      "owner_id": "creator-001"
    }
  ]
}
```








