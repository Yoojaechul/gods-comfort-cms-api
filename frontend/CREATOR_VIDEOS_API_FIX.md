# Creator Videos API 호출 안정화 작업 완료

## 작업 일시
2024년

## 문제점
1. Creator My Videos 페이지에서 API 호출이 `/videos`로 잘못 나가는 경우 발생
2. Authorization 헤더가 제대로 붙지 않을 수 있음
3. 빌드 후 환경변수 누락으로 런타임 에러 발생 가능
4. 에러 메시지가 오해의 소지가 있음 (예: "API 경로 없음")

## 해결 방법

### 1. API Base URL 강화 (`src/lib/apiClient.ts`)
- `getApiBase()` 함수 강화: 환경변수가 없거나 잘못된 경우 기본값 `https://api.godcomfortword.com` 강제 사용
- 프로덕션에서도 안정적으로 동작하도록 방어 로직 추가

```typescript
function getApiBase(): string {
  const env = import.meta.env;
  let apiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL;
  
  // 환경 변수가 없으면 기본값 사용
  if (!apiBase || String(apiBase).trim() === "") {
    apiBase = "https://api.godcomfortword.com";
  }
  
  const trimmed = String(apiBase).trim();
  if (!trimmed) {
    return "https://api.godcomfortword.com";
  }
  
  // HTTP/HTTPS 체크
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return "https://api.godcomfortword.com";
  }
  
  return trimmed;
}
```

### 2. Authorization 헤더 강화 (`src/lib/apiClient.ts`)
- 토큰이 있을 때 반드시 Authorization 헤더 추가
- `options.headers`와 병합 시 Authorization 헤더가 덮어써지지 않도록 보장

```typescript
// Get auth token from localStorage
const token = localStorage.getItem("cms_token");

// 기본 헤더 설정
const headers: HeadersInit = {
  "Content-Type": "application/json",
};

// Authorization 헤더 추가 (토큰이 있으면 Bearer 토큰)
if (token && token.trim().length > 0) {
  headers.Authorization = `Bearer ${token.trim()}`;
}

// options.headers와 병합 (Authorization은 우리가 설정한 것을 우선시)
if (options.headers) {
  Object.assign(headers, options.headers);
  if (token && token.trim().length > 0) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
}
```

### 3. Creator My Videos API 경로 확정 (`src/pages/CreatorMyVideosPage.tsx`)
- **확정 경로**: GET `/creator/videos` (하드코딩)
- API 응답 형식 `{"videos":[...]}` 매핑 개선

```typescript
// ✅ Creator 영상 목록 API: GET /creator/videos
const data = await apiGet<any>("/creator/videos");

// API 응답 형식: {"videos":[...]} 또는 배열 직접 반환
let list: Video[] = [];
if (Array.isArray(data)) {
  list = data;
} else if (data && typeof data === 'object') {
  // videos 필드 우선 확인 (가장 일반적인 응답 형식)
  if (Array.isArray(data.videos)) {
    list = data.videos;
  } else if (Array.isArray(data.data)) {
    list = data.data;
  } else if (Array.isArray(data.items)) {
    list = data.items;
  }
}
setVideos(Array.isArray(list) ? list : []);
```

### 4. 에러 메시지 개선
- "API 경로 없음" 같은 오해의 소지가 있는 메시지 제거
- 사용자 친화적인 메시지로 변경

**변경 전:**
- `API 경로 없음 | 호출 URL: ... | 상태코드: 404`

**변경 후:**
- `요청한 리소스를 찾을 수 없습니다 (404)`
- `잘못된 API 엔드포인트입니다. API 서버 주소를 확인해주세요.`

**CreatorMyVideosPage 에러 메시지:**
- 401/403: "로그인이 필요합니다. 다시 로그인해주세요."
- 404: "영상 목록을 불러올 수 없습니다. API 서버를 확인해주세요."
- 네트워크 오류: "네트워크 오류가 발생했습니다. 연결을 확인해주세요."
- 기타: 기술적 세부사항 제거 후 간결한 메시지

## 변경된 파일

1. **`src/lib/apiClient.ts`**
   - `getApiBase()` 함수 강화 (기본값 강제)
   - Authorization 헤더 처리 개선
   - 에러 메시지 개선

2. **`src/pages/CreatorMyVideosPage.tsx`**
   - API 응답 매핑 개선 (`{"videos":[...]}` 형식 지원)
   - 에러 메시지 사용자 친화적으로 변경

## API 엔드포인트 확정

### Creator 관련 API
- **영상 목록 조회**: GET `/creator/videos`
- **영상 생성**: POST `/creator/videos`
- **영상 수정**: PUT `/creator/videos/:id`
- **영상 삭제**: DELETE `/creator/videos/:id`
- **대량 등록**: POST `/creator/videos/bulk`
- **배치 업로드**: POST `/creator/videos/batch`
- **배치 삭제**: POST `/creator/videos/batch-delete`

모든 Creator 관련 API는 `/creator/videos` 경로를 사용합니다.

## 검증 방법

### 1. 개발 환경 테스트
```bash
npm run dev
```

브라우저에서:
1. Creator 계정으로 로그인
2. "My Videos" 페이지 접속
3. DevTools > Network 탭 확인:
   - **요청 URL**: `GET https://api.godcomfortword.com/creator/videos`
   - **Request Headers**: `Authorization: Bearer <token>` 존재 확인
   - **Response**: `{"videos":[...]}` 형식 확인
   - **Status**: 200 OK

### 2. 프로덕션 빌드 테스트
```bash
# 환경 변수 설정 (선택사항, 없어도 기본값 사용)
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com npm run build

# 빌드 성공 확인
# dist/ 폴더 생성 확인
```

### 3. Firebase 배포 테스트
```bash
npm run build
firebase deploy --only hosting
```

배포 후:
1. `https://cms.godcomfortword.com` 접속
2. Creator 계정으로 로그인
3. "My Videos" 페이지 접속
4. DevTools > Console: 런타임 에러 없어야 함
5. DevTools > Network:
   - `GET https://api.godcomfortword.com/creator/videos` 200 OK
   - Request Headers에 `Authorization: Bearer <token>` 존재
   - Response에 `{"videos":[...]}` 배열 존재

### 4. 영상 등록 테스트
1. "영상 추가" 버튼 클릭
2. YouTube URL 입력 후 저장
3. DevTools > Network:
   - `POST https://api.godcomfortword.com/creator/videos` 201 Created
   - Request Headers에 `Authorization: Bearer <token>` 존재
   - Request Body에 영상 정보 포함
   - Response에 생성된 영상 정보 포함

## 확인 사항

✅ 빌드 성공  
✅ `/creator/videos` 경로 확정  
✅ Authorization 헤더 보장  
✅ 런타임 에러 방지 (기본값 강제)  
✅ 에러 메시지 개선  
✅ API 응답 `{"videos":[...]}` 매핑 확인  

## 환경 변수 (선택사항)

### 개발 환경
`.env.local` 파일 (선택사항):
```
VITE_CMS_API_BASE_URL=http://localhost:3000
```

### 프로덕션 빌드
`.env.production` 파일 (선택사항):
```
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com
```

**참고**: 환경 변수가 없어도 기본값 `https://api.godcomfortword.com`이 사용되므로 안정적으로 동작합니다.






