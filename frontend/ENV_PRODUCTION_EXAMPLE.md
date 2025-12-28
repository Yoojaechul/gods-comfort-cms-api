# .env.production 예시

## 파일 위치
프로젝트 루트 디렉토리: `frontend/.env.production`

## 파일 내용

```env
# CMS API Base URL
# 중요: 프로덕션 배포 시 반드시 설정해야 합니다.
# 환경 변수가 없으면 임시로 Cloud Run 서비스를 사용하되 콘솔 경고가 출력됩니다.
VITE_API_BASE_URL=https://api.godcomfortword.com
```

## 설정 방법

### 방법 1: .env.production 파일 생성 (권장)

프로젝트 루트에 `.env.production` 파일을 생성하고 위 내용을 저장합니다.

```bash
# Windows
echo VITE_API_BASE_URL=https://api.godcomfortword.com > .env.production

# Linux/Mac
echo "VITE_API_BASE_URL=https://api.godcomfortword.com" > .env.production
```

### 방법 2: 빌드 시 환경 변수 지정

```bash
# Windows PowerShell
$env:VITE_API_BASE_URL="https://api.godcomfortword.com"; npm run build

# Windows CMD
set VITE_API_BASE_URL=https://api.godcomfortword.com && npm run build

# Linux/Mac
VITE_API_BASE_URL=https://api.godcomfortword.com npm run build
```

## 중요 사항

1. **환경 변수 우선순위**:
   - `VITE_CMS_API_BASE_URL` (우선)
   - `VITE_API_BASE_URL` (차선)
   - Fallback: Cloud Run URL (임시, 콘솔 경고 출력)

2. **프로덕션 배포 시**:
   - 반드시 `.env.production` 파일에 `VITE_API_BASE_URL`을 설정하세요.
   - 환경 변수가 없으면 콘솔 경고가 출력됩니다.

3. **API 서버 주소**:
   - 현재: `https://api.godcomfortword.com` (Express 서비스)
   - Cloud Run: `https://cms-api-388547952090.asia-northeast3.run.app` (Nest 서비스)
   - Express 서비스가 정상 동작하면 `https://api.godcomfortword.com` 사용
   - Express 서비스 문제 시 Cloud Run URL로 변경 가능

## 확인 방법

빌드 후 브라우저 콘솔에서 확인:

```javascript
console.log(import.meta.env.VITE_API_BASE_URL);
```

프로덕션 환경에서 환경 변수가 설정되지 않으면 콘솔에 경고가 표시됩니다:

```
[config] ⚠️ VITE_API_BASE_URL 환경 변수가 설정되지 않았습니다. 
임시로 Cloud Run 서비스를 사용합니다: https://cms-api-388547952090.asia-northeast3.run.app
프로덕션 배포 시 반드시 .env.production 파일에 VITE_API_BASE_URL을 설정하세요.
```










