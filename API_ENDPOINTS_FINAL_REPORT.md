# API 서버 엔드포인트 최종 분석 리포트

## 🔍 1. 실제 API 서버 엔드포인트 목록

### 프로덕션에서 사용 중인 API 서버: Firebase Functions

**서버 파일**: `functions/index.js`  
**프레임워크**: Express.js  
**배포 위치**: Firebase Functions (`serviceId: "api"`, `region: "us-central1"`)

---

### ✅ 실제 제공하는 엔드포인트 목록

| Method | Path | 설명 | 인증 필요 | 구현 위치 |
|--------|------|------|-----------|-----------|
| **GET** | `/health` | 헬스 체크 | ❌ | `functions/index.js:137` |
| **POST** | `/auth/login` | 로그인 및 JWT 토큰 발급 | ❌ | `functions/index.js:142` |
| **POST** | `/auth/check-email` | 이메일 존재 여부 및 역할 확인 | ❌ | `functions/index.js:223` |
| **POST** | `/auth/change-password` | 비밀번호 변경 (이메일 기반) | ❌ | `functions/index.js:261` |
| **GET** | `/creator/videos` | Creator 영상 목록 조회 | ✅ (JWT Bearer) | `functions/index.js:348` |

---

## 🔍 2. `/creator/videos` 라우트 존재 확인

✅ **존재함**

**구현 위치**: `functions/index.js` (347-398줄)

```javascript
app.get("/creator/videos", (req, res) => {
  // JWT 토큰 검증
  // owner_id와 site_id 기반 영상 조회
  // JSON 응답: { videos: [...] }
});
```

**요구사항**:
- **인증**: `Authorization: Bearer <token>` 헤더 필요
- **쿼리 파라미터**: `site_id` (선택적)
- **응답 형식**: JSON `{ videos: [...] }`

---

## 🔍 3. 정확한 API Base Path 및 접근 가능한 URL

### API Base Path

**Base Path**: `/` (루트 경로)

Firebase Functions에서 Express 앱은 루트 경로에 마운트됩니다:
```javascript
// functions/index.js:418
exports.api = functions.https.onRequest(app);
```

### 실제 접근 가능한 URL

#### 방법 1: Firebase Functions 직접 URL (권장)

```
Base URL: https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

**전체 엔드포인트 URL 예시**:
- Health: `https://us-central1-gods-comfort-word.cloudfunctions.net/api/health`
- Login: `https://us-central1-gods-comfort-word.cloudfunctions.net/api/auth/login`
- Creator Videos: `https://us-central1-gods-comfort-word.cloudfunctions.net/api/creator/videos`

---

#### 방법 2: Firebase Hosting Rewrites 활용

`firebase.json`의 rewrites 설정에 따라 같은 도메인을 통해 접근 가능:

```
Base URL: https://cms.godcomfortword.com
```

**전체 엔드포인트 URL 예시**:
- Health: `https://cms.godcomfortword.com/health` (❌ rewrites에 없음)
- Login: `https://cms.godcomfortword.com/auth/login` (✅ rewrites로 프록시)
- Creator Videos: `https://cms.godcomfortword.com/creator/videos` (✅ rewrites로 프록시)

**주의**: `firebase.json`에는 `/auth/**`와 `/creator/videos`만 rewrites에 포함되어 있습니다.
- `/health` 엔드포인트는 rewrites에 없어서 SPA fallback으로 `/index.html`이 반환됩니다.

---

## 🔍 4. CORS 설정 점검

### credentials: true 사용 시 필요한 설정

**현재 CORS 설정** (`functions/index.js:28-56`):

```javascript
app.use(cors({
  origin: (origin, callback) => {
    // origin이 없으면 (서버 간 요청, curl 등) 허용
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // 허용된 origin이면 통과
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    
    // 허용되지 않은 origin
    callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,  // ✅ 올바르게 설정됨
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "Accept", "Origin"],
}));
```

### ✅ CORS 설정 올바름

**credentials: true 사용 시 필수 요구사항**:

1. ✅ **credentials: true 설정됨**
   - 쿠키, 인증 헤더 전송 허용

2. ✅ **명시적 Origin 허용 목록**
   - `allowedOrigins` 배열에 허용할 Origin 명시
   - `https://cms.godcomfortword.com` 포함

3. ✅ **필요한 HTTP 메서드 허용**
   - `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS` 허용

4. ✅ **필요한 헤더 허용**
   - `Authorization` (JWT 토큰용) 포함
   - `Content-Type` 포함

5. ✅ **OPTIONS 요청 처리**
   - Express의 `cors` 미들웨어가 자동 처리

**결론**: CORS 설정은 **완벽하게 올바릅니다**. 추가 수정 필요 없음.

---

## 🔍 5. 프론트엔드에서 사용해야 할 정확한 API_BASE_URL

### ⚠️ 현재 문제점

프론트엔드 `config.ts` 파일을 보면:
- `CMS_API_BASE`가 빈 문자열이면 **에러를 던지도록** 되어 있습니다.
- 하지만 실제로는 빌드 시 환경 변수가 설정되지 않아 **빈 문자열**이 될 수 있습니다.
- 또는 `CMS_API_BASE`가 `https://cms.godcomfortword.com`을 가리키면 `config.ts`의 검증 로직이 **차단**합니다.

---

### ✅ 권장 해결 방법

#### 옵션 1: Firebase Functions URL 직접 사용 (권장) ⭐

**API_BASE_URL**:
```
https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

**이유**:
- ✅ Firebase Hosting rewrites에 의존하지 않음
- ✅ 명확하고 직접적인 API 서버 접근
- ✅ 모든 엔드포인트 접근 가능 (rewrites 제한 없음)
- ✅ CORS 설정이 올바르게 되어 있어 작동함

**프론트엔드 빌드 시 설정**:

```bash
# Windows (PowerShell)
$env:VITE_API_BASE_URL="https://us-central1-gods-comfort-word.cloudfunctions.net/api"; npm run build

# Linux/Mac
VITE_API_BASE_URL=https://us-central1-gods-comfort-word.cloudfunctions.net/api npm run build
```

**또는 `.env.production` 파일**:
```env
VITE_API_BASE_URL=https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

---

#### 옵션 2: Firebase Hosting rewrites 활용 (config.ts 수정 필요)

`config.ts`의 검증 로직을 수정하여 같은 도메인 사용 허용:

```typescript
// frontend/src/config.ts 수정 필요
// 현재는 같은 도메인을 차단하는 로직이 있음 (51-64줄)
```

**API_BASE_URL**:
```
(빈 문자열 또는 https://cms.godcomfortword.com)
```

**장점**:
- 같은 도메인 사용 (CORS 이슈 없음)
- Firebase Hosting rewrites 활용

**단점**:
- `config.ts` 수정 필요
- rewrites에 없는 엔드포인트는 접근 불가
- Firebase Hosting에 의존

---

### ❌ 현재 프론트엔드 요청이 왜 잘못되었는지

#### 시나리오 1: CMS_API_BASE가 빈 문자열

1. **빌드 시 환경 변수 미설정**
   - `VITE_API_BASE_URL` 또는 `VITE_CMS_API_BASE_URL`이 설정되지 않음
   - 결과: `CMS_API_BASE = ""` (빈 문자열)

2. **apiClient.ts에서 에러 발생**
   ```typescript
   // apiClient.ts:27
   if (!CMS_API_BASE || !CMS_API_BASE.trim()) {
     throw new Error("API base URL is not configured...");
   }
   ```
   - 에러가 발생해야 하지만, 빌드된 코드에서 다르게 동작할 수 있음

3. **또는 상대 경로로 요청**
   - `buildUrl` 함수가 빈 문자열을 받으면 상대 경로로 요청
   - 요청 URL: `https://cms.godcomfortword.com/creator/videos`

4. **Firebase Hosting SPA Fallback 작동**
   - `firebase.json`의 rewrites는 있지만, SPA fallback이 먼저 작동하거나
   - rewrites가 작동하지 않아 `/index.html` 반환
   - 결과: **HTML 응답**

---

#### 시나리오 2: CMS_API_BASE가 SPA 호스팅 도메인을 가리킴

1. **잘못된 환경 변수 설정**
   - `VITE_API_BASE_URL=https://cms.godcomfortword.com` 설정

2. **config.ts 검증 로직 차단**
   ```typescript
   // config.ts:51-64
   if (apiHost === currentHost || apiHost.includes("cms.godcomfortword.com")) {
     // 프로덕션에서는 에러 던짐
     throw new Error("API_BASE_URL cannot point to SPA hosting domain...");
   }
   ```
   - 프로덕션에서는 에러 발생
   - 또는 개발 환경에서는 경고만 하고 진행

3. **결과적으로 상대 경로 요청**
   - 검증 실패 후 빈 문자열 또는 상대 경로로 요청
   - 위의 시나리오 1과 동일한 문제 발생

---

## ✅ 최종 해결책

### 1. 프론트엔드 빌드 시 환경 변수 설정

**`.env.production` 파일 생성**:
```env
VITE_API_BASE_URL=https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

**빌드**:
```bash
cd frontend
npm run build
```

**배포**:
```bash
firebase deploy --only hosting:cms
```

---

### 2. 확인 방법

배포 후 브라우저 개발자 도구에서 확인:

1. **Network 탭**:
   - `/creator/videos` 요청이 `https://us-central1-gods-comfort-word.cloudfunctions.net/api/creator/videos`로 나가는지 확인
   - HTML이 아닌 JSON 응답이 오는지 확인

2. **Console 탭**:
   - `CMS_API_BASE` 값 확인:
   ```javascript
   // 브라우저 콘솔에서
   import.meta.env.VITE_API_BASE_URL
   ```

---

## 📋 요약

### API 서버 실제 엔드포인트 목록

1. `GET /health` - 헬스 체크
2. `POST /auth/login` - 로그인
3. `POST /auth/check-email` - 이메일 확인
4. `POST /auth/change-password` - 비밀번호 변경
5. `GET /creator/videos` - Creator 영상 목록 ✅

### 프론트엔드에서 사용해야 할 정확한 API_BASE_URL

```
https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

### 현재 프론트엔드 요청이 왜 잘못되었는지

1. **환경 변수 미설정** → `CMS_API_BASE`가 빈 문자열
2. **상대 경로 요청** → `https://cms.godcomfortword.com/creator/videos`
3. **SPA Fallback 작동** → `/index.html` 반환 → **HTML 응답**

**해결**: 빌드 시 `VITE_API_BASE_URL` 환경 변수를 Firebase Functions URL로 설정



