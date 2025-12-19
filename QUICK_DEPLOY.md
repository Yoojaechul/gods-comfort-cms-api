# 🚀 Firebase Functions 빠른 배포 가이드

## 1단계: Functions 의존성 설치

```powershell
cd functions
npm install
cd ..
```

## 2단계: Functions 배포

```powershell
firebase deploy --only functions
```

## 3단계: 배포 확인

배포 완료 후 아래 URL로 테스트:

```powershell
# Health Check
curl https://us-central1-gods-comfort-word.cloudfunctions.net/api/health

# Login (임시)
curl -X POST https://us-central1-gods-comfort-word.cloudfunctions.net/api/auth/login -H "Content-Type: application/json"
```

---

## 프론트엔드 설정

`frontend/.env.local` 파일 생성:

```env
VITE_CMS_API_BASE_URL=https://us-central1-gods-comfort-word.cloudfunctions.net/api
```

또는 Hosting Rewrite 사용 시:
```env
VITE_CMS_API_BASE_URL=/api
```

---

## 전체 배포 (Functions + Hosting)

```powershell
# Functions 배포
firebase deploy --only functions

# 프론트 빌드
cd frontend
npm run build
cd ..

# Hosting 배포
firebase deploy --only hosting
```

---

자세한 내용은 `FIREBASE_FUNCTIONS_DEPLOY_GUIDE.md` 참고하세요.
