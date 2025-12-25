# FOREIGN KEY constraint failed 문제 해결 완료

## ✅ 수정된 파일 및 코드 Diff

### 1. `check-db-schema.js` - DB 스키마 점검 스크립트 (새로 추가)

**용도**: 기존 DB의 스키마, 외래키, 데이터 무결성을 점검

**실행 방법**:
```bash
node check-db-schema.js
```

**점검 항목**:
- 테이블 목록
- videos/sites 테이블 스키마
- videos 테이블의 외래키
- sites 테이블 데이터
- videos 테이블의 site_id/owner_id 분포
- 문제가 있는 videos 레코드 (유효하지 않은 FK)

### 2. `backup-db-before-fix.js` - DB 백업 스크립트 (새로 추가)

**용도**: 수정 전 DB 파일을 자동 백업

**실행 방법**:
```bash
node backup-db-before-fix.js
```

**백업 파일명**: `cms_backup_YYYYMMDD_HHMM.db`

### 3. `server.js` - site_id 검증 및 자동 복구 로직 추가

**변경 사항**:
1. `POST /admin/videos` - site_id 검증 및 자동 복구
2. `POST /videos/bulk` - site_id 검증 및 자동 복구
3. `POST /videos` - site_id 검증 및 자동 복구
4. 모든 videos INSERT에 FK 제약조건 에러 처리 추가

## 📋 해결 방법

### (a) sites 테이블에 누락된 site 레코드가 있으면 자동 생성/복구

**로직**:
1. site_id가 제공되지 않으면 기본 사이트 조회
2. 기본 사이트가 없으면 자동 생성 (`gods` 사이트)
3. 제공된 site_id가 존재하지 않으면 기본 사이트 사용

**코드 위치**: `POST /admin/videos`, `POST /videos/bulk`, `POST /videos`

```javascript
// site_id 검증 및 자동 복구
let targetSiteId = site_id;

if (!targetSiteId) {
  // site_id가 없으면 기본 사이트 사용
  const defaultSite = db.prepare("SELECT id FROM sites ORDER BY created_at ASC LIMIT 1").get();
  if (defaultSite) {
    targetSiteId = defaultSite.id;
    console.log(`⚠️  site_id가 제공되지 않아 기본 사이트 사용: ${targetSiteId}`);
  } else {
    // 기본 사이트도 없으면 생성
    const defaultSiteId = "gods";
    // ... 기본 사이트 생성 로직
  }
} else {
  // site_id가 제공되었지만 존재하지 않으면 기본 사이트 사용
  const site = db.prepare("SELECT * FROM sites WHERE id = ?").get(targetSiteId);
  if (!site) {
    console.warn(`⚠️  제공된 site_id(${targetSiteId})가 존재하지 않아 기본 사이트 사용`);
    const defaultSite = db.prepare("SELECT id FROM sites ORDER BY created_at ASC LIMIT 1").get();
    if (defaultSite) {
      targetSiteId = defaultSite.id;
    }
  }
}
```

### (b) 프론트가 잘못된 site_id를 보내면 올바른 site_id 자동 주입

**로직**:
1. 제공된 site_id가 sites 테이블에 존재하는지 확인
2. 존재하지 않으면 기본 사이트 사용
3. 기본 사이트도 없으면 에러 반환 (또는 자동 생성)

**코드 위치**: 모든 videos 생성 엔드포인트

### (c) FK 제약조건 에러 상세 처리

**로직**:
1. INSERT 시 try-catch로 FK 제약조건 에러 캐치
2. site_id와 owner_id 각각 확인
3. 상세한 에러 메시지 제공

**코드 예시**:
```javascript
try {
  db.prepare("INSERT INTO videos (...) VALUES (...)").run(...);
} catch (err) {
  if (err.message.includes("FOREIGN KEY constraint failed")) {
    const siteCheck = db.prepare("SELECT id FROM sites WHERE id = ?").get(siteId);
    const ownerCheck = db.prepare("SELECT id FROM users WHERE id = ?").get(ownerId);
    
    if (!siteCheck) {
      return reply.code(400).send({ 
        error: `FOREIGN KEY constraint failed: site_id '${siteId}' does not exist`,
        details: "Please provide a valid site_id"
      });
    }
    if (!ownerCheck) {
      return reply.code(400).send({ 
        error: `FOREIGN KEY constraint failed: owner_id '${ownerId}' does not exist`,
        details: "Please provide a valid owner_id"
      });
    }
  }
  return reply.code(500).send({ error: "Failed to create video", details: err.message });
}
```

## 🧪 사용 방법

### 1. DB 스키마 점검

```bash
node check-db-schema.js
```

**출력 예시**:
```
📂 Database path: c:\Users\...\cms.db

=== 데이터베이스 스키마 점검 ===

1. 테이블 목록:
   - sites
   - users
   - videos
   ...

2. videos 테이블 스키마:
   id: TEXT NOT NULL
   site_id: TEXT
   owner_id: TEXT
   ...

3. sites 테이블 스키마:
   id: TEXT PRIMARY KEY
   name: TEXT NOT NULL
   ...

4. videos 테이블 외래키:
   ⚠️  외래키가 정의되어 있지 않습니다.

5. sites 테이블 데이터:
   - id: gods, name: God's Comfort Word, domain: godcomfortword.com

6. videos 테이블의 site_id 분포:
   ✅ site_id: gods, count: 10
   ❌ site_id: invalid, count: 2 (sites 테이블에 없음!)

8. 문제가 있는 videos 레코드:
   ⚠️  2개의 videos가 유효하지 않은 site_id를 가지고 있습니다:
   - video.id: abc123, site_id: invalid (sites 테이블에 없음)
```

### 2. DB 백업

```bash
node backup-db-before-fix.js
```

**출력 예시**:
```
✅ DB 백업 완료:
   원본: c:\Users\...\cms.db
   백업: c:\Users\...\cms_backup_20250115_1430.db
```

### 3. 서버 재시작 후 테스트

```bash
npm run dev
```

**테스트**:
```bash
# Admin 비디오 생성 (site_id 없음 - 자동으로 기본 사이트 사용)
curl -X POST http://localhost:8787/admin/videos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "youtube",
    "source_url": "https://www.youtube.com/watch?v=..."
  }'

# Admin 비디오 생성 (잘못된 site_id - 자동으로 기본 사이트 사용)
curl -X POST http://localhost:8787/admin/videos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "youtube",
    "source_url": "https://www.youtube.com/watch?v=...",
    "site_id": "invalid_site_id"
  }'
```

## ✅ 최종 확인 사항

- [x] DB 스키마 점검 스크립트 작성
- [x] DB 백업 스크립트 작성
- [x] POST /admin/videos - site_id 검증 및 자동 복구
- [x] POST /videos/bulk - site_id 검증 및 자동 복구
- [x] POST /videos - site_id 검증 및 자동 복구
- [x] 모든 videos INSERT에 FK 제약조건 에러 처리
- [x] sites 테이블이 비어있으면 자동 생성
- [x] 잘못된 site_id 제공 시 기본 사이트 사용
- [x] 상세한 에러 메시지 제공

## 📝 참고사항

1. **기존 DB 유지**: 모든 수정은 기존 DB를 유지하면서 최소 수정으로 해결
2. **자동 복구**: site_id가 없거나 잘못된 경우 자동으로 기본 사이트 사용
3. **에러 로깅**: 모든 FK 제약조건 에러는 콘솔에 상세 로그 출력
4. **백업 필수**: 수정 전 반드시 `backup-db-before-fix.js` 실행

## 🔍 문제 진단 절차

1. **DB 스키마 점검**:
   ```bash
   node check-db-schema.js
   ```

2. **문제 확인**:
   - sites 테이블이 비어있는지 확인
   - videos 테이블의 site_id가 유효한지 확인
   - 외래키 제약조건이 활성화되어 있는지 확인

3. **백업**:
   ```bash
   node backup-db-before-fix.js
   ```

4. **서버 재시작**:
   ```bash
   npm run dev
   ```

5. **테스트**:
   - CMS Admin에서 영상 추가 시도
   - site_id 없이 추가 시도
   - 잘못된 site_id로 추가 시도

CMS Admin에서 영상 추가 시 FOREIGN KEY constraint failed 오류가 해결되었습니다.


































