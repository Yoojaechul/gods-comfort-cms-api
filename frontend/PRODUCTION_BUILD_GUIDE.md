# 프로덕션 빌드 가이드

## 빠른 시작

### 1. `.env.production` 파일 설정

프로젝트 루트에 `.env.production` 파일을 생성하거나 수정:

```env
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com
```

**⚠️ 중요:** 
- `https://cms.godcomfortword.com` (SPA 도메인)을 사용하면 안 됩니다
- 반드시 별도의 API 서버 주소를 사용하세요

### 2. 빌드

```bash
npm run build
```

### 3. 배포

```bash
firebase deploy --only hosting
```

---

## CreatorMyVideosPage 기준 실제 동작

### 코드

```typescript
// src/pages/CreatorMyVideosPage.tsx:32
const data = await apiGet<any>("/creator/videos");
```

### 처리 흐름

1. `apiGet("/creator/videos")` 호출
2. `apiRequest` 함수에서:
   - `CMS_API_BASE` 검증
   - `buildUrl(CMS_API_BASE, "/creator/videos")` 호출
   - 최종 URL 생성: `https://api.godcomfortword.com/creator/videos`
3. `fetch(url)` 호출
4. 응답 검증 (HTML 응답 감지)

### 실제 요청 URL (올바른 설정 시)

```
GET https://api.godcomfortword.com/creator/videos
Authorization: Bearer <token>
Content-Type: application/json
```

---

## 수정된 파일 목록

1. **`src/config.ts`**
   - SPA 도메인 차단 로직 강화 (빌드 타임 및 런타임)
   - 에러 메시지 개선

2. **`src/lib/apiClient.ts`**
   - HTML 응답 감지 강화
   - 명확한 에러 메시지 (API_BASE_URL이 잘못 설정되었음을 명시)

3. **`src/utils/videoMetadata.ts`** (이전에 수정됨)
   - `window.location.origin` fallback 제거
   - `CMS_API_BASE` 사용으로 통일

4. **`ENV_SETUP_GUIDE.md`** (새 파일)
   - 환경 변수 설정 가이드

5. **`PRODUCTION_BUILD_GUIDE.md`** (이 파일)
   - 프로덕션 빌드 가이드

---

## 핵심 검증 로직

### 1. config.ts에서 SPA 도메인 차단

```typescript
// 빌드 타임 및 런타임 모두에서 검증
if (apiHostname.includes("cms.godcomfortword.com")) {
  throw new Error("API_BASE_URL cannot point to SPA hosting domain...");
}
```

### 2. apiClient.ts에서 HTML 응답 감지

```typescript
// Content-Type 또는 응답 본문으로 HTML 감지
if (isHtmlResponse || isHtmlContent) {
  throw new Error(
    "API endpoint mismatch: Received HTML instead of JSON. " +
    "The API_BASE_URL may be pointing to the SPA hosting domain..."
  );
}
```

---

## 문제 해결

### 문제: API 요청이 SPA 도메인으로 나감

**증상:**
- Network 탭에서 `https://cms.godcomfortword.com/creator/videos` 요청
- HTML 404 응답 수신
- "API endpoint mismatch (received HTML)" 에러

**원인:**
- `.env.production`에 잘못된 설정
- 또는 환경 변수가 설정되지 않음

**해결:**
1. `.env.production` 파일 확인:
   ```env
   VITE_CMS_API_BASE_URL=https://api.godcomfortword.com
   ```
2. 빌드 다시 실행:
   ```bash
   npm run build
   ```
3. Network 탭에서 실제 요청 URL 확인

---

## 체크리스트

### 프로덕션 배포 전

- [ ] `.env.production` 파일 존재
- [ ] `VITE_CMS_API_BASE_URL` 또는 `VITE_API_BASE_URL` 설정됨
- [ ] 값이 실제 API 서버 주소 (`https://api.godcomfortword.com`)
- [ ] SPA 호스팅 도메인 (`cms.godcomfortword.com`)이 아님
- [ ] 빌드 성공 (`npm run build`)
- [ ] 빌드된 파일에서 API URL 확인 (선택사항)
- [ ] Network 탭에서 실제 요청 URL 확인
- [ ] 브라우저 콘솔에 에러 없음

---

## 참고 문서

- `ENV_SETUP_GUIDE.md`: 환경 변수 설정 상세 가이드
- `API_FIX_EXPLANATION.md`: API 호출 수정 설명
- `FIREBASE_HOSTING_ANALYSIS.md`: Firebase Hosting 설정 분석




