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
| GET | `/health` | 헬스 체크 | ❌ |
| POST | `/auth/login` | 이메일/비밀번호 로그인 | ❌ |
| POST | `/auth/setup-password` | 최초 비밀번호 설정 | ❌ |
| POST | `/auth/change-password` | 비밀번호 변경 | ❌ |

### Creator 영상 관리

| HTTP 메서드 | 경로 | 설명 | 인증 필요 |
|------------|------|------|----------|
| GET | `/creator/videos` | Creator 영상 목록 조회 | ✅ (Creator/Admin) |
| POST | `/creator/videos` | Creator 영상 생성 | ✅ (Creator/Admin) |

### 공개 영상

| HTTP 메서드 | 경로 | 설명 | 인증 필요 |
|------------|------|------|----------|
| GET | `/public/videos/youtube/metadata` | YouTube 메타데이터 조회 | ❌ |

### 디버그 (DEBUG_ENDPOINTS=true일 때만)

| HTTP 메서드 | 경로 | 설명 | 인증 필요 |
|------------|------|------|----------|
| GET | `/debug/version` | 버전 정보 조회 | ❌ |
| GET | `/debug/db-info` | DB 정보 조회 | ❌ |
| POST | `/debug/login-check` | 로그인 검증 (진단용) | ❌ |

**⚠️ 주의:** 디버그 엔드포인트는 `DEBUG_ENDPOINTS=true` 환경변수가 설정되어 있을 때만 활성화됩니다. 배포 후 원인 확인이 끝나면 반드시 `DEBUG_ENDPOINTS=false`로 되돌려주세요.

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

- **Type**: SQLite (better-sqlite3)
- **File**: 환경변수 `SQLITE_DB_PATH`로 설정 (기본값: `/app/data/cms.db`)
- **ORM**: 사용 안 함 (better-sqlite3 직접 사용)

### ⚠️ 중요: Cloud Run 배포 시 데이터 영구성 문제

현재 SQLite 파일 기반 데이터베이스를 사용하고 있습니다. **Cloud Run 환경에서는 재배포/인스턴스 교체 시 데이터가 유실될 수 있습니다.**

**해결 방법:**
1. **권장:** Cloud SQL (PostgreSQL)로 전환 - [CLOUD_SQL_MIGRATION.md](./CLOUD_SQL_MIGRATION.md) 참고
2. **임시:** Cloud Storage FUSE 사용 (성능 제한 있음)

자세한 내용은 [CLOUD_SQL_MIGRATION.md](./CLOUD_SQL_MIGRATION.md)를 참고하세요.

## 🔐 인증 방식

- **JWT (JSON Web Token)** 사용
- 로그인 성공 시 액세스 토큰 발급
- 보호된 엔드포인트 접근 시 `Authorization: Bearer <token>` 헤더 필요

## 📚 기술 스택

- **Framework**: NestJS 10
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3) - Cloud SQL 전환 권장
- **Authentication**: JWT (Passport)
- **Validation**: class-validator
- **Documentation**: Swagger (OpenAPI)

## 🧪 API 테스트

API 테스트 커맨드는 [API_TEST_COMMANDS.md](./API_TEST_COMMANDS.md)를 참고하세요.

### 빠른 테스트 예시

```bash
# 로그인 (토큰 획득)
curl -X POST "https://api.godcomfortword.com/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"j1d1y1@naver.com","password":"123456789QWER"}'

# Creator 영상 목록 조회
curl -H "Authorization: Bearer <TOKEN>" \
  "https://api.godcomfortword.com/creator/videos"

# Creator 영상 생성
curl -X POST "https://api.godcomfortword.com/creator/videos" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"sourceType":"youtube","sourceUrl":"https://www.youtube.com/watch?v=8aTbGbnj49w","language":"ko"}'
```

## 📖 추가 문서

- [API_TEST_COMMANDS.md](./API_TEST_COMMANDS.md) - API 테스트 커맨드 가이드
- [CLOUD_SQL_MIGRATION.md](./CLOUD_SQL_MIGRATION.md) - Cloud SQL 마이그레이션 가이드


























