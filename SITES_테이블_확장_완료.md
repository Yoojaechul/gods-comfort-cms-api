# Sites 테이블 확장 및 기본 사이트 Seed 완료

## ✅ 수정된 파일 및 코드 Diff

### 1. `db.js` - sites 테이블 확장 및 기본 사이트 Seed

**변경 사항:**
- sites 테이블에 `homepage_url`, `api_base`, `facebook_key` 컬럼 추가
- 기본 사이트 생성 시 모든 필드 포함 (seed)
- domain을 "godcomfortword.com"으로 변경 (www 제거)

**코드 Diff (24-73줄):**

```diff
  // sites 테이블 생성 (없으면)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        domain TEXT,
        name TEXT NOT NULL,
+       homepage_url TEXT,
+       api_base TEXT,
+       facebook_key TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
-     // domain 컬럼이 없으면 추가 (마이그레이션)
+     // 기존 테이블에 새 컬럼 추가 (마이그레이션)
+     const columnsToAdd = [
+       { name: "domain", type: "TEXT" },
+       { name: "homepage_url", type: "TEXT" },
+       { name: "api_base", type: "TEXT" },
+       { name: "facebook_key", type: "TEXT" },
+     ];
+     
+     for (const column of columnsToAdd) {
        try {
-         db.exec("ALTER TABLE sites ADD COLUMN domain TEXT");
-         console.log("✅ sites 테이블에 domain 컬럼 추가됨");
+         db.exec(`ALTER TABLE sites ADD COLUMN ${column.name} ${column.type}`);
+         console.log(`✅ sites 테이블에 ${column.name} 컬럼 추가됨`);
        } catch (err) {
          if (!err.message.includes("duplicate column")) {
            throw err;
          }
          // 이미 존재하면 무시
        }
      }
    } catch (err) {
      console.error("❌ sites 테이블 생성 오류:", err.message);
      throw err;
    }
    
    // sites 테이블이 비어있으면 기본 사이트 생성 (seed)
    const siteCount = db.prepare("SELECT COUNT(*) as count FROM sites").get();
    if (siteCount.count === 0) {
      const defaultSiteId = "gods";
      const defaultSiteName = "God's Comfort Word";
-     const defaultDomain = "www.godcomfortword.com";
+     const defaultDomain = "godcomfortword.com";
+     const defaultHomepageUrl = "https://www.godscomfortword.com";
+     const defaultApiBase = "http://localhost:8787";
+     const defaultFacebookKey = null;
      
      try {
-       db.prepare("INSERT INTO sites (id, domain, name, created_at) VALUES (?, ?, ?, datetime('now'))").run(
+       db.prepare(
+         "INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
+       ).run(
          defaultSiteId,
          defaultDomain,
          defaultSiteName,
+         defaultHomepageUrl,
+         defaultApiBase,
          defaultFacebookKey
        );
-       console.log(`✅ 기본 사이트 생성: ${defaultSiteId} (${defaultSiteName})`);
+       console.log(`✅ 기본 사이트 생성 (seed): ${defaultSiteId} (${defaultSiteName})`);
+       console.log(`   Domain: ${defaultDomain}`);
+       console.log(`   Homepage: ${defaultHomepageUrl}`);
      } catch (err) {
        // 이미 존재하면 무시
        if (!err.message.includes("UNIQUE constraint")) {
          console.warn("⚠️  기본 사이트 생성 실패:", err.message);
        }
      }
    }
```

### 2. `server.js` - Sites API 응답 확장

**변경 사항:**
1. `GET /sites` - 모든 필드 포함 응답
2. `GET /sites/default` - 모든 필드 포함 응답
3. `POST /sites` - 새 필드 받아서 저장

**코드 Diff:**

#### GET /sites (356-397줄)

```diff
  // 사이트 목록 조회 (공개 API)
  app.get("/sites", async (request, reply) => {
-   const sites = db.prepare("SELECT id, domain, name, created_at FROM sites ORDER BY created_at ASC").all();
+   const sites = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites ORDER BY created_at ASC").all();
    
    // 최소 1개 사이트가 없으면 기본 사이트 생성
    if (sites.length === 0) {
      const defaultSiteId = "gods";
      const defaultSiteName = "God's Comfort Word";
-     const defaultDomain = "www.godcomfortword.com";
+     const defaultDomain = "godcomfortword.com";
+     const defaultHomepageUrl = "https://www.godscomfortword.com";
+     const defaultApiBase = "http://localhost:8787";
+     const defaultFacebookKey = null;
      
      try {
-       db.prepare("INSERT INTO sites (id, domain, name, created_at) VALUES (?, ?, ?, datetime('now'))").run(
+       db.prepare(
+         "INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
+       ).run(
          defaultSiteId,
          defaultDomain,
          defaultSiteName,
+         defaultHomepageUrl,
+         defaultApiBase,
          defaultFacebookKey
        );
        return [{
          id: defaultSiteId,
          domain: defaultDomain,
          name: defaultSiteName,
+         homepage_url: defaultHomepageUrl,
+         api_base: defaultApiBase,
+         facebook_key: defaultFacebookKey,
          created_at: new Date().toISOString(),
        }];
      } catch (err) {
        // 이미 존재하면 다시 조회
-       const retrySites = db.prepare("SELECT id, domain, name, created_at FROM sites ORDER BY created_at ASC").all();
+       const retrySites = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites ORDER BY created_at ASC").all();
        return retrySites;
      }
    }
    
    return sites;
  });
```

#### GET /sites/default (399-440줄)

```diff
  // 기본 사이트 조회 (공개 API)
  app.get("/sites/default", async (request, reply) => {
-   const site = db.prepare("SELECT id, domain, name, created_at FROM sites ORDER BY created_at ASC LIMIT 1").get();
+   const site = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites ORDER BY created_at ASC LIMIT 1").get();
    
    if (!site) {
      // 사이트가 없으면 기본 사이트 생성
      const defaultSiteId = "gods";
      const defaultSiteName = "God's Comfort Word";
-     const defaultDomain = "www.godcomfortword.com";
+     const defaultDomain = "godcomfortword.com";
+     const defaultHomepageUrl = "https://www.godscomfortword.com";
+     const defaultApiBase = "http://localhost:8787";
+     const defaultFacebookKey = null;
      
      try {
-       db.prepare("INSERT INTO sites (id, domain, name, created_at) VALUES (?, ?, ?, datetime('now'))").run(
+       db.prepare(
+         "INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
+       ).run(
          defaultSiteId,
          defaultDomain,
          defaultSiteName,
+         defaultHomepageUrl,
+         defaultApiBase,
          defaultFacebookKey
        );
        return {
          id: defaultSiteId,
          domain: defaultDomain,
          name: defaultSiteName,
+         homepage_url: defaultHomepageUrl,
+         api_base: defaultApiBase,
+         facebook_key: defaultFacebookKey,
          created_at: new Date().toISOString(),
        };
      } catch (err) {
        // 이미 존재하면 다시 조회
-       const retrySite = db.prepare("SELECT id, domain, name, created_at FROM sites ORDER BY created_at ASC LIMIT 1").get();
+       const retrySite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites ORDER BY created_at ASC LIMIT 1").get();
        return retrySite || reply.code(404).send({ error: "No sites found" });
      }
    }
    
    return site;
  });
```

#### POST /sites (442-485줄)

```diff
  // 사이트 생성 (공개 API)
  app.post("/sites", async (request, reply) => {
-   const { domain, name } = request.body;
+   const { domain, name, homepage_url, api_base, facebook_key } = request.body;
 
    if (!name) {
      return reply.code(400).send({ error: "name is required" });
    }

    // ... (id 생성 로직 동일) ...

    try {
-     db.prepare("INSERT INTO sites (id, domain, name, created_at) VALUES (?, ?, ?, datetime('now'))").run(
+     db.prepare(
+       "INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
+     ).run(
        siteId,
        domain || null,
        name,
+       homepage_url || null,
+       api_base || null,
+       facebook_key || null
      );
      
-     const createdSite = db.prepare("SELECT id, domain, name, created_at FROM sites WHERE id = ?").get(siteId);
+     const createdSite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(siteId);
      return createdSite;
    } catch (err) {
      // ... (에러 처리 동일) ...
    }
  });
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
      "domain": "godcomfortword.com",
      "name": "God's Comfort Word",
      "homepage_url": "https://www.godscomfortword.com",
      "api_base": "http://localhost:8787",
      "facebook_key": null,
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ]
  ```

### 2. 기본 사이트 조회
- **Method**: `GET`
- **URL**: `/sites/default`
- **인증**: 불필요 (공개 API)
- **응답**:
  ```json
  {
    "id": "gods",
    "domain": "godcomfortword.com",
    "name": "God's Comfort Word",
    "homepage_url": "https://www.godscomfortword.com",
    "api_base": "http://localhost:8787",
    "facebook_key": null,
    "created_at": "2025-01-01T00:00:00.000Z"
  }
  ```

### 3. 사이트 생성
- **Method**: `POST`
- **URL**: `/sites`
- **인증**: 불필요 (공개 API)
- **Request Body**:
  ```json
  {
    "name": "Example Site",                    // 필수
    "domain": "example.com",                   // 선택사항
    "homepage_url": "https://www.example.com", // 선택사항
    "api_base": "http://localhost:8787",       // 선택사항
    "facebook_key": "EAABwzLixnjYBO..."        // 선택사항
  }
  ```
- **응답**:
  ```json
  {
    "id": "example",
    "domain": "example.com",
    "name": "Example Site",
    "homepage_url": "https://www.example.com",
    "api_base": "http://localhost:8787",
    "facebook_key": "EAABwzLixnjYBO...",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
  ```

## ✅ 주요 특징

1. **자동 테이블 확장**: 기존 sites 테이블에 `homepage_url`, `api_base`, `facebook_key` 컬럼 자동 추가
2. **기본 사이트 Seed**: 서버 시작 시 sites 테이블이 비어있으면 자동으로 기본 사이트 생성
3. **기본 사이트 정보**:
   - `id`: `"gods"`
   - `name`: `"God's Comfort Word"`
   - `domain`: `"godcomfortword.com"` (www 제거)
   - `homepage_url`: `"https://www.godscomfortword.com"`
   - `api_base`: `"http://localhost:8787"`
   - `facebook_key`: `null`
4. **공개 API**: 모든 엔드포인트는 인증 없이 접근 가능
5. **최소 1개 보장**: GET /sites는 항상 최소 1개 사이트를 반환

## 🧪 테스트 예시

### PowerShell 테스트

```powershell
# 사이트 목록 조회
Invoke-WebRequest -Uri "http://localhost:8787/sites" -Method GET -UseBasicParsing

# 기본 사이트 조회
Invoke-WebRequest -Uri "http://localhost:8787/sites/default" -Method GET -UseBasicParsing

# 사이트 생성
$body = @{
  name = "Example Site"
  domain = "example.com"
  homepage_url = "https://www.example.com"
  api_base = "http://localhost:8787"
  facebook_key = "EAABwzLixnjYBO..."
} | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:8787/sites" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
```

### JavaScript/TypeScript 예시

```typescript
// 사이트 목록 조회
const sites = await fetch('http://localhost:8787/sites').then(r => r.json());
console.log(sites);
// 첫 번째 사이트의 site_id 사용
const siteId = sites[0]?.id;

// 기본 사이트 조회
const defaultSite = await fetch('http://localhost:8787/sites/default').then(r => r.json());
console.log(defaultSite);
const siteId = defaultSite.id;

// 사이트 생성
const newSite = await fetch('http://localhost:8787/sites', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Example Site',
    domain: 'example.com',
    homepage_url: 'https://www.example.com',
    api_base: 'http://localhost:8787',
    facebook_key: 'EAABwzLixnjYBO...',
  }),
}).then(r => r.json());
console.log(newSite);
```

## 📝 CMS Settings에서 사용 예시

```typescript
// 1. 사이트 목록 조회
const sites = await fetch('http://localhost:8787/sites').then(r => r.json());

// 2. 첫 번째 사이트의 site_id 사용
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

- [x] sites 테이블에 `homepage_url`, `api_base`, `facebook_key` 컬럼 추가
- [x] 서버 시작 시 기본 사이트 자동 생성 (seed)
- [x] 기본 사이트 정보:
  - `name`: "God's Comfort Word"
  - `domain`: "godcomfortword.com"
  - `homepage_url`: "https://www.godscomfortword.com"
- [x] GET /sites - 모든 필드 포함 응답
- [x] POST /sites - 새 필드 받아서 저장
- [x] GET /sites/default - 모든 필드 포함 응답
- [x] 프론트엔드가 `/sites`로 호출하면 `site_id`를 받을 수 있음

## 🔍 데이터베이스 스키마

### sites 테이블

```sql
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,                    -- 사이트 ID (예: "gods")
  domain TEXT,                            -- 도메인 (예: "godcomfortword.com")
  name TEXT NOT NULL,                     -- 사이트 이름 (예: "God's Comfort Word")
  homepage_url TEXT,                      -- 홈페이지 URL (예: "https://www.godscomfortword.com")
  api_base TEXT,                          -- API 베이스 URL (예: "http://localhost:8787")
  facebook_key TEXT,                      -- Facebook 키 (선택사항)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))  -- 생성 시간
);
```

## 📝 기본 사이트 Seed 정보

서버 시작 시 자동 생성되는 기본 사이트:

- **ID**: `gods`
- **Name**: `God's Comfort Word`
- **Domain**: `godcomfortword.com`
- **Homepage URL**: `https://www.godscomfortword.com`
- **API Base**: `http://localhost:8787`
- **Facebook Key**: `null` (기본값)

## 📝 참고사항

1. **마이그레이션**: 기존 sites 테이블에 새 컬럼이 자동으로 추가됩니다.

2. **기본 사이트 보장**: 
   - 서버 시작 시 sites 테이블이 비어있으면 자동 생성
   - GET /sites 호출 시 사이트가 없으면 자동 생성

3. **프론트엔드 사용**:
   ```typescript
   // 사이트 목록 조회
   const sites = await fetch('http://localhost:8787/sites').then(r => r.json());
   const siteId = sites[0]?.id; // site_id 사용
   ```

4. **Video 생성 연동**: Video 생성 API는 여전히 `site_id`를 필수로 요구하며, `/sites` API로 `site_id`를 얻을 수 있습니다.






































