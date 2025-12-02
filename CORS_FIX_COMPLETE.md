# CORS 문제 해결 완료 ✅

## 적용된 변경사항

### 1. 환경변수 설정 (`.env`)
- ✅ `CORS_ORIGINS=http://localhost:3000,http://localhost:3001` 추가
- 홈페이지(localhost:3000)에서 CMS API 호출 허용

### 2. CORS 설정 개선 (`server.js`)
```javascript
await app.register(cors, {
  origin: (origin, cb) => {
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
      : ["http://localhost:3000"]; // 기본값 설정

    if (!origin) {
      cb(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      cb(null, true);
      return;
    }

    console.warn(`🚫 CORS blocked: ${origin}`);
    cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true, // 🆕 쿠키/인증 헤더 허용
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // 🆕 허용 메서드
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"], // 🆕 허용 헤더
  exposedHeaders: ["Content-Length", "X-Total-Count"], // 🆕 노출 헤더
});
```

**개선 사항:**
- `credentials: true` - 쿠키 및 인증 헤더 허용
- 명시적인 허용 메서드 설정
- 허용 헤더 및 노출 헤더 설정
- CORS 차단 시 로그 출력

### 3. API 응답 형식 표준화 (`/public/videos`)
**변경 전:**
```json
{
  "videos": [...],
  "cursor": "..."
}
```

**변경 후:**
```json
{
  "items": [...],
  "total": 10,
  "page": 1,
  "page_size": 20,
  "cursor": "..."
}
```

### 4. 데이터베이스 스키마 업데이트 (`db.js`)
videos 테이블에 새 컬럼 추가:
- ✅ `video_id TEXT` - YouTube/Facebook 비디오 ID
- ✅ `language TEXT DEFAULT 'en'` - 언어 코드
- ✅ `status TEXT DEFAULT 'active'` - 상태 (active/inactive/draft)

**자동 마이그레이션:**
- 기존 데이터베이스에 새 컬럼이 자동으로 추가됩니다.
- 서버 시작 시 자동 실행됩니다.

### 5. video_id 자동 추출
- YouTube: URL에서 자동 추출 (`extractYouTubeVideoId`)
- Facebook: `/videos/{id}` 패턴에서 추출
- 응답 시 자동으로 계산하여 포함

---

## 테스트 방법

### 1️⃣ CMS API 서버 재시작

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"
npm run dev
```

**확인사항:**
- 서버가 http://localhost:8787에서 실행되는지 확인
- 마이그레이션 메시지 확인:
  ```
  ✅ Migration: video_id 컬럼 추가됨
  ✅ Migration: language 컬럼 추가됨
  ✅ Migration: status 컬럼 추가됨
  ```

### 2️⃣ 테스트 데이터 추가 (선택사항)

```powershell
# PowerShell에서 실행
$headers = @{
    "Content-Type" = "application/json"
    "X-API-Key" = "YOUR_ADMIN_API_KEY"
}

$body = @{
    platform = "youtube"
    source_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    title = "Test Video"
    language = "ko"
    status = "active"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8787/videos" -Method Post -Headers $headers -Body $body
```

### 3️⃣ Next.js 홈페이지에서 테스트

```powershell
cd C:\gods-comfort-word
npm run dev
```

브라우저에서 접속:
```
http://localhost:3000/test-cms
```

**확인사항:**
1. ✅ API 호출이 성공적으로 이루어지는지
2. ✅ 영상 목록이 카드 형태로 표시되는지
3. ✅ 썸네일, 제목, 플랫폼, 날짜가 올바르게 표시되는지
4. ✅ 영상 재생 버튼 클릭 시 모달이 열리는지
5. ✅ iframe에서 영상이 재생되는지

### 4️⃣ 브라우저 개발자 도구 확인

**Network 탭:**
```
Request URL: http://localhost:8787/public/videos?site_id=gods
Status Code: 200 OK

Response Headers:
  Access-Control-Allow-Origin: http://localhost:3000
  Access-Control-Allow-Credentials: true
```

**Console 탭:**
- CORS 에러가 없어야 함 ✅
- API 응답 데이터가 정상적으로 출력되어야 함 ✅

---

## cURL 테스트

### OPTIONS 요청 (Preflight)
```bash
curl -X OPTIONS http://localhost:8787/public/videos \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

**기대 응답:**
```
< HTTP/1.1 204 No Content
< access-control-allow-origin: http://localhost:3000
< access-control-allow-credentials: true
< access-control-allow-methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
```

### GET 요청
```bash
curl http://localhost:8787/public/videos?site_id=gods \
  -H "Origin: http://localhost:3000" \
  -v
```

**기대 응답:**
```json
{
  "items": [
    {
      "id": "...",
      "site_id": "gods",
      "platform": "youtube",
      "video_id": "dQw4w9WgXcQ",
      "title": "Test Video",
      "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "language": "ko",
      "status": "active",
      "created_at": "2024-01-01 12:00:00"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

---

## 문제 해결

### 문제 1: CORS 에러가 여전히 발생
**원인:** .env 파일이 로드되지 않음  
**해결:**
```powershell
# .env 파일 확인
cat .env

# CORS_ORIGINS가 있는지 확인
# 없으면 추가:
echo "CORS_ORIGINS=http://localhost:3000,http://localhost:3001" >> .env

# 서버 재시작
```

### 문제 2: "site_id query parameter is required"
**원인:** API 호출 시 site_id 누락  
**해결:** URL에 `?site_id=gods` 포함 확인

### 문제 3: "items" 필드가 없음
**원인:** server.js가 업데이트되지 않음  
**해결:**
```powershell
# server.js 파일 날짜 확인
Get-Item server.js | Select-Object LastWriteTime

# 최신 변경사항 반영 후 서버 재시작
```

### 문제 4: video_id가 null
**원인:**
- 기존 데이터는 video_id가 없음
- 새로 생성된 데이터만 video_id 포함

**해결:** 기존 데이터의 video_id를 업데이트하는 스크립트 실행
```javascript
// Node.js에서 실행
import db from './db.js';
import { extractYouTubeVideoId } from './metadata.js';

const videos = db.prepare("SELECT * FROM videos WHERE video_id IS NULL").all();

for (const video of videos) {
  let videoId = null;
  
  if (video.platform === 'youtube') {
    videoId = extractYouTubeVideoId(video.source_url);
  } else if (video.platform === 'facebook') {
    const match = video.source_url.match(/\/videos\/(\d+)/);
    videoId = match ? match[1] : null;
  }
  
  if (videoId) {
    db.prepare("UPDATE videos SET video_id = ? WHERE id = ?").run(videoId, video.id);
    console.log(`✅ Updated video ${video.id}: ${videoId}`);
  }
}

console.log('✅ Migration complete!');
```

---

## 프로덕션 배포 시 주의사항

### 1. 환경변수 업데이트
```env
# .env.production
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
JWT_SECRET=STRONG_RANDOM_SECRET_HERE
ADMIN_BOOTSTRAP_KEY=STRONG_RANDOM_KEY_HERE
```

### 2. HTTPS 사용
- 프로덕션에서는 반드시 HTTPS 사용
- Mixed Content 문제 주의 (HTTPS 사이트에서 HTTP API 호출 불가)

### 3. 보안 강화
- 민감한 API는 JWT 인증 추가
- Rate Limiting 고려
- API Key 주기적 갱신

---

## 완료 체크리스트

- [x] .env 파일 생성 및 CORS_ORIGINS 설정
- [x] server.js CORS 설정 개선
- [x] API 응답 형식 표준화 (videos → items)
- [x] DB 스키마 업데이트 (video_id, language, status)
- [x] 자동 마이그레이션 로직 추가
- [x] video_id 자동 추출 로직 구현
- [x] 테스트 가이드 작성

---

## 다음 단계

1. ✅ CMS API 서버 재시작
2. ✅ Next.js 홈페이지에서 `/test-cms` 접속
3. ✅ CORS 에러 없이 API 호출 성공 확인
4. ✅ 영상 목록 및 재생 테스트

문제가 발생하면 위의 "문제 해결" 섹션을 참고하세요!



## 적용된 변경사항

### 1. 환경변수 설정 (`.env`)
- ✅ `CORS_ORIGINS=http://localhost:3000,http://localhost:3001` 추가
- 홈페이지(localhost:3000)에서 CMS API 호출 허용

### 2. CORS 설정 개선 (`server.js`)
```javascript
await app.register(cors, {
  origin: (origin, cb) => {
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
      : ["http://localhost:3000"]; // 기본값 설정

    if (!origin) {
      cb(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      cb(null, true);
      return;
    }

    console.warn(`🚫 CORS blocked: ${origin}`);
    cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true, // 🆕 쿠키/인증 헤더 허용
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // 🆕 허용 메서드
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"], // 🆕 허용 헤더
  exposedHeaders: ["Content-Length", "X-Total-Count"], // 🆕 노출 헤더
});
```

**개선 사항:**
- `credentials: true` - 쿠키 및 인증 헤더 허용
- 명시적인 허용 메서드 설정
- 허용 헤더 및 노출 헤더 설정
- CORS 차단 시 로그 출력

### 3. API 응답 형식 표준화 (`/public/videos`)
**변경 전:**
```json
{
  "videos": [...],
  "cursor": "..."
}
```

**변경 후:**
```json
{
  "items": [...],
  "total": 10,
  "page": 1,
  "page_size": 20,
  "cursor": "..."
}
```

### 4. 데이터베이스 스키마 업데이트 (`db.js`)
videos 테이블에 새 컬럼 추가:
- ✅ `video_id TEXT` - YouTube/Facebook 비디오 ID
- ✅ `language TEXT DEFAULT 'en'` - 언어 코드
- ✅ `status TEXT DEFAULT 'active'` - 상태 (active/inactive/draft)

**자동 마이그레이션:**
- 기존 데이터베이스에 새 컬럼이 자동으로 추가됩니다.
- 서버 시작 시 자동 실행됩니다.

### 5. video_id 자동 추출
- YouTube: URL에서 자동 추출 (`extractYouTubeVideoId`)
- Facebook: `/videos/{id}` 패턴에서 추출
- 응답 시 자동으로 계산하여 포함

---

## 테스트 방법

### 1️⃣ CMS API 서버 재시작

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"
npm run dev
```

**확인사항:**
- 서버가 http://localhost:8787에서 실행되는지 확인
- 마이그레이션 메시지 확인:
  ```
  ✅ Migration: video_id 컬럼 추가됨
  ✅ Migration: language 컬럼 추가됨
  ✅ Migration: status 컬럼 추가됨
  ```

### 2️⃣ 테스트 데이터 추가 (선택사항)

```powershell
# PowerShell에서 실행
$headers = @{
    "Content-Type" = "application/json"
    "X-API-Key" = "YOUR_ADMIN_API_KEY"
}

$body = @{
    platform = "youtube"
    source_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    title = "Test Video"
    language = "ko"
    status = "active"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8787/videos" -Method Post -Headers $headers -Body $body
```

### 3️⃣ Next.js 홈페이지에서 테스트

```powershell
cd C:\gods-comfort-word
npm run dev
```

브라우저에서 접속:
```
http://localhost:3000/test-cms
```

**확인사항:**
1. ✅ API 호출이 성공적으로 이루어지는지
2. ✅ 영상 목록이 카드 형태로 표시되는지
3. ✅ 썸네일, 제목, 플랫폼, 날짜가 올바르게 표시되는지
4. ✅ 영상 재생 버튼 클릭 시 모달이 열리는지
5. ✅ iframe에서 영상이 재생되는지

### 4️⃣ 브라우저 개발자 도구 확인

**Network 탭:**
```
Request URL: http://localhost:8787/public/videos?site_id=gods
Status Code: 200 OK

Response Headers:
  Access-Control-Allow-Origin: http://localhost:3000
  Access-Control-Allow-Credentials: true
```

**Console 탭:**
- CORS 에러가 없어야 함 ✅
- API 응답 데이터가 정상적으로 출력되어야 함 ✅

---

## cURL 테스트

### OPTIONS 요청 (Preflight)
```bash
curl -X OPTIONS http://localhost:8787/public/videos \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

**기대 응답:**
```
< HTTP/1.1 204 No Content
< access-control-allow-origin: http://localhost:3000
< access-control-allow-credentials: true
< access-control-allow-methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
```

### GET 요청
```bash
curl http://localhost:8787/public/videos?site_id=gods \
  -H "Origin: http://localhost:3000" \
  -v
```

**기대 응답:**
```json
{
  "items": [
    {
      "id": "...",
      "site_id": "gods",
      "platform": "youtube",
      "video_id": "dQw4w9WgXcQ",
      "title": "Test Video",
      "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "embed_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "language": "ko",
      "status": "active",
      "created_at": "2024-01-01 12:00:00"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

---

## 문제 해결

### 문제 1: CORS 에러가 여전히 발생
**원인:** .env 파일이 로드되지 않음  
**해결:**
```powershell
# .env 파일 확인
cat .env

# CORS_ORIGINS가 있는지 확인
# 없으면 추가:
echo "CORS_ORIGINS=http://localhost:3000,http://localhost:3001" >> .env

# 서버 재시작
```

### 문제 2: "site_id query parameter is required"
**원인:** API 호출 시 site_id 누락  
**해결:** URL에 `?site_id=gods` 포함 확인

### 문제 3: "items" 필드가 없음
**원인:** server.js가 업데이트되지 않음  
**해결:**
```powershell
# server.js 파일 날짜 확인
Get-Item server.js | Select-Object LastWriteTime

# 최신 변경사항 반영 후 서버 재시작
```

### 문제 4: video_id가 null
**원인:**
- 기존 데이터는 video_id가 없음
- 새로 생성된 데이터만 video_id 포함

**해결:** 기존 데이터의 video_id를 업데이트하는 스크립트 실행
```javascript
// Node.js에서 실행
import db from './db.js';
import { extractYouTubeVideoId } from './metadata.js';

const videos = db.prepare("SELECT * FROM videos WHERE video_id IS NULL").all();

for (const video of videos) {
  let videoId = null;
  
  if (video.platform === 'youtube') {
    videoId = extractYouTubeVideoId(video.source_url);
  } else if (video.platform === 'facebook') {
    const match = video.source_url.match(/\/videos\/(\d+)/);
    videoId = match ? match[1] : null;
  }
  
  if (videoId) {
    db.prepare("UPDATE videos SET video_id = ? WHERE id = ?").run(videoId, video.id);
    console.log(`✅ Updated video ${video.id}: ${videoId}`);
  }
}

console.log('✅ Migration complete!');
```

---

## 프로덕션 배포 시 주의사항

### 1. 환경변수 업데이트
```env
# .env.production
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
JWT_SECRET=STRONG_RANDOM_SECRET_HERE
ADMIN_BOOTSTRAP_KEY=STRONG_RANDOM_KEY_HERE
```

### 2. HTTPS 사용
- 프로덕션에서는 반드시 HTTPS 사용
- Mixed Content 문제 주의 (HTTPS 사이트에서 HTTP API 호출 불가)

### 3. 보안 강화
- 민감한 API는 JWT 인증 추가
- Rate Limiting 고려
- API Key 주기적 갱신

---

## 완료 체크리스트

- [x] .env 파일 생성 및 CORS_ORIGINS 설정
- [x] server.js CORS 설정 개선
- [x] API 응답 형식 표준화 (videos → items)
- [x] DB 스키마 업데이트 (video_id, language, status)
- [x] 자동 마이그레이션 로직 추가
- [x] video_id 자동 추출 로직 구현
- [x] 테스트 가이드 작성

---

## 다음 단계

1. ✅ CMS API 서버 재시작
2. ✅ Next.js 홈페이지에서 `/test-cms` 접속
3. ✅ CORS 에러 없이 API 호출 성공 확인
4. ✅ 영상 목록 및 재생 테스트

문제가 발생하면 위의 "문제 해결" 섹션을 참고하세요!


