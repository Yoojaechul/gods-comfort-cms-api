# CMS_API_BASE 제거 및 Vite 환경변수 통일 작업 완료

## 작업 일시
2024년

## 문제점
- 프론트엔드에서 `CMS_API_BASE` 전역 상수를 직접 참조하여 "CMS_API_BASE is not defined" 오류 발생
- 빌드 타임에 평가되는 상수가 런타임에 정의되지 않아 화면이 깨지는 문제

## 해결 방법

### 1. config.ts 변경
- `CMS_API_BASE` 상수 export 제거
- `getApiBase()` 함수로 변경하여 런타임에 환경 변수를 읽도록 수정
- 기본값: `https://api.godcomfortword.com` (사용자 요청대로)

### 2. 모든 파일에서 CMS_API_BASE 제거
다음 파일들에서 `CMS_API_BASE` import 및 사용을 제거하고 필요한 곳에서 `getApiBase()` 함수 호출 또는 직접 `import.meta.env` 사용:

- `src/lib/apiClient.ts`: 내부 `getApiBase()` 함수로 변경
- `src/utils/videoMetadata.ts`: 내부 `getApiBase()` 함수로 변경, `normalizeThumbnailUrl` 파라미터 선택적으로 변경
- `src/components/admin/VideoFormModal.tsx`: `normalizeThumbnailUrl` 호출 시 파라미터 제거
- `src/components/VideoCard.tsx`: `normalizeThumbnailUrl` 호출 시 파라미터 제거
- `src/components/VideoTable.tsx`: `normalizeThumbnailUrl` 호출 시 파라미터 제거
- `src/pages/LoginPage.tsx`: `getApiBase()` 함수 사용
- `src/pages/VideosPage.tsx`: 사용하지 않아 import 제거
- `src/pages/AdminVideosPage.tsx`: `normalizeThumbnailUrl` 호출 시 파라미터 제거
- `src/pages/AdminCreatorsPage.tsx`: `getApiBase()` 함수 사용
- `src/pages/AdminSettingsPage.tsx`: `getApiBase()` 함수 사용
- `src/pages/FacebookKeysPage.tsx`: `getApiBase()` 함수 사용
- `src/pages/AnalyticsPage.tsx`: `getApiBase()` 함수 사용
- `src/components/BatchUploadModal.tsx`: `getApiBase()` 함수 사용

## API 엔드포인트 확인
- Creator 영상 목록: GET `/creator/videos` ✅
- Creator 영상 생성: POST `/creator/videos` ✅
- 로그인: POST `/auth/login` ✅
- 메타데이터: GET `/public/videos/youtube/metadata?url=...` ✅

모든 Creator 관련 API는 `/creator/videos` 경로를 사용합니다.

## 환경 변수 설정

### 개발 환경
`.env.local` 파일 (선택사항):
```
VITE_CMS_API_BASE_URL=http://localhost:3000
```

### 프로덕션 빌드
`.env.production` 파일:
```
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com
```

또는 빌드 시:
```bash
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com npm run build
```

### 기본값
환경 변수가 설정되지 않은 경우 기본값 `https://api.godcomfortword.com`이 사용됩니다.

## 변경된 파일 목록

### 주요 변경
1. `src/config.ts` - `CMS_API_BASE` 상수 제거, `getApiBase()` 함수로 변경
2. `src/lib/apiClient.ts` - 내부 `getApiBase()` 함수로 변경
3. `src/utils/videoMetadata.ts` - 내부 `getApiBase()` 함수로 변경

### 기타 파일
- `src/components/admin/VideoFormModal.tsx`
- `src/components/VideoCard.tsx`
- `src/components/VideoTable.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/VideosPage.tsx`
- `src/pages/AdminVideosPage.tsx`
- `src/pages/AdminCreatorsPage.tsx`
- `src/pages/AdminSettingsPage.tsx`
- `src/pages/FacebookKeysPage.tsx`
- `src/pages/AnalyticsPage.tsx`
- `src/components/BatchUploadModal.tsx`

## 확인 사항

✅ 빌드 성공  
✅ 모든 `CMS_API_BASE` 참조 제거  
✅ Creator API 경로 `/creator/videos` 확인  
✅ 환경 변수 기본값 설정  

## 테스트 방법

### 1. 개발 환경 테스트
```bash
# 개발 서버 실행
npm run dev

# Creator My Videos 페이지 접속
# 콘솔 확인: "CMS_API_BASE is not defined" 오류가 없어야 함
# Network 탭: GET /creator/videos 요청 확인
```

### 2. 프로덕션 빌드 테스트
```bash
# 환경 변수 설정 후 빌드
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com npm run build

# 또는 .env.production 파일 생성
echo "VITE_CMS_API_BASE_URL=https://api.godcomfortword.com" > .env.production
npm run build

# 빌드 결과 확인
# dist/ 폴더 생성 확인
```

### 3. Firebase 배포 테스트
1. Firebase Hosting에 배포
2. `https://cms.godcomfortword.com` 접속
3. Creator 계정으로 로그인
4. "My Videos" 페이지 접속
5. DevTools 콘솔 확인: 오류 없어야 함
6. Network 탭 확인:
   - GET `https://api.godcomfortword.com/creator/videos` 요청 확인
   - POST `https://api.godcomfortword.com/creator/videos` 요청 확인 (영상 등록 시)

## 참고 사항

- 모든 API 요청은 `apiClient.ts`를 통해 처리되며, `getApiBase()` 함수가 런타임에 호출됩니다.
- 환경 변수는 `VITE_CMS_API_BASE_URL` 우선, 없으면 `VITE_API_BASE_URL` 사용, 둘 다 없으면 기본값 사용.
- `normalizeThumbnailUrl` 함수는 이제 선택적 `baseUrl` 파라미터를 받으며, 제공되지 않으면 내부에서 `getApiBase()`를 호출합니다.

















