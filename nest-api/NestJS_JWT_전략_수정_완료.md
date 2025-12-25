# NestJS JWT 전략 수정 완료 보고서

## ✅ 완료된 작업

### 1. JWT 전략 수정 (jwt.strategy.ts)
- ✅ **Authorization Bearer 토큰 지원** (기존 유지)
- ✅ **쿠키 토큰 지원 추가**
  - `req.cookies['cms_token']` 또는 `req.cookies['access_token']`에서 토큰 읽기
  - `ExtractJwt.fromExtractors`를 사용하여 여러 소스에서 토큰 추출

### 2. 쿠키 파서 설정 (main.ts)
- ✅ `cookie-parser` 패키지 설치 및 설정
- ✅ `app.use(cookieParser())` 추가
- ✅ CORS `credentials: true` 설정 확인 (이미 설정됨)

### 3. 패키지 설치
- ✅ `cookie-parser` 설치
- ✅ `@types/cookie-parser` 설치 (TypeScript 타입 정의)

## 🔒 적용된 수정 사항

### jwt.strategy.ts - JWT 전략

**이전 코드**:
```typescript
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: configService.get<string>('JWT_SECRET'),
});
```

**수정된 코드**:
```typescript
super({
  jwtFromRequest: ExtractJwt.fromExtractors([
    // 1. Authorization Bearer 헤더에서 토큰 추출
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    // 2. 쿠키에서 토큰 추출 (cms_token 또는 access_token)
    (request: Request) => {
      if (request && request.cookies) {
        return request.cookies['cms_token'] || request.cookies['access_token'] || null;
      }
      return null;
    },
  ]),
  ignoreExpiration: false,
  secretOrKey: configService.get<string>('JWT_SECRET'),
});
```

### main.ts - 쿠키 파서 설정

**추가된 코드**:
```typescript
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 쿠키 파서 설정 (JWT 토큰을 쿠키에서 읽기 위해 필요)
  app.use(cookieParser());

  app.enableCors({
    // ...
    credentials: true, // 쿠키 전송을 위해 credentials: true 필요
  });
  // ...
}
```

## 📝 인증 흐름

### 토큰 추출 우선순위
1. **Authorization Bearer 헤더** (우선순위 1)
   ```
   Authorization: Bearer <token>
   ```

2. **쿠키** (우선순위 2)
   ```
   Cookie: cms_token=<token>
   또는
   Cookie: access_token=<token>
   ```

### JWT 전략 동작
1. `ExtractJwt.fromExtractors`가 배열의 각 extractor를 순서대로 시도
2. 첫 번째로 토큰을 찾은 extractor의 결과를 사용
3. 토큰이 없으면 인증 실패 (401 Unauthorized)

## 🔒 Guard/Module 연결 확인

### JwtAuthGuard 사용
- ✅ `JwtAuthGuard`는 `AuthGuard('jwt')`를 확장
- ✅ `JwtStrategy`는 `PassportStrategy(Strategy, 'jwt')`를 확장
- ✅ `AuthModule`에서 `JwtStrategy`를 providers에 등록

### 현재 사용 중인 엔드포인트
다음 엔드포인트들이 `@UseGuards(JwtAuthGuard)`를 사용하고 있습니다:

1. **POST /auth/change-password** (auth.controller.ts)
2. **GET /facebook-key** (facebook-key.controller.ts)
3. **GET /analytics** (analytics.controller.ts)
4. **POST /videos/metadata** (videos.controller.ts)

### /admin/uploads/thumbnail 엔드포인트
- ⚠️ **현재 NestJS에 `/admin/uploads/thumbnail` 엔드포인트가 없습니다**
- Fastify 서버(`server.js`)에만 존재합니다 (포트 8787)
- NestJS 서버는 포트 8788에서 실행됩니다

**참고**: `/admin/uploads/thumbnail` 엔드포인트를 NestJS에 추가하려면:
1. 새로운 컨트롤러 생성 (예: `uploads.controller.ts`)
2. `@UseGuards(JwtAuthGuard)` 데코레이터 추가
3. `@Post('admin/uploads/thumbnail')` 엔드포인트 구현

## ✅ 완료 기준 달성

- [x] JWT 전략에서 Authorization Bearer 토큰 지원 (기존 유지)
- [x] JWT 전략에서 쿠키 토큰 지원 추가 (`cms_token`, `access_token`)
- [x] `ExtractJwt.fromExtractors` 사용
- [x] `cookie-parser` 패키지 설치 및 설정
- [x] CORS `credentials: true` 설정 확인
- [x] Guard/Module 연결 확인

## 🧪 테스트 방법

### 1. Authorization Bearer 토큰 테스트

```bash
# 정상 케이스
curl -X POST "http://localhost:8788/videos/metadata" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sourceType": "YouTube", "sourceUrl": "https://www.youtube.com/watch?v=..."}'
```

### 2. 쿠키 토큰 테스트

```bash
# 쿠키로 토큰 전송
curl -X POST "http://localhost:8788/videos/metadata" \
  -H "Cookie: cms_token=<token>" \
  -H "Content-Type: application/json" \
  -d '{"sourceType": "YouTube", "sourceUrl": "https://www.youtube.com/watch?v=..."}'
```

### 3. 우선순위 테스트

```bash
# Authorization Bearer와 쿠키 둘 다 있는 경우
# Authorization Bearer가 우선적으로 사용됨
curl -X POST "http://localhost:8788/videos/metadata" \
  -H "Authorization: Bearer <token1>" \
  -H "Cookie: cms_token=<token2>" \
  -H "Content-Type: application/json" \
  -d '{"sourceType": "YouTube", "sourceUrl": "https://www.youtube.com/watch?v=..."}'
```

## 📊 수정된 파일 목록

### 1. nest-api/src/auth/strategies/jwt.strategy.ts
- `ExtractJwt.fromExtractors` 사용
- Authorization Bearer와 쿠키 둘 다 지원

### 2. nest-api/src/main.ts
- `cookie-parser` import 및 설정 추가

### 3. nest-api/package.json
- `cookie-parser` 의존성 추가
- `@types/cookie-parser` devDependencies 추가

## 🔒 보안 및 설계

### 토큰 추출 우선순위
1. **Authorization Bearer 헤더** (가장 일반적, 우선순위 1)
2. **쿠키** (Authorization이 없을 때, 우선순위 2)

### 쿠키 보안
- 쿠키는 `HttpOnly`, `Secure`, `SameSite` 속성을 설정하는 것을 권장합니다
- 현재는 기본 설정만 사용 중

### CORS 설정
- `credentials: true`가 설정되어 있어 쿠키 전송이 가능합니다
- 허용된 origin에서만 쿠키가 전송됩니다

## 📌 주의사항

1. **JWT 토큰 페이로드**: 현재 `payload.sub`를 사용하여 사용자를 조회합니다. JWT 토큰 생성 시 `sub` 필드에 사용자 ID를 포함해야 합니다.

2. **쿠키 이름**: 쿠키 이름은 `cms_token` 또는 `access_token`을 사용합니다. 프론트엔드에서 이 이름으로 쿠키를 설정해야 합니다.

3. **포트**: NestJS 서버는 포트 8788에서 실행되며, Fastify 서버(8787)와는 별도입니다.

4. **/admin/uploads/thumbnail**: 이 엔드포인트는 현재 Fastify 서버에만 존재합니다. NestJS에 추가하려면 별도 구현이 필요합니다.

## ✅ 최종 확인

모든 요구사항이 완료되었으며, NestJS JWT 전략이 Authorization Bearer와 쿠키 둘 다 지원합니다:
- Authorization Bearer 토큰 지원 (기존 유지)
- 쿠키 토큰 지원 추가 (`cms_token`, `access_token`)
- `ExtractJwt.fromExtractors` 사용
- `cookie-parser` 설정 완료
- Guard/Module 연결 확인 완료





























