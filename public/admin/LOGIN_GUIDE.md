# 🔐 Admin 로그인 기능 가이드

## 📋 구현 완료 사항

### ✅ 생성된 파일

| 파일 | 설명 |
|------|------|
| `public/admin/login.html` | 로그인 페이지 UI |
| `public/admin/login.js` | 로그인 로직 (NestJS API 연동) |
| `public/admin/login.css` | 로그인 페이지 스타일 |
| `public/admin/admin.js` (수정) | JWT 인증 체크 추가 |
| `public/admin/index.html` (수정) | 사용자 정보 및 로그아웃 버튼 추가 |
| `public/admin/admin.css` (수정) | 헤더 및 사용자 정보 스타일 추가 |

---

## 🚀 사용 방법

### **1단계: 서버 실행**

#### **Fastify 서버 (포트 8787)**
```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"
npm run dev
```

#### **NestJS 서버 (포트 8788)**
```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"
npm run start:dev
```

**서버가 모두 실행 중인지 확인**:
- Fastify: `http://localhost:8787/health`
- NestJS: `http://localhost:8788/auth/health`

---

### **2단계: 로그인 페이지 접속**

브라우저에서:
```
http://localhost:8787/admin/login.html
```

---

### **3단계: 로그인**

#### **기본 관리자 계정**:
- **이메일**: `consulting_manager@naver.com`
- **비밀번호**: (최초 설정 필요)

#### **최초 로그인 시**:

1. 비밀번호가 설정되지 않은 경우, Thunder Client로 비밀번호 설정:

```http
POST http://localhost:8788/auth/setup-password
Content-Type: application/json

{
  "email": "consulting_manager@naver.com",
  "new_password": "secure_password_123"
}
```

2. 응답으로 JWT 토큰을 받으면 성공입니다.

3. 이제 로그인 페이지에서 설정한 비밀번호로 로그인하세요.

---

### **4단계: 로그인 성공**

로그인 성공 시:
1. ✅ JWT 토큰이 `localStorage`에 저장됨
2. ✅ 사용자 정보가 `localStorage`에 저장됨
3. ✅ 자동으로 `/admin/index.html` (대시보드)로 이동
4. ✅ 대시보드 우측 상단에 사용자 정보 및 로그아웃 버튼 표시

---

## 📊 동작 흐름

```
1. 사용자가 /admin/login.html 접속
   ↓
2. email/password 입력
   ↓
3. NestJS /auth/login API 호출 (http://localhost:8788/auth/login)
   ↓
4. 로그인 성공 시:
   - JWT 토큰 받음
   - localStorage에 저장:
     * admin_jwt_token: JWT 토큰
     * admin_user: 사용자 정보 (JSON)
     * admin_token_expires: 토큰 만료 시간
   ↓
5. /admin/index.html로 리다이렉트
   ↓
6. admin.js의 checkAuthentication() 실행:
   - JWT 토큰 확인
   - 토큰 만료 확인
   - 토큰이 없거나 만료되면 /admin/login.html로 리다이렉트
   ↓
7. 인증 성공 시:
   - 사용자 정보 표시
   - 대시보드 로드
```

---

## 🔐 인증 메커니즘

### **JWT 토큰 저장**

```javascript
// login.js에서 저장
localStorage.setItem('admin_jwt_token', token);
localStorage.setItem('admin_user', JSON.stringify(user));
localStorage.setItem('admin_token_expires', expiresAt);
```

### **인증 체크 (admin.js)**

```javascript
// 페이지 로드 시 자동 실행
window.addEventListener('DOMContentLoaded', () => {
  checkAuthentication();  // JWT 토큰 확인
  displayUserInfo();      // 사용자 정보 표시
});
```

### **로그아웃**

```javascript
function logout() {
  // localStorage 초기화
  localStorage.removeItem('admin_jwt_token');
  localStorage.removeItem('admin_user');
  localStorage.removeItem('admin_token_expires');
  
  // 로그인 페이지로 이동
  window.location.href = '/admin/login.html';
}
```

---

## 🧪 테스트 시나리오

### ✅ **시나리오 1: 정상 로그인**

1. `/admin/login.html` 접속
2. 이메일: `consulting_manager@naver.com`
3. 비밀번호: `secure_password_123`
4. "로그인" 버튼 클릭
5. **예상 결과**:
   - ✅ "환영합니다, Manager님!" 메시지
   - ✅ 1초 후 `/admin/index.html`로 이동
   - ✅ 대시보드 우측 상단에 "👤 Manager (admin)" 표시
   - ✅ "로그아웃" 버튼 표시

---

### ❌ **시나리오 2: 잘못된 비밀번호**

1. `/admin/login.html` 접속
2. 이메일: `consulting_manager@naver.com`
3. 비밀번호: `wrong_password`
4. "로그인" 버튼 클릭
5. **예상 결과**:
   - ❌ "이메일 또는 비밀번호가 올바르지 않습니다." 에러 메시지
   - 로그인 페이지에 그대로 머물러 있음

---

### ⚠️ **시나리오 3: 비밀번호 미설정**

1. 비밀번호가 설정되지 않은 계정으로 로그인 시도
2. **예상 결과**:
   - ⚠️  "비밀번호가 설정되지 않았습니다. 최초 비밀번호 설정이 필요합니다." 메시지
   - `/auth/setup-password` API로 먼저 비밀번호 설정 필요

---

### 🔄 **시나리오 4: 자동 리다이렉트**

1. 로그인하지 않고 `/admin/index.html` 직접 접속
2. **예상 결과**:
   - ✅ 자동으로 `/admin/login.html`로 리다이렉트
   - 콘솔에 "❌ JWT 토큰이 없습니다." 메시지

---

### 🚪 **시나리오 5: 로그아웃**

1. 로그인 후 대시보드에서 "로그아웃" 버튼 클릭
2. 확인 대화상자에서 "확인" 클릭
3. **예상 결과**:
   - ✅ localStorage 초기화
   - ✅ `/admin/login.html`로 리다이렉트

---

### ⏰ **시나리오 6: 토큰 만료**

1. JWT 토큰이 만료된 상태에서 `/admin/index.html` 접속
2. **예상 결과**:
   - ✅ 자동으로 `/admin/login.html`로 리다이렉트
   - 콘솔에 "❌ JWT 토큰이 만료되었습니다." 메시지

---

## 🎨 UI 특징

### **로그인 페이지**
- 🎨 그라데이션 배경 (보라색 → 분홍색)
- 🎴 카드 형태의 로그인 폼
- ⏳ 로딩 중 스피너 표시
- ✅ 성공/에러 메시지 표시
- 📱 반응형 디자인 (모바일 지원)

### **대시보드**
- 👤 우측 상단에 사용자 정보 표시
- 🚪 로그아웃 버튼
- 🎯 깔끔한 레이아웃

---

## 🔧 커스터마이징

### **NestJS API 서버 URL 변경**

`public/admin/login.js` 파일의 첫 줄:

```javascript
// 개발 환경
const NEST_API_BASE = 'http://localhost:8788';

// 프로덕션 환경
const NEST_API_BASE = 'https://api.yourdomain.com';
```

### **토큰 만료 시간 변경**

NestJS `.env` 파일:

```env
JWT_EXPIRES_IN=7d  # 7일
JWT_EXPIRES_IN=24h # 24시간
JWT_EXPIRES_IN=30d # 30일
```

---

## 📦 localStorage 구조

```javascript
// JWT 토큰
localStorage.getItem('admin_jwt_token')
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

// 사용자 정보
localStorage.getItem('admin_user')
// {"id":"abc123","name":"Manager","email":"...","role":"admin","site_id":null}

// 토큰 만료 시간
localStorage.getItem('admin_token_expires')
// "2025-12-11T12:53:00.000Z"
```

---

## 🐛 트러블슈팅

### **문제 1: "서버 연결에 실패했습니다"**

**원인**: NestJS 서버가 실행되지 않음

**해결**:
```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"
npm run start:dev
```

---

### **문제 2: CORS 에러**

**원인**: NestJS CORS 설정에 프론트엔드 origin이 없음

**해결**: `nest-api/src/main.ts` 확인:
```typescript
app.enableCors({
  origin: ['http://localhost:8787', ...], // Fastify 서버 origin 추가
  ...
});
```

---

### **문제 3: 로그인 후에도 계속 로그인 페이지로 이동**

**원인**: localStorage에 토큰이 저장되지 않음

**해결**:
1. 브라우저 개발자 도구 → Application → Local Storage 확인
2. `admin_jwt_token` 키가 있는지 확인
3. 없으면 로그인 API 응답 확인

---

### **문제 4: "비밀번호가 설정되지 않았습니다" 메시지**

**원인**: 계정에 비밀번호가 설정되지 않음

**해결**: Thunder Client로 비밀번호 설정:
```http
POST http://localhost:8788/auth/setup-password
Content-Type: application/json

{
  "email": "consulting_manager@naver.com",
  "new_password": "your_secure_password"
}
```

---

## 🎯 다음 단계

1. ✅ 로그인 기능 테스트
2. ✅ 비밀번호 변경 기능 추가 (선택)
3. ✅ "비밀번호 찾기" 기능 추가 (선택)
4. ✅ 다중 사용자 관리 (선택)

---

## 🔒 보안 권장사항

1. **프로덕션 환경**:
   - HTTPS 사용 필수
   - JWT_SECRET 강력한 랜덤 문자열로 변경
   - 토큰 만료 시간 적절히 설정

2. **추가 보안**:
   - Refresh Token 구현 (선택)
   - 2FA 인증 추가 (선택)
   - IP 제한 (선택)

---

모든 기능이 구현 완료되었습니다! 🎉







































































































