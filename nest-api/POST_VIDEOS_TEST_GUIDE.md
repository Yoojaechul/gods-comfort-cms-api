# POST /videos API 테스트 가이드

## 📋 개요

NestJS 서버에 구현된 `POST /videos` 엔드포인트를 테스트하는 방법입니다.

---

## 🧪 Swagger UI에서 테스트

### 1. Swagger UI 접속

```
http://localhost:8788/api-docs
```

### 2. POST /videos 엔드포인트 찾기

1. `videos` 태그 클릭
2. `POST /videos` 엔드포인트 확인
3. `Try it out` 버튼 클릭

### 3. 인증 설정

1. 페이지 상단의 `Authorize` 버튼 클릭
2. `Value` 필드에 JWT 토큰 입력 (Bearer 접두사 없이)
3. `Authorize` 버튼 클릭
4. `Close` 버튼 클릭

### 4. Request Body 입력

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "테스트 영상",
  "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "platform": "youtube",
  "visibility": "public",
  "language": "ko"
}
```

**필수 필드:**
- `url`: 영상 URL (필수)
- `platform`: 플랫폼 (필수) - `youtube`, `facebook`, `other` 중 하나

**선택 필드:**
- `title`: 영상 제목
- `thumbnailUrl`: 썸네일 URL
- `visibility`: 공개 설정 (`public` 또는 `private`, 기본값: `public`)
- `language`: 언어 (기본값: `ko`)

### 5. Execute 버튼 클릭

응답 예시:
```json
{
  "id": "abc123def456...",
  "site_id": "gods",
  "owner_id": "8572ee8892a0671080817b48610690d0",
  "platform": "youtube",
  "source_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "테스트 영상",
  "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "visibility": "public",
  "language": "ko",
  "created_at": "2025-12-05T12:00:00.000Z"
}
```

---

## 🧪 Thunder Client로 테스트

### 1. 로그인하여 토큰 받기

```http
POST http://localhost:8788/auth/login
Content-Type: application/json

{
  "email": "01023942042",
  "password": "creator123!"
}
```

**응답에서 `token` 값 복사**

### 2. 영상 등록 요청

```http
POST http://localhost:8788/videos
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "테스트 영상",
  "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "platform": "youtube",
  "visibility": "public",
  "language": "ko"
}
```

---

## 🧪 Node.js 스크립트로 테스트

```bash
# 1. 로그인하여 토큰 받기
node test-creator-login.js

# 2. 받은 토큰으로 영상 등록
node test-create-video.js <JWT_TOKEN>
```

---

## ✅ 성공 케이스

- **상태 코드**: `201 Created`
- **응답**: 생성된 영상 정보 (JSON)
- **데이터베이스**: videos 테이블에 새 레코드 추가됨

---

## ❌ 실패 케이스

### 400 Bad Request
- 필수 필드 누락 (`url` 또는 `platform` 없음)
- 잘못된 `platform` 값 (youtube, facebook, other 외)
- 잘못된 `visibility` 값 (public, private 외)

### 401 Unauthorized
- JWT 토큰 없음
- JWT 토큰 만료
- 잘못된 JWT 토큰

### 403 Forbidden
- Creator가 자신의 site_id가 아닌 다른 site_id로 영상 생성 시도

### 500 Internal Server Error
- 데이터베이스 오류
- videos 테이블이 존재하지 않음
- 기타 서버 내부 오류

---

## 📝 참고사항

1. **JWT 토큰**: 모든 요청에 `Authorization: Bearer <token>` 헤더 필요
2. **site_id**: JWT 토큰에서 자동으로 추출됨 (사용자 정보에서)
3. **owner_id**: JWT 토큰에서 자동으로 추출됨 (사용자 ID)
4. **id**: 서버에서 자동 생성 (UUID 형식)

---

## 🔍 프론트엔드 연동 확인

Creator 대시보드(`/creator/index.html`)에서:
1. 영상 URL 입력
2. 플랫폼 선택
3. "영상 등록" 버튼 클릭
4. Network 탭에서 `POST http://localhost:8788/videos` 요청 확인
5. 응답 상태 코드 `201` 확인




































































































