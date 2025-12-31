# API 호출 수정 설명

## 문제 발생 원인

### 원래 문제
- `/creator/my-videos` 화면에서 videos API 요청이 `https://cms.godcomfortword.com/creator/videos`로 나가고 있었음
- 이 URL은 Firebase Hosting SPA이므로 HTML(index.html)을 반환함
- 결과적으로 "API endpoint mismatch (received HTML)" 오류 발생

### 왜 문제가 발생했는가?

1. **환경 변수 미설정 또는 잘못된 설정**
   - 프로덕션 빌드 시 `VITE_API_BASE_URL` 환경 변수가 설정되지 않았거나
   - 환경 변수가 SPA 호스팅 도메인(`https://cms.godcomfortword.com`)을 가리키고 있었음

2. **빈 문자열 처리**
   - 환경 변수가 없으면 `CMS_API_BASE`가 빈 문자열 `""`이 됨
   - `apiClient.ts`의 `buildUrl` 함수에서 빈 문자열을 체크하지만, 실제로는 프로덕션에서 다른 값으로 설정되어 있었을 가능성

3. **SPA 도메인과 API 서버 도메인 혼동**
   - SPA는 `https://cms.godcomfortword.com` (Firebase Hosting)
   - API 서버는 별도 도메인 (예: `https://api.godcomfortword.com`)이어야 함
   - 두 도메인이 같으면 안 됨

## 수정 내용

### 1. `src/config.ts` - SPA 도메인 차단 로직 추가

**수정 전:**
```typescript
const getApiBase = (): string => {
  const env = import.meta.env;
  const apiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL || "";
  const trimmed = apiBase.trim();
  if (!trimmed) {
    // 에러 메시지만 출력하고 빈 문자열 반환
    return "";
  }
  return trimmed;
};
```

**수정 후:**
```typescript
const getApiBase = (): string => {
  const env = import.meta.env;
  const apiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL || "";
  const trimmed = apiBase.trim();
  
  // ... 빈 문자열 체크 ...
  
  // ⚠️ SPA 호스팅 도메인을 가리키는 경우 차단 (프로덕션 환경에서만)
  if (typeof window !== "undefined") {
    const currentHost = window.location.hostname;
    const apiHost = new URL(trimmed).hostname;
    
    // SPA 호스팅 도메인과 동일하면 에러
    if (apiHost === currentHost || apiHost.includes("cms.godcomfortword.com")) {
      console.error(/* 에러 메시지 */);
      if (currentHost !== "localhost" && currentHost !== "127.0.0.1") {
        throw new Error(/* 상세 에러 메시지 */);
      }
    }
  }
  
  return trimmed;
};
```

**효과:**
- `cms.godcomfortword.com`을 가리키는 API_BASE_URL 설정 시 런타임 에러 발생
- 프로덕션에서 잘못된 설정을 즉시 감지 가능

### 2. `src/lib/apiClient.ts` - URL 검증 강화

**수정 전:**
```typescript
function buildUrl(baseUrl: string, path: string): string {
  if (!baseUrl || !baseUrl.trim()) {
    throw new Error("CMS_API_BASE is not configured...");
  }
  const cleanBase = baseUrl.trim().replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}
```

**수정 후:**
```typescript
function buildUrl(baseUrl: string, path: string): string {
  if (!baseUrl || !baseUrl.trim()) {
    throw new Error(/* 상세 에러 메시지 */);
  }
  
  const trimmed = baseUrl.trim();
  
  // 절대 URL 형식인지 확인
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    throw new Error(/* 상세 에러 메시지 */);
  }
  
  // URL 파싱 검증
  try {
    const urlObj = new URL(trimmed);
    if (!urlObj.hostname) {
      throw new Error(/* 에러 메시지 */);
    }
  } catch (e) {
    throw new Error(/* 상세 에러 메시지 */);
  }
  
  // ... 기존 로직 ...
}
```

**추가: `apiRequest` 함수에 path 검증**

```typescript
export async function apiRequest(path: string, options: RequestInit = {}) {
  // ... 기존 코드 ...
  
  // path가 상대 경로인지 확인 (절대 경로는 허용하지 않음)
  if (path.startsWith("http://") || path.startsWith("https://")) {
    throw new Error(
      `apiRequest path must be relative (e.g., "/creator/videos"), not absolute URL. ` +
      `Received: "${path}". Use CMS_API_BASE environment variable to configure the API server base URL.`
    );
  }
  
  const url = buildUrl(CMS_API_BASE, path);
  // ... 나머지 코드 ...
}
```

**효과:**
- 잘못된 URL 형식 즉시 감지
- 절대 경로를 path로 사용하는 실수 방지
- 더 명확한 에러 메시지 제공

## CreatorMyVideosPage에서의 실제 동작

### 호출 흐름

1. **컴포넌트에서 API 호출**
   ```typescript
   // src/pages/CreatorMyVideosPage.tsx:32
   const data = await apiGet<any>("/creator/videos");
   ```

2. **apiClient.ts의 apiGet 함수**
   ```typescript
   // src/lib/apiClient.ts:113
   export function apiGet(path: string) {
     return apiRequest(path, { method: "GET" });
   }
   ```

3. **apiRequest 함수에서 URL 생성**
   ```typescript
   // src/lib/apiClient.ts:49-59
   export async function apiRequest(path: string, options: RequestInit = {}) {
     // CMS_API_BASE 검증 (빈 문자열 체크)
     if (!CMS_API_BASE || !CMS_API_BASE.trim()) {
       throw new Error(/* 에러 메시지 */);
     }
     
     // path가 상대 경로인지 확인
     if (path.startsWith("http://") || path.startsWith("https://")) {
       throw new Error(/* 에러 메시지 */);
     }
     
     // buildUrl로 최종 URL 생성
     const url = buildUrl(CMS_API_BASE, path);
     // url = "https://api.godcomfortword.com/creator/videos"
   }
   ```

4. **buildUrl 함수에서 URL 검증 및 생성**
   ```typescript
   // src/lib/apiClient.ts:8-43
   function buildUrl(baseUrl: string, path: string): string {
     // baseUrl 검증 (빈 문자열, 형식, URL 파싱)
     // ...
     
     // URL 생성
     const cleanBase = trimmed.replace(/\/+$/, ""); // "https://api.godcomfortword.com"
     const cleanPath = path.startsWith("/") ? path : `/${path}`; // "/creator/videos"
     return `${cleanBase}${cleanPath}`; // "https://api.godcomfortword.com/creator/videos"
   }
   ```

### 올바른 설정 시 실제 요청 URL

**환경 변수 설정:**
```bash
VITE_API_BASE_URL=https://api.godcomfortword.com npm run build
```

**실제 요청 URL:**
```
GET https://api.godcomfortword.com/creator/videos
Authorization: Bearer <token>
Content-Type: application/json
```

### 잘못된 설정 시 에러

**잘못된 환경 변수 설정:**
```bash
# 잘못된 설정 1: 환경 변수 미설정
npm run build  # CMS_API_BASE가 빈 문자열

# 잘못된 설정 2: SPA 도메인을 가리킴
VITE_API_BASE_URL=https://cms.godcomfortword.com npm run build
```

**에러 발생:**
1. 환경 변수 미설정 시:
   - `apiRequest` 함수에서: "API base URL is not configured..."
   - API 호출 자체가 실패

2. SPA 도메인을 가리키는 경우:
   - `config.ts`에서 런타임 에러 발생
   - 또는 API 호출은 성공하지만 HTML 응답 수신
   - `apiClient.ts`에서 "API endpoint mismatch (received HTML)" 에러

## 프로덕션 배포 시 필수 설정

### 방법 1: 빌드 시 환경 변수 설정
```bash
VITE_API_BASE_URL=https://api.godcomfortword.com npm run build
```

### 방법 2: .env.production 파일 사용
프로젝트 루트에 `.env.production` 파일 생성:
```env
VITE_API_BASE_URL=https://api.godcomfortword.com
```

그리고 빌드:
```bash
npm run build
```

### 확인 방법

빌드 후 브라우저 콘솔에서:
```javascript
// 브라우저 콘솔에서
console.log(import.meta.env.VITE_API_BASE_URL);
// 예상 출력: "https://api.godcomfortword.com"
```

Network 탭에서 실제 요청 URL 확인:
- ✅ 올바름: `https://api.godcomfortword.com/creator/videos`
- ❌ 잘못됨: `https://cms.godcomfortword.com/creator/videos`

## 수정된 파일 목록

1. `src/config.ts`
   - SPA 도메인 차단 로직 추가
   - 에러 메시지 개선

2. `src/lib/apiClient.ts`
   - `buildUrl` 함수에 URL 검증 강화
   - `apiRequest` 함수에 path 검증 추가
   - 에러 메시지 개선

## 핵심 개선 사항

1. ✅ SPA 호스팅 도메인을 API 서버로 사용하는 것을 런타임에 차단
2. ✅ 빈 문자열 및 잘못된 URL 형식 즉시 감지
3. ✅ 절대 경로를 path로 사용하는 실수 방지
4. ✅ 명확한 에러 메시지로 문제 진단 용이
5. ✅ 모든 API 호출이 `apiClient`를 통해 절대 URL로 생성됨















