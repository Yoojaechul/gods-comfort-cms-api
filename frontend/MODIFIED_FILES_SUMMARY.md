# 수정된 파일 목록

## 수정일
2024년

## 수정된 파일

### 1. `src/config.ts`
**변경 사항**:
- 하드코딩된 `DEFAULT_API_BASE` 제거
- 환경 변수 우선순위: `VITE_CMS_API_BASE_URL` > `VITE_API_BASE_URL`
- 환경 변수가 없을 때만 임시 fallback으로 Cloud Run URL 사용 (콘솔 경고와 함께)
- `CHANGE_PASSWORD_API_BASE` 관련 코드 완전 제거
- 주석 및 에러 메시지 업데이트

**주요 변경**:
```typescript
// 이전: 하드코딩된 기본값
const DEFAULT_API_BASE = "https://cms-api-388547952090.asia-northeast3.run.app";
const apiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL || DEFAULT_API_BASE;

// 현재: 환경 변수만 사용, fallback은 콘솔 경고와 함께
const FALLBACK_API_BASE = "https://cms-api-388547952090.asia-northeast3.run.app";
const apiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL || "";
// 환경 변수가 없으면 fallback 사용 (콘솔 경고 출력)
```

---

### 2. `src/lib/apiClient.ts`
**변경 사항**:
- 에러 메시지를 상태 코드별로 개선 (404, 401, 500 등)
- 사용자 친화적인 에러 메시지 제공
- 예시 URL 제거 (하드코딩 방지)

**주요 변경**:
```typescript
// 이전: 일반적인 에러 메시지
let errorMessage = `${response.status} ${response.statusText}`;

// 현재: 상태 코드별 사용자 친화적인 메시지
if (status === 404) {
  errorMessage = "API 도메인 연결이 잘못되었습니다. 관리자에게 문의하세요.";
} else if (status === 401) {
  errorMessage = "권한이 없거나 인증 토큰이 만료되었습니다.";
} else if (status === 500) {
  errorMessage = "서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}
```

---

### 3. `src/pages/ChangePasswordPage.tsx`
**변경 사항**:
- `CHANGE_PASSWORD_API_BASE` 관련 로직 완전 제거
- `apiPost("/auth/change-password", payload)`만 사용 (통일된 API 클라이언트)
- 에러 메시지를 상태 코드별로 개선 (404, 401, 500 등)
- 불필요한 import 제거 (`CMS_API_BASE`, `CHANGE_PASSWORD_API_BASE`)

**주요 변경**:
```typescript
// 이전: CHANGE_PASSWORD_API_BASE 별도 로직
if (CHANGE_PASSWORD_API_BASE) {
  // 직접 fetch 호출
} else {
  result = await apiPost("/auth/change-password", payload);
}

// 현재: 통일된 API 클라이언트만 사용
const result = await apiPost("/auth/change-password", payload);
```

---

## 제거된 기능

### `CHANGE_PASSWORD_API_BASE` 관련 코드
- `src/config.ts`에서 `getChangePasswordApiBase()` 함수 제거
- `src/config.ts`에서 `CHANGE_PASSWORD_API_BASE` export 제거
- `src/pages/ChangePasswordPage.tsx`에서 별도 fetch 로직 제거

**이유**: 모든 API 호출을 통일된 `CMS_API_BASE`로 관리하도록 변경

---

## 개선 사항

### 1. 환경 변수 기반 관리
- 하드코딩 제거
- 환경 변수 우선순위 명확화
- Fallback 사용 시 콘솔 경고 출력

### 2. 통일된 API 클라이언트
- 모든 API 호출이 `apiClient.ts`를 통해 관리
- base URL 결합 로직 중복 제거
- 일관된 에러 처리

### 3. 사용자 친화적인 에러 메시지
- 상태 코드별 명확한 메시지 (404, 401, 500 등)
- 사용자가 이해하기 쉬운 안내 문구

### 4. ChangePasswordPage 개선
- 엔드포인트 보장: `/auth/change-password`로만 요청 (프론트 라우팅 `/change-password`와 구분)
- 통일된 API 클라이언트 사용

---

## .env.production 예시

프로젝트 루트에 `.env.production` 파일 생성:

```env
VITE_API_BASE_URL=https://api.godcomfortword.com
```

자세한 내용은 `ENV_PRODUCTION_EXAMPLE.md` 참고.










