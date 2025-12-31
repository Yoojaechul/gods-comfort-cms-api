# API 호출 문제 최종 수정 요약

## 🔴 문제 발생 원인

### 1. `.env.production` 파일의 잘못된 설정

**현재 설정 (잘못됨):**
```env
VITE_API_BASE_URL=https://cms.godcomfortword.com
VITE_CMS_API_BASE=https://cms.godcomfortword.com
```

**문제점:**
- `cms.godcomfortword.com`은 SPA 호스팅 도메인 (Firebase Hosting)
- 이 도메인으로 API 요청 시 Firebase Hosting이 `index.html`을 반환
- 결과: HTML 응답 수신 → "API endpoint mismatch (received HTML)" 오류

### 2. `src/utils/videoMetadata.ts`의 위험한 fallback

**이전 코드 (문제):**
```typescript
const base =
  (import.meta as any).env?.VITE_CMS_API_BASE_URL ||
  (import.meta as any).env?.VITE_API_BASE_URL ||
  window.location.origin; // ⚠️ 위험: SPA 도메인으로 API 요청
```

**문제점:**
- 환경 변수가 없으면 `window.location.origin` 사용
- 프로덕션에서 `https://cms.godcomfortword.com`으로 API 요청됨

---

## ✅ 수정 내용

### 1. `src/utils/videoMetadata.ts` 수정

**수정된 코드:**
```typescript
// CMS_API_BASE를 사용 (환경 변수 기반, SPA 도메인 차단 로직 포함)
// window.location.origin fallback 제거 (SPA 도메인으로 API 요청하는 것 방지)
const base = CMS_API_BASE;

if (!base || !base.trim()) {
  throw new Error(
    "API base URL is not configured. Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL environment variable."
  );
}
```

**효과:**
- `window.location.origin` fallback 제거
- 환경 변수가 없으면 명확한 에러 발생
- `CMS_API_BASE`를 사용하여 SPA 도메인 차단 로직 활용

### 2. `.env.production` 파일 수정 필요

**수정 방법:**
`.env.production` 파일을 열어서 다음 내용으로 변경:

```env
# Production API Base URL
# ⚠️ 중요: API 서버는 SPA 호스팅 도메인과 별도의 도메인을 사용해야 합니다.
# SPA: https://cms.godcomfortword.com (Firebase Hosting)
# API: https://api.godcomfortword.com (별도 API 서버)

VITE_API_BASE_URL=https://api.godcomfortword.com
```

**주의:**
- `VITE_CMS_API_BASE` 줄은 제거하거나 `VITE_CMS_API_BASE_URL`로 변경
- 실제 API 서버 주소(`https://api.godcomfortword.com`)로 변경 필요

---

## 📋 CreatorMyVideosPage 기준 실제 동작

### 호출 코드

```typescript
// src/pages/CreatorMyVideosPage.tsx:32
const data = await apiGet<any>("/creator/videos");
```

### 호출 흐름

1. **apiGet 함수 호출**
   ```typescript
   // src/lib/apiClient.ts:147
   export function apiGet(path: string) {
     return apiRequest(path, { method: "GET" });
   }
   ```

2. **apiRequest 함수에서 URL 생성**
   ```typescript
   // src/lib/apiClient.ts:49-67
   export async function apiRequest(path: string, options: RequestInit = {}) {
     // CMS_API_BASE 검증 (빈 문자열 체크)
     if (!CMS_API_BASE || !CMS_API_BASE.trim()) {
       throw new Error("API base URL is not configured...");
     }
     
     // path가 상대 경로인지 확인
     if (path.startsWith("http://") || path.startsWith("https://")) {
       throw new Error("apiRequest path must be relative...");
     }
     
     // buildUrl로 최종 URL 생성
     const url = buildUrl(CMS_API_BASE, path);
     // 예: "https://api.godcomfortword.com/creator/videos"
   }
   ```

3. **buildUrl 함수에서 URL 검증 및 생성**
   ```typescript
   // src/lib/apiClient.ts:8-43
   function buildUrl(baseUrl: string, path: string): string {
     // baseUrl 검증 (빈 문자열, 형식, URL 파싱, SPA 도메인 차단)
     // ...
     
     // URL 생성
     const cleanBase = trimmed.replace(/\/+$/, ""); // "https://api.godcomfortword.com"
     const cleanPath = path.startsWith("/") ? path : `/${path}`; // "/creator/videos"
     return `${cleanBase}${cleanPath}`; // "https://api.godcomfortword.com/creator/videos"
   }
   ```

4. **config.ts에서 SPA 도메인 차단**
   ```typescript
   // src/config.ts:44-66
   if (typeof window !== "undefined") {
     const currentHost = window.location.hostname;
     const apiHost = new URL(trimmed).hostname;
     
     // SPA 호스팅 도메인과 동일하면 에러
     if (apiHost === currentHost || apiHost.includes("cms.godcomfortword.com")) {
       if (currentHost !== "localhost" && currentHost !== "127.0.0.1") {
         throw new Error("API_BASE_URL cannot point to SPA hosting domain...");
       }
     }
   }
   ```

### 올바른 설정 시 실제 요청 URL

**환경 변수 설정:**
```env
VITE_API_BASE_URL=https://api.godcomfortword.com
```

**실제 요청:**
```
GET https://api.godcomfortword.com/creator/videos
Authorization: Bearer <token>
Content-Type: application/json
```

### 잘못된 설정 시 에러

**잘못된 환경 변수:**
```env
VITE_API_BASE_URL=https://cms.godcomfortword.com
```

**에러 발생:**
1. `config.ts`에서 런타임 에러:
   ```
   API_BASE_URL cannot point to SPA hosting domain.
   Please set VITE_API_BASE_URL to a separate API server (e.g., https://api.godcomfortword.com).
   Current: https://cms.godcomfortword.com
   ```
2. 또는 API 호출은 성공하지만 HTML 응답 수신:
   ```
   API endpoint mismatch (received HTML). Check API_BASE_URL. (URL: https://cms.godcomfortword.com/creator/videos)
   ```

---

## 🔧 수정된 파일 목록

1. **`src/utils/videoMetadata.ts`**
   - `window.location.origin` fallback 제거
   - `CMS_API_BASE` 사용으로 통일
   - 환경 변수 없을 때 명확한 에러 발생

2. **`.env.production`** (수동 수정 필요)
   - `VITE_API_BASE_URL=https://api.godcomfortword.com`로 변경
   - 잘못된 `VITE_CMS_API_BASE` 제거 또는 수정

---

## 📝 프로덕션 배포 체크리스트

1. ✅ `.env.production` 파일 확인 및 수정
   ```env
   VITE_API_BASE_URL=https://api.godcomfortword.com
   ```

2. ✅ 빌드 실행
   ```bash
   npm run build
   ```

3. ✅ 빌드된 파일 확인
   - 브라우저 콘솔에서 `import.meta.env.VITE_API_BASE_URL` 확인
   - Network 탭에서 실제 요청 URL 확인

4. ✅ Firebase 배포
   ```bash
   firebase deploy --only hosting
   ```

---

## 🎯 핵심 개선 사항

1. ✅ SPA 도메인으로 API 요청하는 것을 완전 차단
2. ✅ `window.location.origin` fallback 제거
3. ✅ 환경 변수 없을 때 명확한 에러 발생
4. ✅ 모든 API 호출이 `CMS_API_BASE`를 통해 절대 URL로 생성
5. ✅ 빈 문자열, 잘못된 URL 형식, SPA 도메인 모두 검증

---

## ❓ 왜 문제가 발생했는가?

1. **`.env.production` 파일의 잘못된 설정**
   - SPA 호스팅 도메인을 API 서버로 설정
   - Vite 빌드 시 이 값이 번들에 포함됨

2. **`videoMetadata.ts`의 위험한 fallback**
   - 환경 변수가 없을 때 `window.location.origin` 사용
   - 프로덕션에서 현재 도메인으로 API 요청

3. **Firebase Hosting의 SPA rewrite**
   - 모든 경로가 `index.html`로 rewrite됨
   - API 경로도 HTML 반환

**해결:**
- 환경 변수를 올바른 API 서버 주소로 설정
- `window.location.origin` fallback 제거
- 모든 API 호출이 절대 URL로 생성되도록 보장

















