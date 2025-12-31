# Firebase Hosting 설정 가이드

## 현재 상황 분석

### 현재 firebase.json 설정
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

**문제점:**
- `"source": "**"` 규칙이 모든 경로를 `index.html`로 rewrite함
- `/creator/videos`, `/auth/login` 같은 API 요청도 HTML로 반환됨
- 하지만 **프론트엔드 코드는 이미 별도 API 서버로 요청하도록 수정됨**

## 해결 전략

### ✅ 권장 방법: 별도 도메인 사용 (현재 구현됨)

**구조:**
- **SPA**: `https://cms.godcomfortword.com` (Firebase Hosting)
- **API**: `https://api.godcomfortword.com` (별도 API 서버)

**장점:**
- ✅ SPA와 API 완전 분리
- ✅ API 서버 독립적 스케일링 가능
- ✅ CORS 설정 명확
- ✅ 보안 정책 분리 가능

**firebase.json 수정 불필요:**
현재 프론트엔드 코드가 이미 별도 API 서버를 사용하므로, firebase.json은 그대로 유지해도 됩니다.

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

**프로덕션 빌드 시:**
```bash
VITE_API_BASE_URL=https://api.godcomfortword.com npm run build
firebase deploy --only hosting
```

---

### 🔧 최소 수정안: Firebase Hosting에서 API 경로 제외

만약 같은 도메인에서 API를 제공해야 하는 경우(권장하지 않음):

#### 방법 1: API 경로를 404로 처리 (Firebase Functions 사용)

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

**⚠️ 문제점:**
- API 경로가 404를 반환하므로 실제로는 사용 불가
- 같은 도메인에서 API를 제공하려면 Firebase Functions나 Cloud Run 필요
- 복잡도 증가 및 성능 저하 가능

#### 방법 2: Firebase Functions로 API 프록시 (비권장)

```json
{
  "hosting": {
    "site": "gods-comfort-word-cms",
    "public": "dist",
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
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

**⚠️ 문제점:**
- Firebase Functions는 콜드 스타트 지연 가능
- 비용 증가 (함수 호출 횟수에 따라)
- API 경로 변경 필요 (예: `/api/auth/login`)

---

## 권장 아키텍처

### 현재 구조 (권장) ✅

```
┌─────────────────────────────────┐
│  cms.godcomfortword.com         │
│  (Firebase Hosting)             │
│  ┌───────────────────────────┐  │
│  │ SPA (React + Vite)        │  │
│  │ - /login                  │  │
│  │ - /admin/*                │  │
│  │ - /creator/*              │  │
│  └───────────────────────────┘  │
│           │                      │
│           │ API 호출             │
│           ▼                      │
└───────────┼──────────────────────┘
            │
            │ HTTPS
            ▼
┌─────────────────────────────────┐
│  api.godcomfortword.com         │
│  (별도 API 서버)                │
│  - /auth/login                  │
│  - /auth/change-password        │
│  - /creator/videos              │
│  - /admin/videos                │
└─────────────────────────────────┘
```

**firebase.json:**
```json
{
  "hosting": {
    "site": "gods-comfort-word-cms",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

---

## 프론트엔드 코드 수정 불필요

프론트엔드 코드는 이미 별도 API 서버를 사용하도록 수정되었습니다:

- ✅ `src/config.ts`: 환경 변수에서 API 서버 URL 읽기
- ✅ `src/lib/apiClient.ts`: 절대 URL로 API 요청
- ✅ SPA 도메인과 API 도메인 차단 로직 포함

**프로덕션 배포 시:**
```bash
# 1. 환경 변수 설정 후 빌드
VITE_API_BASE_URL=https://api.godcomfortword.com npm run build

# 2. Firebase에 배포
firebase deploy --only hosting
```

---

## 추가 최적화 (선택사항)

### 1. 정적 에셋 캐싱 최적화

```json
{
  "hosting": {
    "site": "gods-comfort-word-cms",
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|woff|woff2|ttf|eot)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "/index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      }
    ]
  }
}
```

### 2. 에러 페이지 커스터마이징 (선택사항)

```json
{
  "hosting": {
    "site": "gods-comfort-word-cms",
    "public": "dist",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "errorDocument": "/index.html"
  }
}
```

---

## 결론

### ✅ 현재 권장 구조 (이미 구현됨)

1. **firebase.json은 그대로 유지**
   - 모든 경로를 `index.html`로 rewrite (SPA 동작)

2. **프론트엔드 코드는 별도 API 서버 사용**
   - `VITE_API_BASE_URL=https://api.godcomfortword.com` 설정

3. **프로덕션 배포:**
   ```bash
   VITE_API_BASE_URL=https://api.godcomfortword.com npm run build
   firebase deploy --only hosting
   ```

### ❌ 같은 도메인 사용 시 문제점

- Firebase Hosting은 정적 파일만 제공
- API는 Firebase Functions나 Cloud Run 필요 → 비용 및 복잡도 증가
- 권장하지 않음

### 📝 요약

**현재 firebase.json 설정은 올바릅니다.** 프론트엔드가 별도 API 서버(`api.godcomfortword.com`)를 사용하므로, Firebase Hosting은 SPA만 제공하면 됩니다. API 경로에 대한 특별한 처리나 rewrite 규칙이 필요하지 않습니다.



















