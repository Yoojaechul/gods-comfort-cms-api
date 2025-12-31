# 🧪 Creator 로그인 시스템 테스트 체크리스트

## 사전 준비

### 1. 서버 실행
```bash
# 터미널 1: CMS API 서버 (포트 8787)
npm run dev

# 터미널 2: NestJS API 서버 (포트 8788)
cd nest-api
npm run start:dev
```

### 2. 서버 상태 확인
- ✅ CMS API 서버: http://localhost:8787/health
- ✅ NestJS API 서버: http://localhost:8788/health

---

## 테스트 시나리오

### 테스트 1: 로그인 페이지 접속 및 UI 확인

1. **브라우저에서 접속**
   - URL: `http://localhost:8787/creator/login.html`
   - ✅ 페이지가 정상적으로 로드되는지 확인
   - ✅ CSS가 적용되어 파스텔 톤의 카드형 UI가 보이는지 확인
   - ✅ "CMS Creator Login" 제목이 보이는지 확인
   - ✅ 아이디/비밀번호 입력 필드가 보이는지 확인
   - ✅ 로그인 버튼이 보이는지 확인
   - ✅ "NestJS API: localhost:8788" 정보가 표시되는지 확인

2. **콘솔 확인**
   - ✅ 개발자 도구(F12) → Console 탭 열기
   - ✅ 404 에러가 없는지 확인 (login.css, login.js)
   - ✅ Network 탭에서 login.css, login.js가 200으로 로드되는지 확인

---

### 테스트 2: 로그인 성공 플로우

1. **로그인 정보 입력**
   - 아이디(ID): `01023942042`
   - 비밀번호: `creator_password_123` (또는 설정된 비밀번호)

2. **로그인 버튼 클릭**
   - ✅ 로그인 버튼 클릭
   - ✅ 로딩 상태 확인 (버튼이 비활성화되는지)
   - ✅ 에러 메시지가 표시되지 않는지 확인

3. **리다이렉트 확인**
   - ✅ `/creator/index.html`로 자동 이동하는지 확인

4. **LocalStorage 확인**
   - ✅ 개발자 도구(F12) → Application 탭 → Local Storage
   - ✅ `creator_jwt_token` 키가 생성되고 값이 있는지 확인
   - ✅ `creator_user` 키가 생성되고 JSON 형식인지 확인
   - ✅ `creator_token_expires` 키가 생성되고 날짜 형식인지 확인

5. **index.html 확인**
   - ✅ 상단에 "👤 {이름 또는 이메일} (creator)" 형식으로 사용자 정보가 표시되는지 확인
   - ✅ 로그아웃 버튼이 보이는지 확인
   - ✅ 영상 목록 섹션이 보이는지 확인
   - ✅ 영상 등록 섹션이 보이는지 확인

---

### 테스트 3: 인증 체크 기능

1. **새 탭에서 index.html 직접 접속**
   - URL: `http://localhost:8787/creator/index.html`
   - ✅ LocalStorage에 토큰이 있으면 정상 접속
   - ✅ LocalStorage에 토큰이 없으면 `/creator/login.html`로 리다이렉트

2. **토큰 만료 시뮬레이션**
   - ✅ 개발자 도구 → Application → Local Storage
   - ✅ `creator_token_expires` 값을 과거 날짜로 수정 (예: "2020-01-01T00:00:00.000Z")
   - ✅ 페이지 새로고침
   - ✅ "⏰ 세션 만료: 다시 로그인해주세요." 알림이 표시되는지 확인
   - ✅ 자동으로 로그인 페이지로 이동하는지 확인

---

### 테스트 4: 로그인 실패 처리

1. **잘못된 비밀번호 입력**
   - 아이디: `01023942042`
   - 비밀번호: `wrong_password`
   - ✅ 로그인 버튼 클릭
   - ✅ "아이디와 비밀번호를 올바르게 입력해주세요." 에러 메시지가 표시되는지 확인
   - ✅ LocalStorage에 토큰이 저장되지 않는지 확인

2. **빈 필드로 로그인 시도**
   - ✅ 아이디 또는 비밀번호를 비워두고 로그인 버튼 클릭
   - ✅ 에러 메시지가 표시되는지 확인

---

### 테스트 5: 로그아웃 기능

1. **로그아웃 버튼 클릭**
   - ✅ index.html에서 로그아웃 버튼 클릭
   - ✅ `/creator/login.html`로 이동하는지 확인

2. **LocalStorage 확인**
   - ✅ `creator_jwt_token` 키가 삭제되었는지 확인
   - ✅ `creator_user` 키가 삭제되었는지 확인
   - ✅ `creator_token_expires` 키가 삭제되었는지 확인
   - ✅ 예전 API Key 관련 키들도 삭제되었는지 확인

---

### 테스트 6: API 호출 테스트 (index.html 기능)

1. **영상 목록 조회**
   - ✅ index.html에서 "새로고침" 버튼 클릭
   - ✅ 영상 목록이 로드되는지 확인 (없으면 "등록된 영상이 없습니다" 메시지)

2. **영상 등록**
   - ✅ 플랫폼: YouTube 선택
   - ✅ 영상 URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ` 입력
   - ✅ "영상 등록" 버튼 클릭
   - ✅ 성공 메시지가 표시되는지 확인
   - ✅ 영상 목록에 새로 등록된 영상이 표시되는지 확인

3. **인증 헤더 확인**
   - ✅ 개발자 도구 → Network 탭
   - ✅ `/videos` 요청의 Headers 확인
   - ✅ `Authorization: Bearer {token}` 헤더가 포함되어 있는지 확인

---

## 예상 결과 요약

### ✅ 성공 케이스
- 로그인 페이지가 예쁘게 표시됨
- 로그인 성공 시 JWT 토큰이 LocalStorage에 저장됨
- index.html로 자동 이동
- 사용자 정보가 상단에 표시됨
- 인증이 필요한 API 호출이 정상 작동
- 로그아웃 시 모든 인증 정보가 삭제됨

### ❌ 실패 케이스 (수정 필요)
- 404 에러 (login.css, login.js)
- 로그인 후에도 index.html 접근 불가
- LocalStorage에 토큰이 저장되지 않음
- API 호출 시 401/403 에러

---

## 문제 해결 가이드

### 문제 1: login.css 또는 login.js 404 에러
**원인**: 파일 경로가 잘못되었거나 파일이 없음
**해결**:
- `public/creator/login.css` 파일 존재 확인
- `public/creator/login.js` 파일 존재 확인
- `login.html`에서 경로가 `/creator/login.css`, `/creator/login.js`로 되어 있는지 확인

### 문제 2: 로그인 후 index.html 접근 불가
**원인**: `checkAuth()` 함수가 제대로 작동하지 않음
**해결**:
- `creator.js`의 `checkAuth()` 함수 확인
- `index.html`에서 `onload="checkAuth()"` 또는 `DOMContentLoaded` 이벤트 확인
- LocalStorage에 토큰이 실제로 저장되었는지 확인

### 문제 3: API 호출 시 401/403 에러
**원인**: JWT 토큰이 제대로 전달되지 않음
**해결**:
- Network 탭에서 요청 헤더 확인
- `Authorization: Bearer {token}` 헤더가 포함되어 있는지 확인
- 토큰이 만료되지 않았는지 확인

---

## 추가 확인 사항

- [ ] NestJS API 서버가 포트 8788에서 실행 중인지 확인
- [ ] CMS API 서버가 포트 8787에서 실행 중인지 확인
- [ ] CORS 설정이 올바른지 확인 (필요 시)
- [ ] 데이터베이스에 테스트 계정이 존재하는지 확인

---

**테스트 완료 후**: 모든 체크리스트 항목이 통과하면 시스템이 정상적으로 작동하는 것입니다! 🎉




































































































