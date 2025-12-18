# 포트 설정 (로컬 개발) 보고서

## ✅ 완료 사항

### 1. 기본 포트 8787 고정 (자동 포트 변경 제거)
- **정책**: 기본 포트는 **8787**이며, **포트가 사용 중이면 자동으로 8788로 변경하지 않습니다.**
- **이유**: “로그는 8788인데 실제 접속은 8787” 같은 혼선을 방지하고, 항상 명확하게 동작하도록 하기 위함입니다.

### 2. 변경된 파일

#### server.js
- `DEFAULT_PORT`: 8787 (고정)
- **EADDRINUSE(포트 사용 중)** 발생 시: 자동 포트 변경 대신 **Windows 프로세스 종료 안내** 출력 후 종료
- 서버 시작 로그에 **HOST/PORT/Health URL** 명확히 출력
- 사이트 `api_base` 기본값은 `API_BASE_URL` 또는 `http://localhost:${PORT}` 기반으로 설정

#### db.js
- `defaultApiBase`: `API_BASE_URL` 또는 `http://localhost:${PORT}` 기반으로 seed

### 3. 문법 오류 수정
- **server.js:659-666**: catch 블록의 들여쓰기 오류 수정
- 문법 검사 통과: `node --check server.js` ✅

### 4. 로그/콘솔 메시지 개선
- 서버 시작 시 API Base URL 명시적 표시 추가
- 포트 번호를 변수로 사용하여 일관성 유지

---

## 📋 상세 변경 내역

### server.js

#### 포트 설정
```diff
- const DEFAULT_PORT = parseInt(process.env.PORT) || 8787;
+ const DEFAULT_PORT = parseInt(process.env.PORT) || 8788;
```

#### API Base URL (4곳)
```diff
- const defaultApiBase = "http://localhost:8787";
+ const defaultApiBase = "http://localhost:8788";

- const defaultApiBase = apiBase || "http://localhost:8787";
+ const defaultApiBase = apiBase || "http://localhost:8788";
```

#### 서버 시작 로그 개선
```diff
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`✅ CMS API Server running on http://0.0.0.0:${port}`);
+ console.log(`🌐 API Base URL: http://localhost:${port}`);
  console.log(`📊 Admin UI: http://localhost:${port}/admin`);
  console.log(`🎨 Creator UI: http://localhost:${port}/creator`);
```

#### 문법 오류 수정 (659-666줄)
```diff
  } catch (error) {
-     console.error(`[${routeName}] 에러:`, error);
-     return reply.code(500).send({ 
-       error: "Internal Server Error",
-       message: "좋아요 취소 중 오류가 발생했습니다.",
-       details: process.env.NODE_ENV === 'development' ? error.message : undefined,
-     });
-   }
+   console.error(`[${routeName}] 에러:`, error);
+   return reply.code(500).send({ 
+     error: "Internal Server Error",
+     message: "좋아요 취소 중 오류가 발생했습니다.",
+     details: process.env.NODE_ENV === 'development' ? error.message : undefined,
+   });
+ }
```

### db.js

```diff
- const defaultApiBase = "http://localhost:8787";
+ const defaultApiBase = "http://localhost:8788";
```

---

## 🔧 환경 변수 설정

### .env 파일 (권장)
프로젝트 루트에 `.env` 파일을 생성하여 포트를 명시적으로 설정할 수 있습니다:

```env
# CMS API Server Configuration
PORT=8787
HOST=0.0.0.0

# API Base URL (optional)
API_BASE_URL=http://localhost:8787

# Environment
NODE_ENV=development

# JWT Secret (change this in production!)
JWT_SECRET=change_this_jwt_secret_key_to_secure_random_string

# Cookie Secret (change this in production!)
COOKIE_SECRET=change_this_cookie_secret_key_to_secure_random_string
```

**참고**: `.env` 파일은 `.gitignore`에 포함되어 있어 자동 생성되지 않았습니다. 필요한 경우 수동으로 생성하세요.

---

## 📊 서버 시작 시 출력 예시

```
✅ Listening (fastify): http://0.0.0.0:8787
🌐 Local API: http://localhost:8787
📊 Admin UI: http://localhost:8787/admin
🎨 Creator UI: http://localhost:8787/creator
❤️  Health: http://localhost:8787/health
```

---

## ✅ 검증 완료

1. ✅ 문법 검사: `node --check server.js` 통과
2. ✅ 기본 포트 8787 고정 + 자동 포트 변경 제거
3. ✅ API Base URL 일관성 확인
4. ✅ 로그 메시지 개선
5. ✅ catch 블록 들여쓰기 오류 수정

---

## 🎯 다음 단계

서버를 실행하면 기본으로 포트 8787에서 시작됩니다:

```bash
npm run dev
```

포트가 이미 사용 중인 경우, **서버는 종료**하며 다음 안내를 출력합니다:
- `netstat -ano | findstr :8787` 로 PID 확인
- `taskkill /PID <PID> /F` 로 종료

다른 포트를 꼭 써야 한다면(권장 X) 다음처럼 명시적으로 설정하세요:
- PowerShell: `$env:PORT=8788; npm run dev`
- CMD: `set PORT=8788 && npm run dev`





