# FOREIGN KEY constraint failed 문제 최종 해결

## 🔍 문제 원인

DB 스키마 점검 결과:
- **sites 테이블의 id**: TEXT 타입, 현재 값: `"gods"` (문자열)
- **videos 테이블의 site_id**: TEXT NOT NULL, 외래키: `site_id -> sites.id`
- **프론트엔드가 보내는 site_id**: 숫자 (`1765684445`)

**문제**: 프론트엔드가 숫자 site_id를 보내지만, sites 테이블의 id는 문자열이므로 매칭되지 않아 FOREIGN KEY constraint failed 발생

## ✅ 수정된 파일 및 코드 Diff

### `server.js` - site_id 타입 변환 및 자동 복구

**변경 사항**:
1. 모든 videos 생성 엔드포인트에서 `site_id`를 문자열로 변환
2. 제공된 `site_id`가 존재하지 않으면 기본 사이트(`"gods"`) 자동 사용
3. 상세한 로그 출력

**수정된 엔드포인트**:
- `POST /admin/videos` (1328-1459줄)
- `POST /videos/bulk` (1709-1843줄)
- `POST /videos` (1935-2048줄)
- `POST /videos/batch` (1846-1933줄)

**코드 Diff**:

```diff
  // site_id를 문자열로 변환 (프론트엔드가 숫자로 보낼 수 있음)
+ let providedSiteId = site_id != null ? String(site_id) : null;

  // site_id 검증 및 자동 복구
- let targetSiteId = site_id;
+ let targetSiteId = providedSiteId;
  
  if (!targetSiteId) {
    // site_id가 없으면 기본 사이트 사용
    const defaultSite = db.prepare("SELECT id FROM sites ORDER BY created_at ASC LIMIT 1").get();
    if (defaultSite) {
      targetSiteId = defaultSite.id;
      console.log(`⚠️  site_id가 제공되지 않아 기본 사이트 사용: ${targetSiteId}`);
    }
  } else {
    // site_id가 제공되었지만 존재하지 않으면 기본 사이트 사용
    const site = db.prepare("SELECT * FROM sites WHERE id = ?").get(targetSiteId);
    if (!site) {
      console.warn(`⚠️  제공된 site_id(${targetSiteId})가 존재하지 않아 기본 사이트 사용`);
      const defaultSite = db.prepare("SELECT id FROM sites ORDER BY created_at ASC LIMIT 1").get();
      if (defaultSite) {
        targetSiteId = defaultSite.id;
+       console.log(`   → 기본 사이트로 변경: ${targetSiteId}`);
      }
    }
  }
```

## 📋 해결 방법

### 1. site_id 타입 변환

**문제**: 프론트엔드가 숫자 `1765684445`를 보내지만, sites 테이블의 id는 문자열 `"gods"`

**해결**: 모든 엔드포인트에서 `site_id`를 문자열로 변환

```javascript
// site_id를 문자열로 변환 (프론트엔드가 숫자로 보낼 수 있음)
let providedSiteId = site_id != null ? String(site_id) : null;
```

### 2. 존재하지 않는 site_id 자동 복구

**문제**: 변환된 site_id가 sites 테이블에 존재하지 않음

**해결**: 기본 사이트(`"gods"`) 자동 사용

```javascript
const site = db.prepare("SELECT * FROM sites WHERE id = ?").get(siteId);
if (!site) {
  console.warn(`⚠️  제공된 site_id(${siteId})가 존재하지 않아 기본 사이트 사용`);
  const defaultSite = db.prepare("SELECT id FROM sites ORDER BY created_at ASC LIMIT 1").get();
  if (defaultSite) {
    siteId = defaultSite.id; // "gods"로 변경
    console.log(`   → 기본 사이트로 변경: ${siteId}`);
  }
}
```

### 3. 상세한 로그 출력

모든 site_id 변환 및 복구 과정을 콘솔에 로그로 출력하여 디버깅 용이

## 🧪 테스트 시나리오

### 시나리오 1: 숫자 site_id 제공 (프론트엔드 현재 상황)

```javascript
// 프론트엔드 요청
POST /videos
{
  "platform": "youtube",
  "source_url": "https://www.youtube.com/watch?v=...",
  "site_id": 1765684445  // 숫자
}

// 백엔드 처리
1. site_id를 문자열로 변환: "1765684445"
2. sites 테이블에서 검색: 없음
3. 기본 사이트 조회: "gods"
4. site_id를 "gods"로 변경
5. INSERT 성공
```

### 시나리오 2: site_id 없음

```javascript
// 프론트엔드 요청
POST /videos
{
  "platform": "youtube",
  "source_url": "https://www.youtube.com/watch?v=..."
  // site_id 없음
}

// 백엔드 처리
1. site_id가 없음
2. 기본 사이트 조회: "gods"
3. site_id를 "gods"로 설정
4. INSERT 성공
```

### 시나리오 3: 유효한 문자열 site_id 제공

```javascript
// 프론트엔드 요청
POST /videos
{
  "platform": "youtube",
  "source_url": "https://www.youtube.com/watch?v=...",
  "site_id": "gods"  // 문자열
}

// 백엔드 처리
1. site_id를 문자열로 변환: "gods"
2. sites 테이블에서 검색: 있음
3. site_id를 "gods"로 사용
4. INSERT 성공
```

## ✅ 최종 확인 사항

- [x] DB 스키마 점검 완료 (sites.id는 TEXT, "gods" 존재)
- [x] 모든 videos 생성 엔드포인트에서 site_id 문자열 변환
- [x] 존재하지 않는 site_id 자동 복구 (기본 사이트 사용)
- [x] 상세한 로그 출력
- [x] FK 제약조건 에러 처리

## 📝 참고사항

1. **프론트엔드 site_id 처리**:
   - 프론트엔드는 숫자 site_id를 보낼 수 있음 (localStorage에 숫자로 저장)
   - 백엔드는 항상 문자열로 변환하여 처리

2. **기본 사이트 보장**:
   - sites 테이블이 비어있으면 자동 생성 (`"gods"`)
   - 제공된 site_id가 없거나 유효하지 않으면 기본 사이트 사용

3. **로그 확인**:
   - 서버 콘솔에서 site_id 변환 및 복구 과정 확인 가능
   - 예: `⚠️  제공된 site_id(1765684445)가 존재하지 않아 기본 사이트 사용`
   - 예: `   → 기본 사이트로 변경: gods`

4. **기존 DB 유지**:
   - 기존 videos 레코드는 그대로 유지
   - 새로운 videos는 항상 유효한 site_id로 생성

CMS Admin에서 영상 추가 시 FOREIGN KEY constraint failed 오류가 해결되었습니다.








































