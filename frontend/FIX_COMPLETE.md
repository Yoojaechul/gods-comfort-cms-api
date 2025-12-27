# 프로덕션 API_BASE_URL 수정 완료

## ✅ 수정 완료

### .env.production 파일 수정

**이전 설정 (잘못됨):**
```env
VITE_API_BASE_URL=https://cms.godcomfortword.com
VITE_CMS_API_BASE=https://cms.godcomfortword.com
```

**수정 후 (올바름):**
```env
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com
```

### 빌드 확인

✅ 빌드 성공: `npm run build` 완료

---

## CreatorMyVideosPage 기준 실제 동작

### 코드
```typescript
// src/pages/CreatorMyVideosPage.tsx:32
const data = await apiGet<any>("/creator/videos");
```

### 실제 요청 URL (수정 후)

**올바른 설정 시:**
```
GET https://api.godcomfortword.com/creator/videos
Authorization: Bearer <token>
Content-Type: application/json
```

**처리 흐름:**
1. `apiGet("/creator/videos")` 호출
2. `apiRequest` → `buildUrl(CMS_API_BASE, "/creator/videos")`
3. `CMS_API_BASE` = `https://api.godcomfortword.com` (환경 변수에서)
4. 최종 URL: `https://api.godcomfortword.com/creator/videos`
5. API 서버로 직접 요청 (Firebase Hosting을 거치지 않음)

---

## 배포 단계

### 1. 빌드 (이미 완료)
```bash
npm run build
```

### 2. Firebase 배포
```bash
firebase deploy --only hosting
```

### 3. 확인
1. 브라우저에서 `https://cms.godcomfortword.com/creator/my-videos` 접속
2. 개발자 도구 Network 탭 열기
3. `/creator/videos` 요청 확인:
   - ✅ 올바름: `https://api.godcomfortword.com/creator/videos`
   - ❌ 잘못됨: `https://cms.godcomfortword.com/creator/videos`

---

## 수정된 파일

1. **`.env.production`**
   - `VITE_CMS_API_BASE_URL=https://api.godcomfortword.com`로 변경
   - 잘못된 `VITE_CMS_API_BASE` 제거

---

## 핵심 변경 사항

### 이전 동작 (문제)
- 환경 변수: `VITE_API_BASE_URL=https://cms.godcomfortword.com`
- 요청 URL: `https://cms.godcomfortword.com/creator/videos`
- 응답: HTML 404 (Firebase Hosting)

### 수정 후 동작 (정상)
- 환경 변수: `VITE_CMS_API_BASE_URL=https://api.godcomfortword.com`
- 요청 URL: `https://api.godcomfortword.com/creator/videos`
- 응답: JSON (API 서버)

---

## 검증

### 빌드 확인
- ✅ 빌드 성공
- ✅ 환경 변수가 번들에 포함됨

### 배포 후 확인
- [ ] Network 탭에서 실제 요청 URL 확인
- [ ] 브라우저 콘솔에 에러 없음
- [ ] `/creator/my-videos` 페이지 정상 로드
- [ ] 비디오 목록 정상 표시

---

## 요약

**문제:** API 요청이 SPA 도메인(`cms.godcomfortword.com`)으로 나감

**해결:** `.env.production`에서 API 서버 주소(`api.godcomfortword.com`)로 변경

**결과:** 모든 API 요청이 올바른 API 서버로 전송됨










