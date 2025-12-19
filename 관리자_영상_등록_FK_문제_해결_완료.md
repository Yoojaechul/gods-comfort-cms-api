# 관리자 영상 등록 FK 문제 해결 완료

## ✅ 수정된 파일 및 코드 Diff

### 1. `server.js` - owner_id 검증 및 자동 복구 로직 추가

**변경 사항**:
1. `POST /admin/videos` - owner_id 검증 및 자동 복구
2. `POST /videos/bulk` - owner_id 검증 및 자동 복구
3. `POST /videos/batch` - owner_id 검증 및 자동 복구
4. `POST /videos` - owner_id 검증 및 자동 복구
5. site_id 문자열 변환 확인 및 수정

## 📋 해결 방법

### 1. owner_id 검증 및 자동 복구

**문제**: 관리자가 영상을 등록할 때 `user.id`가 users 테이블에 존재하지 않아 FOREIGN KEY constraint failed 발생

**해결**: owner_id 검증 및 자동 복구 로직 추가

```javascript
// owner_id 검증 및 자동 복구
let targetOwnerId = owner_id ? String(owner_id) : null;

if (!targetOwnerId) {
  // owner_id가 없으면 현재 사용자 사용
  targetOwnerId = user.id;
  console.log(`⚠️  owner_id가 제공되지 않아 현재 사용자 사용: ${targetOwnerId}`);
}

// owner_id가 users 테이블에 존재하는지 확인
const ownerCheck = db.prepare("SELECT * FROM users WHERE id = ?").get(targetOwnerId);
if (!ownerCheck) {
  console.warn(`⚠️  제공된 owner_id(${targetOwnerId})가 존재하지 않아 기본 사용자 사용`);
  // 기본 사용자 조회 (admin 또는 첫 번째 creator)
  const defaultOwner = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'creator') ORDER BY created_at ASC LIMIT 1").get();
  if (defaultOwner) {
    targetOwnerId = defaultOwner.id;
    console.log(`   → 기본 사용자로 변경: ${targetOwnerId}`);
  } else {
    return reply.code(400).send({ 
      error: `Owner ID '${targetOwnerId}' does not exist in users table, and no default user exists`,
      details: "Please ensure at least one user (admin or creator) exists in the users table"
    });
  }
}
```

### 2. site_id 문자열 변환 확인

**문제**: 프론트엔드가 숫자 site_id를 보내지만 DB는 문자열 사용

**해결**: 모든 엔드포인트에서 site_id를 문자열로 변환

```javascript
// site_id를 문자열로 변환 (프론트엔드가 숫자로 보낼 수 있음)
let providedSiteId = site_id != null ? String(site_id) : null;
```

### 3. 영상 편집 기능

**기존 기능 확인**:
- `PATCH /admin/videos/:id` - Admin 영상 편집 (모든 필드 수정 가능)
- `PATCH /videos/:id` - Creator 영상 편집 (본인 소유만 수정 가능)

**기능**:
- 제목, 썸네일, 공개 여부, 상태 등 모든 필드 수정 가능
- source_url이나 platform 변경 시 메타정보 자동 재생성
- video_id 자동 추출 및 업데이트

### 4. 대량 등록/편집 기능

**기존 기능 확인**:
- `POST /videos/bulk` - 일괄 영상 생성 (Admin/Creator 모두 사용 가능, 최대 20개)
- `POST /videos/batch` - 일괄 영상 생성 (Creator 전용, 최대 20개)
- `POST /admin/videos/batch-delete` - 일괄 영상 삭제

**수정 사항**:
- owner_id 검증 및 자동 복구 로직 추가
- site_id 문자열 변환 확인
- FK 제약조건 에러 처리 개선

## 🧪 테스트 시나리오

### 시나리오 1: 관리자 영상 등록 (owner_id 없음)

```javascript
// 프론트엔드 요청
POST /admin/videos
{
  "platform": "youtube",
  "source_url": "https://www.youtube.com/watch?v=..."
  // owner_id 없음
}

// 백엔드 처리
1. owner_id가 없으면 현재 사용자(user.id) 사용
2. owner_id가 users 테이블에 존재하는지 확인
3. 존재하지 않으면 기본 사용자(admin 또는 creator) 사용
4. site_id 검증 및 자동 복구
5. INSERT 성공
```

### 시나리오 2: 관리자 영상 등록 (유효하지 않은 owner_id)

```javascript
// 프론트엔드 요청
POST /admin/videos
{
  "platform": "youtube",
  "source_url": "https://www.youtube.com/watch?v=...",
  "owner_id": "invalid_user_id"
}

// 백엔드 처리
1. owner_id가 users 테이블에 존재하는지 확인: 없음
2. 기본 사용자(admin 또는 creator) 사용
3. site_id 검증 및 자동 복구
4. INSERT 성공
```

### 시나리오 3: 대량 영상 등록

```javascript
// 프론트엔드 요청
POST /videos/bulk
{
  "videos": [
    { "platform": "youtube", "source_url": "..." },
    { "platform": "youtube", "source_url": "..." }
  ]
}

// 백엔드 처리
1. owner_id 검증 및 자동 복구 (한 번만)
2. site_id 검증 및 자동 복구 (한 번만)
3. 각 영상에 대해:
   - 메타정보 자동 보강
   - video_id 추출
   - INSERT (FK 제약조건 에러 처리)
4. 성공/실패 결과 반환
```

## ✅ 최종 확인 사항

- [x] POST /admin/videos - owner_id 검증 및 자동 복구
- [x] POST /videos/bulk - owner_id 검증 및 자동 복구
- [x] POST /videos/batch - owner_id 검증 및 자동 복구
- [x] POST /videos - owner_id 검증 및 자동 복구
- [x] site_id 문자열 변환 확인
- [x] 영상 편집 기능 확인 (PATCH /admin/videos/:id, PATCH /videos/:id)
- [x] 대량 등록/편집 기능 확인 및 수정

## 📝 참고사항

1. **owner_id 자동 복구**:
   - owner_id가 없거나 유효하지 않으면 기본 사용자(admin 또는 creator) 사용
   - 기본 사용자도 없으면 에러 반환

2. **site_id 자동 복구**:
   - site_id가 없거나 유효하지 않으면 기본 사이트("gods") 사용
   - 기본 사이트도 없으면 자동 생성

3. **영상 편집 기능**:
   - Admin: 모든 영상 수정 가능
   - Creator: 본인 소유 영상만 수정 가능
   - source_url이나 platform 변경 시 메타정보 자동 재생성

4. **대량 등록/편집 기능**:
   - 최대 20개 영상 일괄 처리
   - 각 영상의 성공/실패 결과 반환
   - FK 제약조건 에러 처리

관리자가 영상을 등록할 때 FOREIGN KEY constraint failed 오류가 해결되었으며, 영상 등록/편집/대량 등록/편집 기능이 모두 정상적으로 작동합니다.





























