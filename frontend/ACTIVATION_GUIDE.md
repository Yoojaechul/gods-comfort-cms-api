# 🚀 React 기반 관리자 대시보드 활성화 가이드

## 📋 사전 준비사항

### 1. 필요한 서버 실행 확인

React 대시보드는 다음 서버들이 실행 중이어야 합니다:

- **Fastify CMS 서버** (포트 8787) - API 엔드포인트 제공
- **NestJS API 서버** (포트는 환경에 따라 다름) - 인증 및 추가 API 제공 (선택사항)

### 2. 서버 실행 방법

#### Fastify CMS 서버 실행
```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"
npm run dev
# 또는
node server.js
```

#### NestJS API 서버 실행 (선택사항)
```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"
npm run start:dev
```

---

## 🎯 React 대시보드 활성화 단계

### 1단계: frontend 폴더로 이동

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\frontend"
```

### 2단계: 의존성 설치 (처음 한 번만)

```powershell
npm install
```

> **참고**: `node_modules` 폴더가 이미 있다면 이 단계는 건너뛰어도 됩니다.

### 3단계: 개발 서버 실행

```powershell
npm run dev
```

실행 후 다음과 같은 메시지가 표시됩니다:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:<vite-port>/
  ➜  Network: use --host to expose
```

### 4단계: 브라우저에서 접속

브라우저를 열고 다음 URL로 접속하세요:

```
http://localhost:<vite-port>/login
```

또는

```
http://localhost:<vite-port>
```
(자동으로 `/login`으로 리다이렉트됩니다)

---

## 🔐 로그인 방법

### 관리자 계정 정보

| 항목 | 값 |
|------|-----|
| **이메일** | `consulting_manager@naver.com` |
| **비밀번호** | `.env` 파일의 `CMS_TEST_ADMIN_PASSWORD` 값 (기본값: `123456`) |

### 로그인 후 이동 경로

- **관리자**: `/admin` → 관리자 대시보드
- **크리에이터**: `/creator` → 크리에이터 대시보드

---

## 📱 대시보드 기능

### 관리자 대시보드 (`/admin`)

1. **Dashboard** (`/admin`)
   - 전체 영상 수
   - 활성 크리에이터 수
   - 오늘 업로드된 영상 수
   - 최근 업로드된 영상 목록

2. **Videos** (`/admin/videos`)
   - 영상 목록 조회
   - 영상 등록/수정/삭제
   - 대량 등록 기능

3. **Creators** (`/admin/creators`)
   - 크리에이터 목록 조회
   - 크리에이터 생성/수정/삭제

4. **Users** (`/admin/users`)
   - 사용자 관리

5. **Settings** (`/admin/settings`)
   - 시스템 설정

---

## ⚙️ 설정 확인

### API 엔드포인트 설정

`frontend/src/config.ts` 파일에서 API 기본 URL을 확인하세요:

```typescript
export const CMS_API_BASE = "http://localhost:8787";
// HOME_URL은 하드코딩하지 말고 .env로 주입하세요.
// 예: VITE_HOME_URL=http://localhost:<home-port>
export const HOME_URL = (import.meta.env.VITE_HOME_URL || "").trim();
```

이 값이 Fastify CMS 서버의 포트(8787)와 일치하는지 확인하세요.

---

## 🔧 문제 해결

### 1. "Cannot connect to API" 오류

**원인**: Fastify CMS 서버(8787)가 실행되지 않음

**해결**:
```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"
npm run dev
```

### 2. "401 Unauthorized" 오류

**원인**: 로그인 토큰이 만료되었거나 잘못된 계정 정보

**해결**:
- 로그아웃 후 다시 로그인
- `.env` 파일의 `CMS_TEST_ADMIN_PASSWORD` 값 확인
- 브라우저 개발자 도구(F12) → Application → Local Storage에서 `cms_token` 삭제 후 재로그인

### 3. "CORS error" 오류

**원인**: CORS 설정 문제

**해결**: `server.js`에서 CORS 설정 확인:
```javascript
await app.register(cors, {
  // 환경에 맞게 허용 origin을 설정하세요.
  // 예: ["http://localhost:<vite-port>", "http://localhost:<home-port>"]
  origin: ["http://localhost:<vite-port>", "http://localhost:<home-port>"],
  credentials: true,
});
```

### 4. 포트 충돌 (5173 포트가 이미 사용 중)

**해결**: 다른 포트로 실행
```powershell
npm run dev -- --port 5174
```

또는 `vite.config.ts`에서 포트 설정:
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
});
```

---

## 📝 주요 파일 위치

| 파일 | 경로 | 설명 |
|------|------|------|
| 메인 앱 | `frontend/src/App.tsx` | 라우팅 설정 |
| 로그인 페이지 | `frontend/src/pages/LoginPage.tsx` | 로그인 UI |
| 관리자 대시보드 | `frontend/src/pages/AdminDashboard.tsx` | 대시보드 메인 |
| 인증 컨텍스트 | `frontend/src/contexts/AuthContext.tsx` | 인증 상태 관리 |
| API 설정 | `frontend/src/config.ts` | API URL 설정 |

---

## 🎉 완료!

이제 React 기반 관리자 대시보드를 사용할 수 있습니다!

**접속 URL**: `http://localhost:<vite-port>/admin`

**로그인 URL**: `http://localhost:<vite-port>/login`

---

## 💡 추가 팁

### 개발 서버를 백그라운드로 실행

PowerShell에서:
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\frontend'; npm run dev"
```

### 프로덕션 빌드

```powershell
npm run build
```

빌드된 파일은 `frontend/dist` 폴더에 생성됩니다.


























































