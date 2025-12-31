# Sites API 구현 완료

## ✅ 수정된 파일 및 코드 Diff

### 1. `db.js` - sites 테이블 자동 생성 및 domain 필드 추가

**변경 사항:**
- `initDB()` 함수에 sites 테이블 자동 생성 로직 추가
- `domain` 컬럼 마이그레이션 추가 (없으면 추가)
- 기본 사이트 자동 생성 (sites 테이블이 비어있을 때)

**코드 Diff (18-70줄):**

```diff
  // SQLite 초기화 (호환성을 위해 async 함수로 유지)
  export async function initDB() {
    try {
      console.log(`📂 SQLite database: ${dbPath}`);
      console.log("✅ SQLite database opened successfully");
      
+     // sites 테이블 생성 (없으면)
+     try {
+       db.exec(`
+         CREATE TABLE IF NOT EXISTS sites (
+           id TEXT PRIMARY KEY,
+           domain TEXT,
+           name TEXT NOT NULL,
+           created_at TEXT NOT NULL DEFAULT (datetime('now'))
+         )
+       `);
+       
+       // domain 컬럼이 없으면 추가 (마이그레이션)
+       try {
+         db.exec("ALTER TABLE sites ADD COLUMN domain TEXT");
+         console.log("✅ sites 테이블에 domain 컬럼 추가됨");
+       } catch (err) {
+         if (!err.message.includes("duplicate column")) {
+           throw err;
+         }
+         // 이미 존재하면 무시
+       }
+     } catch (err) {
+       console.error("❌ sites 테이블 생성 오류:", err.message);
+       throw err;
+     }
+     
      // 테이블 존재 확인
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log(`📊 Found ${tables.length} tables in database`);
+     
+     // sites 테이블이 비어있으면 기본 사이트 생성
+     const siteCount = db.prepare("SELECT COUNT(*) as count FROM sites").get();
+     if (siteCount.count === 0) {
+       const defaultSiteId = "gods";
+       const defaultSiteName = "God's Comfort Word";
+       const defaultDomain = "www.godcomfortword.com";
+       try {
+         db.prepare("INSERT INTO sites (id, domain, name, created_at) VALUES (?, ?, ?, datetime('now'))").run(
+           defaultSiteId,
+           defaultDomain,
+           defaultSiteName
+         );
+         console.log(`✅ 기본 사이트 생성: ${defaultSiteId} (${defaultSiteName})`);
+       } catch (err) {
+         // 이미 존재하면 무시
+         if (!err.message.includes("UNIQUE constraint")) {
+           console.warn("⚠️  기본 사이트 생성 실패:", err.message);
+         }
+       }
+     }
      
    } catch (error) {
      console.error("❌ SQLite initialization error:", error.message);
      throw error;
    }
  }
```

### 2. `server.js` - 공개 Sites API 추가

**변경 사항:**
1. `GET /sites` - 사이트 목록 조회 (공개 API, 인증 불필요)
2. `POST /sites` - 사이트 생성 (공개 API, 인증 불필요)
3. `GET /sites/default` - 첫 번째 사이트 반환 (공개 API, 인증 불필요)

**코드 Diff (356-430줄):**

```diff
  });

+ // 사이트 목록 조회 (공개 API)
+ app.get("/sites", async (request, reply) => {
+   const sites = db.prepare("SELECT id, domain, name, created_at FROM sites ORDER BY created_at ASC").all();
+   
+   // 최소 1개 사이트가 없으면 기본 사이트 생성
+   if (sites.length === 0) {
+     const defaultSiteId = "gods";
+     const defaultSiteName = "God's Comfort Word";
+     const defaultDomain = "www.godcomfortword.com";
+     try {
+       db.prepare("INSERT INTO sites (id, domain, name, created_at) VALUES (?, ?, ?, datetime('now'))").run(
+         defaultSiteId,
+         defaultDomain,
+         defaultSiteName
+       );
+       return [{
+         id: defaultSiteId,
+         domain: defaultDomain,
+         name: defaultSiteName,
+         created_at: new Date().toISOString(),
+       }];
+     } catch (err) {
+       // 이미 존재하면 다시 조회
+       const retrySites = db.prepare("SELECT id, domain, name, created_at FROM sites ORDER BY created_at ASC").all();
+       return retrySites;
+     }
+   }
+   
+   return sites;
+ });
+ 
+ // 기본 사이트 조회 (공개 API)
+ app.get("/sites/default", async (request, reply) => {
+   const site = db.prepare("SELECT id, domain, name, created_at FROM sites ORDER BY created_at ASC LIMIT 1").get();
+   
+   if (!site) {
+     // 사이트가 없으면 기본 사이트 생성
+     const defaultSiteId = "gods";
+     const defaultSiteName = "God's Comfort Word";
+     const defaultDomain = "www.godcomfortword.com";
+     try {
+       db.prepare("INSERT INTO sites (id, domain, name, created_at) VALUES (?, ?, ?, datetime('now'))").run(
+         defaultSiteId,
+         defaultDomain,
+         defaultSiteName
+       );
+       return {
+         id: defaultSiteId,
+         domain: defaultDomain,
+         name: defaultSiteName,
+         created_at: new Date().toISOString(),
+       };
+     } catch (err) {
+       // 이미 존재하면 다시 조회
+       const retrySite = db.prepare("SELECT id, domain, name, created_at FROM sites ORDER BY created_at ASC LIMIT 1").get();
+       return retrySite || reply.code(404).send({ error: "No sites found" });
+     }
+   }
+   
+   return site;
+ });
+ 
+ // 사이트 생성 (공개 API)
+ app.post("/sites", async (request, reply) => {
+   const { domain, name } = request.body;
+ 
+   if (!name) {
+     return reply.code(400).send({ error: "name is required" });
+   }
+ 
+   // id는 자동 생성 (domain 기반 또는 랜덤)
+   let siteId;
+   if (domain) {
+     // domain에서 사이트 ID 추출 (예: www.example.com -> example)
+     const domainParts = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split(".");
+     siteId = domainParts[0] || generateId();
+   } else {
+     // domain이 없으면 랜덤 ID 생성
+     siteId = generateId();
+   }
+ 
+   // ID 중복 확인 및 재시도
+   let existingSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(siteId);
+   let attempts = 0;
+   while (existingSite && attempts < 5) {
+     siteId = generateId();
+     existingSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(siteId);
+     attempts++;
+   }
+ 
+   if (existingSite) {
+     return reply.code(409).send({ error: "Failed to generate unique site ID. Please try again." });
+   }
+ 
+   try {
+     db.prepare("INSERT INTO sites (id, domain, name, created_at) VALUES (?, ?, ?, datetime('now'))").run(
+       siteId,
+       domain || null,
+       name
+     );
+     
+     const createdSite = db.prepare("SELECT id, domain, name, created_at FROM sites WHERE id = ?").get(siteId);
+     return createdSite;
+   } catch (err) {
+     if (err.code === "SQLITE_CONSTRAINT") {
+       return reply.code(409).send({ error: "Site ID already exists" });
+     }
+     console.error("사이트 생성 오류:", err);
+     return reply.code(500).send({ error: "Failed to create site" });
+     }
+ });
+ 
  // ==================== 인증 필요 엔드포인트 ====================
```

## 📋 API 엔드포인트 목록

### 1. 사이트 목록 조회
- **Method**: `GET`
- **URL**: `/sites`
- **인증**: 불필요 (공개 API)
- **응답**:
  ```json
  [
    {
      "id": "gods",
      "domain": "www.godcomfortword.com",
      "name": "God's Comfort Word",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
  ```
- **특징**: 사이트가 없으면 자동으로 기본 사이트 생성 후 반환

### 2. 기본 사이트 조회
- **Method**: `GET`
- **URL**: `/sites/default`
- **인증**: 불필요 (공개 API)
- **응답**:
  ```json
  {
    "id": "gods",
    "domain": "www.godcomfortword.com",
    "name": "God's Comfort Word",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
  ```
- **특징**: 첫 번째 사이트 반환, 없으면 자동 생성

### 3. 사이트 생성
- **Method**: `POST`
- **URL**: `/sites`
- **인증**: 불필요 (공개 API)
- **Request Body**:
  ```json
  {
    "domain": "www.example.com",  // 선택사항
    "name": "Example Site"         // 필수
  }
  ```
- **응답**:
  ```json
  {
    "id": "example",  // 자동 생성 (domain 기반 또는 랜덤)
    "domain": "www.example.com",
    "name": "Example Site",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
  ```
- **특징**: 
  - `id`는 자동 생성 (domain에서 추출하거나 랜덤)
  - `domain`은 선택사항
  - `name`은 필수

## ✅ 주요 특징

1. **자동 테이블 생성**: `initDB()`에서 sites 테이블이 없으면 자동 생성
2. **domain 필드 마이그레이션**: 기존 테이블에 domain 컬럼 자동 추가
3. **기본 사이트 자동 생성**: sites 테이블이 비어있으면 기본 사이트 생성
4. **공개 API**: 모든 엔드포인트는 인증 없이 접근 가능
5. **최소 1개 보장**: GET /sites는 항상 최소 1개 사이트를 반환
6. **자동 ID 생성**: POST /sites에서 domain 기반 또는 랜덤 ID 생성

## 🧪 테스트 예시

### PowerShell 테스트

```powershell
# 사이트 목록 조회
Invoke-WebRequest -Uri "http://localhost:8787/sites" -Method GET -UseBasicParsing

# 기본 사이트 조회
Invoke-WebRequest -Uri "http://localhost:8787/sites/default" -Method GET -UseBasicParsing

# 사이트 생성
$body = @{
  domain = "www.example.com"
  name = "Example Site"
} | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:8787/sites" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
```

### JavaScript/TypeScript 예시

```typescript
// 사이트 목록 조회
const sites = await fetch('http://localhost:8787/sites').then(r => r.json());
console.log(sites);

// 기본 사이트 조회
const defaultSite = await fetch('http://localhost:8787/sites/default').then(r => r.json());
console.log(defaultSite);

// 사이트 생성
const newSite = await fetch('http://localhost:8787/sites', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    domain: 'www.example.com',
    name: 'Example Site',
  }),
}).then(r => r.json());
console.log(newSite);
```

## 📝 Video 생성 API와의 연동

### 기존 동작 유지

Video 생성 API (`POST /videos`)는 기존대로 `site_id` 검증을 유지합니다:

- **Admin**: `site_id`를 body에서 받아야 함 (없으면 400 에러)
- **Creator**: 자동으로 `user.site_id` 사용 (없으면 400 에러)

### 프론트엔드 사용 예시

```typescript
// 1. 사이트 목록 조회
const sites = await fetch('http://localhost:8787/sites').then(r => r.json());

// 2. 첫 번째 사이트 ID 사용
const siteId = sites[0]?.id || (await fetch('http://localhost:8787/sites/default').then(r => r.json())).id;

// 3. Video 생성 시 site_id 사용
await fetch('http://localhost:8787/videos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    platform: 'youtube',
    source_url: 'https://www.youtube.com/watch?v=...',
    site_id: siteId,  // 필수
  }),
});
```

## ✅ 최종 확인 사항

- [x] sites 테이블 자동 생성 (id, domain, name, created_at)
- [x] domain 컬럼 마이그레이션 (기존 테이블에 자동 추가)
- [x] 기본 사이트 자동 생성 (sites 테이블이 비어있을 때)
- [x] GET /sites - 사이트 목록 조회 (공개 API)
- [x] POST /sites - 사이트 생성 (공개 API)
- [x] GET /sites/default - 기본 사이트 조회 (공개 API)
- [x] Video 생성 API의 site_id 검증 유지 (400 에러 유지)
- [x] 최소 1개 사이트 보장 (GET /sites는 항상 최소 1개 반환)

## 🔍 데이터베이스 스키마

### sites 테이블

```sql
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,           -- 사이트 ID (예: "gods", "example")
  domain TEXT,                       -- 도메인 (예: "www.godcomfortword.com")
  name TEXT NOT NULL,                -- 사이트 이름 (예: "God's Comfort Word")
  created_at TEXT NOT NULL DEFAULT (datetime('now'))  -- 생성 시간
);
```

## 📝 참고사항

1. **기존 Admin API 유지**: `/admin/sites` POST/GET 엔드포인트는 관리자 전용으로 유지됩니다.

2. **공개 API vs Admin API**:
   - 공개 API (`/sites`): 인증 불필요, 프론트엔드에서 쉽게 사용 가능
   - Admin API (`/admin/sites`): 인증 필요, 관리자 전용

3. **ID 생성 규칙**:
   - `domain`이 제공되면: `www.example.com` → `example`
   - `domain`이 없으면: 랜덤 ID 생성
   - 중복 시 최대 5회 재시도

4. **기본 사이트**: 
   - ID: `gods`
   - Domain: `www.godcomfortword.com`
   - Name: `God's Comfort Word`







































