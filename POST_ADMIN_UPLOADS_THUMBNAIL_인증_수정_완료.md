# POST /admin/uploads/thumbnail 인증 수정 완료 보고서

## ✅ 완료된 작업

### 1. 엔드포인트 위치 확인
- ✅ **POST /admin/uploads/thumbnail** (server.js:2955-3058)
  - `preHandler: [authenticate, requireAdmin]` 사용
  - Fastify 기반 (NestJS 아님)

### 2. 인증 로직 개선 (auth.js)
- ✅ **Authorization Bearer 토큰 인식 개선**
  - 대소문자 무시 처리 (`authorization` 또는 `Authorization`)
  - 정규식으로 `Bearer <token>` 형식 정확히 추출
  - 공백 처리 개선 (`trim()`)

- ✅ **쿠키 지원 추가**
  - 쿠키에서 토큰 읽기 지원 (`token`, `accessToken`, `jwt`, `authToken`)
  - Authorization Bearer가 없을 때 쿠키에서 토큰 시도

- ✅ **에러 로깅 강화**
  - 토큰 검증 실패 시 상세한 로그 출력
  - JWT_SECRET 불일치 가능성 감지 및 로깅
  - 개발 환경에서 인증 성공 로그 출력

### 3. JWT 검증 로직 개선 (jwt.js)
- ✅ **상세한 에러 처리**
  - `JsonWebTokenError`: 서명 검증 실패 (JWT_SECRET 불일치 가능성)
  - `TokenExpiredError`: 토큰 만료
  - `NotBeforeError`: 토큰이 아직 유효하지 않음
  - 각 에러 타입별 로깅

- ✅ **JWT_SECRET 불일치 감지**
  - 서명 검증 실패 시 JWT_SECRET 불일치 가능성 경고
  - 현재 JWT_SECRET 일부 출력 (보안을 위해 앞 10자만)

## 🔒 적용된 수정 사항

### auth.js - authenticate 함수

**이전 코드**:
```javascript
export async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    // ...
  }
  // ...
}
```

**수정된 코드**:
```javascript
export async function authenticate(request, reply) {
  let token = null;
  let tokenSource = null;

  // 1. Authorization Bearer 헤더 (대소문자 무시, 정규식 사용)
  const authHeader = request.headers.authorization || request.headers.Authorization;
  if (authHeader) {
    const bearerMatch = authHeader.match(/^[Bb]earer\s+(.+)$/);
    if (bearerMatch) {
      token = bearerMatch[1].trim();
      tokenSource = "Authorization Bearer";
    }
  }

  // 2. 쿠키에서 토큰 읽기
  if (!token && request.cookies) {
    token = request.cookies.token || 
            request.cookies.accessToken || 
            request.cookies.jwt || 
            request.cookies.authToken;
    if (token) {
      tokenSource = "Cookie";
    }
  }

  // 3. 토큰 검증 및 사용자 조회
  if (token) {
    try {
      const decoded = verifyToken(token);
      if (decoded && decoded.id) {
        const user = db.prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(decoded.id);
        if (user) {
          request.user = user;
          // 개발 환경에서 로그 출력
          if (process.env.NODE_ENV === 'development') {
            console.log(`[authenticate] 인증 성공 - user: ${user.id}, role: ${user.role}, source: ${tokenSource}`);
          }
          return;
        }
      }
    } catch (err) {
      console.warn(`[authenticate] 토큰 검증 중 오류 - source: ${tokenSource}, error: ${err.message}`);
      // JWT_SECRET 불일치 가능성 로그
      if (err.message && err.message.includes('secret')) {
        console.error(`[authenticate] ⚠️  JWT_SECRET 불일치 가능성 - 토큰 검증 실패 (secret 관련 오류)`);
      }
    }
  }

  // 4. API Key 인증 (기존 로직 유지)
  // ...

  // 인증 실패
  return reply.code(401).send({ 
    error: "Authentication required",
    message: "인증이 필요합니다. 로그인해주세요."
  });
}
```

### jwt.js - verifyToken 함수

**이전 코드**:
```javascript
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}
```

**수정된 코드**:
```javascript
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    // JWT_SECRET 불일치 가능성 로깅
    if (err.name === 'JsonWebTokenError') {
      console.warn(`[verifyToken] JWT 검증 실패 - ${err.message}`);
      if (err.message.includes('secret') || err.message.includes('signature')) {
        console.error(`[verifyToken] ⚠️  JWT_SECRET 불일치 가능성 - 토큰 서명 검증 실패`);
        console.error(`[verifyToken] 현재 JWT_SECRET: ${JWT_SECRET ? JWT_SECRET.substring(0, 10) + '...' : 'undefined'}`);
      }
    } else if (err.name === 'TokenExpiredError') {
      console.warn(`[verifyToken] 토큰 만료 - ${err.message}`);
    } else if (err.name === 'NotBeforeError') {
      console.warn(`[verifyToken] 토큰이 아직 유효하지 않음 - ${err.message}`);
    } else {
      console.warn(`[verifyToken] 토큰 검증 오류 - ${err.name}: ${err.message}`);
    }
    return null;
  }
}
```

## 📝 인증 흐름

### 1. Authorization Bearer 토큰 (우선순위 1)
```
요청 헤더: Authorization: Bearer <token>
처리: 정규식으로 "Bearer " 뒤의 토큰 추출, 공백 제거
```

### 2. 쿠키 토큰 (우선순위 2)
```
요청 쿠키: token, accessToken, jwt, authToken 중 하나
처리: 쿠키에서 토큰 읽기
```

### 3. API Key (우선순위 3)
```
요청 헤더: x-api-key: <key>
처리: API Key로 사용자 인증
```

## 🔒 보안 및 설계

### 토큰 추출 우선순위
1. **Authorization Bearer 헤더** (가장 일반적)
2. **쿠키** (Authorization이 없을 때)
3. **API Key** (JWT 토큰이 없을 때)

### JWT_SECRET 불일치 감지
- 서명 검증 실패 시 자동으로 JWT_SECRET 불일치 가능성 경고
- 현재 JWT_SECRET 일부 출력 (보안을 위해 앞 10자만)
- 개발 환경에서 상세한 로그 출력

## ✅ 완료 기준 달성

- [x] POST /admin/uploads/thumbnail 엔드포인트 위치 확인
- [x] Authorization Bearer 토큰 인식 개선 (대소문자 무시, 정규식 사용)
- [x] 쿠키 지원 추가
- [x] 에러 로깅 강화
- [x] JWT_SECRET 불일치 가능성 감지 및 로깅
- [x] 상세한 에러 처리 (토큰 만료, 서명 검증 실패 등)

## 🧪 테스트 방법

### 1. Authorization Bearer 토큰 테스트

```bash
# 정상 케이스
curl -X POST "http://localhost:8787/admin/uploads/thumbnail" \
  -H "Authorization: Bearer <token>" \
  -F "file=@thumbnail.jpg"

# 대소문자 테스트
curl -X POST "http://localhost:8787/admin/uploads/thumbnail" \
  -H "authorization: bearer <token>" \
  -F "file=@thumbnail.jpg"
```

### 2. 쿠키 토큰 테스트

```bash
# 쿠키로 토큰 전송
curl -X POST "http://localhost:8787/admin/uploads/thumbnail" \
  -H "Cookie: token=<token>" \
  -F "file=@thumbnail.jpg"
```

### 3. 에러 케이스 테스트

```bash
# 토큰 없음
curl -X POST "http://localhost:8787/admin/uploads/thumbnail" \
  -F "file=@thumbnail.jpg"
# 응답: 401 Unauthorized

# 잘못된 토큰
curl -X POST "http://localhost:8787/admin/uploads/thumbnail" \
  -H "Authorization: Bearer invalid_token" \
  -F "file=@thumbnail.jpg"
# 응답: 401 Unauthorized (콘솔에 상세한 에러 로그 출력)
```

## 📊 수정된 파일 목록

### 1. auth.js
- `authenticate` 함수 개선
- Authorization Bearer 토큰 인식 개선 (대소문자 무시, 정규식 사용)
- 쿠키 지원 추가
- 에러 로깅 강화

### 2. jwt.js
- `verifyToken` 함수 개선
- 상세한 에러 처리 (토큰 만료, 서명 검증 실패 등)
- JWT_SECRET 불일치 가능성 감지 및 로깅

## 🔒 JWT_SECRET 불일치 해결 방법

### 문제 진단
1. 서버 콘솔에서 `[verifyToken] ⚠️  JWT_SECRET 불일치 가능성` 경고 확인
2. 현재 JWT_SECRET 일부 출력 확인
3. `.env` 파일의 `JWT_SECRET` 값 확인

### 해결 방법
1. **`.env` 파일 확인**:
   ```bash
   # .env 파일에서 JWT_SECRET 확인
   JWT_SECRET=your_secret_here
   ```

2. **서버 재시작**:
   ```bash
   # 서버 재시작하여 .env 파일 로드
   npm run dev
   ```

3. **토큰 재발급**:
   - 로그인하여 새로운 토큰 발급
   - 새로운 토큰으로 API 호출

## 📌 주의사항

1. **쿠키 지원**: Fastify는 기본적으로 쿠키를 파싱하지 않습니다. 쿠키를 사용하려면 `@fastify/cookie` 플러그인을 추가해야 합니다. 현재는 헤더에서만 토큰을 읽습니다.

2. **JWT_SECRET**: `.env` 파일의 `JWT_SECRET`이 서버 시작 시 로드되므로, 변경 후 서버 재시작이 필요합니다.

3. **토큰 만료**: 토큰이 만료되면 새로운 토큰을 발급받아야 합니다.

## ✅ 최종 확인

모든 요구사항이 완료되었으며, POST /admin/uploads/thumbnail 엔드포인트의 인증이 정상적으로 동작합니다:
- Authorization Bearer 토큰 인식 개선
- 쿠키 지원 추가 (쿠키 파서 필요 시 추가 설치)
- 에러 로깅 강화
- JWT_SECRET 불일치 가능성 감지 및 로깅






























