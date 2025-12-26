# PUT /admin/creators/:id 구현 완료

## ✅ 수정된 파일 및 코드 Diff

### `server.js` - PUT /admin/creators/:id 라우트 추가

**변경 사항:**
1. `PUT /admin/creators/:id` - 크리에이터 정보 전체 업데이트 (새로 추가)
2. `GET /admin/creators` - 응답에 `email`과 `facebook_key` 필드 추가

**코드 Diff:**

#### PUT /admin/creators/:id 추가 (938-1028줄)

```diff
+ // Creator 정보 수정 (PUT - 전체 업데이트)
+ app.put(
+   "/admin/creators/:id",
+   { preHandler: [authenticate, requireAdmin] },
+   async (request, reply) => {
+     const { id } = request.params;
+     const { name, email, site_domain, site_url, facebook_key, status } = request.body;
+ 
+     // Creator 존재 확인
+     const creator = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'creator'").get(id);
+     if (!creator) {
+       return reply.code(404).send({ error: "Creator not found" });
+     }
+ 
+     // site_domain 또는 site_url로 site_id 찾기
+     let targetSiteId = creator.site_id; // 기본값은 현재 site_id
+     const domainToUse = site_domain || site_url;
+     
+     if (domainToUse) {
+       const site = db.prepare("SELECT id FROM sites WHERE domain = ? LIMIT 1").get(domainToUse);
+       if (site) {
+         targetSiteId = site.id;
+       } else {
+         return reply.code(404).send({ error: `Site not found for domain: ${domainToUse}` });
+       }
+     }
+ 
+     // users 테이블 업데이트
+     const updates = [];
+     const params = [];
+ 
+     if (name !== undefined) {
+       updates.push("name = ?");
+       params.push(name);
+     }
+ 
+     if (email !== undefined) {
+       // 이메일 중복 확인 (다른 사용자의 이메일인지 확인)
+       if (email) {
+         const existing = db.prepare("SELECT * FROM users WHERE email = ? AND id != ?").get(email, id);
+         if (existing) {
+           return reply.code(409).send({ error: "Email already exists" });
+         }
+       }
+       updates.push("email = ?");
+       params.push(email || null);
+     }
+ 
+     if (targetSiteId !== creator.site_id) {
+       // site_id 변경 확인
+       const site = db.prepare("SELECT * FROM sites WHERE id = ?").get(targetSiteId);
+       if (!site) {
+         return reply.code(404).send({ error: "Site not found" });
+       }
+       updates.push("site_id = ?");
+       params.push(targetSiteId);
+     }
+ 
+     if (status !== undefined) {
+       updates.push("status = ?");
+       params.push(status);
+     }
+ 
+     if (updates.length > 0) {
+       updates.push("updated_at = datetime('now')");
+       params.push(id);
+ 
+       const stmt = db.prepare(
+         `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
+       );
+       stmt.run(...params);
+     }
+ 
+     // Facebook 키 업데이트/저장
+     if (facebook_key !== undefined) {
+       if (facebook_key) {
+         // 기존 키 확인
+         const existingKey = db
+           .prepare(
+             "SELECT id FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
+           )
+           .get(id);
+ 
+         if (existingKey) {
+           // 업데이트
+           db.prepare(
+             "UPDATE user_provider_keys SET key_value = ?, updated_at = datetime('now') WHERE id = ?"
+           ).run(facebook_key, existingKey.id);
+         } else {
+           // 새로 생성
+           const keyId = generateId();
+           db.prepare(
+             "INSERT INTO user_provider_keys (id, user_id, provider, key_name, key_value) VALUES (?, ?, ?, ?, ?)"
+           ).run(keyId, id, "facebook", "access_token", facebook_key);
+         }
+       } else {
+         // facebook_key가 null이면 삭제
+         db.prepare(
+           "DELETE FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token'"
+         ).run(id);
+       }
+     }
+ 
+     // 업데이트된 Creator 정보 조회
+     const updatedCreator = db
+       .prepare("SELECT id, site_id, name, email, role, status, created_at FROM users WHERE id = ?")
+       .get(id);
+ 
+     // Facebook 키 정보 추가
+     const facebookKey = db
+       .prepare(
+         "SELECT key_value FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
+       )
+       .get(id);
+ 
+     return {
+       ...updatedCreator,
+       facebook_key: facebookKey?.key_value || null,
+     };
+   }
+ );
```

#### GET /admin/creators 응답 확장 (916-936줄)

```diff
  // Creator 목록 조회
  app.get(
    "/admin/creators",
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const { site_id } = request.query;
 
-     let query = "SELECT id, site_id, name, role, status, created_at FROM users WHERE role = 'creator'";
+     let query = "SELECT id, site_id, name, email, role, status, created_at FROM users WHERE role = 'creator'";
      const params = [];
 
      if (site_id) {
        query += " AND site_id = ?";
        params.push(site_id);
      }
 
      query += " ORDER BY created_at DESC";
 
      const creators = db.prepare(query).all(...params);
+     
+     // 각 크리에이터의 Facebook 키 정보 추가
+     const creatorsWithKeys = creators.map((creator) => {
+       const facebookKey = db
+         .prepare(
+           "SELECT key_value FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
+         )
+         .get(creator.id);
+       
+       return {
+         ...creator,
+         facebook_key: facebookKey?.key_value || null,
+       };
+     });
+     
-     return { creators };
+     return { creators: creatorsWithKeys };
    }
  );
```

## 📋 API 엔드포인트 목록

### 1. PUT /admin/creators/:id - 크리에이터 정보 수정 (전체 업데이트)

- **Method**: `PUT`
- **URL**: `/admin/creators/:id`
- **인증**: 필요 (Admin JWT 또는 Admin API Key)
- **Path Parameters**:
  - `id` (string, 필수): 크리에이터 ID
- **Request Body**:
  ```json
  {
    "name": "John Doe",                    // 선택사항
    "email": "john@example.com",           // 선택사항
    "site_domain": "godcomfortword.com",    // 선택사항 (site_url도 지원)
    "site_url": "godcomfortword.com",      // 선택사항 (site_domain과 동일)
    "facebook_key": "EAABwzLixnjYBO...",   // 선택사항 (null이면 삭제)
    "status": "active"                      // 선택사항 ("active" 또는 "suspended")
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

### 2. GET /admin/creators - 크리에이터 목록 조회 (확장)

- **Method**: `GET`
- **URL**: `/admin/creators?site_id=gods`
- **인증**: 필요 (Admin JWT 또는 Admin API Key)
- **Query Parameters**:
  - `site_id` (string, 선택): 사이트 ID 필터
- **응답**:
  ```json
  {
    "creators": [
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
  }
  ```

## ✅ 주요 특징

1. **PUT 메서드 지원**: 프론트엔드가 요청하는 PUT 메서드 지원
2. **site_domain/site_url 지원**: `site_domain` 또는 `site_url`로 사이트 변경 가능
3. **Facebook 키 관리**: 
   - `facebook_key` 제공 시 저장/업데이트
   - `facebook_key`가 `null`이면 삭제
   - 기존 키가 있으면 업데이트, 없으면 생성
4. **이메일 중복 확인**: 다른 사용자의 이메일과 중복되지 않도록 확인
5. **site_id 검증**: 변경하려는 site_id가 존재하는지 확인
6. **응답에 facebook_key 포함**: 업데이트된 크리에이터 정보에 Facebook 키 포함
7. **GET /admin/creators 확장**: 목록 조회 시 `email`과 `facebook_key` 필드 포함

## 🧪 테스트 예시

### PowerShell 테스트

```powershell
# 크리에이터 정보 수정
$body = @{
  name = "John Doe Updated"
  email = "john.updated@example.com"
  site_url = "godcomfortword.com"
  facebook_key = "EAABwzLixnjYBO..."
  status = "active"
} | ConvertTo-Json

$headers = @{
  "Content-Type" = "application/json"
  "Authorization" = "Bearer YOUR_ADMIN_JWT_TOKEN"
}

Invoke-WebRequest -Uri "http://localhost:8787/admin/creators/creator123abc" -Method PUT -Body $body -Headers $headers -UseBasicParsing

# Facebook 키 삭제
$body = @{
  facebook_key = $null
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8787/admin/creators/creator123abc" -Method PUT -Body $body -Headers $headers -UseBasicParsing
```

### JavaScript/TypeScript 예시

```typescript
// 크리에이터 정보 수정
const updatedCreator = await fetch('http://localhost:8787/admin/creators/creator123abc', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
    name: 'John Doe Updated',
    email: 'john.updated@example.com',
    site_url: 'godcomfortword.com',
    facebook_key: 'EAABwzLixnjYBO...',
    status: 'active',
  }),
}).then(r => r.json());

console.log(updatedCreator);
// {
//   id: "creator123abc",
//   site_id: "gods",
//   name: "John Doe Updated",
//   email: "john.updated@example.com",
//   role: "creator",
//   status: "active",
//   created_at: "2025-01-01T00:00:00.000Z",
//   facebook_key: "EAABwzLixnjYBO..."
// }

// Facebook 키 삭제
const creatorWithoutKey = await fetch('http://localhost:8787/admin/creators/creator123abc', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
    facebook_key: null,
  }),
}).then(r => r.json());

console.log(creatorWithoutKey.facebook_key); // null
```

## 📝 site_domain/site_url 처리 로직

1. **site_domain 또는 site_url 제공**: sites 테이블에서 domain으로 site_id 찾기
2. **site_id 변경**: 기존 site_id와 다르면 업데이트
3. **site_id 검증**: 변경하려는 site_id가 존재하는지 확인
4. **에러 처리**: site를 찾을 수 없으면 404 에러 반환

## 📝 Facebook 키 처리 로직

1. **facebook_key 제공 (값 있음)**:
   - 기존 키가 있으면 업데이트
   - 기존 키가 없으면 새로 생성
2. **facebook_key 제공 (null)**:
   - 기존 키 삭제
3. **facebook_key 미제공 (undefined)**:
   - 기존 키 유지 (변경 없음)

## ✅ 최종 확인 사항

- [x] PUT /admin/creators/:id - 크리에이터 정보 수정 (전체 업데이트)
- [x] name, email, site_domain/site_url, facebook_key, status 업데이트 지원
- [x] site_domain/site_url로 site_id 자동 찾기
- [x] Facebook 키 저장/업데이트/삭제
- [x] 이메일 중복 확인
- [x] site_id 검증
- [x] 응답에 facebook_key 포함
- [x] GET /admin/creators 응답에 email과 facebook_key 포함
- [x] 관리자 인증 (authenticate, requireAdmin) 적용

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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
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

1. **PUT vs PATCH**:
   - PUT: 전체 업데이트 (모든 필드 선택적 업데이트 가능)
   - PATCH: 부분 업데이트 (status, name만 지원, 기존 유지)

2. **site_domain vs site_url**:
   - 둘 다 동일하게 처리 (site_domain 우선, 없으면 site_url 사용)
   - sites 테이블의 `domain` 컬럼과 매칭

3. **Facebook 키 관리**:
   - `user_provider_keys` 테이블에 저장
   - `provider`: `"facebook"`
   - `key_name`: `"access_token"`
   - `key_value`: Facebook Access Token (평문 저장)

4. **이메일 중복 확인**:
   - 다른 사용자의 이메일과 중복되지 않도록 확인
   - 같은 크리에이터의 이메일 변경은 허용

5. **프론트엔드 호환성**:
   - 프론트엔드가 `site_url`로 보내도 `site_domain`으로 처리
   - 프론트엔드가 PUT 메서드로 호출 가능

관리자 CMS에서 크리에이터 정보 수정이 정상 동작합니다.



































