# 🚀 Debug 엔드포인트 배포 가이드

## 📋 배포 정보

- **서비스 이름**: `cms-api`
- **리전**: `asia-northeast3`
- **프로젝트 ID**: `esoteric-throne-471613-j6`
- **도메인**: `https://api.godcomfortword.com`
- **배포 방식**: Cloud Build + Cloud Run

## 🔍 현재 문제

- `/health`는 200 OK 반환 (서버는 정상 동작 중)
- `/debug/version`, `/debug/db-info`는 404 반환
- 원인: 배포된 서버가 최신 코드가 아니거나, `DEBUG_ENDPOINTS` 환경변수가 설정되지 않음

## ✅ 해결 방법

### 1. 코드 확인 (로컬)

```powershell
# 로컬에서 빌드 및 테스트
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"
npm run build

# 로컬 서버 실행 (DEBUG_ENDPOINTS=true 설정)
$env:DEBUG_ENDPOINTS="true"
node dist/main.js

# 다른 터미널에서 테스트
Invoke-RestMethod -Method GET -Uri "http://127.0.0.1:8080/debug/version"
Invoke-RestMethod -Method GET -Uri "http://127.0.0.1:8080/debug/db-info"
```

**예상 응답 (200 OK):**
```json
{
  "appName": "godscomfortword-nest-api",
  "nodeEnv": "development",
  "envVars": {
    "CMS_TEST_ADMIN_EMAIL": "set",
    "CMS_TEST_ADMIN_PASSWORD": "set",
    "CMS_TEST_CREATOR_EMAIL": "set",
    "CMS_TEST_CREATOR_PASSWORD": "set",
    "SEED_FORCE_PASSWORD_UPDATE": "unset",
    "DEBUG_ENDPOINTS": "set"
  },
  "buildInfo": {
    "gitCommitSha": "abc1234",
    "buildTimestamp": "2025-01-15T10:00:00.000Z"
  }
}
```

### 2. Cloud Run 배포

#### 방법 1: Cloud Build 사용 (권장)

```powershell
# 프로젝트 루트에서 실행
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"

# gcloud CLI 로그인 및 프로젝트 설정
gcloud auth login
gcloud config set project esoteric-throne-471613-j6

# Cloud Build 실행 (최신 코드 빌드 및 배포)
gcloud builds submit --config cloudbuild.yaml
```

**예상 출력:**
```
Creating temporary tarball archive...
Uploading tarball to gs://...
Created [https://cloudbuild.googleapis.com/...]
ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Status: SUCCESS
```

#### 방법 2: 직접 Docker 배포

```powershell
# 프로젝트 루트에서 실행
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"

# Docker 이미지 빌드
docker build -t gcr.io/esoteric-throne-471613-j6/cms-api:latest .

# 이미지 푸시
docker push gcr.io/esoteric-throne-471613-j6/cms-api:latest

# Cloud Run 배포
gcloud run deploy cms-api `
  --image gcr.io/esoteric-throne-471613-j6/cms-api:latest `
  --region asia-northeast3 `
  --platform managed `
  --allow-unauthenticated `
  --port 8080
```

### 3. 환경변수 설정 (필수)

**⚠️ 중요**: `DEBUG_ENDPOINTS=true`를 설정해야 `/debug/*` 엔드포인트가 활성화됩니다.

```powershell
# Cloud Run 서비스에 환경변수 설정
gcloud run services update cms-api `
  --set-env-vars "DEBUG_ENDPOINTS=true,CMS_TEST_ADMIN_EMAIL=consulting_manager@naver.com,CMS_TEST_ADMIN_PASSWORD=123456,CMS_TEST_CREATOR_EMAIL=j1dly1@naver.com,CMS_TEST_CREATOR_PASSWORD=123456789QWER,SEED_FORCE_PASSWORD_UPDATE=false" `
  --region asia-northeast3
```

**또는 기존 환경변수에 추가:**

```powershell
# 현재 환경변수 확인
gcloud run services describe cms-api --region asia-northeast3 --format="value(spec.template.spec.containers[0].env)"

# 기존 환경변수에 DEBUG_ENDPOINTS 추가 (예시)
gcloud run services update cms-api `
  --update-env-vars "DEBUG_ENDPOINTS=true" `
  --region asia-northeast3
```

### 4. 배포 확인

```powershell
# 1. 서비스 상태 확인
gcloud run services describe cms-api --region asia-northeast3

# 2. 최신 리비전 확인
gcloud run revisions list --service cms-api --region asia-northeast3 --limit 1

# 3. 환경변수 확인
gcloud run services describe cms-api --region asia-northeast3 --format="value(spec.template.spec.containers[0].env)"

# 4. 서버 로그 확인 (DebugModule 로드 여부 확인)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=cms-api AND textPayload=~'DEBUG'" --limit 20 --format json
```

**예상 로그:**
```
[DEBUG] Debug endpoints are ENABLED. Remember to set DEBUG_ENDPOINTS=false after diagnosis.
```

### 5. 엔드포인트 테스트

```powershell
# Health Check (버전 정보 포함)
Invoke-RestMethod -Method GET -Uri "https://api.godcomfortword.com/health"

# Debug Version
Invoke-RestMethod -Method GET -Uri "https://api.godcomfortword.com/debug/version"

# Debug DB Info
Invoke-RestMethod -Method GET -Uri "https://api.godcomfortword.com/debug/db-info"

# Debug Login Check
$body = @{
    email = "consulting_manager@naver.com"
    password = "123456"
} | ConvertTo-Json

Invoke-RestMethod -Method POST -Uri "https://api.godcomfortword.com/debug/login-check" -ContentType "application/json" -Body $body
```

**예상 응답 (200 OK):**

**GET /health:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "appName": "godscomfortword-nest-api",
  "nodeEnv": "production",
  "buildInfo": {
    "buildTimestamp": "2025-01-15T09:00:00.000Z"
  }
}
```

**GET /debug/version:**
```json
{
  "appName": "godscomfortword-nest-api",
  "nodeEnv": "production",
  "envVars": {
    "CMS_TEST_ADMIN_EMAIL": "set",
    "CMS_TEST_ADMIN_PASSWORD": "set",
    "CMS_TEST_CREATOR_EMAIL": "set",
    "CMS_TEST_CREATOR_PASSWORD": "set",
    "SEED_FORCE_PASSWORD_UPDATE": "set",
    "DEBUG_ENDPOINTS": "set"
  },
  "buildInfo": {
    "buildTimestamp": "2025-01-15T09:00:00.000Z"
  }
}
```

## 🔧 문제 해결

### 문제 1: 여전히 404가 반환되는 경우

**원인**: 배포된 서버가 최신 코드가 아님

**해결책**:
1. Cloud Build를 다시 실행하여 최신 코드 배포
2. 배포 후 최소 1-2분 대기 (컨테이너 재시작 시간)
3. `/health` 엔드포인트에서 `buildInfo` 확인하여 배포 시간 확인

```powershell
# 최신 빌드 확인
$health = Invoke-RestMethod -Method GET -Uri "https://api.godcomfortword.com/health"
Write-Host "Build timestamp: $($health.buildInfo.buildTimestamp)"
```

### 문제 2: DEBUG_ENDPOINTS=true인데도 404

**원인**: Guard가 제대로 작동하지 않거나, 모듈이 로드되지 않음

**해결책**:
1. 서버 로그 확인:
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=cms-api" --limit 50 --format json
```

2. 로그에서 다음 확인:
   - `[DEBUG] Debug endpoints are ENABLED` 메시지가 있는지
   - `[DEBUG] Debug endpoints are DISABLED` 메시지가 있는지

3. 환경변수 재설정:
```powershell
gcloud run services update cms-api `
  --update-env-vars "DEBUG_ENDPOINTS=true" `
  --region asia-northeast3
```

### 문제 3: 배포 후 서버가 시작되지 않음

**원인**: 빌드 오류 또는 런타임 오류

**해결책**:
1. Cloud Build 로그 확인:
```powershell
gcloud builds list --limit 1
gcloud builds log [BUILD_ID]
```

2. Cloud Run 로그 확인:
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=cms-api AND severity>=ERROR" --limit 20 --format json
```

## ⚠️ 보안 주의사항

**원인 확인이 끝나면 반드시 `DEBUG_ENDPOINTS=false`로 되돌려주세요:**

```powershell
gcloud run services update cms-api `
  --update-env-vars "DEBUG_ENDPOINTS=false" `
  --region asia-northeast3
```

또는 환경변수에서 완전히 제거:

```powershell
gcloud run services update cms-api `
  --remove-env-vars "DEBUG_ENDPOINTS" `
  --region asia-northeast3
```

## 📝 체크리스트

배포 전:
- [ ] 로컬에서 `npm run build` 성공
- [ ] 로컬에서 `DEBUG_ENDPOINTS=true`로 `/debug/version` 테스트 성공

배포 중:
- [ ] Cloud Build 실행 성공
- [ ] Cloud Run 서비스 업데이트 성공
- [ ] 환경변수 설정 확인 (`DEBUG_ENDPOINTS=true`)

배포 후:
- [ ] `/health` 엔드포인트 200 OK (버전 정보 포함)
- [ ] `/debug/version` 엔드포인트 200 OK
- [ ] `/debug/db-info` 엔드포인트 200 OK
- [ ] `/debug/login-check` 엔드포인트 200 OK (테스트)

원인 확인 후:
- [ ] `DEBUG_ENDPOINTS=false`로 되돌리기









