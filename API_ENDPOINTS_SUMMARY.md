# API 엔드포인트 요약

## 수정된 파일

1. **functions/index.js** - 모든 API 엔드포인트 구현
2. **functions/package.json** - better-sqlite3, jsonwebtoken 패키지 추가

---

## 최종 엔드포인트 목록

### 인증 (Auth)

| Method | Path | 설명 | 인증 필요 |
|--------|------|------|-----------|
| GET | `/health` | 헬스 체크 | ❌ |
| POST | `/auth/login` | 로그인 및 JWT 토큰 발급 | ❌ |
| POST | `/auth/check-email` | 이메일 존재 여부 및 역할 확인 | ❌ |
| POST | `/auth/change-password` | 비밀번호 변경 (이메일 기반) | ❌ |

### Creator

| Method | Path | 설명 | 인증 필요 |
|--------|------|------|-----------|
| GET | `/creator/videos` | Creator 영상 목록 조회 | ✅ (JWT) |

---

## 응답 형식

### 성공 응답
- 모든 성공 응답은 **200 OK** 상태 코드와 함께 JSON 형식으로 반환

### 에러 응답
- 모든 에러 응답은 **JSON 형식**으로 반환 (HTML 없음)
- 형식: `{ error, message, statusCode }` 또는 `{ ok: false, message }`

---

## 보안 기능

### 비밀번호 변경
- ✅ 역할 체크: admin/creator만 가능 (403 반환)
- ✅ 현재 비밀번호 검증: scrypt 해시 비교
- ✅ 새 비밀번호 해싱: scrypt 사용
- ✅ DB 업데이트: 실제 DB에 해시된 비밀번호 저장

### Creator Videos
- ✅ JWT 인증: Bearer 토큰 필요
- ✅ 역할 기반 필터링: owner_id와 site_id 기반

---

## 배포 명령어

```bash
# functions 디렉토리로 이동
cd functions

# 의존성 설치
npm install

# Firebase Functions 배포
firebase deploy --only functions:api
```

---

## 확인 사항

- [x] POST /auth/login - 작동 중 (JWT 토큰 발급)
- [x] POST /auth/check-email - JSON 반환, 역할 정보 포함
- [x] POST /auth/change-password - 역할 체크 (403), DB 업데이트, JSON 반환
- [x] GET /creator/videos - JSON 반환, JWT 인증, owner_id/site_id 필터링
- [x] GET /health - 헬스 체크
- [x] 모든 에러 응답 - JSON 형식 (HTML 없음)

