# CMS API 데이터베이스 보안 체크리스트

## 🔒 현재 데이터베이스: SQLite (cms.db)

Firestore 대신 SQLite를 사용하고 있습니다.

---

## ✅ A. 데이터 일관성 점검

### 1. site_id 검증

**스키마**:
```sql
CREATE TABLE videos (
  site_id TEXT NOT NULL,  -- ✅ NOT NULL
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);
```

**검증**:
```bash
# 모든 영상에 site_id가 있는지 확인
node -e "import db from './db.js'; const invalid = db.prepare('SELECT COUNT(*) as count FROM videos WHERE site_id IS NULL OR site_id = \\\"\\\"').get(); console.log('site_id 없는 영상:', invalid.count);"
```

**기대**: `site_id 없는 영상: 0`

### 2. owner_id 검증

**스키마**:
```sql
CREATE TABLE videos (
  owner_id TEXT NOT NULL,  -- ✅ NOT NULL
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
```

**검증**:
```bash
# owner_id가 실제 user와 매칭되는지 확인
node -e "import db from './db.js'; const orphaned = db.prepare('SELECT v.id, v.title, v.owner_id FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE u.id IS NULL').all(); console.log('고아 영상 (owner 없음):', orphaned.length); orphaned.forEach(v => console.log('- ', v.title, v.owner_id));"
```

**기대**: `고아 영상 (owner 없음): 0`

### 3. platform 값 제한

**스키마**:
```sql
CREATE TABLE videos (
  platform TEXT NOT NULL CHECK(platform IN ('youtube', 'facebook', 'other'))
);
```

**검증**:
```bash
# 허용되지 않은 platform 값 확인
node -e "import db from './db.js'; const invalid = db.prepare(\\\"SELECT id, title, platform FROM videos WHERE platform NOT IN ('youtube', 'facebook', 'other')\\\").all(); console.log('잘못된 platform:', invalid.length);"
```

**기대**: `잘못된 platform: 0`

### 4. stats 음수 검증

**스키마**:
```sql
CREATE TABLE videos (
  views_count INTEGER DEFAULT 0,   -- ✅ CHECK >= 0 필요
  likes_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0
);
```

**검증 추가 (server.js)**:
```javascript
// Stats 수정 시 음수 체크
app.patch("/admin/videos/:id/stats", async (request, reply) => {
  const { views_count, likes_count, shares_count } = request.body;
  
  // 음수 검증
  if (views_count !== undefined && views_count < 0) {
    return reply.code(400).send({ error: "views_count cannot be negative" });
  }
  if (likes_count !== undefined && likes_count < 0) {
    return reply.code(400).send({ error: "likes_count cannot be negative" });
  }
  if (shares_count !== undefined && shares_count < 0) {
    return reply.code(400).send({ error: "shares_count cannot be negative" });
  }
  
  // ... 나머지 로직
});
```

---

## ✅ B. 권한 재점검 (API 레벨)

### Admin 권한 ✅

#### 허용:
```javascript
// ✅ 모든 영상 CRUD
PATCH  /admin/videos/:id
DELETE /admin/videos/:id

// ✅ Stats 수정 (Admin 전용!)
PATCH  /admin/videos/:id/stats
```

#### API 코드:
```javascript
// requireAdmin 미들웨어
export async function requireAdmin(request, reply) {
  if (request.user.role !== "admin") {
    return reply.code(403).send({ 
      error: "Access denied",
      message: "관리자 권한이 필요합니다."
    });
  }
}
```

#### 테스트:
```bash
# Creator 토큰으로 Stats 수정 시도 → 403 기대
curl -X PATCH http://localhost:8787/admin/videos/{id}/stats \
  -H "Authorization: Bearer {CREATOR_TOKEN}" \
  -d '{"views_count": 9999}'

# 기대: 403 Forbidden
```

### Creator 권한 ✅

#### 허용:
```javascript
// ✅ 본인 영상만 CRUD
PATCH  /videos/:id        // owner_id 검증
DELETE /videos/:id        // owner_id 검증
```

#### API 코드:
```javascript
// 본인 소유 확인
const existing = db
  .prepare("SELECT * FROM videos WHERE id = ? AND owner_id = ?")
  .get(id, user.id);

if (!existing) {
  return reply.code(404).send({ 
    error: "Video not found or access denied" 
  });
}
```

#### 금지:
```javascript
// ❌ Stats 수정 불가
PATCH  /admin/videos/:id/stats  // requireAdmin 미들웨어로 차단

// ❌ 다른 사용자 영상 수정 불가
PATCH  /videos/{other_user_id}  // owner_id 불일치로 404
```

#### 테스트:
```bash
# Creator가 다른 사용자 영상 수정 시도 → 404 기대
curl -X PATCH http://localhost:8787/videos/{other_user_video_id} \
  -H "Authorization: Bearer {CREATOR_TOKEN}" \
  -d '{"title": "해킹"}'

# 기대: 404 Not Found
```

---

## ✅ C. 데이터베이스 보안

### SQLite 보안 설정

#### 1. 파일 권한
```bash
# cms.db 파일 권한 설정 (Linux/Mac)
chmod 600 cms.db
chown cms-api:cms-api cms.db

# Windows: 파일 속성에서 권한 설정
```

#### 2. SQL Injection 방지

**현재 코드**: ✅ Prepared Statements 사용
```javascript
// ✅ 안전 (Prepared Statement)
db.prepare("SELECT * FROM videos WHERE id = ?").get(id);

// ❌ 위험 (직접 문자열 삽입)
db.prepare(`SELECT * FROM videos WHERE id = ${id}`).get();
```

**검증**: 모든 쿼리에서 Prepared Statements 사용 확인

#### 3. 트랜잭션 사용

**권장**: 중요한 작업은 트랜잭션으로 묶기
```javascript
const transaction = db.transaction((videos) => {
  for (const video of videos) {
    db.prepare('INSERT INTO videos (...) VALUES (...)').run(...);
  }
});

try {
  transaction(videosArray);
} catch (err) {
  // 모두 롤백됨
  console.error(err);
}
```

---

## ✅ D. 인덱스 점검

### 현재 인덱스

```sql
CREATE INDEX IF NOT EXISTS idx_videos_site_id ON videos(site_id);
CREATE INDEX IF NOT EXISTS idx_videos_owner_id ON videos(owner_id);
CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility);
CREATE INDEX IF NOT EXISTS idx_users_site_id ON users(site_id);
CREATE INDEX IF NOT EXISTS idx_user_provider_keys_user_id ON user_provider_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_site_id ON visits(site_id);
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);
CREATE INDEX IF NOT EXISTS idx_visits_country_code ON visits(country_code);
CREATE INDEX IF NOT EXISTS idx_visits_language ON visits(language);
CREATE INDEX IF NOT EXISTS idx_stats_adjustments_video_id ON stats_adjustments(video_id);
CREATE INDEX IF NOT EXISTS idx_stats_adjustments_admin_id ON stats_adjustments(admin_id);
```

### 복합 인덱스 추가 권장

```sql
-- /public/videos 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_videos_site_visibility_created 
ON videos(site_id, visibility, created_at DESC);

-- 언어별 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_videos_site_visibility_language 
ON videos(site_id, visibility, language);

-- 접속자 통계 최적화
CREATE INDEX IF NOT EXISTS idx_visits_site_created 
ON visits(site_id, created_at);
```

---

## 🔍 쿼리 성능 테스트

### 1. EXPLAIN QUERY PLAN

```javascript
// 쿼리 계획 확인
const plan = db.prepare(`
  EXPLAIN QUERY PLAN
  SELECT * FROM videos 
  WHERE site_id = ? AND visibility = 'public' 
  ORDER BY created_at DESC 
  LIMIT 20
`).all('gods');

console.log(plan);
```

**기대**: `SEARCH TABLE videos USING INDEX idx_videos_site_visibility_created`

### 2. 느린 쿼리 찾기

```javascript
// 실행 시간 측정
console.time('query');
const videos = db.prepare('SELECT * FROM videos WHERE site_id = ?').all('gods');
console.timeEnd('query');
```

**기대**: `query: < 10ms`

---

## 🛡️ 보안 룰 점검 (API 레벨)

### 공개 조회 (`/public/videos`)

```javascript
app.get("/public/videos", async (request, reply) => {
  // ✅ 인증 불필요
  // ✅ visibility = 'public'만 반환
  // ✅ site_id 필수
  
  let query = "SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE v.site_id = ? AND v.visibility = 'public'";
  
  const videos = db.prepare(query).all(site_id);
  
  // ✅ owner_name 포함 (공개 정보)
  // ❌ owner_id, api_key 등은 제외
  
  return { items: videos, total, page, page_size };
});
```

### 인증 필요 엔드포인트

```javascript
// ✅ 모든 민감한 작업은 authenticate 미들웨어 필수
app.get("/videos", { preHandler: authenticate }, async (request, reply) => {
  // 본인 영상만 반환
  const videos = db.prepare(
    "SELECT * FROM videos WHERE owner_id = ?"
  ).all(user.id);
});

app.patch("/videos/:id", { preHandler: authenticate }, async (request, reply) => {
  // 본인 영상만 수정
  const existing = db.prepare(
    "SELECT * FROM videos WHERE id = ? AND owner_id = ?"
  ).get(id, user.id);
});
```

---

## 🧪 보안 테스트 시나리오

### 테스트 1: 공개 API (인증 없이)
```bash
curl http://localhost:8787/public/videos?site_id=gods
```
**기대**:
- ✅ 200 OK
- ✅ visibility='public'인 영상만 반환
- ✅ owner_name 포함
- ❌ api_key_hash, password_hash 등 민감정보 없음

### 테스트 2: 인증 필요 API (토큰 없이)
```bash
curl http://localhost:8787/videos
```
**기대**:
- ✅ 401 Unauthorized
- ✅ 친화적 에러 메시지

### 테스트 3: Creator가 Admin API 호출
```bash
curl -X PATCH http://localhost:8787/admin/videos/{id}/stats \
  -H "Authorization: Bearer {CREATOR_TOKEN}"
```
**기대**:
- ✅ 403 Forbidden
- ✅ "관리자 권한이 필요합니다." 메시지

### 테스트 4: Creator가 다른 사용자 영상 수정
```bash
curl -X PATCH http://localhost:8787/videos/{other_user_video_id} \
  -H "Authorization: Bearer {CREATOR_TOKEN}"
```
**기대**:
- ✅ 404 Not Found
- ✅ "Video not found or access denied"

---

## 🔧 추가 보안 강화

### 1. Stats 음수 검증 추가

```javascript
// server.js - Stats 수정 API에 추가
const { views_count, likes_count, shares_count } = request.body;

// 음수 검증
if (views_count !== undefined && views_count < 0) {
  return reply.code(400).send({ 
    error: "Invalid value",
    message: "조회수는 0 이상이어야 합니다."
  });
}
if (likes_count !== undefined && likes_count < 0) {
  return reply.code(400).send({ 
    error: "Invalid value",
    message: "좋아요는 0 이상이어야 합니다."
  });
}
if (shares_count !== undefined && shares_count < 0) {
  return reply.code(400).send({ 
    error: "Invalid value",
    message: "공유수는 0 이상이어야 합니다."
  });
}
```

### 2. Rate Limiting

```bash
npm install @fastify/rate-limit
```

```javascript
import rateLimit from '@fastify/rate-limit';

await app.register(rateLimit, {
  max: 100,  // 분당 최대 100 요청
  timeWindow: '1 minute'
});
```

### 3. 입력 검증

```javascript
// URL 검증
if (!source_url.startsWith('https://')) {
  return reply.code(400).send({ error: "HTTPS URL required" });
}

// 제목 길이 검증
if (title.length > 500) {
  return reply.code(400).send({ error: "Title too long (max 500 chars)" });
}
```

---

## 📊 데이터 무결성 점검

### 검증 스크립트 실행

```bash
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"
node check-data-integrity.js
```

**check-data-integrity.js**:
```javascript
import db from './db.js';

console.log('=== 데이터 무결성 점검 ===\n');

// 1. site_id 검증
const noSiteId = db.prepare('SELECT COUNT(*) as count FROM videos WHERE site_id IS NULL OR site_id = ""').get();
console.log('1. site_id 없는 영상:', noSiteId.count, noSiteId.count === 0 ? '✅' : '❌');

// 2. owner_id 검증
const orphaned = db.prepare('SELECT COUNT(*) as count FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE u.id IS NULL').get();
console.log('2. owner 없는 영상:', orphaned.count, orphaned.count === 0 ? '✅' : '❌');

// 3. platform 검증
const invalidPlatform = db.prepare("SELECT COUNT(*) as count FROM videos WHERE platform NOT IN ('youtube', 'facebook', 'other')").get();
console.log('3. 잘못된 platform:', invalidPlatform.count, invalidPlatform.count === 0 ? '✅' : '❌');

// 4. stats 음수 검증
const negativeStats = db.prepare('SELECT COUNT(*) as count FROM videos WHERE views_count < 0 OR likes_count < 0 OR shares_count < 0').get();
console.log('4. 음수 stats:', negativeStats.count, negativeStats.count === 0 ? '✅' : '❌');

// 5. 필수 필드 검증
const noTitle = db.prepare('SELECT COUNT(*) as count FROM videos WHERE title IS NULL OR title = ""').get();
console.log('5. 제목 없는 영상:', noTitle.count, noTitle.count === 0 ? '✅' : '❌');

console.log('\n=== 점검 완료 ===');
```

---

## 🔒 운영 환경 설정

### .env.production

```env
# Node 환경
NODE_ENV=production

# 서버 포트
PORT=8787

# JWT Secret (강력한 랜덤 키)
JWT_SECRET=22151c2bc3f87920ee938bc3c30590d36f928877d42ef40d1147bbda5cfe7ba20cab38776f444d38d5c10cc3e485b3684e49ca868308a5910f09f24e4c77ed28

# Admin Bootstrap Key (강력한 랜덤 키)
ADMIN_BOOTSTRAP_KEY=a2bd9baec1b2c4c016bd8498061794fea378f8b1ada14371723d8697062134c7

# CORS (운영 도메인만)
CORS_ORIGINS=https://godscomfortword.com,https://www.godscomfortword.com

# Fastify 설정
FASTIFY_LOG_LEVEL=warn  # 운영에서는 warn 이상만 로깅
```

---

## 💾 데이터베이스 백업

### 자동 백업 스크립트

**backup-db.js**:
```javascript
import fs from 'fs';
import path from 'path';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `backups/cms_${timestamp}.db`;

// 디렉토리 생성
if (!fs.existsSync('backups')) {
  fs.mkdirSync('backups');
}

// 백업
fs.copyFileSync('cms.db', backupPath);
console.log(`✅ 백업 완료: ${backupPath}`);

// 7일 이상 된 백업 삭제
const files = fs.readdirSync('backups');
const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

files.forEach(file => {
  const filePath = path.join('backups', file);
  const stats = fs.statSync(filePath);
  if (stats.mtimeMs < sevenDaysAgo) {
    fs.unlinkSync(filePath);
    console.log(`🗑️ 오래된 백업 삭제: ${file}`);
  }
});
```

**Cron 설정** (매일 자동 백업):
```bash
# crontab -e
0 2 * * * cd /path/to/cms_api && node backup-db.js
```

---

## ✅ 최종 체크리스트

### 데이터 무결성
- [ ] site_id 모든 영상에 존재
- [ ] owner_id 유효한 user와 매칭
- [ ] platform 제한된 값만 사용
- [ ] stats 음수 없음
- [ ] 필수 필드 (title, thumbnail_url, embed_url) 존재

### API 보안
- [x] Admin 권한 체크 (미들웨어)
- [x] Creator 본인 영상만 접근 (owner_id 검증)
- [x] Stats 수정 Admin 전용
- [ ] Stats 음수 검증 추가
- [ ] Rate Limiting 추가 (선택)

### 데이터베이스
- [x] Prepared Statements 사용
- [x] Foreign Key 설정
- [x] 인덱스 생성
- [ ] 복합 인덱스 추가 (권장)
- [ ] 정기 백업 설정

### 환경 설정
- [x] .env.production 준비
- [x] 강력한 JWT_SECRET
- [x] 강력한 ADMIN_BOOTSTRAP_KEY
- [x] CORS 운영 도메인만 포함
- [ ] NODE_ENV=production 설정

---

## 🎯 Firebase 정리 (선택)

### 현재 상태
- Firebase는 **사용하지 않음**
- 레거시 코드로만 존재 (Navbar의 onAuthStateChanged)

### 옵션 1: Firebase 완전 제거

```bash
npm uninstall firebase
```

**수정 필요한 파일**:
- `app/components/Navbar.tsx` - Firebase 코드 제거
- `lib/firebase.ts` - 파일 삭제 또는 빈 export
- `package.json` - firebase 의존성 제거

### 옵션 2: Firebase 유지 (미래 사용 가능성)

현재 상태 유지. Firebase는 설치되어 있지만 실제로 사용하지 않음.

---

## 🎉 완료!

**CMS API (SQLite) 보안 체크리스트**가 완성되었습니다!

**Firestore 대신 SQLite를 사용하므로**:
- ✅ 별도 프로젝트 분리 불필요
- ✅ Security Rules 불필요
- ✅ 파일 백업으로 충분
- ✅ 서버 사이드 권한 제어로 보호됨

**다음 단계**:
1. Stats 음수 검증 추가
2. 데이터 무결성 검증 스크립트 실행
3. 복합 인덱스 추가
4. 백업 스크립트 설정
5. 운영 배포!


