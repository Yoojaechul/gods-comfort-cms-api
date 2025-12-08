# 선교홈페이지 NestJS API

God's Comfort Word - 영상 CMS를 위한 NestJS 기반 RESTful API 서버

## 📁 프로젝트 구조

```
nest-api/
├── src/
│   ├── main.ts                    # 애플리케이션 엔트리 포인트
│   ├── app.module.ts              # 루트 모듈
│   ├── auth/                      # 인증 모듈
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts     # 인증 엔드포인트
│   │   ├── auth.service.ts        # 인증 비즈니스 로직
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts    # JWT 인증 전략
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts  # JWT 가드
│   │   └── dto/
│   │       ├── login.dto.ts       # 로그인 DTO
│   │       └── setup-password.dto.ts  # 비밀번호 설정 DTO
│   └── database/                  # 데이터베이스 모듈
│       ├── database.module.ts
│       └── database.service.ts    # SQLite 연결 및 쿼리
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env                           # 환경변수 (생성 필요)
```

## 🚀 시작하기

### 1. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
# 서버 설정
PORT=8788
NODE_ENV=development

# JWT 설정
JWT_SECRET=change_this_jwt_secret_key_to_secure_random_string
JWT_EXPIRES_IN=7d

# SQLite DB 경로 (부모 디렉터리의 cms.db 사용)
SQLITE_DB_PATH=../cms.db

# Facebook Graph API Access Token (Facebook 영상 썸네일 자동 가져오기용)
# 생성 방법: https://developers.facebook.com/tools/explorer/
# 또는 Facebook Graph API를 통해 Long-lived Access Token을 생성하세요.
FACEBOOK_ACCESS_TOKEN=your_facebook_access_token_here

# CORS 허용 origin
CORS_ORIGINS=http://localhost:3000,https://gods-comfort-word.web.app,https://godcomfortword.com,https://www.godcomfortword.com
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run start:dev
```

서버가 `http://localhost:8788`에서 실행됩니다.

### 4. Swagger UI 접속

브라우저에서 다음 주소로 접속하여 API 문서를 확인하세요:

```
http://localhost:8788/api-docs
```

## 📡 API 엔드포인트

### 인증 (Auth)

| HTTP 메서드 | 경로 | 설명 | 인증 필요 |
|------------|------|------|----------|
| GET | `/auth/health` | 헬스 체크 | ❌ |
| POST | `/auth/login` | 이메일/비밀번호 로그인 | ❌ |
| POST | `/auth/setup-password` | 최초 비밀번호 설정 | ❌ |

## 🔧 개발 스크립트

```bash
# 개발 서버 (watch 모드)
npm run start:dev

# 디버그 모드
npm run start:debug

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start:prod
```

## 🔄 Fastify 서버와 병행 운용

- **Fastify 서버**: `http://localhost:8787` (기존)
- **NestJS 서버**: `http://localhost:8788` (신규)

두 서버를 동시에 실행하여 점진적으로 기능을 이전합니다.

## 📝 데이터베이스

- **Type**: SQLite
- **File**: `../cms.db` (부모 디렉터리)
- **ORM**: 사용 안 함 (better-sqlite3 직접 사용)

기존 Fastify 서버와 동일한 DB 파일을 공유합니다.

## 🔐 인증 방식

- **JWT (JSON Web Token)** 사용
- 로그인 성공 시 액세스 토큰 발급
- 보호된 엔드포인트 접근 시 `Authorization: Bearer <token>` 헤더 필요

## 📚 기술 스택

- **Framework**: NestJS 10
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3)
- **Authentication**: JWT (Passport)
- **Validation**: class-validator
- **Documentation**: Swagger (OpenAPI)


























