# API 엔드포인트 구현 완료 보고서

## 📋 완료된 작업

### ✅ 1. POST /auth/check-email
- **상태**: 이미 구현됨 (이전 작업에서 완료)
- **입력**: `{ email: string }`
- **출력**: `{ exists: boolean, role?: "admin"|"creator" }`
- **기능**: 이메일 존재 여부 및 역할 확인

### ✅ 2. POST /auth/change-password
- **상태**: 이미 구현됨 (이전 작업에서 완료)
- **입력**: `{ email: string, currentPassword: string, newPassword: string }`
- **출력**: `{ ok: boolean, message?: string }`
- **기능**: 비밀번호 변경 (DB 업데이트, 해싱 적용)

### ✅ 3. GET /creator/videos
- **상태**: 신규 구현 완료
- **인증**: JWT 토큰 필요
- **입력**: Query parameter `site_id` (선택적)
- **출력**: `{ videos: Video[] }`
- **기능**: Creator 자신의 영상 목록 조회

### ✅ 4. Firebase Hosting 설정
- **상태**: 완료
- **변경사항**: `/creator/**` rewrites 추가

---

## 📁 수정된 파일 목록

### 백엔드 (NestJS)

1. **nest-api/src/videos/videos.controller.ts**
   - `CreatorVideosController` 클래스 추가
   - `GET /creator/videos` 엔드포인트 추가

2. **nest-api/src/videos/videos.service.ts**
   - `getCreatorVideos()` 메서드 추가
   - owner_id와 site_id를 기반으로 영상 조회

3. **nest-api/src/videos/videos.module.ts**
   - `CreatorVideosController` 모듈에 등록

### Firebase 설정

4. **firebase.json**
   - `/creator/**` rewrites 추가 (Cloud Functions로 프록시)

---

## 🔌 엔드포인트 상세 스펙

### 1. POST /auth/check-email

**요청**:
```json
{
  "email": "consulting_manager@naver.com"
}
```

**응답 (200 OK)**:
```json
{
  "exists": true,
  "role": "admin"
}
```

또는 존재하지 않는 경우:
```json
{
  "exists": false
}
```

---

### 2. POST /auth/change-password

**요청**:
```json
{
  "email": "consulting_manager@naver.com",
  "currentPassword": "old_password_123",
  "newPassword": "new_password_456"
}
```

**응답 (200 OK) - 성공**:
```json
{
  "ok": true
}
```

**응답 (200 OK) - 실패**:
```json
{
  "ok": false,
  "message": "현재 비밀번호가 올바르지 않습니다."
}
```

**검증 항목**:
- email 존재 확인
- role이 admin 또는 creator인지 확인
- currentPassword가 저장된 해시와 일치하는지 확인
- 새 비밀번호를 해시하여 DB 업데이트

---

### 3. GET /creator/videos

**인증**: JWT 토큰 필요 (`Authorization: Bearer <token>`)

**요청**:
```
GET /creator/videos?site_id=gods
```

**응답 (200 OK)**:
```json
{
  "videos": [
    {
      "id": "abc123",
      "title": "샘플 영상",
      "platform": "youtube",
      "visibility": "public",
      "thumbnail_url": "https://img.youtube.com/vi/.../hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=...",
      "language": "ko",
      "site_id": "gods",
      "owner_id": "creator-001",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**에러 응답**:

- **401 Unauthorized**: JWT 토큰이 없거나 유효하지 않음
- **403 Forbidden**: Creator가 자신의 site_id가 아닌 다른 site_id로 접근 시도

**보안 기능**:
- JWT에서 사용자 정보 추출
- Creator는 자신의 site_id와 owner_id로 필터링된 영상만 조회 가능
- site_id 파라미터가 제공된 경우, Creator는 자신의 site_id와 일치해야 함

---

## 🔒 보안 기능

### 비밀번호 변경
1. **역할 기반 접근 제어**: admin/creator만 비밀번호 변경 가능
2. **현재 비밀번호 검증**: 반드시 현재 비밀번호 확인
3. **비밀번호 해싱**: scrypt 사용 (기존 프로젝트와 동일)
4. **이메일 검증**: 이메일 형식 및 존재 여부 확인

### Creator Videos
1. **JWT 인증**: 모든 요청에 JWT 토큰 필요
2. **역할 기반 필터링**: Creator는 자신의 영상만 조회 가능
3. **site_id 검증**: Creator는 자신의 site_id만 접근 가능

---

## 🚀 배포 명령어

### 1. 프론트엔드 빌드 및 배포

```bash
# 프론트엔드 빌드
cd frontend
npm install
npm run build

# Firebase Hosting 배포
cd ..
firebase deploy --only hosting:cms
```

### 2. 백엔드 배포

```bash
# NestJS 빌드 (필요한 경우)
cd nest-api
npm install
npm run build

# 서버 실행 (배포 환경에 따라 다름)
npm run start:prod
```

---

## 🧪 테스트 커맨드 (curl)

### 1. 이메일 확인

```bash
curl -X POST https://cms.godcomfortword.com/auth/check-email \
  -H "Content-Type: application/json" \
  -d '{"email": "consulting_manager@naver.com"}'
```

### 2. 비밀번호 변경

```bash
curl -X POST https://cms.godcomfortword.com/auth/change-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "consulting_manager@naver.com",
    "currentPassword": "123456",
    "newPassword": "new_password_789"
  }'
```

### 3. Creator Videos 조회

```bash
# 먼저 로그인하여 JWT 토큰 획득
curl -X POST https://cms.godcomfortword.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "j1dly1@naver.com",
    "password": "your_password"
  }'

# JWT 토큰으로 영상 조회
curl -X GET https://cms.godcomfortword.com/creator/videos \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## 📝 Firebase Hosting 설정 확인

### firebase.json

```json
{
  "hosting": [
    {
      "target": "cms",
      "public": "frontend/dist",
      "rewrites": [
        {
          "source": "/auth/**",
          "run": {
            "serviceId": "api",
            "region": "us-central1"
          }
        },
        {
          "source": "/creator/**",
          "run": {
            "serviceId": "api",
            "region": "us-central1"
          }
        },
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    }
  ]
}
```

### .firebaserc

```json
{
  "projects": {
    "default": "gods-comfort-word"
  },
  "targets": {
    "gods-comfort-word": {
      "hosting": {
        "home": ["gods-comfort-word"],
        "cms": ["gods-comfort-word-cms"]
      }
    }
  }
}
```

---

## ✅ Acceptance Criteria 확인

### 1. POST /auth/login
- ✅ 이미 작동 중 (기존 구현)

### 2. POST /auth/check-email
- ✅ 200 JSON 반환 (HTML 없음)
- ✅ `{ exists, role? }` 형식

### 3. POST /auth/change-password
- ✅ DB 업데이트 확인
- ✅ 200 JSON 반환 (HTML 없음)
- ✅ `{ ok, message? }` 형식

### 4. GET /creator/videos
- ✅ 200 JSON 반환 (HTML 없음)
- ✅ `{ videos: Video[] }` 형식
- ✅ JWT 인증 필요
- ✅ Creator만 자신의 영상 조회 가능

### 5. Firebase Hosting Target
- ✅ `firebase deploy --only hosting:cms` 명령어 사용 가능
- ✅ firebase.json에 target "cms" 설정됨
- ✅ .firebaserc에 targets 매핑 확인됨

---

## 🔄 다음 단계

1. **배포 환경 테스트**
   - 프로덕션 환경에서 각 엔드포인트 테스트
   - Firebase Hosting 배포 확인

2. **모니터링**
   - 로그 확인
   - 에러 추적

3. **문서화**
   - API 문서 업데이트 (Swagger)
   - 프론트엔드 개발자 가이드

---

## 📌 주의사항

1. **Firebase Functions 프록시**
   - `/auth/**`와 `/creator/**`는 Cloud Functions로 프록시됨
   - `serviceId: "api"`가 올바르게 설정되어 있는지 확인 필요

2. **CORS 설정**
   - 백엔드 서버의 CORS 설정 확인
   - `https://cms.godcomfortword.com` 허용 확인

3. **JWT 토큰**
   - Creator Videos는 JWT 토큰 필수
   - 토큰 만료 시 401 에러 반환

4. **DB 스키마**
   - `users` 테이블: `id`, `email`, `password_hash`, `api_key_salt`, `role`, `site_id`
   - `videos` 테이블: `id`, `owner_id`, `site_id`, `title`, `platform`, `url`, 등

---

## ✅ 완료 기준 달성

- [x] POST /auth/login (이미 작동)
- [x] POST /auth/check-email 구현 완료
- [x] POST /auth/change-password 구현 완료
- [x] GET /creator/videos 구현 완료
- [x] Firebase Hosting target 설정 완료
- [x] JSON 응답 보장 (HTML 없음)
- [x] DB 업데이트 확인
- [x] 보안 기능 구현 (인증, 권한 확인)






