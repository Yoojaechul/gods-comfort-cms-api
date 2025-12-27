# management_id 검증 가이드

이 문서는 `management_id` 기능이 정상적으로 동작하는지 검증하기 위한 curl 명령을 제공합니다.

## 사전 준비

1. NestJS 서버가 실행 중이어야 합니다:
   ```bash
   npm run start:dev
   ```

2. Creator 계정이 준비되어 있어야 합니다.

## 검증 단계

### 1. Creator 로그인하여 JWT 토큰 받기

```bash
# Windows (PowerShell)
$loginResponse = Invoke-RestMethod -Method POST -Uri "http://localhost:8788/auth/login" `
  -ContentType "application/json" `
  -Body (@{email="01023942042"; password="creator123!"} | ConvertTo-Json)

$token = $loginResponse.token
Write-Host "Token: $token"
```

```bash
# Linux/Mac
TOKEN=$(curl -X POST http://localhost:8788/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"01023942042","password":"creator123!"}' \
  | jq -r '.token')

echo "Token: $TOKEN"
```

### 2. POST /creator/videos로 영상 생성 (management_id 확인)

```bash
# Windows (PowerShell)
$body = @{
  sourceType = "youtube"
  sourceUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  title = "테스트 영상 - management_id 검증"
  language = "ko"
} | ConvertTo-Json

$response = Invoke-RestMethod -Method POST -Uri "http://localhost:8788/creator/videos" `
  -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} `
  -Body $body

Write-Host "Created Video:"
$response | ConvertTo-Json -Depth 10

# management_id 확인
Write-Host "`nmanagement_id: $($response.video.management_id)"
```

```bash
# Linux/Mac
curl -X POST http://localhost:8788/creator/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sourceType": "youtube",
    "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "테스트 영상 - management_id 검증",
    "language": "ko"
  }' | jq '.'

# management_id만 추출
curl -X POST http://localhost:8788/creator/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sourceType": "youtube",
    "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "테스트 영상 2",
    "language": "ko"
  }' | jq -r '.video.management_id'
```

**예상 결과:**
- `management_id`가 `"251227-001"` 형식으로 반환되어야 합니다 (날짜는 현재 날짜에 따라 달라집니다)
- 두 번째 영상을 생성하면 `"251227-002"`가 반환되어야 합니다

### 3. GET /creator/videos로 영상 목록 조회 (management_id 확인)

```bash
# Windows (PowerShell)
$response = Invoke-RestMethod -Method GET -Uri "http://localhost:8788/creator/videos" `
  -Headers @{Authorization="Bearer $token"}

Write-Host "Videos List:"
$response | ConvertTo-Json -Depth 10

# 첫 번째 영상의 management_id 확인
if ($response.videos -and $response.videos.Count -gt 0) {
  Write-Host "`n첫 번째 영상의 management_id: $($response.videos[0].management_id)"
}
```

```bash
# Linux/Mac
curl -X GET http://localhost:8788/creator/videos \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

# 첫 번째 영상의 management_id만 추출
curl -X GET http://localhost:8788/creator/videos \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.videos[0].management_id'
```

**예상 결과:**
- 모든 영상의 `management_id` 필드가 채워져 있어야 합니다
- `null`이나 누락된 값이 없어야 합니다

## 백필 스크립트 실행 (기존 null management_id 처리)

기존에 생성된 영상 중 `management_id`가 `null`인 경우 백필 스크립트를 실행하세요:

```bash
node backfill-management-id.js
```

이 스크립트는:
- `management_id`가 `null`인 모든 영상을 찾습니다
- `site_id`와 `created_at` 기준으로 그룹화합니다
- 각 그룹 내에서 `001`, `002`, ... 순서로 `management_id`를 부여합니다
- 기존에 값이 있는 영상은 건드리지 않습니다

## 완료 기준

✅ **성공 기준:**
1. POST `/creator/videos` 응답의 `video.management_id`가 `"YYMMDD-001"` 형태로 반환됨
2. GET `/creator/videos` 응답의 모든 `videos[*].management_id`가 채워져 있음
3. 같은 날짜, 같은 `site_id`에서 순차적으로 번호가 증가함 (001, 002, 003...)

❌ **실패 시 확인사항:**
- NestJS 서버 로그에서 에러 메시지 확인
- DB에서 직접 확인: `SELECT id, site_id, management_id, created_at FROM videos ORDER BY created_at DESC;`
- 백필 스크립트가 정상 실행되었는지 확인

