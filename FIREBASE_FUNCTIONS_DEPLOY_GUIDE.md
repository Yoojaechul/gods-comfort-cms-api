# Firebase Cloud Functions 배포 가이드

## 📋 사전 준비

### 1. Firebase CLI 설치 확인
```powershell
firebase --version
```

Firebase CLI가 설치되지 않은 경우:
```powershell
npm install -g firebase-tools
```

### 2. Firebase 로그인
```powershell
firebase login
```

브라우저가 열리면 Google 계정으로 로그인하세요.

### 3. 프로젝트 연결 확인
```powershell
firebase projects:list
```

프로젝트 `gods-comfort-word`가 목록에 있는지 확인하세요.

---

## 🚀 배포 단계

### 단계 1: Functions 디렉토리로 이동 및 의존성 설치

```powershell
cd functions
npm install
cd ..
```

**예상 출력:**
- `functions/` 디렉토리에 `node_modules/` 생성
- 패키지 설치 완료 메시지

---

### 단계 2: Firebase Functions 초기화 (처음 한 번만)

⚠️ **주의**: 이미 `functions/` 디렉토리가 있고 `firebase.json`이 있다면 이 단계를 건너뛰세요.

```powershell
firebase init functions
```

**질문에 대한 답변:**
1. **Use an existing project?** → `Y` 선택
2. **Select a default Firebase project for this directory** → `gods-comfort-word` 선택
3. **What language would you like to use?** → `JavaScript` 선택
4. **Do you want to use ESLint?** → `N` 선택 (선택사항)
5. **Do you want to install dependencies with npm now?** → `Y` 선택

---

### 단계 3: 로컬 테스트 (선택사항)

Firebase Emulator를 사용하여 로컬에서 테스트할 수 있습니다:

```powershell
firebase emulators:start --only functions
```

**다른 터미널에서 테스트:**
```powershell
curl http://localhost:5001/gods-comfort-word/us-central1/api/health
curl -X POST http://localhost:5001/gods-comfort-word/us-central1/api/auth/login -H "Content-Type: application/json"
```

---

### 단계 4: Functions 배포

```powershell
firebase deploy --only functions
```

**또는 특정 함수만 배포:**
```powershell
firebase deploy --only functions:api
```

**예상 출력:**
```
✔  functions[api(us-central1)]: Successful create operation.
✔  Deploy complete!
```

**배포된 Functions URL:**
```
https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

---

### 단계 5: Functions URL 확인

배포 완료 후 콘솔에서 Functions URL을 확인하거나:

```powershell
firebase functions:list
```

또는 Firebase Console에서:
1. https://console.firebase.google.com 접속
2. 프로젝트 `gods-comfort-word` 선택
3. Functions 탭 클릭
4. `api` 함수 클릭
5. URL 확인

---

## 🔗 프론트엔드 설정

### 환경변수 설정

`frontend/.env` 또는 `frontend/.env.local` 파일에 Functions URL 추가:

```env
VITE_CMS_API_BASE_URL=https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

**또는 Hosting Rewrite를 사용하는 경우 (권장):**

Hosting Rewrite가 `/api/**`를 Functions로 리다이렉트하므로:
```env
VITE_CMS_API_BASE_URL=/api
```

---

### 프론트엔드 재빌드 및 배포

```powershell
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

---

## ✅ 배포 후 테스트

### 1. Health Check
```powershell
curl https://us-central1-gods-comfort-word.cloudfunctions.net/api/health
```

**예상 응답:**
```json
{"ok":true}
```

### 2. Login API
```powershell
curl -X POST https://us-central1-gods-comfort-word.cloudfunctions.net/api/auth/login -H "Content-Type: application/json"
```

**예상 응답:**
```json
{"token":"dev-token"}
```

### 3. 브라우저에서 테스트
- https://gods-comfort-word-cms.web.app 접속
- 로그인 페이지에서 로그인 시도
- 네트워크 탭에서 `/api/auth/login` 호출 확인
- 토큰이 localStorage에 저장되는지 확인

---

## 🔧 문제 해결

### 문제 1: "Functions source directory does not exist"
**원인**: `functions/` 디렉토리가 없거나 `firebase.json`의 `functions.source` 경로가 잘못됨

**해결**:
```powershell
# functions 디렉토리 확인
dir functions

# firebase.json 확인
type firebase.json
```

### 문제 2: "Permission denied" 또는 "Unauthorized"
**원인**: Firebase CLI가 로그인되지 않음

**해결**:
```powershell
firebase login --reauth
```

### 문제 3: "Project not found"
**원인**: `.firebaserc` 파일의 프로젝트 ID가 잘못됨

**해결**:
```powershell
# .firebaserc 확인
type .firebaserc

# 프로젝트 ID 수정 후 다시 배포
```

### 문제 4: CORS 에러
**원인**: Functions의 CORS 설정이 프론트엔드 origin과 일치하지 않음

**해결**:
1. `functions/index.js`의 `allowedOrigins` 배열 확인
2. 프론트엔드 실제 도메인 추가
3. Functions 재배포

---

## 📝 전체 배포 스크립트 (한 번에 실행)

```powershell
# 1. Functions 의존성 설치
cd functions
npm install
cd ..

# 2. Functions 배포
firebase deploy --only functions

# 3. 프론트엔드 빌드
cd frontend
npm run build
cd ..

# 4. Hosting 배포
firebase deploy --only hosting
```

---

## 🔄 Functions 업데이트 후 재배포

Functions 코드 수정 후 재배포:

```powershell
firebase deploy --only functions:api
```

---

## 📊 Functions 로그 확인

```powershell
firebase functions:log
```

또는 실시간 로그:
```powershell
firebase functions:log --follow
```

---

## 🎯 다음 단계

1. ✅ Functions 기본 구조 완료
2. ⏭️ 실제 로그인 로직 구현 (DB 연동)
3. ⏭️ JWT 토큰 생성 및 검증
4. ⏭️ 나머지 CMS API 엔드포인트 구현
5. ⏭️ Firestore 또는 Cloud SQL 연동

---

## 📚 참고 자료

- [Firebase Functions 문서](https://firebase.google.com/docs/functions)
- [Express on Firebase Functions](https://firebase.google.com/docs/functions/http-events)
- [Firebase CLI 명령어](https://firebase.google.com/docs/cli)












