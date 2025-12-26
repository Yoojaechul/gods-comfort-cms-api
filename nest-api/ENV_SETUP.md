# 환경 변수 설정 가이드

## .env 파일 생성

`nest-api` 디렉터리에 `.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
# ====================================
# 서버 설정
# ====================================
PORT=8788
NODE_ENV=development

# ====================================
# JWT 설정
# ====================================
# 보안을 위해 production에서는 반드시 변경하세요!
JWT_SECRET=change_this_jwt_secret_key_to_secure_random_string
JWT_EXPIRES_IN=7d

# ====================================
# SQLite DB 경로
# ====================================
# 부모 디렉터리의 cms.db 파일을 사용합니다.
# 기존 Fastify 서버와 동일한 DB를 공유합니다.
SQLITE_DB_PATH=../cms.db

# ====================================
# CORS 허용 origin
# ====================================
# 쉼표로 구분하여 여러 origin을 설정할 수 있습니다.
CORS_ORIGINS=http://localhost:3000,https://gods-comfort-word.web.app,https://godcomfortword.com,https://www.godcomfortword.com
```

## Windows PowerShell에서 .env 파일 생성

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"

# .env 파일 생성
@"
PORT=8788
NODE_ENV=development
JWT_SECRET=change_this_jwt_secret_key_to_secure_random_string
JWT_EXPIRES_IN=7d
SQLITE_DB_PATH=../cms.db
CORS_ORIGINS=http://localhost:3000,https://gods-comfort-word.web.app,https://godcomfortword.com,https://www.godcomfortword.com
"@ | Out-File -FilePath .env -Encoding UTF8
```

## 환경 변수 설명

### PORT
- NestJS 서버가 실행될 포트 번호
- 기본값: `8788`
- Fastify 서버(8787)와 충돌하지 않도록 다른 포트 사용

### NODE_ENV
- 실행 환경
- 값: `development` | `production` | `test`

### JWT_SECRET
- JWT 토큰 서명에 사용되는 비밀키
- **중요**: Production 환경에서는 반드시 강력한 랜덤 문자열로 변경
- 추천: 최소 32자 이상의 랜덤 문자열

### JWT_EXPIRES_IN
- JWT 토큰 유효 기간
- 형식: `1h`, `7d`, `30d` 등
- 기본값: `7d` (7일)

### SQLITE_DB_PATH
- SQLite 데이터베이스 파일 경로
- 상대 경로 또는 절대 경로 가능
- 기본값: `../cms.db` (부모 디렉터리의 cms.db)

### CORS_ORIGINS
- CORS 허용 origin 목록
- 쉼표(`,`)로 구분
- 프론트엔드 도메인들을 여기에 추가

## 보안 주의사항

⚠️ **절대로 `.env` 파일을 Git에 커밋하지 마세요!**

`.gitignore`에 다음이 포함되어 있는지 확인하세요:

```
.env
.env.local
.env.*.local
```

## 검증

환경 변수가 제대로 로드되는지 확인:

```bash
npm run start:dev
```

콘솔에 다음과 같은 메시지가 나타나야 합니다:

```
✅ NestJS API Server running on http://localhost:8788
📚 Swagger UI: http://localhost:8788/api-docs
```





































































































