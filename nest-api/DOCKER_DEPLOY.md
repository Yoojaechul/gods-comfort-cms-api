# 🐳 Docker 배포 가이드 (nest-api)

## 📋 개요

`nest-api` 폴더에 Dockerfile을 추가하여 Cloud Run에서 Dockerfile 기반 배포가 가능하도록 구성했습니다.

## 📁 생성된 파일

- `Dockerfile`: 멀티 스테이지 빌드를 사용한 NestJS Docker 이미지
- `.dockerignore`: 불필요한 파일 제외를 위한 설정

## 🏗️ Dockerfile 구조

### Builder Stage
1. `package.json`과 `package-lock.json` 복사 (캐시 최적화)
2. `npm ci`로 모든 의존성 설치 (devDependencies 포함)
3. 소스 코드 복사
4. `npm run build`로 TypeScript 빌드

### Runtime Stage
1. 빌드된 `dist` 폴더만 복사
2. `package.json`과 `package-lock.json` 복사
3. `npm ci --omit=dev`로 프로덕션 의존성만 설치
4. `/app/data` 디렉터리 생성 (SQLite 파일용)
5. `node dist/main.js` 실행

## 🚀 로컬 테스트

### 1. Docker 이미지 빌드

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"
docker build -t nest-api:latest .
```

### 2. Docker 컨테이너 실행

```powershell
# 환경변수 설정 (필요한 경우)
docker run -p 8080:8080 `
  -e JWT_SECRET="your-jwt-secret" `
  -e SQLITE_DB_PATH="/app/data/cms.db" `
  -e CMS_TEST_ADMIN_EMAIL="consulting_manager@naver.com" `
  -e CMS_TEST_ADMIN_PASSWORD="123456" `
  -e CMS_TEST_CREATOR_EMAIL="j1dly1@naver.com" `
  -e CMS_TEST_CREATOR_PASSWORD="123456789QWER" `
  -e DEBUG_ENDPOINTS="true" `
  nest-api:latest
```

### 3. 테스트

```powershell
# Health Check
Invoke-RestMethod -Method GET -Uri "http://localhost:8080/health"

# Debug Version
Invoke-RestMethod -Method GET -Uri "http://localhost:8080/debug/version"
```

## ☁️ Cloud Run 배포

### 방법 1: gcloud CLI로 직접 배포 (Dockerfile 사용)

```powershell
# nest-api 폴더에서 실행
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

**참고**: `--source .` 옵션을 사용하면 Cloud Run이 현재 디렉터리의 Dockerfile을 자동으로 감지하여 빌드합니다.

### 방법 2: Docker 이미지 빌드 후 배포

```powershell
# 1. Docker 이미지 빌드
docker build -t gcr.io/esoteric-throne-471613-j6/cms-api:latest .

# 2. GCR에 푸시
docker push gcr.io/esoteric-throne-471613-j6/cms-api:latest

# 3. Cloud Run 배포
gcloud run deploy cms-api `
  --image gcr.io/esoteric-throne-471613-j6/cms-api:latest `
  --region asia-northeast3 `
  --platform managed `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars "JWT_SECRET=your-jwt-secret,SQLITE_DB_PATH=/app/data/cms.db,CMS_TEST_ADMIN_EMAIL=consulting_manager@naver.com,CMS_TEST_ADMIN_PASSWORD=123456,CMS_TEST_CREATOR_EMAIL=j1dly1@naver.com,CMS_TEST_CREATOR_PASSWORD=123456789QWER,DEBUG_ENDPOINTS=true"
```

### 방법 3: Cloud Build 사용 (cloudbuild.yaml 수정 필요)

프로젝트 루트의 `cloudbuild.yaml`을 수정하여 `nest-api` 폴더의 Dockerfile을 사용하도록 변경:

```yaml
steps:
  # 1) Build image (nest-api 폴더의 Dockerfile 사용)
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - build
      - '-t'
      - 'gcr.io/$PROJECT_ID/cms-api:$BUILD_ID'
      - '-f'
      - 'nest-api/Dockerfile'
      - 'nest-api'

  # 2) Push image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - push
      - 'gcr.io/$PROJECT_ID/cms-api:$BUILD_ID'

  # 3) Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - cms-api
      - '--image'
      - 'gcr.io/$PROJECT_ID/cms-api:$BUILD_ID'
      - '--region'
      - 'asia-northeast3'
      - '--platform'
      - 'managed'
      - '--port'
      - '8080'

images:
  - 'gcr.io/$PROJECT_ID/cms-api:$BUILD_ID'
```

그 다음:

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"
gcloud builds submit --config cloudbuild.yaml
```

## 🔧 환경변수 설정

Cloud Run 서비스에 환경변수를 설정하려면:

```powershell
gcloud run services update cms-api `
  --set-env-vars "JWT_SECRET=your-jwt-secret,SQLITE_DB_PATH=/app/data/cms.db,CMS_TEST_ADMIN_EMAIL=consulting_manager@naver.com,CMS_TEST_ADMIN_PASSWORD=123456,CMS_TEST_CREATOR_EMAIL=j1dly1@naver.com,CMS_TEST_CREATOR_PASSWORD=123456789QWER,DEBUG_ENDPOINTS=true,SEED_FORCE_PASSWORD_UPDATE=false" `
  --region asia-northeast3
```

또는 기존 환경변수에 추가:

```powershell
gcloud run services update cms-api `
  --update-env-vars "DEBUG_ENDPOINTS=true" `
  --region asia-northeast3
```

## ✅ 확인 사항

### Dockerfile 요구사항 충족 확인

- ✅ Node/Nest 빌드 후 dist 실행
- ✅ PORT 환경변수 사용 (main.ts에서 `process.env.PORT || 8080` 사용)
- ✅ CMD: `node dist/main.js`
- ✅ `npm ci` → `npm run build` → production dependencies만 포함

### 배포 확인

```powershell
# Health Check
Invoke-RestMethod -Method GET -Uri "https://api.godcomfortword.com/health"

# Debug Version
Invoke-RestMethod -Method GET -Uri "https://api.godcomfortword.com/debug/version"
```

## 📝 주의사항

1. **PORT 환경변수**: Cloud Run이 자동으로 `PORT` 환경변수를 주입하므로, Dockerfile에서 하드코딩하지 않았습니다. `main.ts`에서 `process.env.PORT || 8080`을 사용합니다.

2. **SQLite DB 경로**: Cloud Run의 ephemeral filesystem을 사용하므로, 컨테이너 재시작 시 DB가 초기화될 수 있습니다. 환경변수로 seed 계정을 자동 생성하는 방식을 권장합니다.

3. **빌드 최적화**: 멀티 스테이지 빌드를 사용하여 최종 이미지 크기를 최소화했습니다.

4. **.dockerignore**: 불필요한 파일(node_modules, dist, .git 등)이 Docker 이미지에 포함되지 않도록 설정했습니다.

























