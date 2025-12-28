# 수정된 파일 목록

## 수정 일시
2024년

## 수정된 파일

### 1. `src/lib/apiClient.ts`

**변경 사항**:
- `buildUrl` 함수를 `export`하여 단일 진실 원천으로 사용 가능하게 함
- 모든 API 요청 시 `console.log`로 requestUrl 출력
- 에러 발생 시 `console.error`로 status/responseText/requestUrl 출력
- 상태 코드별 사용자 친화적인 에러 메시지 개선

**주요 변경**:
```typescript
// export 추가
export function buildUrl(baseUrl: string, path: string): string { ... }

// 요청 URL 항상 출력
console.log(`[apiRequest] ${options.method || "GET"} ${url}`);

// 에러 상세 정보 출력
console.error(`[apiRequest Error] Status: ${status}, URL: ${url}, Response:`, responseText);
```

**에러 메시지**:
- 400: "입력값/현재 비밀번호 확인 필요(서버 로그 확인 필요)"
- 401: "권한/인증 실패(로그인 상태 또는 토큰 확인)"
- 404: "API 경로 없음(배포/라우팅 확인)"
- 500: "서버 내부 오류(Cloud Run 로그 확인 필요)"

---

### 2. `src/pages/ChangePasswordPage.tsx`

**변경 사항**:
- email 파라미터 처리 안정화 (query parameter 우선, 없으면 AuthContext의 user.email 사용)
- `useAuth` hook 추가하여 user 정보 접근
- 에러 처리 단순화 (apiClient.ts에서 처리된 메시지 사용)
- 401 에러 시 자동으로 로그인 페이지로 리다이렉트

**주요 변경**:
```typescript
// email 파라미터 안정적 처리
const { user } = useAuth();
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

## 확인 사항

✅ 빌드 성공  
✅ 린터 오류 없음  
✅ buildUrl 함수 export  
✅ 모든 API 요청 시 URL 콘솔 출력  
✅ 에러 발생 시 status/responseText/requestUrl 콘솔 출력  
✅ 상태 코드별 사용자 친화적인 에러 메시지  
✅ ChangePasswordPage email 파라미터 안정화  

---

## 브라우저에서 재현 테스트 순서

### 1단계: 로그인
1. 브라우저에서 `/login` 페이지 접속
2. 관리자 또는 크리에이터 계정으로 로그인
3. 개발자 도구 콘솔 확인:
   ```
   [apiRequest] POST https://api.godcomfortword.com/auth/login
   ```
   출력 확인

### 2단계: 비밀번호 변경
1. 사이드바에서 "비밀번호 변경" 메뉴 클릭
   - 또는 `/change-password?email=<이메일>` URL로 직접 접속
2. 현재 비밀번호, 새 비밀번호 입력
3. "비밀번호 변경" 버튼 클릭
4. 개발자 도구 콘솔 확인:
   ```
   [apiRequest] POST https://api.godcomfortword.com/auth/change-password
   ```
   출력 확인
5. 에러 발생 시:
   ```
   [apiRequest Error] Status: <상태코드>, URL: <요청URL>, Response: <응답본문>
   ```
   출력 확인
   - 화면에 상태 코드별 사용자 친화적인 메시지 표시 확인

### 3단계: 재로그인
1. 비밀번호 변경 성공 시 자동으로 `/login` 페이지로 이동
2. 변경한 새 비밀번호로 로그인 시도
3. 로그인 성공 확인
4. 개발자 도구 콘솔 확인:
   ```
   [apiRequest] POST https://api.godcomfortword.com/auth/login
   ```
   출력 확인

---

## 참고

자세한 내용은 `API_IMPROVEMENTS_SUMMARY.md` 참고.










