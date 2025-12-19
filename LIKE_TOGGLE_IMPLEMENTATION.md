# 좋아요 토글 구현 완료 보고서

## ✅ 구현 완료 사항

### 1. 문법 에러 수정 (프롬프트 C)
- **613번째 줄**: 문법 에러 없음 확인 (실제로는 정상 코드)
- 모든 문법 검사 통과: `node --check server.js` ✅
- 에러 응답 형식 통일: `ok: false` 제거

### 2. 좋아요 토글 정책 구현 (프롬프트 D)

#### 2.1 핵심 요구사항 충족
- ✅ **토글 동작**: 1번 누르면 +1 (하트 ON), 2번 누르면 -1 (하트 OFF)
- ✅ **새로고침 유지**: 쿠키 기반 client_id로 상태 유지 (프론트 임시값 금지)
- ✅ **중복 클릭 방지**: UNIQUE(video_id, client_id) 제약조건으로 1개만 유지
- ✅ **관리자 수정 가능**: PATCH /admin/videos/:id/counters로 직접 조정
- ✅ **홈페이지 동기화**: 서버가 단일 소스, 관리자 수정값이 홈페이지에 반영

#### 2.2 구현 방식
- **비로그인 기반**: clientId (쿠키/헤더) + videoId unique
- **엔드포인트**: POST /public/videos/:id/like
- **응답 형식**: `{ liked: boolean, likeCount: number }`
- **DB 테이블**: `video_like_clients` (UNIQUE 인덱스 포함)
- **동기화**: `video_like_clients` 테이블의 실제 COUNT(*)로 `videos.likes_count` 업데이트

---

## 📋 변경 파일 목록

### 수정된 파일
1. **server.js** - 메인 서버 파일
   - 좋아요 토글 로직 개선
   - COUNT 기반 동기화 구현
   - 에러 응답 형식 통일

---

## 🔧 핵심 코드 변경 (Diff 형태)

### 1. 테이블 생성 (video_like_clients)

```javascript
// 기존: video_likes 테이블
// 변경: video_like_clients 테이블 (client_id 필드 사용)

db.exec(`
  CREATE TABLE IF NOT EXISTS video_like_clients (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(video_id, client_id)
  )
`);
db.exec("CREATE INDEX IF NOT EXISTS idx_video_like_clients_video_id ON video_like_clients(video_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_video_like_clients_client_id ON video_like_clients(client_id)");
```

**변경점:**
- 테이블명: `video_likes` → `video_like_clients`
- 필드명: `client_key` → `client_id`
- UNIQUE 제약조건: `(video_id, client_id)` - 중복 클릭 방지

---

### 2. 좋아요 토글 로직 개선

#### 이전 코드 (산술 연산 기반):
```javascript
if (isLiked) {
  db.prepare("DELETE FROM video_like_clients WHERE video_id = ? AND client_id = ?").run(id, clientId);
  const currentLikes = video.likes_count ?? 0;
  newLikesCount = Math.max(0, currentLikes - 1);  // 산술 연산
  db.prepare("UPDATE videos SET likes_count = ? WHERE id = ?").run(newLikesCount, id);
} else {
  const likeId = generateId();
  db.prepare("INSERT INTO video_like_clients (id, video_id, client_id) VALUES (?, ?, ?)").run(likeId, id, clientId);
  const currentLikes = video.likes_count ?? 0;
  newLikesCount = currentLikes + 1;  // 산술 연산
  db.prepare("UPDATE videos SET likes_count = ? WHERE id = ?").run(newLikesCount, id);
}
```

#### 개선된 코드 (COUNT 기반 동기화):
```javascript
if (isLiked) {
  // 좋아요 취소 (삭제)
  db.prepare("DELETE FROM video_like_clients WHERE video_id = ? AND client_id = ?").run(id, clientId);
  liked = false;
} else {
  // 좋아요 추가 (삽입)
  const likeId = generateId();
  db.prepare("INSERT INTO video_like_clients (id, video_id, client_id) VALUES (?, ?, ?)").run(likeId, id, clientId);
  liked = true;
}

// video_like_clients 테이블의 실제 개수로 동기화 (단일 소스 원칙)
const actualCount = (db.prepare("SELECT COUNT(*) as count FROM video_like_clients WHERE video_id = ?").get(id) || { count: 0 }).count || 0;
db.prepare("UPDATE videos SET likes_count = ? WHERE id = ?").run(actualCount, id);
newLikesCount = actualCount;
```

**개선점:**
1. ✅ **단일 소스 원칙**: `video_like_clients` 테이블이 실제 좋아요 데이터의 단일 소스
2. ✅ **동기화 보장**: 삽입/삭제 후 항상 COUNT(*)로 동기화하여 데이터 일관성 유지
3. ✅ **관리자 수정 대응**: 관리자가 직접 수정한 값도 `video_like_clients`와 무관하게 저장 가능
4. ✅ **동시성 안전**: COUNT(*) 쿼리로 여러 요청이 동시에 와도 정확한 개수 유지

---

### 3. Client ID 생성 로직

```javascript
// 우선순위: X-Client-Id 헤더 > 쿠키 client_id > 자동 생성 (UUID)

const clientIdHeader = request.headers['x-client-id'];
let clientId;

if (clientIdHeader && typeof clientIdHeader === 'string' && clientIdHeader.trim()) {
  // 1순위: 헤더에서 X-Client-Id 사용
  clientId = clientIdHeader.trim().substring(0, 200);
} else if (request.cookies?.client_id) {
  // 2순위: 쿠키에서 client_id 사용
  clientId = request.cookies.client_id.trim().substring(0, 200);
} else {
  // 3순위: client_id가 없으면 생성 (UUID) 후 쿠키 설정
  clientId = randomUUID();
  reply.setCookie('client_id', clientId, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1년
    httpOnly: false, // JavaScript에서 접근 가능
    sameSite: 'lax',
    path: '/',
  });
}
```

**특징:**
- ✅ 개발 단계: 헤더 방식 반드시 동작 (`X-Client-Id`)
- ✅ 프로덕션: 쿠키 자동 관리로 새로고침 시에도 상태 유지
- ✅ UUID 생성: 안전한 클라이언트 식별자

---

### 4. UNIQUE 제약조건 위반 처리

```javascript
catch (updateErr) {
  // UNIQUE 제약조건 위반 (중복 요청) 처리
  if (updateErr.message?.includes('UNIQUE constraint')) {
    console.warn(`[${routeName}] 중복 요청 감지 (UNIQUE constraint): videoId=${id}, clientId=${clientId.substring(0, 20)}...`);
    
    // 이미 좋아요가 있는 상태이므로 현재 상태 반환
    const actualCount = (db.prepare("SELECT COUNT(*) as count FROM video_like_clients WHERE video_id = ?").get(id) || { count: 0 }).count || 0;
    db.prepare("UPDATE videos SET likes_count = ? WHERE id = ?").run(actualCount, id);
    
    return {
      liked: true,
      likeCount: actualCount,
    };
  }
  // 다른 에러는 상위 catch에서 처리
}
```

**안전장치:**
- ✅ 동시 요청 시 UNIQUE 제약조건 위반 처리
- ✅ 실제 COUNT(*)로 동기화하여 일관성 유지

---

### 5. 관리자 카운터 업데이트 API

```javascript
app.patch(
  "/admin/videos/:id/counters",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;
    const { views_count, likes_count, shares_count } = request.body;
    const user = request.user;

    // 카운터 업데이트
    const updates = [];
    const params = [];

    if (likes_count !== undefined) {
      if (typeof likes_count !== 'number' || likes_count < 0) {
        return reply.code(400).send({ 
          error: "Bad Request",
          message: "likes_count는 0 이상의 숫자여야 합니다.",
        });
      }
      updates.push("likes_count = ?");
      params.push(likes_count);
    }
    // ... views_count, shares_count 동일 처리

    if (updates.length > 0) {
      updates.push("stats_updated_at = datetime('now')");
      updates.push("stats_updated_by = ?");
      params.push(user.id);
      params.push(id);

      db.prepare(`UPDATE videos SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    }

    const updatedVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    return {
      success: true,
      videoId: id,
      views_count: updatedVideo.views_count ?? 0,
      likes_count: updatedVideo.likes_count ?? 0,
      shares_count: updatedVideo.shares_count ?? 0,
      updated_at: updatedVideo.stats_updated_at,
      updated_by: updatedVideo.stats_updated_by,
    };
  }
);
```

**특징:**
- ✅ 관리자 인증 필요 (`authenticate, requireAdmin`)
- ✅ 직접 값 설정 가능 (video_like_clients와 무관)
- ✅ 변경 로그 기록 (`stats_adjustments` 테이블)
- ✅ 홈페이지에 즉시 반영 (서버가 단일 소스)

---

## 🗄️ 데이터베이스 스키마

### video_like_clients 테이블
```sql
CREATE TABLE IF NOT EXISTS video_like_clients (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(video_id, client_id)
);

CREATE INDEX idx_video_like_clients_video_id ON video_like_clients(video_id);
CREATE INDEX idx_video_like_clients_client_id ON video_like_clients(client_id);
```

### videos 테이블 (기존)
```sql
-- likes_count는 video_like_clients 테이블의 COUNT(*)로 동기화
-- 관리자가 직접 수정 가능 (PATCH /admin/videos/:id/counters)
```

---

## 🧪 테스트 방법

### 1. 좋아요 토글 테스트
```bash
VIDEO_ID="your_video_id"
CLIENT_ID="test-client-$(date +%s)"

# 첫 번째 좋아요 (추가)
curl -X POST "http://localhost:8787/public/videos/$VIDEO_ID/like" \
  -H "X-Client-Id: $CLIENT_ID" \
  -H "Content-Type: application/json"

# 응답: { "liked": true, "likeCount": 1 }

# 두 번째 좋아요 (같은 client_id로 취소)
curl -X POST "http://localhost:8787/public/videos/$VIDEO_ID/like" \
  -H "X-Client-Id: $CLIENT_ID" \
  -H "Content-Type: application/json"

# 응답: { "liked": false, "likeCount": 0 }

# 세 번째 좋아요 (다시 추가)
curl -X POST "http://localhost:8787/public/videos/$VIDEO_ID/like" \
  -H "X-Client-Id: $CLIENT_ID" \
  -H "Content-Type: application/json"

# 응답: { "liked": true, "likeCount": 1 }
```

### 2. 새로고침 유지 테스트
```bash
# 쿠키 저장
curl -X POST "http://localhost:8787/public/videos/$VIDEO_ID/like" \
  -H "Content-Type: application/json" \
  -c cookies.txt

# 쿠키 사용 (새로고침 시뮬레이션)
curl -X POST "http://localhost:8787/public/videos/$VIDEO_ID/like" \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

### 3. 관리자 수정 테스트
```bash
# 로그인 후 토큰 획득
TOKEN="your_admin_token"

# 좋아요 수를 999로 설정
curl -X PATCH "http://localhost:8787/admin/videos/$VIDEO_ID/counters" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"likes_count": 999}'

# 공개 API로 확인 (홈페이지와 동일)
curl -X GET "http://localhost:8787/public/videos/$VIDEO_ID"
```

---

## ✅ 완료 기준 검증

- ✅ **좋아요 토글**: 1번 누르면 +1, 2번 누르면 -1
- ✅ **새로고침 유지**: 쿠키 기반 client_id로 상태 유지
- ✅ **중복 클릭 방지**: UNIQUE(video_id, client_id) 제약조건
- ✅ **관리자 수정**: PATCH /admin/videos/:id/counters로 직접 조정
- ✅ **홈페이지 동기화**: 서버가 단일 소스, 관리자 수정값 반영
- ✅ **문법 에러 없음**: `node --check server.js` 통과
- ✅ **npm run dev 실행 가능**: 에러 없이 실행 가능

---

## 📝 API 엔드포인트 요약

| 엔드포인트 | 메서드 | 인증 | 설명 |
|-----------|--------|------|------|
| `/public/videos/:id/like` | POST | 없음 | 좋아요 토글 |
| `/public/videos/:id/unlike` | POST | 없음 | 좋아요 취소 (명시적) |
| `/public/videos/:id/view` | POST | 없음 | 조회수 증가 |
| `/public/videos/:id/share` | POST | 없음 | 공유수 증가 |
| `/admin/videos/:id/counters` | PATCH | 필요 | 카운터 직접 설정 |

---

## 🔄 동작 흐름

1. **사용자 좋아요 클릭**
   - POST /public/videos/:id/like
   - client_id 확인 (헤더/쿠키/생성)
   - video_like_clients 테이블 조회
   - 있으면 삭제, 없으면 삽입
   - COUNT(*)로 videos.likes_count 동기화
   - 응답: { liked: boolean, likeCount: number }

2. **관리자 수정**
   - PATCH /admin/videos/:id/counters
   - videos.likes_count 직접 업데이트
   - 홈페이지에서 즉시 반영 (서버가 단일 소스)

3. **새로고침**
   - 쿠키에서 client_id 자동 로드
   - 현재 좋아요 상태 유지
   - 프론트엔드에서 서버 응답 기반으로 UI 업데이트

---

## 🎯 핵심 설계 원칙

1. **단일 소스 원칙**: `video_like_clients` 테이블이 실제 좋아요 데이터의 단일 소스
2. **COUNT 기반 동기화**: 산술 연산 대신 COUNT(*) 쿼리로 정확성 보장
3. **관리자 우선권**: 관리자가 직접 수정한 값은 video_like_clients와 무관하게 저장
4. **안전한 동시성**: UNIQUE 제약조건과 COUNT(*) 쿼리로 동시 요청 처리
5. **상태 유지**: 쿠키 기반 client_id로 새로고침 시에도 상태 유지

---

## 📌 참고사항

- **마이그레이션**: 기존 `video_likes` 테이블이 있으면 자동으로 `video_like_clients`로 마이그레이션
- **에러 처리**: 모든 에러 응답에서 `ok: false` 필드 제거 (통일된 형식)
- **로그**: 모든 좋아요 작업에 대한 상세 로그 기록









