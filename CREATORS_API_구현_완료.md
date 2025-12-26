# Creators API 구현 완료

## ✅ 수정된 파일 및 코드 Diff

### `server.js` - 공개 Creators API 추가

**변경 사항:**
1. `GET /creators` - 크리에이터 목록 조회 (공개 API, 인증 불필요)
2. `POST /creators` - 크리에이터 생성 (공개 API, 인증 불필요)
3. `site_domain`으로 `site_id` 자동 찾기
4. `facebook_key` 자동 저장 (`user_provider_keys` 테이블)
5. 기본 사이트 자동 사용 (site_id가 없을 때)

**코드 Diff (468-567줄):**

```diff
  });

+ // 크리에이터 목록 조회 (공개 API)
+ app.get("/creators", async (request, reply) => {
+   const { site_id } = request.query;
+ 
+   let query = "SELECT id, site_id, name, email, role, status, created_at FROM users WHERE role = 'creator'";
+   const params = [];
+ 
+   if (site_id) {
+     query += " AND site_id = ?";
+     params.push(site_id);
+   }
+ 
+   query += " ORDER BY created_at DESC";
+ 
+   const creators = db.prepare(query).all(...params);
+   
+   // 각 크리에이터의 Facebook 키 정보 추가
+   const creatorsWithKeys = creators.map((creator) => {
+     const facebookKey = db
+       .prepare(
+         "SELECT key_value FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
+       )
+       .get(creator.id);
+     
+     return {
+       ...creator,
+       facebook_key: facebookKey?.key_value || null,
+     };
+   });
+ 
+   return creatorsWithKeys;
+ });
+ 
+ // 크리에이터 생성 (공개 API)
+ app.post("/creators", async (request, reply) => {
+   const { name, email, site_domain, facebook_key, site_id } = request.body;
+ 
+   if (!name) {
+     return reply.code(400).send({ error: "name is required" });
+   }
+ 
+   // site_id 결정: 직접 제공되거나 site_domain으로 찾거나 기본 사이트 사용
+   let targetSiteId = site_id;
+   
+   if (!targetSiteId) {
+     if (site_domain) {
+       // site_domain으로 site 찾기
+       const site = db.prepare("SELECT id FROM sites WHERE domain = ? LIMIT 1").get(site_domain);
+       if (site) {
+         targetSiteId = site.id;
+       }
+     }
+     
+     // 여전히 없으면 기본 사이트 사용
+     if (!targetSiteId) {
+       const defaultSite = db.prepare("SELECT id FROM sites ORDER BY created_at ASC LIMIT 1").get();
+       if (defaultSite) {
+         targetSiteId = defaultSite.id;
+       } else {
+         // 기본 사이트도 없으면 생성
+         const defaultSiteId = "gods";
+         const defaultSiteName = "God's Comfort Word";
+         const defaultDomain = "www.godcomfortword.com";
+         try {
+           db.prepare("INSERT INTO sites (id, domain, name, created_at) VALUES (?, ?, ?, datetime('now'))").run(
+             defaultSiteId,
+             defaultDomain,
+             defaultSiteName
+           );
+           targetSiteId = defaultSiteId;
+         } catch (err) {
+           // 이미 존재하면 조회
+           const retrySite = db.prepare("SELECT id FROM sites WHERE id = ?").get(defaultSiteId);
+           targetSiteId = retrySite?.id || defaultSiteId;
+         }
+       }
+     }
+   }
+ 
+   // site_id 존재 확인
+   const site = db.prepare("SELECT * FROM sites WHERE id = ?").get(targetSiteId);
+   if (!site) {
+     return reply.code(404).send({ error: "Site not found" });
+   }
+ 
+   // 이메일 중복 확인
+   if (email) {
+     const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
+     if (existing) {
+       return reply.code(409).send({ error: "Email already exists" });
+     }
+   }
+ 
+   // 크리에이터 생성
+   const creatorId = generateId();
+   const apiKey = generateApiKey();
+   const { hash: apiKeyHash, salt: apiKeySalt } = hashApiKey(apiKey);
+ 
+   db.prepare(
+     "INSERT INTO users (id, site_id, name, email, role, status, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
+   ).run(creatorId, targetSiteId, name, email || null, "creator", "active", apiKeyHash, apiKeySalt);
+ 
+   // Facebook 키 저장 (제공된 경우)
+   if (facebook_key) {
+     const keyId = generateId();
+     try {
+       db.prepare(
+         "INSERT INTO user_provider_keys (id, user_id, provider, key_name, key_value) VALUES (?, ?, ?, ?, ?)"
+       ).run(keyId, creatorId, "facebook", "access_token", facebook_key);
+     } catch (err) {
+       console.warn("Facebook 키 저장 실패:", err.message);
+       // 키 저장 실패해도 크리에이터는 생성됨
+     }
+   }
+ 
+   // 생성된 크리에이터 정보 조회
+   const creator = db.prepare("SELECT id, site_id, name, email, role, status, created_at FROM users WHERE id = ?").get(creatorId);
+   
+   // Facebook 키 정보 추가
+   const facebookKey = db
+     .prepare(
+       "SELECT key_value FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
+     )
+     .get(creatorId);
+ 
+   return {
+     ...creator,
+     facebook_key: facebookKey?.key_value || null,
+   };
+ });
+ 
  // ==================== 인증 필요 엔드포인트 ====================
```

## 📋 API 엔드포인트 목록

### 1. 크리에이터 목록 조회
- **Method**: `GET`
- **URL**: `/creators`
- **인증**: 불필요 (공개 API)
- **Query Parameters**:
  - `site_id` (string, 선택): 사이트 ID 필터
- **응답**:
  ```json
  [
    {
      "id": "creator123abc",
      "site_id": "gods",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "creator",
      "status": "active",
      "created_at": "2025-01-01T00:00:00.000Z",
      "facebook_key": "EAABwzLixnjYBO..." // 또는 null
    }
  ]
  ```
- **특징**: 
  - 각 크리에이터의 Facebook 키 정보 포함
  - `site_id`로 필터링 가능

### 2. 크리에이터 생성
- **Method**: `POST`
- **URL**: `/creators`
- **인증**: 불필요 (공개 API)
- **Request Body**:
  ```json
  {
    "name": "John Doe",                    // 필수
    "email": "john@example.com",           // 선택사항
    "site_domain": "www.godcomfortword.com", // 선택사항 (site_id가 없을 때 사용)
    "facebook_key": "EAABwzLixnjYBO...",    // 선택사항
    "site_id": "gods"                       // 선택사항 (우선순위 높음)
  }
  ```
- **응답**:
  ```json
  {
    "id": "creator123abc",
    "site_id": "gods",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "creator",
    "status": "active",
    "created_at": "2025-01-01T00:00:00.000Z",
    "facebook_key": "EAABwzLixnjYBO..." // 또는 null
  }
  ```
- **site_id 결정 로직**:
  1. `site_id`가 제공되면 사용
  2. 없으면 `site_domain`으로 sites 테이블에서 찾기
  3. 여전히 없으면 기본 사이트 (첫 번째 사이트) 사용
  4. 기본 사이트도 없으면 자동 생성 (`gods`)

## ✅ 주요 특징

1. **공개 API**: 모든 엔드포인트는 인증 없이 접근 가능
2. **자동 site_id 처리**: `site_id`가 없어도 `site_domain`으로 찾거나 기본 사이트 사용
3. **Facebook 키 자동 저장**: `facebook_key`가 제공되면 `user_provider_keys` 테이블에 자동 저장
4. **Facebook 키 포함 응답**: GET/POST 응답에 `facebook_key` 필드 포함
5. **기본 사이트 보장**: sites 테이블이 비어있으면 자동으로 기본 사이트 생성

## 🧪 테스트 예시

### PowerShell 테스트

```powershell
# 크리에이터 목록 조회
Invoke-WebRequest -Uri "http://localhost:8787/creators" -Method GET -UseBasicParsing

# site_id로 필터링
Invoke-WebRequest -Uri "http://localhost:8787/creators?site_id=gods" -Method GET -UseBasicParsing

# 크리에이터 생성 (site_id 직접 제공)
$body = @{
  name = "John Doe"
  email = "john@example.com"
  site_id = "gods"
  facebook_key = "EAABwzLixnjYBO..."
} | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:8787/creators" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing

# 크리에이터 생성 (site_domain 사용)
$body = @{
  name = "Jane Doe"
  email = "jane@example.com"
  site_domain = "www.godcomfortword.com"
  facebook_key = "EAABwzLixnjYBO..."
} | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:8787/creators" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
```

### JavaScript/TypeScript 예시

```typescript
// 크리에이터 목록 조회
const creators = await fetch('http://localhost:8787/creators').then(r => r.json());
console.log(creators);

// site_id로 필터링
const creatorsBySite = await fetch('http://localhost:8787/creators?site_id=gods').then(r => r.json());
console.log(creatorsBySite);

// 크리에이터 생성 (site_id 직접 제공)
const newCreator = await fetch('http://localhost:8787/creators', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    site_id: 'gods',
    facebook_key: 'EAABwzLixnjYBO...',
  }),
}).then(r => r.json());
console.log(newCreator);

// 크리에이터 생성 (site_domain 사용)
const newCreator2 = await fetch('http://localhost:8787/creators', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Jane Doe',
    email: 'jane@example.com',
    site_domain: 'www.godcomfortword.com',
    facebook_key: 'EAABwzLixnjYBO...',
  }),
}).then(r => r.json());
console.log(newCreator2);
```

## 📝 site_id 결정 로직

### 우선순위

1. **직접 제공**: `site_id`가 body에 제공되면 사용
2. **site_domain으로 찾기**: `site_domain`이 제공되면 sites 테이블에서 찾기
3. **기본 사이트 사용**: sites 테이블의 첫 번째 사이트 사용
4. **기본 사이트 생성**: sites 테이블이 비어있으면 자동 생성 (`gods`)

### 예시

```javascript
// Case 1: site_id 직접 제공
POST /creators
{ "name": "John", "site_id": "gods" }
→ site_id: "gods" 사용

// Case 2: site_domain으로 찾기
POST /creators
{ "name": "John", "site_domain": "www.godcomfortword.com" }
→ sites 테이블에서 domain으로 찾아서 site_id 사용

// Case 3: 기본 사이트 사용
POST /creators
{ "name": "John" }
→ sites 테이블의 첫 번째 사이트 사용

// Case 4: 기본 사이트 생성
POST /creators
{ "name": "John" }
→ sites 테이블이 비어있으면 "gods" 사이트 자동 생성 후 사용
```

## ✅ 최종 확인 사항

- [x] GET /creators - 크리에이터 목록 조회 (공개 API)
- [x] POST /creators - 크리에이터 생성 (공개 API)
- [x] site_id 자동 처리 (site_domain 또는 기본 사이트 사용)
- [x] facebook_key 자동 저장 (user_provider_keys 테이블)
- [x] Facebook 키 포함 응답 (GET/POST 모두)
- [x] 기본 사이트 자동 생성 (sites 테이블이 비어있을 때)
- [x] 이메일 중복 확인
- [x] site_id FK 검증

## 🔍 데이터베이스 스키마

### users 테이블 (크리에이터)
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  site_id TEXT,                    -- FK to sites.id
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,               -- 'creator'
  status TEXT NOT NULL,             -- 'active', 'suspended'
  api_key_hash TEXT,
  api_key_salt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### user_provider_keys 테이블 (Facebook 키)
```sql
CREATE TABLE user_provider_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,            -- FK to users.id
  provider TEXT NOT NULL,            -- 'facebook'
  key_name TEXT NOT NULL,           -- 'access_token'
  key_value TEXT NOT NULL,          -- Facebook Access Token
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 📝 참고사항

1. **기존 Admin API 유지**: `/admin/creators` POST/GET 엔드포인트는 관리자 전용으로 유지됩니다.

2. **공개 API vs Admin API**:
   - 공개 API (`/creators`): 인증 불필요, 프론트엔드에서 쉽게 사용 가능
   - Admin API (`/admin/creators`): 인증 필요, 관리자 전용

3. **Facebook 키 저장**:
   - `provider`: `"facebook"`
   - `key_name`: `"access_token"`
   - `key_value`: Facebook Access Token (평문 저장)

4. **site_id 필수**: 크리에이터는 반드시 `site_id`를 가져야 하므로, 제공되지 않으면 자동으로 기본 사이트를 사용합니다.

5. **이메일 중복**: 같은 이메일로 중복 생성 시 409 에러 반환




































