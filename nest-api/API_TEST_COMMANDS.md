# API 테스트 커맨드 가이드

## 배포 URL
- **프로덕션:** `https://api.godcomfortword.com`
- **로컬:** `http://127.0.0.1:8788` (또는 `http://localhost:8080`)

## 1. 로그인 (토큰 획득)

### Creator 계정
```bash
# curl (Linux/WSL)
curl -X POST "https://api.godcomfortword.com/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"j1d1y1@naver.com","password":"123456789QWER"}'

# PowerShell (Windows)
$response = Invoke-RestMethod -Uri "https://api.godcomfortword.com/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"j1d1y1@naver.com","password":"123456789QWER"}'
$token = $response.access_token
Write-Host "Token: $token"
```

### Admin 계정
```bash
# curl (Linux/WSL)
curl -X POST "https://api.godcomfortword.com/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"consulting_manager@naver.com","password":"123456"}'

# PowerShell (Windows)
$response = Invoke-RestMethod -Uri "https://api.godcomfortword.com/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"consulting_manager@naver.com","password":"123456"}'
$token = $response.access_token
Write-Host "Token: $token"
```

## 2. Creator 영상 목록 조회 (GET /creator/videos)

```bash
# curl (Linux/WSL)
curl -H "Authorization: Bearer <TOKEN>" \
  "https://api.godcomfortword.com/creator/videos"

# PowerShell (Windows)
$headers = @{
  "Authorization" = "Bearer $token"
}
Invoke-RestMethod -Uri "https://api.godcomfortword.com/creator/videos" `
  -Method GET `
  -Headers $headers
```

## 3. Creator 영상 생성 (POST /creator/videos)

```bash
# curl (Linux/WSL)
curl -X POST "https://api.godcomfortword.com/creator/videos" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "youtube",
    "sourceUrl": "https://www.youtube.com/watch?v=8aTbGbnj49w",
    "language": "ko",
    "title": "테스트 영상",
    "visibility": "public"
  }'

# PowerShell (Windows)
$body = @{
  sourceType = "youtube"
  sourceUrl = "https://www.youtube.com/watch?v=8aTbGbnj49w"
  language = "ko"
  title = "테스트 영상"
  visibility = "public"
} | ConvertTo-Json

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "https://api.godcomfortword.com/creator/videos" `
  -Method POST `
  -Headers $headers `
  -Body $body
```

## 4. 공개 영상 메타데이터 조회 (GET /public/videos/youtube/metadata)

```bash
# curl (Linux/WSL)
curl "https://api.godcomfortword.com/public/videos/youtube/metadata?url=https://www.youtube.com/watch?v=8aTbGbnj49w"

# PowerShell (Windows)
Invoke-RestMethod -Uri "https://api.godcomfortword.com/public/videos/youtube/metadata?url=https://www.youtube.com/watch?v=8aTbGbnj49w" `
  -Method GET
```

## 5. Health Check (GET /health)

```bash
# curl (Linux/WSL)
curl "https://api.godcomfortword.com/health"

# PowerShell (Windows)
Invoke-RestMethod -Uri "https://api.godcomfortword.com/health" -Method GET
```

## 6. 디버그 엔드포인트 (DEBUG_ENDPOINTS=true일 때만)

### 버전 정보
```bash
# curl (Linux/WSL)
curl "https://api.godcomfortword.com/debug/version"

# PowerShell (Windows)
Invoke-RestMethod -Uri "https://api.godcomfortword.com/debug/version" -Method GET
```

### DB 정보
```bash
# curl (Linux/WSL)
curl "https://api.godcomfortword.com/debug/db-info"

# PowerShell (Windows)
Invoke-RestMethod -Uri "https://api.godcomfortword.com/debug/db-info" -Method GET
```

### 로그인 검증 (진단용)
```bash
# curl (Linux/WSL)
curl -X POST "https://api.godcomfortword.com/debug/login-check" \
  -H "Content-Type: application/json" \
  -d '{"email":"j1d1y1@naver.com","password":"123456789QWER"}'

# PowerShell (Windows)
$body = @{
  email = "j1d1y1@naver.com"
  password = "123456789QWER"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://api.godcomfortword.com/debug/login-check" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

## 예상 응답 코드

- **200 OK:** 성공
- **201 Created:** 리소스 생성 성공
- **400 Bad Request:** 잘못된 요청 (필수 필드 누락 등)
- **401 Unauthorized:** 인증 실패 (토큰 없음/만료/서명 오류)
- **403 Forbidden:** 권한 없음 (creator/admin이 아님)
- **404 Not Found:** 라우트 없음 또는 리소스 없음
- **500 Internal Server Error:** 서버 오류

## 문제 해결

### 401 Unauthorized 발생 시
1. 토큰이 올바르게 전달되었는지 확인
2. 토큰이 만료되지 않았는지 확인 (재로그인)
3. Cloud Run 로그에서 인증 실패 원인 확인:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=cms-api" \
     --limit 50 \
     --format json | jq '.[] | select(.jsonPayload.message | contains("AUTH"))'
   ```

### 404 Not Found 발생 시
1. 라우트 경로 확인 (`/creator/videos`가 정확한지)
2. HTTP 메서드 확인 (GET vs POST)
3. Cloud Run 배포가 최신인지 확인:
   ```bash
   gcloud run services describe cms-api --region=asia-northeast3
   ```

### 데이터가 사라지는 경우
1. Cloud Run 로그에서 DB 경로 확인:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=cms-api" \
     --limit 50 \
     --format json | jq '.[] | select(.jsonPayload.message | contains("SQLite DB Path"))'
   ```
2. **즉시 조치:** Cloud SQL로 전환 (CLOUD_SQL_MIGRATION.md 참고)

