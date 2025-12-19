# CORS 설정 수정 완료 요약

## ✅ 수정된 파일 및 코드 Diff

### 1. `server.js` - CORS 설정 개선

**변경 사항:**
- 개발 환경 기본 Origin에 `http://localhost:5173` 추가
- 운영 환경 기본 Origin에 `https://www.godcomfortword.com`, `https://cms.godcomfortword.com` 추가
- 환경변수 `CORS_ORIGINS`로 커스텀 설정 가능
- `allowedHeaders`에 `Accept`, `Origin`, `X-Requested-With` 추가
- `exposedHeaders`에 `Authorization` 추가
- `maxAge: 86400` 추가 (preflight 캐시 24시간)

**코드 Diff (25-98줄):**
```diff
  // CORS 설정
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
+ // 개발 환경 기본 허용 Origin 목록
+ const defaultDevOrigins = [
+   "http://localhost:3000",  // Next.js 홈페이지
+   "http://localhost:5173",  // Vite CMS 프론트엔드
+   "http://127.0.0.1:3000",
+   "http://127.0.0.1:5173",
+ ];
+ 
+ // 운영 환경 기본 허용 Origin 목록
+ const defaultProdOrigins = [
+   "https://www.godcomfortword.com",
+   "https://cms.godcomfortword.com",
+ ];
+ 
+ // 환경변수에서 CORS_ORIGINS를 읽거나 기본값 사용
+ const getCorsOrigins = () => {
+   if (process.env.CORS_ORIGINS) {
+     return process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
+   }
+   return isDevelopment ? defaultDevOrigins : defaultProdOrigins;
+ };
+ 
+ const allowedOrigins = getCorsOrigins();
+ 
  await app.register(cors, {
    origin: (origin, cb) => {
      // 개발 환경에서만 상세 로그
      if (isDevelopment) {
-       console.log(`🌐 CORS Request from origin: ${origin}`);
+       console.log(`🌐 CORS Request from origin: ${origin || '(no origin)'}`);
      }
      // origin이 없으면 (curl/server-to-server/Postman 등) 허용
      if (!origin) {
        cb(null, true);
        return;
      }
      // 허용된 origin이면 통과
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      // 허용되지 않은 origin (경고 로그)
-     console.warn(`⚠️ CORS blocked: ${origin} (Allowed: ${allowedOrigins.join(", ")})`);
+     console.warn(`⚠️ CORS blocked: ${origin}`);
+     console.warn(`   Allowed origins: ${allowedOrigins.join(", ")}`);
      cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true, // 쿠키/인증 헤더 사용 (withCredentials: true 지원)
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // 허용 HTTP 메서드
-   allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"], // 허용 헤더
+   allowedHeaders: [
+     "Content-Type",
+     "Authorization",
+     "X-API-Key",
+     "Accept",
+     "Origin",
+     "X-Requested-With",
+   ], // 허용 요청 헤더
    exposedHeaders: [
      "Content-Length",
      "X-Total-Count",
+     "Authorization",
    ], // 클라이언트에서 접근 가능한 응답 헤더
    preflight: true, // preflight 요청 자동 처리
    optionsSuccessStatus: 204, // OPTIONS 요청 응답 코드
    preflightContinue: false, // preflight 후 다음 핸들러로 전달하지 않음
+   maxAge: 86400, // preflight 결과 캐시 시간 (24시간)
  });
```

### 2. `frontend/src/lib/apiClient.ts` - credentials 추가

**변경 사항:**
- 모든 fetch 요청에 `credentials: "include"` 추가

**코드 Diff:**
```diff
  export async function apiGet<T>(...): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders({ auth: options.auth }),
+     credentials: "include", // CORS credentials 지원
    });
    return handleResponse<T>(response);
  }

  export async function apiPost<T>(...): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders({ auth: options.auth, isFormData: options.isFormData }),
      body,
+     credentials: "include", // CORS credentials 지원
    });
    return handleResponse<T>(response);
  }

  // apiPut, apiPatch, apiDelete에도 동일하게 추가
```

### 3. `frontend/vite.config.ts` - Proxy 옵션 추가 (선택사항)

**변경 사항:**
- Vite 개발 서버에 API 프록시 추가
- `/api/*` 요청을 `http://localhost:8787/*`로 프록시

**코드 Diff:**
```diff
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'

  export default defineConfig({
    plugins: [react()],
+   server: {
+     proxy: {
+       // API 요청을 백엔드 서버로 프록시
+       // 사용 예: /api/auth/login → http://localhost:8787/auth/login
+       '/api': {
+         target: 'http://localhost:8787',
+         changeOrigin: true,
+         rewrite: (path) => path.replace(/^\/api/, ''),
+         secure: false,
+       },
+     },
+   },
  })
```

**참고:** Proxy는 선택사항입니다. 프론트엔드에서 `CMS_API_BASE`를 사용하여 직접 호출하는 방식도 가능합니다.

### 4. `.env` - CORS_ORIGINS 업데이트

**변경 사항:**
- `CORS_ORIGINS`에 `http://localhost:5173` 추가

**변경 전:**
```
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

**변경 후:**
```
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173,https://www.godcomfortword.com,https://cms.godcomfortword.com
```

### 5. `.env.example` - CORS_ORIGINS 예시 업데이트

**변경 사항:**
- 개발/운영 환경 Origin 예시 추가

## ✅ 테스트 결과

### 1. Health Check from localhost:5173
- **Status**: `200 OK`
- **Access-Control-Allow-Origin**: `http://localhost:5173` ✅
- **Access-Control-Allow-Credentials**: `true` ✅

### 2. OPTIONS (Preflight) from localhost:5173
- **Status**: `204 No Content` ✅
- **Access-Control-Allow-Origin**: `http://localhost:5173` ✅
- **Access-Control-Allow-Methods**: `GET, POST, PUT, DELETE, PATCH, OPTIONS` ✅
- **Access-Control-Allow-Headers**: `Content-Type, Authorization, X-API-Key, Accept, Origin, X-Requested-With` ✅

### 3. Login API from localhost:5173
- **Status**: `200 OK` ✅
- **Access-Control-Allow-Origin**: `http://localhost:5173` ✅
- **Token**: 정상 수신 ✅

### 4. Login API from localhost:3000
- **Status**: `200 OK` ✅

## ✅ 허용된 Origin 목록

### 개발 환경 (기본값)
- `http://localhost:3000` - Next.js 홈페이지
- `http://localhost:5173` - Vite CMS 프론트엔드
- `http://127.0.0.1:3000`
- `http://127.0.0.1:5173`

### 운영 환경 (기본값)
- `https://www.godcomfortword.com`
- `https://cms.godcomfortword.com`

### 환경변수로 커스터마이징
`.env` 파일에 `CORS_ORIGINS`를 설정하면 기본값 대신 사용됩니다:
```
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://www.godcomfortword.com
```

## ✅ CORS 설정 상세

### 허용된 HTTP 메서드
- GET, POST, PUT, DELETE, PATCH, OPTIONS

### 허용된 요청 헤더
- `Content-Type`
- `Authorization` (JWT 토큰)
- `X-API-Key`
- `Accept`
- `Origin`
- `X-Requested-With`

### 노출된 응답 헤더
- `Content-Length`
- `X-Total-Count`
- `Authorization`

### 기타 설정
- `credentials: true` - 쿠키/인증 헤더 지원
- `preflight: true` - OPTIONS 요청 자동 처리
- `maxAge: 86400` - Preflight 결과 24시간 캐시

## 📝 Vite Proxy 사용 방법 (선택사항)

프론트엔드에서 Vite Proxy를 사용하려면:

1. **vite.config.ts**에 proxy 설정 추가 (이미 완료)
2. **config.ts**에서 API 베이스 URL 변경:
   ```typescript
   // Proxy 사용 시
   export const CMS_API_BASE = "/api";
   
   // 직접 호출 시 (현재)
   export const CMS_API_BASE = import.meta.env.VITE_CMS_API_BASE_URL || "http://localhost:8787";
   ```

**장점:**
- CORS 문제 완전 회피
- 개발 환경에서 간단한 설정

**단점:**
- 운영 환경에서는 여전히 CORS 설정 필요
- 프록시 오버헤드

**권장사항:**
- 개발 환경: Proxy 사용 가능 (선택사항)
- 운영 환경: 백엔드 CORS 설정 필수 (현재 완료)

## ✅ 최종 확인 사항

- [x] `http://localhost:5173`에서 API 호출 허용
- [x] `http://localhost:3000`에서 API 호출 허용
- [x] `https://cms.godcomfortword.com`에서 API 호출 허용
- [x] `https://www.godcomfortword.com`에서 API 호출 허용
- [x] OPTIONS (preflight) 요청 처리
- [x] Authorization 헤더 허용
- [x] credentials 지원 (쿠키/토큰)
- [x] 환경변수로 Origin 관리 가능
- [x] 로그인 API 200/201 응답 확인

## 🎯 결과

**CMS 로그인 버튼 클릭 시 네트워크에서 200/201 응답이 정상적으로 반환됩니다.**

### 테스트 결과
- ✅ `http://localhost:5173` → `http://localhost:8787/auth/login` → `200 OK`
- ✅ `http://localhost:3000` → `http://localhost:8787/auth/login` → `200 OK`
- ✅ OPTIONS (preflight) → `204 No Content`
- ✅ CORS 헤더 정상 반환



























