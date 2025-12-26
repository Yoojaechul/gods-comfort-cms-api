# 환경 변수 설정 가이드

## 📋 백엔드 환경 변수 (server.js)

### 프로젝트 루트 `.env` 파일

```env
PORT=8787
JWT_SECRET=your_secure_jwt_secret_key
ADMIN_EMAIL=consulting_manager@naver.com
ADMIN_PASSWORD=123456
DB_PATH=cms.db
```

---

## 📋 프론트엔드 환경 변수

### 로컬 개발용 (`frontend/.env.local`)

**파일 생성:**
```powershell
# 프로젝트 루트에서 실행
cd frontend
New-Item -Path ".env.local" -ItemType File -Force
```

**내용:**
```env
# 로컬 개발 환경 변수
# 이 파일은 git에 커밋하지 않습니다 (.gitignore에 포함)

# 로컬 API 서버 주소
VITE_CMS_API_BASE_URL=http://127.0.0.1:8787

# 또는
# VITE_API_BASE_URL=http://127.0.0.1:8787
```

### 프로덕션 빌드용 (`frontend/.env.production`)

**파일 생성:**
```powershell
# 프로젝트 루트에서 실행
cd frontend
New-Item -Path ".env.production" -ItemType File -Force
```

**내용:**
```env
# 프로덕션 빌드 환경 변수
# ⚠️ 중요: API 서버는 SPA 호스팅 도메인과 별도여야 합니다.
# SPA: https://cms.godcomfortword.com (Firebase Hosting)
# API: https://api.godcomfortword.com (Cloud Run)

# 프로덕션 API 서버 주소
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com

# 또는 (두 개 중 하나만 설정)
# VITE_API_BASE_URL=https://api.godcomfortword.com
```

---

## ✅ 확인 방법

### 로컬 개발 환경 확인

```powershell
# 프론트엔드 개발 서버 실행
cd frontend
npm run dev
```

브라우저 콘솔에서 확인:
```javascript
console.log(import.meta.env.VITE_CMS_API_BASE_URL);
// 예상 출력: "http://127.0.0.1:8787"
```

### 프로덕션 빌드 확인

```powershell
# 프론트엔드 빌드
cd frontend
npm run build

# 빌드된 파일에서 확인
Select-String -Path "dist/assets/*.js" -Pattern "api.godcomfortword.com"
```

---

## 🔧 문제 해결

### "API_BASE_URL cannot point to SPA hosting domain" 오류

**원인:** `.env.production`에 SPA 호스팅 도메인이 설정됨

**해결:**
1. `frontend/.env.production` 파일 확인
2. `VITE_CMS_API_BASE_URL` 값을 `https://api.godcomfortword.com`으로 변경
3. 빌드 재실행

### 로컬에서 API 요청이 실패하는 경우

**원인:** `.env.local` 파일이 없거나 잘못된 주소 설정

**해결:**
1. `frontend/.env.local` 파일 생성
2. `VITE_CMS_API_BASE_URL=http://127.0.0.1:8787` 설정
3. 개발 서버 재시작


