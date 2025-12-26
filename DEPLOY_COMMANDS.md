# 🚀 배포 명령어 가이드

이 문서는 **Cloud Run (cms-api)** 배포와 **Firebase Hosting** 배포를 모두 다룹니다.

---

## 📋 Cloud Run API 서버 배포 (api.godcomfortword.com)

### 사전 확인

#### 1. server.js 라우트 확인

```powershell
# 프로젝트 루트에서 실행
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"

# /creator/videos 라우트 확인
Select-String -Path "server.js" -Pattern "/creator/videos"
```

**예상 출력:**
```
server.js:378:fastify.get("/creator/videos", { preHandler: requireAuth }, getCreatorVideosHandler);
```

#### 2. Dockerfile 확인

```powershell
# Dockerfile이 server.js를 실행하는지 확인
Select-String -Path "Dockerfile" -Pattern "server.js"
```

**예상 출력:**
```
Dockerfile:15:CMD ["node", "server.js"]
```

#### 3. cloudbuild.yaml 확인

```powershell
# 서비스 이름과 리전 확인
Select-String -Path "cloudbuild.yaml" -Pattern "cms-api|asia-northeast3"
```

---

### 🚀 Cloud Run 배포 절차

#### 방법 1: Cloud Build 사용 (권장)

**1단계: 코드 커밋 (선택사항)**
```powershell
# 변경사항 확인
git status

# 커밋 (필요시)
git add .
git commit -m "Add /creator/videos route"
git push origin main
```

**2단계: Cloud Build 실행**
```powershell
# gcloud CLI 로그인 (필요시)
gcloud auth login

# 프로젝트 설정
gcloud config set project esoteric-throne-471613-j6

# Cloud Build 실행
gcloud builds submit --config cloudbuild.yaml
```

**예상 출력:**
```
Creating temporary tarball archive...
Uploading tarball to gs://...
Created [https://cloudbuild.googleapis.com/...]
```

**3단계: 환경 변수 설정 (계정 자동 생성)**

```powershell
# Cloud Run 서비스에 환경 변수 설정 (Admin + Creator 계정 자동 생성)
gcloud run services update cms-api `
  --set-env-vars "ADMIN_EMAIL=consulting_manager@naver.com,ADMIN_PASSWORD=123456,CREATOR_EMAIL=j1dly1@naver.com,CREATOR_PASSWORD=123456789QWER" `
  --region asia-northeast3
```

**중요:** 
- 환경 변수를 설정하면 서버 시작 시 자동으로 계정이 생성/업데이트됩니다.
- Cloud Run은 ephemeral 파일시스템이므로 컨테이너 재시작 시 DB가 초기화될 수 있습니다.
- 환경 변수로 자동 생성하는 방식이 가장 안정적입니다.

**4단계: 배포 확인**
```powershell
# Cloud Run 서비스 상태 확인
gcloud run services describe cms-api --region asia-northeast3

# 최신 리비전 확인
gcloud run revisions list --service cms-api --region asia-northeast3 --limit 1

# 환경 변수 확인
gcloud run services describe cms-api --region asia-northeast3 --format="value(spec.template.spec.containers[0].env)"

# 서버 시작 로그 확인 (부트스트랩 과정 확인)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=cms-api AND textPayload=~'bootstrap'" --limit 20 --format json
```

#### 방법 2: 직접 Docker 배포 (빠른 테스트)

```powershell
# 1. Docker 이미지 빌드 및 푸시
docker build -t gcr.io/esoteric-throne-471613-j6/cms-api:latest .
docker push gcr.io/esoteric-throne-471613-j6/cms-api:latest

# 2. Cloud Run 배포
gcloud run deploy cms-api `
  --image gcr.io/esoteric-throne-471613-j6/cms-api:latest `
  --region asia-northeast3 `
  --platform managed `
  --allow-unauthenticated `
  --port 8080
```

---

### 🌐 도메인 매핑 확인

**1. 도메인 매핑 확인**
```powershell
gcloud run domain-mappings list --region asia-northeast3
```

**예상 출력:**
```
NAME                      SERVICE  LOCATION
api.godcomfortword.com    cms-api  asia-northeast3
```

**2. 도메인 매핑이 없는 경우 생성**
```powershell
gcloud run domain-mappings create `
  --service cms-api `
  --domain api.godcomfortword.com `
  --region asia-northeast3
```

**3. DNS 레코드 확인**
```powershell
# DNS 레코드 확인
nslookup api.godcomfortword.com
```

도메인 등록 기관에서 다음 DNS 레코드가 설정되어 있어야 합니다:
- **이름**: `api`
- **타입**: `CNAME`
- **값**: `ghs.googlehosted.com` (또는 Cloud Run이 제공하는 값)

---

### 🧪 배포 후 테스트

**1. Health Check 및 버전 확인**

```powershell
# 프로덕션 도메인으로 테스트
$healthResponse = Invoke-RestMethod -Uri "https://api.godcomfortword.com/health"
$healthResponse | ConvertTo-Json
```

**예상 응답:**
```json
{
  "status": "ok",
  "service": "cms-api",
  "message": "CMS API is running",
  "version": "1.0.0",
  "buildTime": "2025-01-15T10:30:00.000Z",
  "gitHash": "abc1234"
}
```

**확인 사항:**
- `gitHash`가 로컬과 동일한지 확인 (같은 코드가 배포되었는지)
- `buildTime`으로 배포 시점 확인

**2. 로그인 테스트 (Creator 계정)**

```powershell
# Creator 계정으로 로그인
$loginBody = @{
    email = "j1dly1@naver.com"
    password = "123456789QWER"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "https://api.godcomfortword.com/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody
    
    $TOKEN = $loginResponse.token
    Write-Host "✅ Creator 로그인 성공! Token: $($TOKEN.Substring(0, 20))..." -ForegroundColor Green
} catch {
    Write-Host "❌ Creator 로그인 실패: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Cloud Run 로그를 확인하세요:" -ForegroundColor Yellow
    Write-Host "gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=cms-api' --limit 50" -ForegroundColor Gray
}
```

**3. 로그인 테스트 (Admin 계정)**

```powershell
# Admin 계정으로 로그인
$adminLoginBody = @{
    email = "consulting_manager@naver.com"
    password = "123456"
} | ConvertTo-Json

try {
    $adminLoginResponse = Invoke-RestMethod -Uri "https://api.godcomfortword.com/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $adminLoginBody
    
    Write-Host "✅ Admin 로그인 성공!" -ForegroundColor Green
} catch {
    Write-Host "❌ Admin 로그인 실패: $($_.Exception.Message)" -ForegroundColor Red
}
```

**4. GET /creator/videos 테스트**

```powershell
# GET /creator/videos 호출
if ($TOKEN) {
    $headers = @{
        "Authorization" = "Bearer $TOKEN"
        "Content-Type" = "application/json"
    }

    try {
        $response = Invoke-RestMethod -Uri "https://api.godcomfortword.com/creator/videos" `
            -Method GET `
            -Headers $headers
        
        Write-Host "✅ GET /creator/videos 성공! (200)" -ForegroundColor Green
        Write-Host "영상 개수: $($response.videos.Count)" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 3
    } catch {
        Write-Host "❌ GET /creator/videos 실패: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host "⚠️  404 에러: Cloud Run에 최신 코드가 배포되지 않았을 수 있습니다." -ForegroundColor Yellow
            Write-Host "Cloud Build를 재실행하세요: gcloud builds submit --config cloudbuild.yaml" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "⚠️  토큰이 없습니다. 먼저 로그인을 성공해야 합니다." -ForegroundColor Yellow
}
```

**예상 응답:**
```json
{
  "videos": []
}
```

---

## 📋 Firebase Hosting 배포 (cms.godcomfortword.com)

### 사전 준비

1. **프로젝트 확인**
   ```bash
   firebase projects:list
   firebase use gods-comfort-word
   ```

2. **타겟 확인 (필요시)**
   ```bash
   firebase target:apply hosting cms gods-comfort-word-cms
   ```

### 🚀 배포 프로세스

**1. 프론트엔드 빌드**
```bash
cd frontend
npm install
npm run build
cd ..
```

**2. Firebase Hosting 배포**
```bash
# 루트 디렉토리에서 실행
firebase deploy --only hosting:cms
```

또는 전체 배포:
```bash
firebase deploy
```

---

## 🔧 문제 해결

### Cloud Run: 404 "Route GET:/creator/videos not found"

**원인:**
- Cloud Run에 최신 코드가 배포되지 않음

**해결:**
1. `server.js`에서 `/creator/videos` 라우트 확인
2. Cloud Build 재실행:
   ```powershell
   gcloud builds submit --config cloudbuild.yaml
   ```
3. 배포 완료 후 테스트

### Cloud Run: 도메인이 라우팅되지 않음

**원인:**
- DNS 레코드가 올바르게 설정되지 않음

**해결:**
1. Cloud Run 도메인 매핑 확인
2. DNS 레코드 확인 및 수정
3. DNS 전파 대기 (보통 몇 분)

### Firebase Hosting: "Hosting site or target cms not detected"

**해결:**
1. **타겟 재설정**
   ```bash
   firebase target:apply hosting cms gods-comfort-word-cms
   ```

2. **firebase.json 확인**
   - `hosting`이 객체 형식인지 확인
   - `target: "cms"`가 설정되어 있는지 확인

---

## 📋 배포 환경 초기 계정 생성

Cloud Run은 컨테이너 파일시스템이 ephemeral이므로, 배포 후에도 초기 계정을 생성해야 합니다.

### 방법 1: 환경 변수로 자동 생성 (권장)

Cloud Run 서비스에 환경 변수를 설정하면 `server.js`가 시작 시 자동으로 계정을 생성합니다:

```powershell
# Cloud Run 서비스 환경 변수 설정 (Admin + Creator 모두)
gcloud run services update cms-api `
  --set-env-vars "ADMIN_EMAIL=consulting_manager@naver.com,ADMIN_PASSWORD=123456,CREATOR_EMAIL=j1dly1@naver.com,CREATOR_PASSWORD=123456789QWER" `
  --region asia-northeast3
```

**주의:** 
- `server.js`는 시작 시 `ensureAdminFromEnv()`와 `ensureCreatorFromEnv()`를 호출하여 계정을 자동 생성/업데이트합니다.
- 기존 계정이 있으면 비밀번호만 업데이트됩니다.
- Cloud Run은 ephemeral 파일시스템이므로 컨테이너 재시작 시 DB가 초기화될 수 있습니다. 환경 변수로 자동 생성하는 방식이 가장 안정적입니다.

### 방법 2: Cloud Run Job으로 setup-initial-accounts.js 실행

```powershell
# Cloud Run Job 생성 (한 번만 실행)
gcloud run jobs create setup-accounts `
  --image gcr.io/esoteric-throne-471613-j6/cms-api:latest `
  --region asia-northeast3 `
  --set-env-vars "DB_PATH=/tmp/cms.db" `
  --command "node" `
  --args "setup-initial-accounts.js"

# Job 실행
gcloud run jobs execute setup-accounts --region asia-northeast3
```

### 방법 3: 로컬에서 DB 파일 생성 후 Cloud Storage에 업로드

```powershell
# 1. 로컬에서 계정 생성
node setup-initial-accounts.js

# 2. DB 파일을 Cloud Storage에 업로드
gsutil cp cms.db gs://your-bucket/cms.db

# 3. Cloud Run에서 Cloud Storage의 DB 파일 사용하도록 설정
# (별도 설정 필요)
```

### 초기 계정 정보

- **Admin**: `consulting_manager@naver.com` / `123456`
- **Creator**: `j1dly1@naver.com` / `123456789QWER`

---

## ✅ 배포 확인 체크리스트

### Cloud Run (API 서버)
- [ ] `server.js`에 `/creator/videos` 라우트 확인 (378라인)
- [ ] Cloud Build 실행 완료
- [ ] Cloud Run 서비스 상태 확인
- [ ] 환경 변수 설정 확인 (ADMIN_EMAIL, ADMIN_PASSWORD, CREATOR_EMAIL, CREATOR_PASSWORD)
- [ ] 도메인 매핑 확인
- [ ] DNS 레코드 확인
- [ ] Health Check 성공 (`/health`) - 버전 정보 확인 (gitHash로 코드 버전 확인)
- [ ] Creator 로그인 테스트 성공 (`/auth/login`)
- [ ] Admin 로그인 테스트 성공 (`/auth/login`)
- [ ] GET /creator/videos 테스트 성공 (200 응답, Bearer 토큰 포함)

### Firebase Hosting (프론트엔드)
- [ ] 프론트엔드 빌드 완료
- [ ] Firebase Hosting 배포 완료
- [ ] https://cms.godcomfortword.com/ 접속 확인
- [ ] 로그인 페이지 접속 확인
- [ ] Admin/Creator 페이지 접속 확인

---

## 🚀 빠른 배포 명령어 (전체)

### Cloud Run 배포 (전체 절차)

```powershell
# 프로젝트 루트에서 실행
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"

# 1. 라우트 확인
Select-String -Path "server.js" -Pattern "/creator/videos"

# 2. Cloud Build 실행 (최신 코드 배포)
gcloud builds submit --config cloudbuild.yaml

# 3. 환경 변수 설정 (계정 자동 생성)
gcloud run services update cms-api `
  --set-env-vars "ADMIN_EMAIL=consulting_manager@naver.com,ADMIN_PASSWORD=123456,CREATOR_EMAIL=j1dly1@naver.com,CREATOR_PASSWORD=123456789QWER" `
  --region asia-northeast3

# 4. 배포 확인
gcloud run services describe cms-api --region asia-northeast3

# 5. Health Check (버전 정보 확인)
$health = Invoke-RestMethod -Uri "https://api.godcomfortword.com/health"
$health | ConvertTo-Json

# 6. 로그인 테스트
$loginBody = @{
    email = "j1dly1@naver.com"
    password = "123456789QWER"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "https://api.godcomfortword.com/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody

$TOKEN = $loginResponse.token

# 7. GET /creator/videos 테스트
$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

$videosResponse = Invoke-RestMethod -Uri "https://api.godcomfortword.com/creator/videos" `
    -Method GET `
    -Headers $headers

$videosResponse | ConvertTo-Json
```

### Firebase Hosting 배포
```powershell
# 프로젝트 루트에서 실행
cd frontend
npm run build
cd ..
firebase deploy --only hosting:cms
```

