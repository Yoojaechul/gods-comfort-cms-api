# ✅ Firebase Functions 설정 완료

## 📁 생성된 파일 구조

```
999. cms_api/
├── functions/
│   ├── index.js          # Express 앱 및 라우트
│   ├── package.json      # Node 18 의존성
│   └── .gitignore
├── firebase.json         # Functions + Hosting 설정
└── .firebaserc          # 프로젝트 ID: gods-comfort-word
```

---

## 🔧 구현된 기능

### ✅ Express 앱 구성
- Node.js 18 런타임
- Express 프레임워크
- CORS 미들웨어

### ✅ CORS 허용 Origin
- `https://gods-comfort-word-cms.web.app` (프로덕션)
- `http://localhost:5173` (개발 환경)

### ✅ 라우트
1. **GET /health** → `{ ok: true }`
2. **POST /auth/login** → `{ token: "dev-token" }` (임시)

---

## 🚀 배포 명령어

### 1. Functions 의존성 설치
```powershell
cd functions
npm install
cd ..
```

### 2. Functions 배포
```powershell
firebase deploy --only functions
```

### 3. 배포 확인
```powershell
curl https://us-central1-gods-comfort-word.cloudfunctions.net/api/health
```

---

## 📝 프론트엔드 환경변수 설정

`frontend/.env.local` 파일 생성:

```env
VITE_CMS_API_BASE_URL=https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

또는 Hosting Rewrite 사용 (권장):
```env
VITE_CMS_API_BASE_URL=/api
```

---

## 🔄 다음 단계

1. ⏭️ 실제 로그인 로직 구현 (DB 연동)
2. ⏭️ JWT 토큰 생성 및 검증
3. ⏭️ 나머지 CMS API 엔드포인트 마이그레이션

자세한 배포 가이드는 `FIREBASE_FUNCTIONS_DEPLOY_GUIDE.md`를 참고하세요.
