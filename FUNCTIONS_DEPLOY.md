# Firebase Functions 배포 가이드

## 📋 수정된 파일

1. **functions/index.js** - 모든 API 엔드포인트 구현
2. **functions/package.json** - better-sqlite3, jsonwebtoken 패키지 추가

---

## 🔧 구현된 엔드포인트

### GET /health
- 서버 헬스 체크
- DB 연결 상태 확인

### POST /auth/login
- 이메일/비밀번호 로그인
- JWT 토큰 발급
- DB 사용자 검증

### POST /auth/check-email
- 이메일 존재 여부 확인
- 역할(role) 정보 반환

### POST /auth/change-password
- 비밀번호 변경 (이메일 기반)
- 역할 체크 (admin/creator만 가능)
- 현재 비밀번호 검증
- DB 업데이트

### GET /creator/videos
- Creator 영상 목록 조회
- JWT 토큰 검증 필요
- owner_id와 site_id 기반 필터링

---

## 🚀 배포 절차

### 1. DB 파일 준비

Firebase Functions에 배포할 때 DB 파일(`cms.db`)이 포함되어야 합니다.

```bash
# DB 파일을 functions 디렉토리로 복사
cp cms.db functions/cms.db
```

또는 `.gitignore`에서 `functions/cms.db`를 제외하여 저장소에 포함시키세요.

### 2. 환경 변수 설정

Firebase Functions에 환경 변수를 설정합니다:

```bash
firebase functions:config:set jwt.secret="your-secret-key-here"
```

또는 Firebase Console에서:
1. Firebase Console > Functions > Configuration
2. Environment variables 추가:
   - `JWT_SECRET`: JWT 서명용 시크릿 키
   - `SQLITE_DB_PATH`: DB 파일 경로 (선택사항, 기본값: `functions/cms.db`)

### 3. 의존성 설치

```bash
cd functions
npm install
cd ..
```

### 4. Firebase Functions 배포

```bash
# functions 디렉토리에서
firebase deploy --only functions:api
```

또는 루트 디렉토리에서:

```bash
firebase deploy --only functions
```

---

## ⚠️ 중요 사항

### DB 파일 위치

Firebase Functions는 임시 파일 시스템을 사용하므로:

1. **옵션 1**: DB 파일을 `functions/cms.db`에 포함시켜 배포
   - `.gitignore`에 `functions/cms.db` 추가하지 않음
   - DB 파일이 배포 패키지에 포함됨

2. **옵션 2**: Cloud Storage에서 DB 파일 로드 (고급)
   - Firebase Storage에 DB 파일 업로드
   - Functions에서 Storage에서 다운로드하여 사용

### CORS 설정

현재 허용된 Origin:
- `https://cms.godcomfortword.com`
- `https://gods-comfort-word-cms.web.app`
- `https://gods-comfort-word-cms.firebaseapp.com`
- `https://www.godcomfortword.com`
- `https://godcomfortword.com`
- `http://localhost:5173`
- `http://localhost:3000`

추가 Origin이 필요하면 `functions/index.js`의 `allowedOrigins` 배열에 추가하세요.

### JWT 시크릿 키

**반드시 프로덕션에서는 강력한 JWT 시크릿 키를 사용하세요!**

```bash
# 랜덤 시크릿 키 생성 (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

생성된 키를 Firebase Functions 환경 변수로 설정:

```bash
firebase functions:config:set jwt.secret="generated-secret-key-here"
```

---

## 🧪 로컬 테스트

### Firebase Functions 에뮬레이터

```bash
cd functions
npm install

# 에뮬레이터 실행
firebase emulators:start --only functions

# 다른 터미널에서 테스트
curl http://localhost:5001/gods-comfort-word/us-central1/api/health
```

### 로컬 DB 테스트

로컬에서 테스트할 때는 DB 파일 경로를 환경 변수로 지정:

```bash
export SQLITE_DB_PATH=/path/to/cms.db
firebase emulators:start --only functions
```

---

## 📝 배포 체크리스트

- [ ] `functions/cms.db` 파일이 존재하는지 확인 (또는 환경 변수로 경로 지정)
- [ ] `functions/package.json`에 필요한 패키지가 포함되어 있는지 확인
- [ ] `npm install` 실행하여 의존성 설치 완료
- [ ] JWT_SECRET 환경 변수 설정
- [ ] CORS 허용 Origin 확인
- [ ] `firebase deploy --only functions:api` 실행
- [ ] 배포 후 엔드포인트 테스트

---

## 🔍 문제 해결

### "Database not available" 에러

- DB 파일이 `functions/cms.db`에 존재하는지 확인
- 또는 `SQLITE_DB_PATH` 환경 변수가 올바르게 설정되었는지 확인

### JWT 토큰 검증 실패

- `JWT_SECRET` 환경 변수가 설정되어 있는지 확인
- 토큰 생성 시 사용한 시크릿과 검증 시 사용한 시크릿이 일치하는지 확인

### CORS 에러

- 요청 Origin이 `allowedOrigins` 배열에 포함되어 있는지 확인
- Firebase Functions 로그에서 "CORS blocked" 메시지 확인

---

## 📌 참고

- Firebase Functions 최대 실행 시간: 60초 (1세대), 540초 (2세대)
- Firebase Functions 메모리: 기본 256MB, 최대 8GB
- Firebase Functions 리전: `us-central1` (기본값)


