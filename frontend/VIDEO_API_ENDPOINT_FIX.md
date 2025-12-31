# 영상 등록 API 엔드포인트 수정

## 수정 일시
2024년

## 문제점
- 프론트엔드에서 POST `/creator/videos`로 요청
- 백엔드에서는 POST `/videos`가 정상 엔드포인트
- 영상 등록이 실패하는 문제 발생

## 수정 내용

### 수정된 파일 목록

#### 1. `src/lib/videoApi.ts`
**변경 사항**: 모든 creator 관련 엔드포인트를 `/creator/videos`에서 `/videos`로 변경

**변경된 함수들**:
- `getVideoApiBasePath()`: creator일 때 `/videos` 반환 (이전: `/creator/videos`)
- `getVideoApiEndpoint()`: `getVideoApiBasePath()`를 사용하므로 자동으로 `/videos` 사용
- `getVideoDeleteApiEndpoint()`: creator일 때 `/videos/${videoId}` 반환 (이전: `/creator/videos/${videoId}`)
- `getBulkVideosApiEndpoint()`: creator일 때 `/videos/bulk` 반환 (이전: `/creator/videos/bulk`)
- `getVideosListApiEndpoint()`: creator일 때 `/videos` 반환 (이전: `/creator/videos`)
- `getBatchUploadApiEndpoint()`: creator일 때 `/videos/batch` 반환 (이전: `/creator/videos/batch`)
- `getBatchDeleteApiEndpoint()`: creator일 때 `/videos/batch-delete` 반환 (이전: `/creator/videos/batch-delete`)

#### 2. `src/pages/CreatorMyVideosPage.tsx`
**변경 사항**: GET 요청 경로 변경
- 이전: `apiGet("/creator/videos")`
- 현재: `apiGet("/videos")`

#### 3. `src/components/admin/BulkVideosModal.tsx`
**변경 사항**: 주석 업데이트
- 주석에서 `/creator/videos` → `/videos`로 변경

#### 4. `src/lib/apiClient.ts`
**변경 사항**: 예시 URL 업데이트
- 에러 메시지 예시: `/creator/videos` → `/videos`

---

## 변경된 엔드포인트 매핑

### Creator (크리에이터)

| 기능 | 이전 경로 | 변경 후 경로 |
|------|----------|------------|
| 영상 목록 조회 (GET) | `/creator/videos` | `/videos` |
| 영상 등록 (POST) | `/creator/videos` | `/videos` |
| 영상 수정 (PUT) | `/creator/videos/:id` | `/videos/:id` |
| 영상 삭제 (DELETE) | `/creator/videos/:id` | `/videos/:id` |
| 대량 등록 (POST) | `/creator/videos/bulk` | `/videos/bulk` |
| 배치 업로드 (POST) | `/creator/videos/batch` | `/videos/batch` |
| 배치 삭제 (POST) | `/creator/videos/batch-delete` | `/videos/batch-delete` |

### Admin (관리자)
- 변경 없음: `/admin/videos` 계속 사용

---

## 영향 받는 기능

### 1. 영상 등록 (POST)
- **위치**: `VideoFormModal.tsx` (create 모드)
- **경로**: `/videos` (이전: `/creator/videos`)
- **요청 body**: 변경 없음
  ```json
  {
    "sourceType": "youtube",
    "sourceUrl": "string",
    "title": "string",
    "thumbnailUrl": "string",
    "language": "string"
  }
  ```

### 2. 영상 목록 조회 (GET)
- **위치**: `CreatorMyVideosPage.tsx`
- **경로**: `/videos` (이전: `/creator/videos`)

### 3. 대량 등록/편집 (POST)
- **위치**: `BulkVideosModal.tsx`
- **경로**: `/videos` (이전: `/creator/videos`)

---

## 확인 사항

✅ 빌드 성공  
✅ 린터 오류 없음  
✅ 모든 `/creator/videos` 경로 제거 확인  
✅ POST 요청이 `/videos`로 전송되는지 확인 필요  

---

## 테스트 방법

### 1. 영상 등록 테스트
1. 크리에이터 계정으로 로그인
2. "My Videos" 페이지 접속
3. "영상 추가" 버튼 클릭
4. YouTube URL 입력 및 제목 입력
5. "저장" 버튼 클릭
6. 개발자 도구 > Network 탭 확인:
   - 요청 URL: `POST https://api.godcomfortword.com/videos`
   - 요청 헤더: `Authorization: Bearer <token>`, `Content-Type: application/json`
   - 요청 body: `{ sourceType, sourceUrl, title, ... }`
7. 응답 확인:
   - 200 OK: 영상 등록 성공
   - 400/401/500: 에러 메시지 확인

### 2. 영상 목록 조회 테스트
1. 크리에이터 계정으로 로그인
2. "My Videos" 페이지 접속
3. 개발자 도구 > Network 탭 확인:
   - 요청 URL: `GET https://api.godcomfortword.com/videos`
   - 응답: 영상 목록 배열

### 3. 대량 등록 테스트
1. 크리에이터 계정으로 로그인
2. "My Videos" 페이지 접속
3. "대량 등록/편집" 버튼 클릭
4. 여러 영상 정보 입력
5. "저장" 버튼 클릭
6. 개발자 도구 > Network 탭 확인:
   - 요청 URL: `POST https://api.godcomfortword.com/videos` (각 행마다)

---

## 참고 사항

- Admin(관리자)의 엔드포인트는 변경되지 않았습니다 (`/admin/videos` 계속 사용)
- 모든 API 요청은 `apiClient.ts`를 통해 처리되며, Authorization 헤더가 자동으로 추가됩니다
- 요청 body 구조는 변경되지 않았습니다

















