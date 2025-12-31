# 환경 변수 설정 가이드

## 프로덕션 배포 시 필수 환경 변수

프로덕션에서 API 서버로 올바르게 요청을 보내기 위해 다음 환경 변수 중 하나를 반드시 설정해야 합니다.

### 환경 변수 우선순위
1. `VITE_API_BASE_URL` (권장)
2. `VITE_CMS_API_BASE_URL`

### 설정 방법

#### 빌드 시 환경 변수 설정

```bash
# Windows (PowerShell)
$env:VITE_API_BASE_URL="https://your-api-server.com"; npm run build

# Windows (CMD)
set VITE_API_BASE_URL=https://your-api-server.com && npm run build

# Linux/Mac
VITE_API_BASE_URL=https://your-api-server.com npm run build
```

#### .env 파일 사용 (로컬 개발)

프로젝트 루트에 `.env.production` 파일을 생성:

```env
VITE_API_BASE_URL=https://your-api-server.com
```

그리고 빌드:
```bash
npm run build
```

#### CI/CD 파이프라인 예시

```yaml
# GitHub Actions 예시
env:
  VITE_API_BASE_URL: https://api.godcomfortword.com

steps:
  - run: npm run build
```

### 중요 사항

1. **절대 URL 사용**: 환경 변수 값은 `http://` 또는 `https://`로 시작해야 합니다.
   - ✅ 올바름: `https://api.example.com`
   - ❌ 잘못됨: `api.example.com` 또는 `/api`

2. **프론트엔드 호스트와 다른 API 서버 호스트**: 
   - 프론트엔드: `https://cms.godcomfortword.com`
   - API 서버: `https://api.godcomfortword.com` (또는 다른 호스트)

3. **빌드 타임 설정**: Vite는 빌드 시점에 환경 변수를 번들에 포함시킵니다.
   - 런타임에 환경 변수를 변경해도 반영되지 않습니다.
   - 빌드를 다시 해야 환경 변수 변경이 적용됩니다.

### 로컬 개발

로컬 개발 시에는 `.env.local` 또는 `.env.development` 파일을 사용하거나, vite.config.ts의 기본값(`http://localhost:8787`)이 사용됩니다.

```env
# .env.local
VITE_API_BASE_URL=http://localhost:8787
```

### 확인 방법

빌드 후 브라우저 콘솔에서 확인:
```javascript
// 브라우저 콘솔에서 실행
console.log(import.meta.env.VITE_API_BASE_URL);
```

환경 변수가 올바르게 설정되지 않으면 다음 에러 메시지가 표시됩니다:
- "API base URL is not configured. Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL environment variable."
- "API endpoint mismatch (received HTML). Check API_BASE_URL."



















