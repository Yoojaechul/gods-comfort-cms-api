# Firebase Hosting 배포 가이드

## 📋 Firebase Hosting 설정

### firebase.json
- **public**: `frontend/dist` (Vite 빌드 출력 디렉토리)
- **target**: `cms` (Firebase Hosting 타겟)
- **rewrites**: 
  - `/auth/**` → Cloud Functions (API)
  - `/creator/videos` → Cloud Functions (API)
  - 기타 모든 경로 → `/index.html` (SPA fallback)

### .firebaserc
- **project**: `gods-comfort-word`
- **target**: `cms` → `gods-comfort-word-cms` (Firebase Hosting 사이트)

---

## 🚀 배포 명령어

### 1. 프론트엔드 빌드

```bash
cd frontend
npm install
npm run build
```

빌드 결과는 `frontend/dist/` 디렉토리에 생성됩니다.

### 2. Firebase Hosting 배포

```bash
# 루트 디렉토리에서
firebase deploy --only hosting:cms
```

또는 전체 배포:
```bash
firebase deploy
```

---

## 🔍 라우팅 규칙 설명

### API 엔드포인트 (Cloud Functions로 프록시)

다음 경로는 백엔드 API로 프록시됩니다:

- `/auth/**` - 인증 API (login, check-email, change-password 등)
- `/creator/videos` - Creator 영상 목록 API (GET 요청만)

### 클라이언트 사이드 라우트 (SPA fallback)

다음 경로는 모두 `/index.html`로 fallback되어 React Router가 처리합니다:

- `/creator/my-videos` - Creator 영상 관리 페이지
- `/admin/**` - Admin 관련 페이지
- `/login` - 로그인 페이지
- `/change-password` - 비밀번호 변경 페이지
- 기타 모든 경로

---

## ⚠️ 중요 사항

1. **rewrites 순서**
   - Firebase Hosting은 rewrites를 위에서부터 순서대로 매칭합니다.
   - `/creator/videos`를 `/creator/**`보다 먼저 명시하여 API 엔드포인트만 프록시하고, 나머지 클라이언트 라우트는 SPA fallback으로 처리합니다.

2. **API 엔드포인트 vs 클라이언트 라우트**
   - API 엔드포인트: `/auth/**`, `/creator/videos`
   - 클라이언트 라우트: `/creator/my-videos`, `/admin/videos` 등
   - 클라이언트 라우트는 모두 `/index.html`로 fallback되어 React Router가 처리합니다.

3. **빌드 확인**
   - 배포 전에 `frontend/dist/` 디렉토리에 `index.html`이 있는지 확인하세요.
   - `npm run build`가 성공적으로 완료되었는지 확인하세요.

---

## 🧪 로컬 테스트

### Firebase Hosting 에뮬레이터

```bash
# Firebase Hosting 에뮬레이터 실행
firebase emulators:start --only hosting

# 브라우저에서 http://localhost:5000 접속
```

### 프론트엔드 빌드 미리보기

```bash
cd frontend
npm run build
npm run preview
```

---

## 📝 배포 체크리스트

- [ ] `frontend/dist/` 디렉토리 존재 확인
- [ ] `frontend/dist/index.html` 파일 존재 확인
- [ ] `firebase.json` 설정 확인
- [ ] `.firebaserc` 타겟 매핑 확인
- [ ] Firebase CLI 로그인 확인 (`firebase login`)
- [ ] 프로젝트 선택 확인 (`firebase use gods-comfort-word`)
- [ ] 배포 실행 (`firebase deploy --only hosting:cms`)

---

## 🔧 문제 해결

### "Cannot GET /creator/my-videos" 에러

이 에러가 발생하면:
1. `firebase.json`의 rewrites 순서 확인
2. `/creator/videos`가 API 엔드포인트로만 프록시되는지 확인
3. `/creator/my-videos` 같은 클라이언트 라우트는 SPA fallback(`** → /index.html`)에 의해 처리되는지 확인

### "Hosting site or target cms not detected" 에러

이 에러가 발생하면:
1. `.firebaserc`에 타겟 매핑이 있는지 확인:
   ```json
   {
     "targets": {
       "gods-comfort-word": {
         "hosting": {
           "cms": ["gods-comfort-word-cms"]
         }
       }
     }
   }
   ```
2. `firebase.json`에 target이 설정되어 있는지 확인:
   ```json
   {
     "hosting": [{
       "target": "cms",
       ...
     }]
   }
   ```

### 빌드 오류

빌드가 실패하면:
1. `cd frontend && npm install` 실행
2. `npm run build` 오류 메시지 확인
3. 환경 변수 설정 확인 (`.env` 파일)






