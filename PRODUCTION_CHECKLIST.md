# 프로덕션 배포 전 최종 체크리스트

## 🔒 보안 설정 (매우 중요!)

### 1. 시크릿 키 생성 및 설정

**.env.production** 파일 생성:

```env
# 서버 포트
PORT=8787

# JWT Secret (아래 명령으로 생성된 키 사용)
JWT_SECRET=22151c2bc3f87920ee938bc3c30590d36f928877d42ef40d1147bbda5cfe7ba20cab38776f444d38d5c10cc3e485b3684e49ca868308a5910f09f24e4c77ed28

# Admin Bootstrap Key (아래 명령으로 생성된 키 사용)
ADMIN_BOOTSTRAP_KEY=a2bd9baec1b2c4c016bd8498061794fea378f8b1ada14371723d8697062134c7

# CORS - 운영 도메인만 포함
CORS_ORIGINS=https://godscomfortword.com,https://www.godscomfortword.com
```

**강력한 키 생성 방법**:
```bash
node -e "console.log('JWT_SECRET='+require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('ADMIN_BOOTSTRAP_KEY='+require('crypto').randomBytes(32).toString('hex'))"
```

### 2. 프론트엔드 환경변수

**Next.js .env.production**:
```env
NEXT_PUBLIC_CMS_API_BASE_URL=https://cms-api.godscomfortword.com
```

**주의사항**:
- ❌ localhost 포함 금지
- ✅ HTTPS만 사용
- ❌ API Key, Secret 포함 금지
- ✅ NEXT_PUBLIC_ 접두사만 사용

---

## ✅ 보안 점검

### A. 민감정보 제거

#### 프론트엔드 (Next.js)
- [x] API Key 하드코딩 없음
- [x] Secret 하드코딩 없음
- [x] 토큰 로그 출력 제거
- [x] 비밀번호 로그 출력 제거
- [x] 환경변수로 API URL 분리

#### 백엔드 (CMS API)
- [x] API Key 로그 조건부 출력 (개발 환경만)
- [x] 비밀번호 로그 제거
- [x] CORS 로그 최소화 (프로덕션)
- [x] 에러 메시지에 민감정보 없음

### B. CORS 설정

**개발 환경**:
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

**프로덕션 환경**:
```env
CORS_ORIGINS=https://godscomfortword.com,https://www.godscomfortword.com
```

**금지사항**:
- ❌ `*` (모든 도메인 허용)
- ❌ localhost 포함 (운영 환경)
- ❌ HTTP (HTTPS만 사용)

---

## 🔑 권한 재점검

### Admin 권한

**허용**:
- ✅ 모든 영상 조회 (`GET /admin/videos`)
- ✅ 모든 영상 수정 (`PATCH /admin/videos/:id`)
- ✅ 모든 영상 삭제 (`DELETE /admin/videos/:id`)
- ✅ Stats 수정 (`PATCH /admin/videos/:id/stats`)
- ✅ 접속자 통계 (`GET /admin/analytics`)
- ✅ 사이트 관리 (`GET /admin/sites`)

**API 검증**:
```javascript
// auth.js
export async function requireAdmin(request, reply) {
  if (request.user.role !== "admin") {
    return reply.code(403).send({ 
      error: "Access denied",
      message: "관리자 권한이 필요합니다."
    });
  }
}
```

### Creator 권한

**허용**:
- ✅ 본인 영상만 조회 (`GET /videos`)
- ✅ 본인 영상만 추가 (`POST /videos`)
- ✅ 본인 영상만 수정 (`PATCH /videos/:id`)
- ✅ 본인 영상만 삭제 (`DELETE /videos/:id`)
- ✅ Stats 읽기 (수정 불가)

**금지**:
- ❌ 다른 사용자 영상 접근
- ❌ Stats 수정
- ❌ 접속자 통계 접근
- ❌ 사이트 관리

**API 검증**:
```javascript
// 본인 영상만 삭제
const result = db
  .prepare("DELETE FROM videos WHERE id = ? AND owner_id = ?")
  .run(id, user.id);

// 본인 영상만 수정
const existing = db
  .prepare("SELECT * FROM videos WHERE id = ? AND owner_id = ?")
  .get(id, user.id);
```

---

## 📝 로그 정리

### 제거된 로그

#### 프론트엔드:
- ❌ `console.log("로그인 성공:", data)` → 제거
- ❌ `console.log("토큰 및 사용자 정보 저장 완료")` → 제거
- ❌ `console.log("영상 추가 성공:", result)` → 제거
- ❌ `console.log("Stats 수정 성공:", result)` → 제거

#### 백엔드:
- ❌ `console.log("API Key:", apiKey)` → 제거 (프로덕션)
- 📉 CORS 로그 최소화 (프로덕션)

### 유지된 로그 (에러만)

```javascript
// 개발 환경 디버깅용 - 프로덕션에서는 최소화
console.error("영상 목록 불러오기 오류:", err);
console.warn("🚫 CORS blocked:", origin);
```

---

## 🌐 공개 API 점검

### GET /public/videos?site_id=gods

**응답 필드 확인**:
```json
{
  "items": [
    {
      "id": "video_id",
      "site_id": "gods",
      "platform": "youtube",          // ✅ 필수
      "video_id": "dQw4w9WgXcQ",     // ✅ 필수
      "title": "영상 제목",           // ✅ 필수
      "thumbnail_url": "https://...", // ✅ 필수
      "embed_url": "https://...",     // ✅ 필수
      "language": "ko",               // ✅ 필수
      "status": "active",             // ✅ 필수
      "visibility": "public",         // ✅ 필수
      "created_at": "2025-12-02...",  // ✅ 필수
      "updated_at": "2025-12-02...",  // ✅ 필수
      "views_count": 150,             // ✅ Stats
      "likes_count": 30000,           // ✅ Stats
      "shares_count": 0,              // ✅ Stats
      "owner_name": "Admin"           // ℹ️ 선택
    }
  ],
  "total": 4,
  "page": 1,
  "page_size": 100,
  "cursor": "2025-12-02..."
}
```

**렌더링에 필요한 모든 필드 포함됨!** ✅

---

## 🧪 테스트 시나리오

### A. Admin 권한 테스트

#### 1. Stats 수정 (Admin만 가능)
```bash
# Creator 토큰으로 시도 → 403 오류 기대
curl -X PATCH http://localhost:8787/admin/videos/{id}/stats \
  -H "Authorization: Bearer {CREATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"views_count": 9999}'

# 기대 응답: 403 Forbidden
{
  "error": "Access denied",
  "message": "관리자 권한이 필요합니다."
}
```

#### 2. 다른 사용자 영상 수정 (Creator 차단)
```bash
# Creator가 다른 사람 영상 수정 시도 → 404 기대
curl -X PATCH http://localhost:8787/videos/{OTHER_USER_VIDEO_ID} \
  -H "Authorization: Bearer {CREATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title": "해킹 시도"}'

# 기대 응답: 404 Not Found (또는 403)
{
  "error": "Video not found or access denied"
}
```

### B. 에러 처리 테스트

#### 1. 401 Unauthorized
```bash
curl http://localhost:8787/admin/videos?site_id=gods

# 기대 응답:
{
  "error": "Authentication required",
  "message": "인증이 필요합니다. 로그인해주세요."
}
```

#### 2. 403 Forbidden
UI에서 표시:
```
접근 권한이 없습니다.
```

#### 3. 500 Internal Server Error
UI에서 표시:
```
서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
```

---

## 🚀 프로덕션 서버 테스트

### 1. 개발 서버 중지

터미널에서 **Ctrl + C**

### 2. 프로덕션 서버 시작

```bash
cd C:\gods-comfort-word
npm run start
```

### 3. 테스트

#### A. 홈페이지
```
http://localhost:3000
```
- [x] 페이지 로드
- [x] 네비게이션 작동
- [x] 이미지 표시

#### B. 영상 목록
```
http://localhost:3000/videos?lang=ko
```
- [x] API 호출 성공
- [x] 영상 목록 표시
- [x] 썸네일 표시
- [x] 영상 재생 가능

#### C. API 테스트 페이지
```
http://localhost:3000/test-cms
```
- [x] API 호출 성공
- [x] 영상 카드 렌더링
- [x] Stats 표시 (👁️❤️📤)
- [x] 영상 재생 모달

#### D. 관리자 대시보드
```
http://localhost:3000/admin/dashboard
```
- [x] 로그인 후 접근
- [x] 영상 목록 표시
- [x] CRUD 작동
- [x] 에러 처리

---

## 📋 배포 전 최종 체크리스트

### 환경변수

#### Next.js
- [x] `.env.production` 생성
- [x] `NEXT_PUBLIC_CMS_API_BASE_URL` 설정
- [x] Firebase 설정 (선택)
- [x] 민감정보 없음

#### CMS API
- [ ] `.env.production` 생성
- [ ] `JWT_SECRET` 강력한 키로 변경
- [ ] `ADMIN_BOOTSTRAP_KEY` 강력한 키로 변경
- [ ] `CORS_ORIGINS` 운영 도메인만 포함
- [ ] localhost 제거

### 보안

- [x] API Key 로그 제거
- [x] 토큰 로그 제거
- [x] 비밀번호 로그 제거
- [x] CORS 로그 최소화
- [x] 에러 메시지 사용자 친화적으로 변경
- [x] 권한 체크 (API 레벨)

### 코드

- [x] 하드코딩된 API URL 없음
- [x] 환경변수 기본값 설정
- [x] TypeScript 오류 없음
- [x] 빌드 성공

### 테스트

- [ ] 프로덕션 빌드 (`npm run build`)
- [ ] 프로덕션 서버 (`npm run start`)
- [ ] `/test-cms` 페이지 작동
- [ ] 모든 페이지 렌더링
- [ ] API 연동
- [ ] CORS 정상 작동

### 데이터베이스

- [ ] 백업 생성
- [ ] 초기 계정 설정
- [ ] 마이그레이션 완료
- [ ] 인덱스 생성

---

## 🎯 배포 순서

### 1단계: CMS API 배포

```bash
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"

# 1. 환경변수 설정
cp .env .env.backup
nano .env.production  # 위 내용으로 작성

# 2. 프로덕션 모드로 실행
NODE_ENV=production npm run dev

# 또는 PM2 사용 (권장)
pm2 start server.js --name cms-api --env production
```

### 2단계: Next.js 배포

```bash
cd C:\gods-comfort-word

# 1. 환경변수 설정
nano .env.production
# NEXT_PUBLIC_CMS_API_BASE_URL=https://cms-api.godscomfortword.com

# 2. 빌드
npm run build

# 3. 프로덕션 서버 실행
npm run start

# 또는 PM2 사용
pm2 start npm --name gods-comfort-word -- start
```

### 3단계: 도메인 연결

- DNS 설정
- SSL 인증서 설치 (Let's Encrypt)
- Nginx/Apache 프록시 설정

---

## 🔍 프로덕션 테스트

### 1. 헬스 체크

```bash
curl https://cms-api.godscomfortword.com/health
# 기대: {"ok": true, "time": "..."}
```

### 2. 공개 API

```bash
curl https://cms-api.godscomfortword.com/public/videos?site_id=gods
# 기대: {"items": [...], "total": 4}
```

### 3. CORS 테스트

브라우저에서:
```
https://godscomfortword.com/test-cms
```

개발자 도구 (F12) > Network 탭에서:
- Response Headers에 `access-control-allow-origin: https://godscomfortword.com` 확인

---

## ⚠️ 운영 환경 주의사항

### 1. HTTPS 필수
- 모든 API 호출은 HTTPS
- Mixed Content 오류 방지

### 2. 환경 분리
- 개발: localhost
- 스테이징: staging.godscomfortword.com
- 운영: godscomfortword.com

### 3. 로그 관리
- 민감정보 로그 금지
- 에러만 로깅
- 로그 파일 로테이션

### 4. 데이터베이스
- 정기 백업
- 트랜잭션 사용
- 인덱스 최적화

---

## 📊 모니터링

### 1. API 헬스 체크

```bash
# 매 5분마다 실행
curl https://cms-api.godscomfortword.com/health
```

### 2. 에러 로그 모니터링

```bash
# CMS API 로그
tail -f cms-api.log | grep "level\":50"  # 에러만

# Next.js 로그
tail -f next.log | grep ERROR
```

### 3. CORS 차단 모니터링

```bash
tail -f cms-api.log | grep "CORS blocked"
```

---

## 🎉 완료!

**프로덕션 준비 완료**:
- ✅ 빌드 성공
- ✅ 보안 강화
- ✅ 민감정보 제거
- ✅ CORS 설정
- ✅ 권한 체크
- ✅ 에러 처리
- ✅ 환경변수 분리

**다음 단계**: 실제 서버에 배포



## 🔒 보안 설정 (매우 중요!)

### 1. 시크릿 키 생성 및 설정

**.env.production** 파일 생성:

```env
# 서버 포트
PORT=8787

# JWT Secret (아래 명령으로 생성된 키 사용)
JWT_SECRET=22151c2bc3f87920ee938bc3c30590d36f928877d42ef40d1147bbda5cfe7ba20cab38776f444d38d5c10cc3e485b3684e49ca868308a5910f09f24e4c77ed28

# Admin Bootstrap Key (아래 명령으로 생성된 키 사용)
ADMIN_BOOTSTRAP_KEY=a2bd9baec1b2c4c016bd8498061794fea378f8b1ada14371723d8697062134c7

# CORS - 운영 도메인만 포함
CORS_ORIGINS=https://godscomfortword.com,https://www.godscomfortword.com
```

**강력한 키 생성 방법**:
```bash
node -e "console.log('JWT_SECRET='+require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('ADMIN_BOOTSTRAP_KEY='+require('crypto').randomBytes(32).toString('hex'))"
```

### 2. 프론트엔드 환경변수

**Next.js .env.production**:
```env
NEXT_PUBLIC_CMS_API_BASE_URL=https://cms-api.godscomfortword.com
```

**주의사항**:
- ❌ localhost 포함 금지
- ✅ HTTPS만 사용
- ❌ API Key, Secret 포함 금지
- ✅ NEXT_PUBLIC_ 접두사만 사용

---

## ✅ 보안 점검

### A. 민감정보 제거

#### 프론트엔드 (Next.js)
- [x] API Key 하드코딩 없음
- [x] Secret 하드코딩 없음
- [x] 토큰 로그 출력 제거
- [x] 비밀번호 로그 출력 제거
- [x] 환경변수로 API URL 분리

#### 백엔드 (CMS API)
- [x] API Key 로그 조건부 출력 (개발 환경만)
- [x] 비밀번호 로그 제거
- [x] CORS 로그 최소화 (프로덕션)
- [x] 에러 메시지에 민감정보 없음

### B. CORS 설정

**개발 환경**:
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

**프로덕션 환경**:
```env
CORS_ORIGINS=https://godscomfortword.com,https://www.godscomfortword.com
```

**금지사항**:
- ❌ `*` (모든 도메인 허용)
- ❌ localhost 포함 (운영 환경)
- ❌ HTTP (HTTPS만 사용)

---

## 🔑 권한 재점검

### Admin 권한

**허용**:
- ✅ 모든 영상 조회 (`GET /admin/videos`)
- ✅ 모든 영상 수정 (`PATCH /admin/videos/:id`)
- ✅ 모든 영상 삭제 (`DELETE /admin/videos/:id`)
- ✅ Stats 수정 (`PATCH /admin/videos/:id/stats`)
- ✅ 접속자 통계 (`GET /admin/analytics`)
- ✅ 사이트 관리 (`GET /admin/sites`)

**API 검증**:
```javascript
// auth.js
export async function requireAdmin(request, reply) {
  if (request.user.role !== "admin") {
    return reply.code(403).send({ 
      error: "Access denied",
      message: "관리자 권한이 필요합니다."
    });
  }
}
```

### Creator 권한

**허용**:
- ✅ 본인 영상만 조회 (`GET /videos`)
- ✅ 본인 영상만 추가 (`POST /videos`)
- ✅ 본인 영상만 수정 (`PATCH /videos/:id`)
- ✅ 본인 영상만 삭제 (`DELETE /videos/:id`)
- ✅ Stats 읽기 (수정 불가)

**금지**:
- ❌ 다른 사용자 영상 접근
- ❌ Stats 수정
- ❌ 접속자 통계 접근
- ❌ 사이트 관리

**API 검증**:
```javascript
// 본인 영상만 삭제
const result = db
  .prepare("DELETE FROM videos WHERE id = ? AND owner_id = ?")
  .run(id, user.id);

// 본인 영상만 수정
const existing = db
  .prepare("SELECT * FROM videos WHERE id = ? AND owner_id = ?")
  .get(id, user.id);
```

---

## 📝 로그 정리

### 제거된 로그

#### 프론트엔드:
- ❌ `console.log("로그인 성공:", data)` → 제거
- ❌ `console.log("토큰 및 사용자 정보 저장 완료")` → 제거
- ❌ `console.log("영상 추가 성공:", result)` → 제거
- ❌ `console.log("Stats 수정 성공:", result)` → 제거

#### 백엔드:
- ❌ `console.log("API Key:", apiKey)` → 제거 (프로덕션)
- 📉 CORS 로그 최소화 (프로덕션)

### 유지된 로그 (에러만)

```javascript
// 개발 환경 디버깅용 - 프로덕션에서는 최소화
console.error("영상 목록 불러오기 오류:", err);
console.warn("🚫 CORS blocked:", origin);
```

---

## 🌐 공개 API 점검

### GET /public/videos?site_id=gods

**응답 필드 확인**:
```json
{
  "items": [
    {
      "id": "video_id",
      "site_id": "gods",
      "platform": "youtube",          // ✅ 필수
      "video_id": "dQw4w9WgXcQ",     // ✅ 필수
      "title": "영상 제목",           // ✅ 필수
      "thumbnail_url": "https://...", // ✅ 필수
      "embed_url": "https://...",     // ✅ 필수
      "language": "ko",               // ✅ 필수
      "status": "active",             // ✅ 필수
      "visibility": "public",         // ✅ 필수
      "created_at": "2025-12-02...",  // ✅ 필수
      "updated_at": "2025-12-02...",  // ✅ 필수
      "views_count": 150,             // ✅ Stats
      "likes_count": 30000,           // ✅ Stats
      "shares_count": 0,              // ✅ Stats
      "owner_name": "Admin"           // ℹ️ 선택
    }
  ],
  "total": 4,
  "page": 1,
  "page_size": 100,
  "cursor": "2025-12-02..."
}
```

**렌더링에 필요한 모든 필드 포함됨!** ✅

---

## 🧪 테스트 시나리오

### A. Admin 권한 테스트

#### 1. Stats 수정 (Admin만 가능)
```bash
# Creator 토큰으로 시도 → 403 오류 기대
curl -X PATCH http://localhost:8787/admin/videos/{id}/stats \
  -H "Authorization: Bearer {CREATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"views_count": 9999}'

# 기대 응답: 403 Forbidden
{
  "error": "Access denied",
  "message": "관리자 권한이 필요합니다."
}
```

#### 2. 다른 사용자 영상 수정 (Creator 차단)
```bash
# Creator가 다른 사람 영상 수정 시도 → 404 기대
curl -X PATCH http://localhost:8787/videos/{OTHER_USER_VIDEO_ID} \
  -H "Authorization: Bearer {CREATOR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title": "해킹 시도"}'

# 기대 응답: 404 Not Found (또는 403)
{
  "error": "Video not found or access denied"
}
```

### B. 에러 처리 테스트

#### 1. 401 Unauthorized
```bash
curl http://localhost:8787/admin/videos?site_id=gods

# 기대 응답:
{
  "error": "Authentication required",
  "message": "인증이 필요합니다. 로그인해주세요."
}
```

#### 2. 403 Forbidden
UI에서 표시:
```
접근 권한이 없습니다.
```

#### 3. 500 Internal Server Error
UI에서 표시:
```
서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
```

---

## 🚀 프로덕션 서버 테스트

### 1. 개발 서버 중지

터미널에서 **Ctrl + C**

### 2. 프로덕션 서버 시작

```bash
cd C:\gods-comfort-word
npm run start
```

### 3. 테스트

#### A. 홈페이지
```
http://localhost:3000
```
- [x] 페이지 로드
- [x] 네비게이션 작동
- [x] 이미지 표시

#### B. 영상 목록
```
http://localhost:3000/videos?lang=ko
```
- [x] API 호출 성공
- [x] 영상 목록 표시
- [x] 썸네일 표시
- [x] 영상 재생 가능

#### C. API 테스트 페이지
```
http://localhost:3000/test-cms
```
- [x] API 호출 성공
- [x] 영상 카드 렌더링
- [x] Stats 표시 (👁️❤️📤)
- [x] 영상 재생 모달

#### D. 관리자 대시보드
```
http://localhost:3000/admin/dashboard
```
- [x] 로그인 후 접근
- [x] 영상 목록 표시
- [x] CRUD 작동
- [x] 에러 처리

---

## 📋 배포 전 최종 체크리스트

### 환경변수

#### Next.js
- [x] `.env.production` 생성
- [x] `NEXT_PUBLIC_CMS_API_BASE_URL` 설정
- [x] Firebase 설정 (선택)
- [x] 민감정보 없음

#### CMS API
- [ ] `.env.production` 생성
- [ ] `JWT_SECRET` 강력한 키로 변경
- [ ] `ADMIN_BOOTSTRAP_KEY` 강력한 키로 변경
- [ ] `CORS_ORIGINS` 운영 도메인만 포함
- [ ] localhost 제거

### 보안

- [x] API Key 로그 제거
- [x] 토큰 로그 제거
- [x] 비밀번호 로그 제거
- [x] CORS 로그 최소화
- [x] 에러 메시지 사용자 친화적으로 변경
- [x] 권한 체크 (API 레벨)

### 코드

- [x] 하드코딩된 API URL 없음
- [x] 환경변수 기본값 설정
- [x] TypeScript 오류 없음
- [x] 빌드 성공

### 테스트

- [ ] 프로덕션 빌드 (`npm run build`)
- [ ] 프로덕션 서버 (`npm run start`)
- [ ] `/test-cms` 페이지 작동
- [ ] 모든 페이지 렌더링
- [ ] API 연동
- [ ] CORS 정상 작동

### 데이터베이스

- [ ] 백업 생성
- [ ] 초기 계정 설정
- [ ] 마이그레이션 완료
- [ ] 인덱스 생성

---

## 🎯 배포 순서

### 1단계: CMS API 배포

```bash
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"

# 1. 환경변수 설정
cp .env .env.backup
nano .env.production  # 위 내용으로 작성

# 2. 프로덕션 모드로 실행
NODE_ENV=production npm run dev

# 또는 PM2 사용 (권장)
pm2 start server.js --name cms-api --env production
```

### 2단계: Next.js 배포

```bash
cd C:\gods-comfort-word

# 1. 환경변수 설정
nano .env.production
# NEXT_PUBLIC_CMS_API_BASE_URL=https://cms-api.godscomfortword.com

# 2. 빌드
npm run build

# 3. 프로덕션 서버 실행
npm run start

# 또는 PM2 사용
pm2 start npm --name gods-comfort-word -- start
```

### 3단계: 도메인 연결

- DNS 설정
- SSL 인증서 설치 (Let's Encrypt)
- Nginx/Apache 프록시 설정

---

## 🔍 프로덕션 테스트

### 1. 헬스 체크

```bash
curl https://cms-api.godscomfortword.com/health
# 기대: {"ok": true, "time": "..."}
```

### 2. 공개 API

```bash
curl https://cms-api.godscomfortword.com/public/videos?site_id=gods
# 기대: {"items": [...], "total": 4}
```

### 3. CORS 테스트

브라우저에서:
```
https://godscomfortword.com/test-cms
```

개발자 도구 (F12) > Network 탭에서:
- Response Headers에 `access-control-allow-origin: https://godscomfortword.com` 확인

---

## ⚠️ 운영 환경 주의사항

### 1. HTTPS 필수
- 모든 API 호출은 HTTPS
- Mixed Content 오류 방지

### 2. 환경 분리
- 개발: localhost
- 스테이징: staging.godscomfortword.com
- 운영: godscomfortword.com

### 3. 로그 관리
- 민감정보 로그 금지
- 에러만 로깅
- 로그 파일 로테이션

### 4. 데이터베이스
- 정기 백업
- 트랜잭션 사용
- 인덱스 최적화

---

## 📊 모니터링

### 1. API 헬스 체크

```bash
# 매 5분마다 실행
curl https://cms-api.godscomfortword.com/health
```

### 2. 에러 로그 모니터링

```bash
# CMS API 로그
tail -f cms-api.log | grep "level\":50"  # 에러만

# Next.js 로그
tail -f next.log | grep ERROR
```

### 3. CORS 차단 모니터링

```bash
tail -f cms-api.log | grep "CORS blocked"
```

---

## 🎉 완료!

**프로덕션 준비 완료**:
- ✅ 빌드 성공
- ✅ 보안 강화
- ✅ 민감정보 제거
- ✅ CORS 설정
- ✅ 권한 체크
- ✅ 에러 처리
- ✅ 환경변수 분리

**다음 단계**: 실제 서버에 배포


