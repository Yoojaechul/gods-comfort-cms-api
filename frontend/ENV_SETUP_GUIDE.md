# 환경 변수 설정 가이드

## 프로덕션 빌드를 위한 환경 변수 설정

### 중요 사항

**API_BASE_URL은 반드시 SPA 호스팅 도메인과 다른 별도의 API 서버 주소여야 합니다.**

- ✅ **SPA**: `https://cms.godcomfortword.com` (Firebase Hosting)
- ✅ **API**: `https://api.godcomfortword.com` (별도 API 서버)
- ❌ **잘못됨**: `VITE_API_BASE_URL=https://cms.godcomfortword.com` (SPA 도메인을 API로 사용)

---

## .env 파일 체크리스트

### 1. `.env.production` (프로덕션 빌드용)

**위치:** 프로젝트 루트 디렉토리 (`frontend/.env.production`)

**내용:**
```env
# Production API Base URL
# ⚠️ 중요: API 서버는 SPA 호스팅 도메인과 별도여야 합니다.
# SPA: https://cms.godcomfortword.com (Firebase Hosting)
# API: https://api.godcomfortword.com (별도 API 서버)

VITE_CMS_API_BASE_URL=https://api.godcomfortword.com

# 또는 (두 개 중 하나만 설정)
# VITE_API_BASE_URL=https://api.godcomfortword.com
```

**확인 사항:**
- [ ] 파일이 프로젝트 루트에 있는지 확인
- [ ] `VITE_CMS_API_BASE_URL` 또는 `VITE_API_BASE_URL` 중 하나만 설정
- [ ] 값이 `https://` 또는 `http://`로 시작하는지 확인
- [ ] SPA 호스팅 도메인(`cms.godcomfortword.com`)이 아닌지 확인
- [ ] 실제 API 서버 주소로 설정되어 있는지 확인

### 2. `.env.local` (로컬 개발용, 선택사항)

**위치:** 프로젝트 루트 디렉토리 (`frontend/.env.local`)

**내용:**
```env
# Local Development API Base URL
VITE_CMS_API_BASE_URL=http://localhost:8787

# 또는
# VITE_API_BASE_URL=http://localhost:8787
```

**참고:**
- `.env.local`은 git에 커밋하지 않아야 함 (`.gitignore`에 포함)
- 로컬 개발 시 로컬 API 서버 주소 설정

### 3. `.env` (기본값, 선택사항)

**위치:** 프로젝트 루트 디렉토리 (`frontend/.env`)

**내용:**
```env
# Default API Base URL (fallback)
VITE_CMS_API_BASE_URL=http://localhost:8787
```

**참고:**
- 모든 환경에서 공통으로 사용할 기본값
- 프로덕션에서는 `.env.production`이 우선순위가 높음

---

## 환경 변수 우선순위

Vite는 다음 순서로 환경 변수를 읽습니다 (높은 우선순위가 먼저):

1. **`.env.production.local`** (프로덕션 빌드 시, git에 커밋 안 함)
2. **`.env.production`** (프로덕션 빌드 시)
3. **`.env.local`** (모든 환경, git에 커밋 안 함)
4. **`.env`** (모든 환경)

**프로덕션 빌드 시:**
```bash
npm run build
# .env.production 파일이 사용됨
```

---

## 프로덕션 빌드 단계

### 방법 1: .env.production 파일 사용 (권장)

1. **`.env.production` 파일 생성/수정:**
   ```env
   VITE_CMS_API_BASE_URL=https://api.godcomfortword.com
   ```

2. **빌드:**
   ```bash
   npm run build
   ```

3. **배포:**
   ```bash
   firebase deploy --only hosting
   ```

### 방법 2: 빌드 명령어에 환경 변수 직접 설정

**Windows (PowerShell):**
```powershell
$env:VITE_CMS_API_BASE_URL="https://api.godcomfortword.com"; npm run build
```

**Windows (CMD):**
```cmd
set VITE_CMS_API_BASE_URL=https://api.godcomfortword.com && npm run build
```

**Linux/Mac:**
```bash
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com npm run build
```

---

## 빌드 확인 방법

### 1. 빌드 후 브라우저 콘솔에서 확인

브라우저에서 앱을 열고 개발자 도구 콘솔에서:

```javascript
// 환경 변수 확인 (빌드된 값)
console.log(import.meta.env.VITE_CMS_API_BASE_URL);
console.log(import.meta.env.VITE_API_BASE_URL);

// config.ts에서 사용되는 값
// (소스 코드를 확인하거나 Network 탭에서 실제 요청 URL 확인)
```

### 2. Network 탭에서 실제 요청 URL 확인

1. 브라우저 개발자 도구 열기 (F12)
2. Network 탭 선택
3. 페이지 새로고침 또는 API 호출 트리거
4. 요청 URL 확인:
   - ✅ **올바름**: `https://api.godcomfortword.com/creator/videos`
   - ❌ **잘못됨**: `https://cms.godcomfortword.com/creator/videos`

### 3. 빌드된 파일에서 확인

빌드 후 `dist/assets/index-*.js` 파일을 열어서 (텍스트 에디터 또는 grep):

```bash
# Windows PowerShell
Select-String -Path "dist/assets/index-*.js" -Pattern "api\.godcomfortword\.com"

# Linux/Mac
grep -r "api.godcomfortword.com" dist/assets/
```

---

## 일반적인 오류 및 해결 방법

### 오류 1: "API_BASE_URL cannot point to SPA hosting domain"

**원인:** `.env.production`에서 SPA 호스팅 도메인을 사용

**해결:**
```env
# 잘못된 설정 (제거)
VITE_CMS_API_BASE_URL=https://cms.godcomfortword.com

# 올바른 설정 (추가)
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com
```

### 오류 2: "API endpoint mismatch: Received HTML instead of JSON"

**원인:** API_BASE_URL이 SPA 호스팅 도메인을 가리키거나, 환경 변수가 설정되지 않음

**해결:**
1. `.env.production` 파일 확인
2. 올바른 API 서버 주소로 설정
3. 빌드 다시 실행

### 오류 3: "CMS_API_BASE is not configured"

**원인:** 환경 변수가 설정되지 않았거나 빌드 시 전달되지 않음

**해결:**
1. `.env.production` 파일 생성/확인
2. `VITE_CMS_API_BASE_URL` 또는 `VITE_API_BASE_URL` 설정
3. 빌드 다시 실행

---

## 파일 구조 예시

```
frontend/
├── .env                      # 기본값 (선택사항)
├── .env.local                # 로컬 개발용 (선택사항, gitignore)
├── .env.production           # 프로덕션 빌드용 (필수)
├── .env.production.local     # 프로덕션 로컬 오버라이드 (선택사항, gitignore)
├── .gitignore                # .env.local, .env.production.local 포함되어야 함
├── package.json
├── vite.config.ts
└── src/
    ├── config.ts             # 환경 변수 읽기
    └── lib/
        └── apiClient.ts      # API 요청 중앙화
```

---

## .gitignore 확인

`.gitignore` 파일에 다음이 포함되어 있는지 확인:

```gitignore
# 환경 변수 파일 (선택적으로 커밋)
.env.local
.env.production.local
.env.*.local

# .env.production은 커밋 가능 (예시 값 포함)
# .env는 커밋 가능 (기본값)
```

---

## 요약 체크리스트

### 프로덕션 배포 전

- [ ] `.env.production` 파일이 프로젝트 루트에 존재
- [ ] `VITE_CMS_API_BASE_URL` 또는 `VITE_API_BASE_URL` 설정됨
- [ ] 값이 실제 API 서버 주소 (`https://api.godcomfortword.com`)
- [ ] SPA 호스팅 도메인 (`cms.godcomfortword.com`)이 아님
- [ ] 값이 `https://` 또는 `http://`로 시작
- [ ] 빌드 후 Network 탭에서 실제 요청 URL 확인
- [ ] 브라우저 콘솔에서 에러 없음

### 빌드 명령어

```bash
# 방법 1: .env.production 사용
npm run build

# 방법 2: 환경 변수 직접 설정
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com npm run build
```

---

## 참고

- Vite 환경 변수는 빌드 타임에 번들에 포함됩니다
- 런타임에 변경할 수 없습니다
- 환경 변수를 변경한 후에는 반드시 다시 빌드해야 합니다
- `.env.production` 파일이 없으면 빌드 시 에러가 발생할 수 있습니다











