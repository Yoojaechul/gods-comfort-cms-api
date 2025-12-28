# Firebase Hosting 설정 분석 및 해결 전략

## 1. firebase.json 분석

### 현재 설정
```json
{
  "hosting": {
    "site": "gods-comfort-word-cms",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

### 설정 분석

| 항목 | 값 | 의미 |
|------|-----|------|
| `site` | `gods-comfort-word-cms` | Firebase Hosting 사이트 ID |
| `public` | `dist` | 배포할 빌드 출력 디렉토리 |
| `rewrites[0].source` | `**` | 모든 경로 매칭 (와일드카드) |
| `rewrites[0].destination` | `/index.html` | 모든 경로를 index.html로 rewrite |

**문제점:**
- `"source": "**"`가 모든 HTTP 요청을 `index.html`로 rewrite함
- `/creator/videos`, `/auth/login` 같은 API 경로도 HTML로 반환됨
- 브라우저에서 직접 API 경로 접근 시 HTML 응답 수신

---

## 2. 해결 전략: SPA rewrite 유지 + API 분리

### ✅ 권장 방법: 별도 도메인 구조 (현재 구조 유지)

**아키텍처:**
```
┌──────────────────────────────────────┐
│  cms.godcomfortword.com              │
│  (Firebase Hosting - SPA만 제공)     │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ React SPA (Vite build)        │  │
│  │ - /login                      │  │
│  │ - /admin/*                    │  │
│  │ - /creator/*                  │  │
│  │ - /change-password            │  │
│  └────────────────────────────────┘  │
│           │                           │
│           │ API 호출 (절대 URL)       │
│           │                           │
└───────────┼───────────────────────────┘
            │
            │ HTTPS
            ▼
┌──────────────────────────────────────┐
│  api.godcomfortword.com              │
│  (별도 API 서버)                     │
│  - /auth/login                       │
│  - /auth/change-password             │
│  - /creator/videos                   │
│  - /admin/videos                     │
│  - /videos                           │
└──────────────────────────────────────┘
```

### firebase.json 설정 (변경 불필요)

**현재 설정 그대로 유지:**
```json
{
  "hosting": {
    "site": "gods-comfort-word-cms",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

**설명:**
- 모든 경로를 `index.html`로 rewrite (SPA 라우팅)
- 프론트엔드 JavaScript가 **절대 URL**로 별도 API 서버에 요청
- Firebase Hosting은 SPA만 제공, API는 처리하지 않음

### 동작 방식

1. **사용자가 브라우저에서 접근:**
   ```
   https://cms.godcomfortword.com/creator/my-videos
   ```

2. **Firebase Hosting 처리:**
   - 모든 경로(`**`)를 `/index.html`로 rewrite
   - `index.html` 반환 (React SPA 로드)

3. **React SPA 동작:**
   - React Router가 `/creator/my-videos` 경로 인식
   - `CreatorMyVideosPage` 컴포넌트 렌더링

4. **API 호출:**
   ```javascript
   // 프론트엔드 코드
   const data = await apiGet("/creator/videos");
   // 실제 요청: https://api.godcomfortword.com/creator/videos
   ```
   - `CMS_API_BASE` 환경 변수 사용
   - 절대 URL로 API 서버에 직접 요청
   - Firebase Hosting을 거치지 않음

**결과:**
- ✅ SPA 라우팅 정상 동작
- ✅ API 요청은 별도 서버로 전송
- ✅ Firebase Hosting은 SPA만 제공

---

## 3. 최소 수정안 (같은 도메인 사용 시 - 비권장)

### ⚠️ 중요한 사실

**Firebase Hosting은 정적 파일만 제공 가능합니다.**
- HTML, CSS, JavaScript, 이미지 등 정적 파일만 서빙
- API는 제공할 수 없음
- 동적 콘텐츠를 제공하려면 추가 서비스 필요

### 방법 1: API 경로를 404로 처리 (의미 없음)

```json
{
  "hosting": {
    "site": "gods-comfort-word-cms",
    "public": "dist",
    "rewrites": [
      {
        "source": "/auth/**",
        "type": 404
      },
      {
        "source": "/creator/**",
        "type": 404
      },
      {
        "source": "/admin/**",
        "type": 404
      },
      {
        "source": "/videos/**",
        "type": 404
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

**문제점:**
- API 경로가 404를 반환하므로 사용 불가
- 실제로는 API 서버가 별도로 필요
- 의미 없는 설정

### 방법 2: Firebase Functions로 API 프록시 (복잡함)

#### 2-1. firebase.json 수정

```json
{
  "hosting": {
    "site": "gods-comfort-word-cms",
    "public": "dist",
    "rewrites": [
      {
        "source": "/api/**",
        "function": "apiProxy",
        "region": "asia-northeast1"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs18"
  }
}
```

#### 2-2. Firebase Functions 코드 필요

```javascript
// functions/index.js
const functions = require('firebase-functions');
const fetch = require('node-fetch');

exports.apiProxy = functions
  .region('asia-northeast1')
  .https.onRequest(async (req, res) => {
    const apiBaseUrl = 'https://api.godcomfortword.com';
    const path = req.path.replace('/api', '');
    const url = `${apiBaseUrl}${path}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    
    try {
      const response = await fetch(url, {
        method: req.method,
        headers: req.headers,
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      });
      
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
```

#### 2-3. 프론트엔드 코드 수정 필요

```typescript
// API 경로를 /api/*로 변경해야 함
const data = await apiGet("/api/creator/videos");
// 실제 요청: https://cms.godcomfortword.com/api/creator/videos
// → Firebase Functions로 프록시 → https://api.godcomfortword.com/creator/videos
```

**단점:**
- ❌ Firebase Functions 설정 필요
- ❌ 콜드 스타트 지연 가능
- ❌ 비용 증가 (함수 호출 횟수 기반)
- ❌ 프론트엔드 코드 수정 필요 (API 경로 변경)
- ❌ 복잡도 증가
- ❌ 성능 저하

---

## 4. 권장 구조 구현

### 현재 구현 상태

**프론트엔드 코드는 이미 올바르게 구현되어 있습니다:**

1. **환경 변수 기반 API Base URL**
   ```typescript
   // src/config.ts
   const apiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL || "";
   ```

2. **절대 URL로 API 요청**
   ```typescript
   // src/lib/apiClient.ts
   const url = buildUrl(CMS_API_BASE, path);
   // 예: "https://api.godcomfortword.com/creator/videos"
   ```

3. **SPA 도메인 차단 로직**
   ```typescript
   // src/config.ts
   if (apiHost === currentHost || apiHost.includes("cms.godcomfortword.com")) {
     throw new Error("API_BASE_URL cannot point to SPA hosting domain...");
   }
   ```

### 프로덕션 배포 단계

1. **`.env.production` 파일 설정:**
   ```env
   VITE_API_BASE_URL=https://api.godcomfortword.com
   ```

2. **빌드:**
   ```bash
   npm run build
   ```

3. **Firebase 배포:**
   ```bash
   firebase deploy --only hosting
   ```

**firebase.json 변경 불필요!**

---

## 5. 비교: 권장 vs 비권장

| 항목 | 별도 도메인 (권장) | Firebase Functions 프록시 (비권장) |
|------|-------------------|----------------------------------|
| **복잡도** | ⭐ 낮음 | ⭐⭐⭐ 높음 |
| **성능** | ⭐⭐⭐ 우수 (직접 연결) | ⭐⭐ 보통 (프록시 오버헤드) |
| **비용** | ⭐⭐⭐ 낮음 | ⭐⭐ 보통 (함수 호출 비용) |
| **확장성** | ⭐⭐⭐ 우수 | ⭐⭐ 보통 |
| **유지보수** | ⭐⭐⭐ 쉬움 | ⭐ 어려움 |
| **firebase.json 변경** | ❌ 불필요 | ✅ 필요 |
| **프론트엔드 코드 변경** | ❌ 불필요 | ✅ 필요 |
| **추가 설정** | ❌ 없음 | ✅ Firebase Functions 설정 필요 |

---

## 6. 최종 권장 사항

### ✅ 권장: 현재 구조 유지

**firebase.json:**
```json
{
  "hosting": {
    "site": "gods-comfort-word-cms",
    "public": "dist",
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```
→ **변경 불필요**

**프론트엔드:**
- 환경 변수로 API 서버 주소 설정
- 절대 URL로 API 요청
- 이미 구현되어 있음 ✅

**필요한 작업:**
1. `.env.production`에 올바른 API 서버 주소 설정
2. 빌드 및 배포

### ❌ 비권장: 같은 도메인 사용

**이유:**
1. Firebase Hosting은 정적 파일만 제공
2. API 제공을 위해 Firebase Functions/Cloud Run 필요
3. 복잡도, 비용, 성능 저하 발생
4. 프론트엔드 코드 수정 필요

---

## 7. 체크리스트

### 현재 상태
- [x] firebase.json에 SPA rewrite 규칙 존재
- [x] 프론트엔드 코드가 별도 API 서버 사용하도록 구현됨
- [ ] `.env.production`에 올바른 API 서버 주소 설정 필요

### 프로덕션 배포 전
- [ ] `.env.production` 파일 확인
  ```env
  VITE_API_BASE_URL=https://api.godcomfortword.com
  ```
- [ ] 빌드 후 Network 탭에서 실제 API 요청 URL 확인
- [ ] 브라우저 콘솔에서 환경 변수 확인
- [ ] API 서버가 실제로 동작하는지 확인

---

## 결론

**firebase.json은 그대로 유지하고, 프론트엔드 환경 변수만 올바르게 설정하면 됩니다.**

Firebase Hosting은 SPA만 제공하고, API는 별도 서버에서 제공하는 구조가 가장 단순하고 효율적입니다.

**핵심:**
- ✅ Firebase Hosting = SPA만 제공
- ✅ API 서버 = 별도 도메인 (`api.godcomfortword.com`)
- ✅ 프론트엔드 = 환경 변수로 API 서버 주소 설정
- ✅ firebase.json = 변경 불필요













