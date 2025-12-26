# API 서버 엔드포인트 분석 및 해결 방안

## 🔍 현재 상황 분석

### 문제점
프론트엔드에서 `/creator/videos` API를 호출할 때 **HTML이 반환**되고 있습니다.
이는 API 서버가 아닌 **SPA(Firebase Hosting)**를 호출하고 있기 때문입니다.

---

## 📋 실제 API 서버 구성

이 프로젝트에는 **3개의 API 서버**가 있습니다:

### 1. server.js (Fastify 기반, Cloud Run 배포용)

**기본 경로**: `/` (루트 경로)

**엔드포인트 목록**:
| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/` | 서비스 상태 확인 | ❌ |
| GET | `/health` | 헬스 체크 | ❌ |
| GET | `/public/health` | 공개 헬스 체크 | ❌ |
| GET | `/public/healthz` | 공개 헬스 체크 (Kubernetes) | ❌ |
| POST | `/auth/login` | 로그인 및 JWT 토큰 발급 | ❌ |
| GET | `/auth/me` | 내 정보 확인 | ✅ (JWT) |
| GET | `/__bootstrap/creator` | Creator 계정 생성 (임시) | ❌ |

**⚠️ 중요**: `server.js`에는 `/creator/videos` 엔드포인트가 **존재하지 않습니다**.

**배포 위치**: Cloud Run (별도 URL 필요)

---

### 2. functions/index.js (Express 기반, Firebase Functions)

**기본 경로**: `/` (Firebase Functions의 `/api` 서비스)

**엔드포인트 목록**:
| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/health` | 헬스 체크 | ❌ |
| POST | `/auth/login` | 로그인 및 JWT 토큰 발급 | ❌ |
| POST | `/auth/check-email` | 이메일 존재 여부 확인 | ❌ |
| POST | `/auth/change-password` | 비밀번호 변경 | ❌ |
| GET | `/creator/videos` | Creator 영상 목록 조회 | ✅ (JWT) |

**배포 위치**: Firebase Functions (`serviceId: "api"`, `region: "us-central1"`)

**접근 URL**: 
- Cloud Functions URL: `https://us-central1-gods-comfort-word.cloudfunctions.net/api`
- 또는 Firebase Hosting rewrites를 통해: `https://cms.godcomfortword.com/auth/**` 및 `https://cms.godcomfortword.com/creator/videos`

---

### 3. nest-api/ (NestJS 기반, 별도 배포)

**기본 경로**: `/` (NestJS 기본)

**엔드포인트 목록**:
- `/auth/login`
- `/auth/check-email`
- `/auth/change-password`
- `/creator/videos`

**배포 위치**: 별도 서버 (현재 배포 여부 불명)

---

## 🔧 firebase.json 설정 분석

현재 `firebase.json` 설정:

```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "/auth/**",
        "run": {
          "serviceId": "api",
          "region": "us-central1"
        }
      },
      {
        "source": "/creator/videos",
        "run": {
          "serviceId": "api",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

**의미**:
- `/auth/**` → Firebase Functions의 `api` 서비스로 프록시
- `/creator/videos` → Firebase Functions의 `api` 서비스로 프록시
- 기타 모든 경로 → `/index.html` (SPA fallback)

**문제점**:
Firebase Hosting rewrites는 **같은 호스트**에서만 작동합니다. 
즉, `https://cms.godcomfortword.com/creator/videos`로 요청하면 Firebase Hosting이 이를 Firebase Functions로 프록시합니다.

하지만 **프론트엔드에서 상대 경로로 요청**하면:
- `CMS_API_BASE`가 빈 문자열이면
- 요청이 `https://cms.godcomfortword.com/creator/videos`로 가고
- Firebase Hosting rewrites가 작동하여 Firebase Functions로 프록시되어야 하는데
- 프론트엔드 코드가 `CMS_API_BASE` 없이 상대 경로로 요청하면 rewrites가 작동하지 않을 수 있습니다.

---

## 🚨 현재 프론트엔드 요청 분석

### apiClient.ts 동작

```typescript
// frontend/src/lib/apiClient.ts
export async function apiRequest(path: string, options: RequestInit = {}) {
  if (!CMS_API_BASE || !CMS_API_BASE.trim()) {
    throw new Error("API base URL is not configured...");
  }
  
  const url = buildUrl(CMS_API_BASE, path);
  // ...
}
```

**문제점**:
1. `CMS_API_BASE`가 빈 문자열이면 에러를 던집니다.
2. 하지만 빌드 시점에 환경 변수가 설정되지 않으면 `CMS_API_BASE`가 빈 문자열입니다.
3. 빈 문자열일 때 `buildUrl`이 실패하거나, 상대 경로로 요청이 나갑니다.

### CreatorMyVideosPage.tsx

```typescript
const data = await apiGet<any>("/creator/videos");
```

**실제 요청 URL**:
- `CMS_API_BASE`가 설정되지 않았으면: `https://cms.godcomfortword.com/creator/videos` (상대 경로)
- 이 경우 Firebase Hosting이 SPA fallback으로 `/index.html`을 반환하여 HTML이 반환됩니다.

---

## ✅ 해결 방안

### 방법 1: Firebase Functions URL 직접 사용 (권장)

프론트엔드에서 Firebase Functions URL을 직접 사용하도록 설정합니다.

**API Base URL**:
```
https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

**프론트엔드 빌드 시 환경 변수 설정**:
```bash
# Windows (PowerShell)
$env:VITE_API_BASE_URL="https://us-central1-gods-comfort-word.cloudfunctions.net/api"; npm run build

# Linux/Mac
VITE_API_BASE_URL=https://us-central1-gods-comfort-word.cloudfunctions.net/api npm run build
```

또는 `.env.production` 파일:
```env
VITE_API_BASE_URL=https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

**장점**:
- Firebase Hosting rewrites에 의존하지 않음
- 직접 API 서버로 요청하므로 더 명확함
- CORS 설정만 올바르면 작동함

---

### 방법 2: Firebase Hosting Rewrites 활용 (현재 설정 활용)

프론트엔드에서 `CMS_API_BASE`를 **빈 문자열** 또는 **현재 호스트**로 설정하여 Firebase Hosting rewrites를 활용합니다.

**API Base URL**:
```
(빈 문자열 또는 https://cms.godcomfortword.com)
```

**프론트엔드 코드 수정 필요**:
`apiClient.ts`에서 `CMS_API_BASE`가 빈 문자열일 때 현재 호스트를 사용하도록 수정:

```typescript
const baseUrl = CMS_API_BASE || window.location.origin;
const url = buildUrl(baseUrl, path);
```

**장점**:
- 같은 도메인에서 모든 요청 처리
- CORS 이슈 없음

**단점**:
- Firebase Hosting rewrites에 의존
- 모든 API 요청이 Firebase Hosting을 거쳐감

---

### 방법 3: server.js에 `/creator/videos` 엔드포인트 추가 (Cloud Run 사용 시)

만약 `server.js`를 Cloud Run에 배포하여 사용한다면, `/creator/videos` 엔드포인트를 추가해야 합니다.

---

## 🔒 CORS 설정 점검

### Firebase Functions (functions/index.js)

```javascript
const allowedOrigins = [
  "https://cms.godcomfortword.com",
  "https://gods-comfort-word-cms.web.app",
  "https://gods-comfort-word-cms.firebaseapp.com",
  "https://www.godcomfortword.com",
  "https://godcomfortword.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,  // ✅ 중요
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "Accept", "Origin"],
}));
```

**✅ CORS 설정 올바름**:
- `credentials: true` 설정됨
- 필요한 Origin들이 허용 목록에 포함됨
- 필요한 HTTP 메서드들이 허용됨
- 필요한 헤더들이 허용됨

---

## 📝 최종 권장 사항

### 1. 프론트엔드 API Base URL 설정

**방법 1 (권장)**: Firebase Functions URL 직접 사용

```bash
# 빌드 시
VITE_API_BASE_URL=https://us-central1-gods-comfort-word.cloudfunctions.net/api npm run build
```

**방법 2**: Firebase Hosting rewrites 활용 (apiClient.ts 수정 필요)

```typescript
// apiClient.ts 수정
const baseUrl = CMS_API_BASE || window.location.origin;
```

### 2. 현재 프론트엔드 요청이 왜 잘못되었는지

1. **`CMS_API_BASE`가 빈 문자열**:
   - 환경 변수 `VITE_API_BASE_URL` 또는 `VITE_CMS_API_BASE_URL`이 빌드 시 설정되지 않음
   - 빌드된 프론트엔드에서 `CMS_API_BASE`가 빈 문자열

2. **상대 경로 요청**:
   - `CMS_API_BASE`가 빈 문자열이면 `apiRequest`에서 에러를 던지거나, 상대 경로로 요청
   - 상대 경로 요청은 현재 프론트엔드 호스트(`https://cms.godcomfortword.com`)로 전송됨

3. **Firebase Hosting SPA Fallback**:
   - `/creator/videos`로 요청이 Firebase Hosting에 도달
   - Firebase Hosting rewrites가 작동하지 않거나, SPA fallback이 먼저 작동하여 `/index.html`이 반환됨
   - 결과적으로 HTML이 반환됨

---

## ✅ 확인 사항

### 현재 API 서버 엔드포인트 목록 (Firebase Functions)

| Method | Path | 설명 | 인증 필요 |
|--------|------|------|-----------|
| GET | `/health` | 헬스 체크 | ❌ |
| POST | `/auth/login` | 로그인 | ❌ |
| POST | `/auth/check-email` | 이메일 확인 | ❌ |
| POST | `/auth/change-password` | 비밀번호 변경 | ❌ |
| GET | `/creator/videos` | Creator 영상 목록 | ✅ (JWT) |

### 프론트엔드에서 사용해야 할 정확한 API_BASE_URL

**옵션 1 (권장)**: Firebase Functions URL 직접 사용
```
https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

**옵션 2**: Firebase Hosting rewrites 활용 (apiClient.ts 수정 필요)
```
(빈 문자열 또는 https://cms.godcomfortword.com)
```

### 현재 프론트엔드 요청이 왜 잘못되었는지

1. `CMS_API_BASE`가 빈 문자열 (환경 변수 미설정)
2. 상대 경로로 요청 → `https://cms.godcomfortword.com/creator/videos`
3. Firebase Hosting SPA fallback → `/index.html` 반환 → HTML 응답



