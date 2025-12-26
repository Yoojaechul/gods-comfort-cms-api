# API 호출 개선 요약

## 수정 일시
2024년

## 수정된 파일 목록

### 1. `src/lib/apiClient.ts`
**주요 변경사항**:
- `buildUrl` 함수를 export하여 단일 진실 원천(Single Source of Truth)으로 사용
- 모든 API 요청 시 `requestUrl`을 콘솔에 출력 (디버깅 용이)
- 상태 코드별 사용자 친화적인 에러 메시지 개선
- `console.error`에 status/responseText/requestUrl 출력 (네트워크 탭 확인용)

**변경 상세**:
```typescript
// buildUrl export 추가
export function buildUrl(baseUrl: string, path: string): string {
  // ... (기존 검증 로직)
}

// 모든 API 요청 시 URL 출력
console.log(`[apiRequest] ${options.method || "GET"} ${url}`);

// 에러 발생 시 상세 정보 출력
console.error(`[apiRequest Error] Status: ${status}, URL: ${url}, Response:`, responseText);
```

**에러 메시지**:
- **400**: "입력값/현재 비밀번호 확인 필요(서버 로그 확인 필요)"
- **401**: "권한/인증 실패(로그인 상태 또는 토큰 확인)"
- **404**: "API 경로 없음(배포/라우팅 확인)"
- **500**: "서버 내부 오류(Cloud Run 로그 확인 필요)"

---

### 2. `src/pages/ChangePasswordPage.tsx`
**주요 변경사항**:
- email 파라미터 처리 안정화 (query parameter 우선, 없으면 AuthContext의 user.email 사용)
- 에러 처리 단순화 (apiClient.ts에서 처리된 메시지 사용)
- 401 에러 시 자동으로 로그인 페이지로 리다이렉트

**변경 상세**:
```typescript
// email 파라미터 안정적 처리
const emailFromQuery = searchParams.get("email")?.trim() || "";
const emailFromUser = user?.email?.trim() || "";
const email = emailFromQuery || emailFromUser;

// 에러 처리 단순화
const errorMessage = e?.message || "비밀번호 변경에 실패했습니다.";
if (status === 401) {
  setTimeout(() => {
    navigate("/login", { replace: true });
  }, 2000);
}
```

---

## 개선 사항

### 1. 단일 진실 원천 (Single Source of Truth)
- `buildUrl` 함수를 export하여 모든 URL 결합이 이 함수를 통하도록 통일
- 향후 다른 파일에서도 `buildUrl`을 import하여 사용 가능

### 2. 디버깅 용이성 향상
- 모든 API 요청 시 URL을 콘솔에 출력
- 에러 발생 시 status/responseText/requestUrl을 `console.error`로 출력
- 네트워크 탭에서 확인한 정보와 콘솔 로그를 대조하여 디버깅 가능

### 3. 사용자 친화적인 에러 메시지
- 상태 코드별로 명확하고 행동 가능한 메시지 제공
- 서버 로그/Cloud Run 로그 확인 필요 여부 명시
- 개발자/관리자가 문제 해결에 필요한 정보 제공

### 4. ChangePasswordPage 안정성 향상
- email 파라미터를 query parameter와 AuthContext 모두에서 가져오도록 개선
- API 에러 메시지는 apiClient.ts에서 통일하여 처리

---

## 브라우저에서 재현 테스트 순서

### 1단계: 로그인
1. 브라우저에서 `/login` 페이지 접속
2. 관리자 또는 크리에이터 계정으로 로그인
3. 개발자 도구 콘솔 확인:
   - `[apiRequest] POST https://api.godcomfortword.com/auth/login` 출력 확인
4. 로그인 성공 후 대시보드로 이동 확인

### 2단계: 비밀번호 변경
1. 사이드바에서 "비밀번호 변경" 메뉴 클릭
   - 또는 `/change-password?email=<이메일>` URL로 직접 접속
2. 현재 비밀번호, 새 비밀번호 입력
3. "비밀번호 변경" 버튼 클릭
4. 개발자 도구 콘솔 확인:
   - `[apiRequest] POST https://api.godcomfortword.com/auth/change-password` 출력 확인
5. 에러 발생 시:
   - 콘솔에 `[apiRequest Error] Status: <상태코드>, URL: <요청URL>, Response: <응답본문>` 출력 확인
   - 화면에 상태 코드별 사용자 친화적인 메시지 표시 확인

### 3단계: 재로그인
1. 비밀번호 변경 성공 시 자동으로 `/login` 페이지로 이동
2. 변경한 새 비밀번호로 로그인 시도
3. 로그인 성공 확인
4. 개발자 도구 콘솔 확인:
   - `[apiRequest] POST https://api.godcomfortword.com/auth/login` 출력 확인

---

## 콘솔 출력 예시

### 정상 요청 시:
```
[apiRequest] POST https://api.godcomfortword.com/auth/login
[apiRequest] POST https://api.godcomfortword.com/auth/change-password
```

### 에러 발생 시:
```
[apiRequest] POST https://api.godcomfortword.com/auth/change-password
[apiRequest Error] Status: 400, URL: https://api.godcomfortword.com/auth/change-password, Response: {"message":"현재 비밀번호가 일치하지 않습니다."}
```

---

## 확인 사항

✅ 빌드 성공  
✅ 린터 오류 없음  
✅ buildUrl 함수 export  
✅ 모든 API 요청 시 URL 콘솔 출력  
✅ 에러 발생 시 status/responseText/requestUrl 콘솔 출력  
✅ 상태 코드별 사용자 친화적인 에러 메시지  
✅ ChangePasswordPage email 파라미터 안정화  

---

## 다음 단계 (선택사항)

향후 다른 파일에서 직접 URL을 조합하는 경우가 있으면 `buildUrl` 함수를 사용하도록 변경:
- `src/utils/videoMetadata.ts`
- `src/pages/VideosPage.tsx`
- `src/components/BatchUploadModal.tsx`
- 기타 직접 `CMS_API_BASE`를 사용하여 URL을 만드는 파일들

