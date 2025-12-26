# 멀티사이트 CMS API

여러 홈페이지에 붙일 수 있는 공통 CMS API입니다. 멀티사이트(멀티테넌트) 구조로 각 사이트별로 콘텐츠를 분리 관리할 수 있습니다.

## 주요 기능

- 🔐 **멀티사이트 지원**: site_id 기반으로 콘텐츠 분리
- 👥 **역할 기반 접근 제어**: Admin(관리자) / Creator(크리에이터)
- 🔑 **하이브리드 인증**: 이메일/비밀번호 + API Key 병행 지원
- 🎬 **메타정보 자동 생성**: YouTube/Facebook URL만 입력해도 제목, 썸네일, embed URL 자동 생성
- ⏰ **세션 관리**: 3시간 세션 + 만료 알람 (10분, 5분, 1분 전)
- 🌐 **CORS 지원**: 여러 도메인에서 사용 가능
- 📱 **관리자 UI**: Admin/Creator 전용 웹 인터페이스 제공

## 기술 스택

- **Backend**: Node.js + Fastify
- **Database**: SQLite (better-sqlite3)
- **Frontend**: HTML + Vanilla JavaScript + CSS
- **인증**: JWT + API Key (하이브리드)

---

## 🚀 빠른 시작

### Step 1: 의존성 설치

```bash
npm install
```

### Step 2: 환경 변수 설정

**Windows:**
```bash
copy .env.example .env
```

**Mac/Linux:**
```bash
cp .env.example .env
```

`.env` 파일을 열어서 다음 값을 변경하세요:

```env
PORT=8787
ADMIN_BOOTSTRAP_KEY=my_secure_admin_key_12345678901234567890
JWT_SECRET=my_secure_jwt_secret_12345678901234567890
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Step 3: 서버 실행

```bash
npm run dev
```

또는

```bash
node server.js
```

서버가 시작되면 콘솔에 **Admin API Key**가 표시됩니다:

```
============================================================
✅ Admin 자동 생성 완료!
API Key: abc123def456...
⚠️  이 키를 안전한 곳에 저장하세요!
============================================================
✅ CMS API Server running on http://127.0.0.1:8787
📊 Admin UI: http://localhost:8787/admin
🎨 Creator UI: http://localhost:8787/creator
```

**중요:** Admin API Key를 메모장에 복사하세요!

### Step 4: 브라우저 접속 확인

- Health Check: `http://localhost:8787/health`
- Admin UI: `http://localhost:8787/admin`
- Creator 로그인: `http://localhost:8787/creator/login.html`
- 데모 뷰어: `http://localhost:8787/demo.html`

---

## ✅ 검증 체크리스트

전체 기능이 정상 작동하는지 확인하려면 **VERIFICATION_CHECKLIST.md**를 참고하세요.

### 빠른 검증 (5분)

1. ✅ `http://localhost:8787/health` → `{"ok":true}`
2. ✅ Admin UI에서 사이트 생성
3. ✅ Admin UI에서 Creator 생성 (이메일/비밀번호 포함)
4. ✅ Creator 로그인 (`/creator/login.html`)
5. ✅ YouTube 영상 등록 (메타 자동 생성 확인)
6. ✅ `/public/videos?site_id=gods` 조회

### 전체 검증 (15분)

**VERIFICATION_CHECKLIST.md** 파일의 전체 단계를 따라하세요.

---

## 🧪 테스트용 cURL 명령

### 1. Health Check

```bash
# 로컬
curl -i http://localhost:8787/health

# 프로덕션
curl -i https://api.godcomfortword.com/health
```

**예상 응답:**
```json
{
  "ok": true,
  "service": "cms-api",
  "ts": "2025-01-15T10:30:00.000Z"
}
```

### 1-1. 비밀번호 변경 테스트

```bash
# 로컬
curl -i -X POST http://localhost:8787/auth/change-password \
  -H "Content-Type: application/json" \
  -d '{"email":"j1dly1@naver.com","currentPassword":"123456789QWER","newPassword":"123456789"}'

# 프로덕션
curl -i -X POST https://api.godcomfortword.com/auth/change-password \
  -H "Content-Type: application/json" \
  -d '{"email":"j1dly1@naver.com","currentPassword":"123456789QWER","newPassword":"123456789"}'
```

**예상 응답 (성공):**
```json
{
  "ok": true
}
```

**예상 응답 (실패 - 현재 비밀번호 불일치):**
```json
{
  "error": "BAD_REQUEST",
  "message": "Current password is incorrect"
}
```

**주의:** 이 엔드포인트는 인증(JWT) 없이 호출 가능하며, `currentPassword` 검증으로 보안을 확보합니다.

---

### 2. 사이트 생성 (Admin)

```bash
curl -X POST http://localhost:8787/admin/sites \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_API_KEY" \
  -d '{
    "id": "gods",
    "name": "Gods Site"
  }'
```

**예상 응답:**
```json
{"id":"gods","name":"Gods Site"}
```

---

### 3. Creator 생성 (Admin) - 이메일 로그인용

```bash
curl -X POST http://localhost:8787/admin/creators \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_API_KEY" \
  -d '{
    "site_id": "gods",
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

**예상 응답:**
```json
{
  "id": "creator123abc",
  "site_id": "gods",
  "name": "John Doe",
  "email": "john@example.com",
  "api_key": "abc123def456..."
}
```

**중요:** `api_key`는 1회만 표시됩니다!

---

### 4. Creator 로그인 (이메일)

```bash
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**예상 응답:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": 1700010800000,
  "user": {
    "id": "creator123abc",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "creator",
    "site_id": "gods"
  }
}
```

**토큰을 저장하세요!**

---

### 5. 영상 등록 (Creator) - JWT 사용

```bash
curl -X POST http://localhost:8787/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "platform": "youtube",
    "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "visibility": "public"
  }'
```

**예상 응답:**
```json
{
  "id": "video123abc",
  "site_id": "gods",
  "owner_id": "creator123abc",
  "platform": "youtube",
  "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "visibility": "public",
  "created_at": "2025-12-02 09:30:00",
  "updated_at": "2025-12-02 09:30:00"
}
```

**주목:** 제목, 썸네일, embed URL이 자동으로 생성되었습니다!

---

### 6. 영상 등록 (Creator) - API Key 사용

```bash
curl -X POST http://localhost:8787/videos \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_CREATOR_API_KEY" \
  -d '{
    "platform": "youtube",
    "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "visibility": "public"
  }'
```

---

### 7. 공개 영상 조회 (인증 불필요)

```bash
curl "http://localhost:8787/public/videos?site_id=gods&limit=10"
```

**예상 응답:**
```json
{
  "videos": [
    {
      "id": "video123abc",
      "site_id": "gods",
      "platform": "youtube",
      "title": "Rick Astley - Never Gonna Give You Up",
      "thumbnail_url": "https://img.youtube.com/vi/.../hqdefault.jpg",
      "embed_url": "https://www.youtube.com/embed/...",
      "owner_name": "John Doe",
      "visibility": "public",
      "created_at": "2025-12-02 09:30:00",
      "updated_at": "2025-12-02 09:30:00"
    }
  ],
  "cursor": "2025-12-02 09:30:00"
}
```

---

### 8. 플랫폼 필터링

```bash
# YouTube만
curl "http://localhost:8787/public/videos?site_id=gods&platform=youtube"

# Facebook만
curl "http://localhost:8787/public/videos?site_id=gods&platform=facebook"

# 개수 제한
curl "http://localhost:8787/public/videos?site_id=gods&limit=5"
```

---

### 9. 영상 수정 (Creator)

```bash
curl -X PATCH http://localhost:8787/videos/video123abc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Updated Title",
    "visibility": "private"
  }'
```

---

### 10. 영상 삭제 (Creator)

```bash
curl -X DELETE http://localhost:8787/videos/video123abc \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 11. 플랫폼 키 저장 (Creator)

```bash
curl -X PUT http://localhost:8787/my/provider-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "provider": "youtube",
    "key_name": "api_key",
    "key_value": "AIzaSyABC123..."
  }'
```

---

## 📱 웹 UI 사용법

### Admin UI

1. **접속**: `http://localhost:8787/admin`
2. **API Key 입력**: 서버 콘솔에 출력된 Admin API Key
3. **사이트 생성**: ID와 이름 입력
4. **Creator 생성**: 
   - 사이트 선택
   - 이름, 이메일, 비밀번호 입력
   - API Key 복사 (1회만 표시)

### Creator UI (이메일 로그인)

1. **접속**: `http://localhost:8787/creator/login.html`
2. **"이메일 로그인" 탭 선택**
3. **로그인**: Admin이 발급한 이메일/비밀번호
4. **영상 관리**: 등록/수정/삭제
5. **세션**: 3시간 유효 (만료 전 알람)
6. **로그아웃**: 우측 상단 버튼

### Creator UI (API Key 로그인)

1. **접속**: `http://localhost:8787/creator/login.html`
2. **"API Key 로그인" 탭 선택**
3. **로그인**: Admin이 발급한 API Key
4. **세션**: 무제한

### 데모 뷰어

1. **접속**: `http://localhost:8787/demo.html`
2. **기능**: 
   - 공개 영상 자동 표시
   - 플랫폼 필터
   - 클릭해서 재생
   - 외부 홈페이지 연동 예제

---

## 🎬 메타정보 자동 생성

### YouTube (완전 자동)

**지원 URL:**
- `https://www.youtube.com/watch?v=VIDEOID`
- `https://youtu.be/VIDEOID`
- `https://www.youtube.com/shorts/VIDEOID`

**자동 생성:**
- ✅ `title`: YouTube oEmbed API
- ✅ `thumbnail_url`: `https://img.youtube.com/vi/VIDEOID/hqdefault.jpg`
- ✅ `embed_url`: `https://www.youtube.com/embed/VIDEOID`

### Facebook (부분 자동)

**지원 URL:**
- `https://www.facebook.com/watch/?v=123456789`
- `https://www.facebook.com/username/videos/123456789`

**자동 생성:**
- ✅ `embed_url`: Facebook 플러그인 URL

**수동 입력:**
- ❌ `title`: 직접 입력 필요
- ❌ `thumbnail_url`: 직접 입력 필요

**주의:** `/share/v/xxxxx/` 형식은 embed 불가. 동영상 상단 URL을 복사하세요.

---

## 📚 API 문서

자세한 API 문서는 다음 파일을 참고하세요:

- **API_DOCUMENTATION.md**: 전체 API 레퍼런스
- **UPGRADE_GUIDE.md**: 로그인 시스템 가이드
- **ERD.md**: 데이터베이스 ERD
- **SUMMARY.md**: 시스템 요약

---

## 🔐 인증 방식

### Creator 인증 (하이브리드)

#### 방법 1: 이메일 로그인 (권장)
```bash
# 1. 로그인
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'

# 2. 응답에서 token 저장
# {"token":"eyJhbGc...","expiresAt":1700010800000,"user":{...}}

# 3. API 호출 시 Bearer 토큰 사용
curl http://localhost:8787/videos \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**특징:**
- ✅ 3시간 세션
- ✅ 만료 알람
- ✅ 사용자 친화적

#### 방법 2: API Key (개발자용)
```bash
curl http://localhost:8787/videos \
  -H "x-api-key: YOUR_API_KEY"
```

**특징:**
- ✅ 만료 없음
- ✅ 스크립트/외부 앱 연동

### Admin 인증

```bash
curl http://localhost:8787/admin/sites \
  -H "x-api-key: YOUR_ADMIN_API_KEY"
```

---

## 🌐 외부 홈페이지 연동

### JavaScript 예제

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Videos</title>
</head>
<body>
  <div id="videos"></div>

  <script>
    const API_BASE = 'http://localhost:8787';
    const SITE_ID = 'gods';

    fetch(`${API_BASE}/public/videos?site_id=${SITE_ID}&limit=20`)
      .then(r => r.json())
      .then(data => {
        const container = document.getElementById('videos');
        
        data.videos.forEach(video => {
          const card = document.createElement('div');
          card.innerHTML = `
            <h3>${video.title || 'Untitled'}</h3>
            ${video.thumbnail_url ? 
              `<img src="${video.thumbnail_url}" alt="${video.title}">` : ''}
            ${video.embed_url ? 
              `<iframe src="${video.embed_url}" width="560" height="315" 
                frameborder="0" allowfullscreen></iframe>` : ''}
            <p>by ${video.owner_name}</p>
          `;
          container.appendChild(card);
        });
      });
  </script>
</body>
</html>
```

### React 예제

```jsx
import { useEffect, useState } from 'react';

function VideoList({ siteId }) {
  const [videos, setVideos] = useState([]);
  
  useEffect(() => {
    fetch(`http://localhost:8787/public/videos?site_id=${siteId}&limit=20`)
      .then(r => r.json())
      .then(data => setVideos(data.videos));
  }, [siteId]);
  
  return (
    <div>
      {videos.map(video => (
        <div key={video.id}>
          <h3>{video.title || 'Untitled'}</h3>
          {video.thumbnail_url && <img src={video.thumbnail_url} alt={video.title} />}
          {video.embed_url && (
            <iframe src={video.embed_url} width="560" height="315" 
              frameBorder="0" allowFullScreen />
          )}
          <p>by {video.owner_name}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 📊 API 엔드포인트 요약

### 공용 (인증 불필요)
- `GET /health` - 서버 상태
- `GET /public/videos?site_id=xxx` - 공개 영상 조회

### 인증 (JWT 또는 API Key)
- `POST /auth/login` - 이메일 로그인 (JWT 발급)
- `GET /me` - 현재 사용자 정보

### Admin 전용
- `POST /admin/sites` - 사이트 생성
- `GET /admin/sites` - 사이트 목록
- `POST /admin/creators` - Creator 생성
- `GET /admin/creators` - Creator 목록
- `PATCH /admin/creators/:id` - Creator 수정
- `POST /admin/creators/:id/rotate-key` - API Key 재발급

### Creator 전용
- `GET /videos` - 내 영상 목록
- `POST /videos` - 영상 등록
- `PATCH /videos/:id` - 영상 수정
- `DELETE /videos/:id` - 영상 삭제
- `GET /my/provider-keys` - 플랫폼 키 목록
- `PUT /my/provider-keys` - 플랫폼 키 저장
- `DELETE /my/provider-keys/:id` - 플랫폼 키 삭제

---

## 🎯 사용 시나리오

### 시나리오 1: 일반 Creator (이메일 로그인)

1. Admin이 Creator 생성 (이메일/비밀번호 발급)
2. Creator가 `/creator/login.html`에서 로그인
3. YouTube URL만 입력해서 영상 등록
4. 제목, 썸네일, embed URL 자동 생성 확인
5. 3시간 후 세션 만료 알람 확인

### 시나리오 2: 개발자 (API Key)

1. Admin이 Creator 생성 (이메일 없이)
2. API Key를 스크립트에 저장
3. cURL이나 Python으로 자동화
4. 만료 없이 계속 사용

### 시나리오 3: 외부 홈페이지

1. `/demo.html` 코드 복사
2. `SITE_ID` 변경
3. 자신의 홈페이지에 붙이기
4. 자동으로 영상 카드 렌더링

---

## 🔔 세션 만료 알람

이메일 로그인 시:

- **2시간 50분**: 🔴 "10분 전" 알람 (우측 상단 팝업)
- **2시간 55분**: 🔴 "5분 전" 알람
- **2시간 59분**: 🔴 "1분 전" 알람
- **3시간**: ⚠️ "세션 만료" alert + 자동 로그아웃

알람은 10초 후 자동으로 사라집니다.

---

## 🗂️ 프로젝트 구조

```
cms_api/
├── server.js              # 메인 서버 (Fastify)
├── db.js                  # DB 초기화 + 유틸리티
├── auth.js                # 인증 미들웨어 (JWT + API Key)
├── jwt.js                 # JWT 토큰 관리
├── metadata.js            # 메타정보 자동 생성
├── package.json
├── .env.example           # 환경 변수 예제
├── cms.db                 # SQLite DB (자동 생성)
├── README.md              # 이 문서
├── API_DOCUMENTATION.md   # API 레퍼런스
├── UPGRADE_GUIDE.md       # 업그레이드 가이드
├── ERD.md                 # 데이터베이스 ERD
├── SUMMARY.md             # 시스템 요약
└── public/
    ├── admin/
    │   ├── index.html     # Admin UI
    │   ├── admin.js
    │   └── admin.css
    ├── creator/
    │   ├── login.html     # Creator 로그인
    │   ├── index.html     # Creator UI
    │   ├── creator.js
    │   └── creator.css
    └── demo.html          # 데모 뷰어
```

---

## 🔒 보안

- **API Key**: scrypt 해싱 (salt 포함)
- **비밀번호**: scrypt 해싱 (salt 포함)
- **JWT 토큰**: 3시간 만료
- **CORS**: 설정된 도메인만 허용
- **권한**: Creator는 자기 site_id 데이터만 접근

---

## 🐛 문제 해결

### 서버가 시작되지 않음
```bash
# Node 프로세스 확인
Get-Process -Name node

# 포트 사용 확인
netstat -ano | findstr :8787
```

### Admin API Key를 잃어버림
```bash
# DB 초기화 (주의: 모든 데이터 삭제)
Remove-Item cms.db
node server.js
```

### 브라우저 캐시 문제
- **Ctrl + Shift + Delete**: 캐시 삭제
- **Ctrl + F5**: 강력 새로고침
- 시크릿 모드에서 테스트

---

## 📞 추가 문서

- **API_DOCUMENTATION.md**: 모든 API 상세 문서
- **UPGRADE_GUIDE.md**: 로그인 시스템 가이드
- **ERD.md**: 데이터베이스 구조
- **SUMMARY.md**: 시스템 전체 요약

---

## 🚀 배포

### Cloud Run 배포

자세한 내용은 **DEPLOY_COMMANDS.md**를 참고하세요.

#### 배포 전 확인사항

1. **초기 계정 생성**
   ```bash
   # 로컬에서 실행하여 계정 생성/업데이트
   node setup-initial-accounts.js
   ```

2. **배포 환경에서도 초기 계정 생성 필요**
   
   Cloud Run은 컨테이너 파일시스템이 ephemeral이므로, 배포 후에도 초기 계정을 생성해야 합니다.
   
   **방법 1: Cloud Run 환경 변수 사용 (권장)**
   
   Cloud Run 서비스에 다음 환경 변수를 설정:
   ```powershell
   gcloud run services update cms-api `
     --set-env-vars "ADMIN_EMAIL=consulting_manager@naver.com,ADMIN_PASSWORD=123456,CREATOR_EMAIL=j1dly1@naver.com,CREATOR_PASSWORD=123456789QWER" `
     --region asia-northeast3
   ```
   
   `server.js`는 시작 시 `ensureAdminFromEnv()`와 `ensureCreatorFromEnv()`를 호출하여 자동으로 계정을 생성/업데이트합니다.
   
   **방법 2: Cloud Run Job으로 setup-initial-accounts.js 실행**
   
   ```powershell
   # Cloud Run Job 생성 (한 번만 실행)
   gcloud run jobs create setup-accounts `
     --image gcr.io/esoteric-throne-471613-j6/cms-api:latest `
     --region asia-northeast3 `
     --set-env-vars "DB_PATH=/tmp/cms.db" `
     --command "node" `
     --args "setup-initial-accounts.js"
   
   # Job 실행
   gcloud run jobs execute setup-accounts --region asia-northeast3
   ```
   
   **주의:** Cloud Run은 ephemeral 파일시스템이므로 컨테이너 재시작 시 DB가 초기화될 수 있습니다. 환경 변수로 자동 생성하는 방식(방법 1)이 가장 안정적입니다.

3. **버전 확인**
   
   배포 후 `/health` 엔드포인트에서 버전 정보 확인:
   ```bash
   curl https://api.godcomfortword.com/health
   ```
   
   응답 예시:
   ```json
   {
     "status": "ok",
     "service": "cms-api",
     "message": "CMS API is running",
     "version": "1.0.0",
     "buildTime": "2025-01-15T10:30:00.000Z",
     "gitHash": "abc1234"
   }
   ```

### Render.com
1. GitHub에 코드 푸시
2. Render.com에서 Web Service 생성
3. 환경 변수 설정
4. 자동 배포

### Railway.app
1. Railway에 프로젝트 연결
2. 환경 변수 설정
3. 자동 배포

자세한 내용은 **SUMMARY.md**의 "배포" 섹션 참고

---

## 📝 라이선스

ISC

---

## 🎉 완성!

이 프로젝트는 프로덕션 준비가 완료되었습니다:

- ✅ 멀티사이트 구조
- ✅ 하이브리드 인증
- ✅ 세션 관리
- ✅ 메타정보 자동 생성
- ✅ 완전한 CRUD
- ✅ 공개 API
- ✅ 관리자 UI
- ✅ 데모 뷰어
- ✅ 완전한 문서

**지금 바로 사용할 수 있습니다!** 🚀
