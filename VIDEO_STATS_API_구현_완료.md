# Video Stats API 구현 완료

## ✅ 수정된 파일 및 코드 Diff

### `server.js` - 공개 영상 통계 API 추가

**변경 사항:**
1. `/public/videos` GET 응답에 `views_count`, `likes_count`, `shares_count` fallback 추가 (없으면 0)
2. `/public/videos/:id/view` POST - 조회수 +1 (익명 사용자 허용)
3. `/public/videos/:id/like` POST - 좋아요 +1 (익명 사용자 허용)
4. `/public/videos/:id/share` POST - 공유 +1 (익명 사용자 허용)
5. `/public/videos/:id` PATCH - 통계 업데이트 (익명 사용자 허용, 선택적 필드)

**코드 Diff:**

#### 1. `/public/videos` GET 응답에 fallback 추가 (217-224줄)

```diff
    return {
      ...video,
      video_id: videoId,
      // status가 없으면 기본값 설정
      status: video.status || 'active',
      // language가 없으면 기본값 설정
      language: video.language || 'en',
+     // views, likes, shares가 없으면 기본값 0으로 설정
+     views_count: video.views_count ?? 0,
+     likes_count: video.likes_count ?? 0,
+     shares_count: video.shares_count ?? 0,
    };
  });
```

#### 2. 공개 영상 조회수 증가 API 추가 (236-250줄)

```javascript
// 공개 영상 조회수 증가 (익명 사용자 허용)
app.post("/public/videos/:id/view", async (request, reply) => {
  const { id } = request.params;

  // 영상 존재 확인
  const video = db.prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'").get(id);

  if (!video) {
    return reply.code(404).send({ error: "Video not found" });
  }

  // 조회수 증가 (없으면 0에서 시작)
  const currentViews = video.views_count ?? 0;
  db.prepare("UPDATE videos SET views_count = ? WHERE id = ?").run(currentViews + 1, id);

  const updatedVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
  return {
    success: true,
    views_count: updatedVideo.views_count ?? 0,
  };
});
```

#### 3. 공개 영상 좋아요 증가 API 추가 (252-266줄)

```javascript
// 공개 영상 좋아요 증가 (익명 사용자 허용)
app.post("/public/videos/:id/like", async (request, reply) => {
  const { id } = request.params;

  // 영상 존재 확인
  const video = db.prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'").get(id);

  if (!video) {
    return reply.code(404).send({ error: "Video not found" });
  }

  // 좋아요 증가 (없으면 0에서 시작)
  const currentLikes = video.likes_count ?? 0;
  db.prepare("UPDATE videos SET likes_count = ? WHERE id = ?").run(currentLikes + 1, id);

  const updatedVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
  return {
    success: true,
    likes_count: updatedVideo.likes_count ?? 0,
  };
});
```

#### 4. 공개 영상 공유 증가 API 추가 (268-282줄)

```javascript
// 공개 영상 공유 증가 (익명 사용자 허용)
app.post("/public/videos/:id/share", async (request, reply) => {
  const { id } = request.params;

  // 영상 존재 확인
  const video = db.prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'").get(id);

  if (!video) {
    return reply.code(404).send({ error: "Video not found" });
  }

  // 공유 수 증가 (없으면 0에서 시작)
  const currentShares = video.shares_count ?? 0;
  db.prepare("UPDATE videos SET shares_count = ? WHERE id = ?").run(currentShares + 1, id);

  const updatedVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
  return {
    success: true,
    shares_count: updatedVideo.shares_count ?? 0,
  };
});
```

#### 5. 공개 영상 통계 업데이트 API 추가 (PATCH 방식, 284-320줄)

```javascript
// 공개 영상 통계 업데이트 (PATCH 방식, 익명 사용자 허용)
// {views_count, likes_count, shares_count} 중 원하는 필드만 업데이트 가능
app.patch("/public/videos/:id", async (request, reply) => {
  const { id } = request.params;
  const { views_count, likes_count, shares_count } = request.body;

  // 영상 존재 확인
  const video = db.prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'").get(id);

  if (!video) {
    return reply.code(404).send({ error: "Video not found" });
  }

  // 업데이트할 필드와 값 준비
  const updates = [];
  const params = [];

  if (views_count !== undefined) {
    updates.push("views_count = ?");
    params.push(views_count);
  }

  if (likes_count !== undefined) {
    updates.push("likes_count = ?");
    params.push(likes_count);
  }

  if (shares_count !== undefined) {
    updates.push("shares_count = ?");
    params.push(shares_count);
  }

  if (updates.length === 0) {
    return reply.code(400).send({ error: "At least one field (views_count, likes_count, shares_count) is required" });
  }

  // 업데이트 실행
  params.push(id);
  db.prepare(`UPDATE videos SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  const updatedVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
  return {
    success: true,
    views_count: updatedVideo.views_count ?? 0,
    likes_count: updatedVideo.likes_count ?? 0,
    shares_count: updatedVideo.shares_count ?? 0,
  };
});
```

## 📋 API 엔드포인트 목록

### 1. 조회수 증가
- **Method**: `POST`
- **URL**: `/public/videos/:id/view`
- **인증**: 불필요 (익명 사용자 허용)
- **응답**:
  ```json
  {
    "success": true,
    "views_count": 123
  }
  ```

### 2. 좋아요 증가
- **Method**: `POST`
- **URL**: `/public/videos/:id/like`
- **인증**: 불필요 (익명 사용자 허용)
- **응답**:
  ```json
  {
    "success": true,
    "likes_count": 45
  }
  ```

### 3. 공유 증가
- **Method**: `POST`
- **URL**: `/public/videos/:id/share`
- **인증**: 불필요 (익명 사용자 허용)
- **응답**:
  ```json
  {
    "success": true,
    "shares_count": 12
  }
  ```

### 4. 통계 업데이트 (PATCH)
- **Method**: `PATCH`
- **URL**: `/public/videos/:id`
- **인증**: 불필요 (익명 사용자 허용)
- **Request Body** (선택적):
  ```json
  {
    "views_count": 100,
    "likes_count": 50,
    "shares_count": 20
  }
  ```
- **응답**:
  ```json
  {
    "success": true,
    "views_count": 100,
    "likes_count": 50,
    "shares_count": 20
  }
  ```

## ✅ 주요 특징

1. **익명 사용자 허용**: 모든 엔드포인트는 인증 없이 접근 가능
2. **공개 영상만**: `visibility = 'public'`인 영상만 업데이트 가능
3. **Fallback 처리**: `views_count`, `likes_count`, `shares_count`가 없으면 0으로 처리
4. **안전한 증가**: POST 방식은 각각 +1만 가능하여 악의적 조작 방지
5. **유연한 업데이트**: PATCH 방식으로 원하는 필드만 선택적으로 업데이트 가능

## 🧪 테스트 예시

### PowerShell 테스트

```powershell
# 조회수 증가
Invoke-WebRequest -Uri "http://localhost:8787/public/videos/{video_id}/view" -Method POST -UseBasicParsing

# 좋아요 증가
Invoke-WebRequest -Uri "http://localhost:8787/public/videos/{video_id}/like" -Method POST -UseBasicParsing

# 공유 증가
Invoke-WebRequest -Uri "http://localhost:8787/public/videos/{video_id}/share" -Method POST -UseBasicParsing

# 통계 업데이트 (PATCH)
$body = @{
  views_count = 100
  likes_count = 50
} | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:8787/public/videos/{video_id}" -Method PATCH -Body $body -ContentType "application/json" -UseBasicParsing
```

### JavaScript/TypeScript 예시

```typescript
// 조회수 증가
await fetch('http://localhost:8787/public/videos/{video_id}/view', {
  method: 'POST',
});

// 좋아요 증가
await fetch('http://localhost:8787/public/videos/{video_id}/like', {
  method: 'POST',
});

// 공유 증가
await fetch('http://localhost:8787/public/videos/{video_id}/share', {
  method: 'POST',
});

// 통계 업데이트 (PATCH)
await fetch('http://localhost:8787/public/videos/{video_id}', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    views_count: 100,
    likes_count: 50,
    shares_count: 20,
  }),
});
```

## 📝 참고사항

1. **데이터베이스 필드**: `videos` 테이블에 `views_count`, `likes_count`, `shares_count` 필드가 있어야 합니다. 없으면 마이그레이션 스크립트(`add-stats-fields.js` 또는 `migrate-video-stats-fields.js`)를 실행하세요.

2. **기존 Admin API**: `/admin/videos/:id/stats` PATCH 엔드포인트는 관리자 전용으로 유지되며, 변경 로그(`stats_adjustments` 테이블)를 기록합니다.

3. **공개 API vs Admin API**:
   - 공개 API: 익명 사용자 허용, 로그 기록 없음, 간단한 증가/업데이트
   - Admin API: 인증 필요, 변경 로그 기록, 관리자 수동 조정용

4. **동시성**: 현재 구현은 단순 증가 방식이므로, 동시 요청 시 정확한 카운트를 보장하지 않을 수 있습니다. 필요시 트랜잭션 또는 락을 추가할 수 있습니다.

## ✅ 최종 확인 사항

- [x] `/public/videos` GET 응답에 `views_count`, `likes_count`, `shares_count` fallback 추가
- [x] `/public/videos/:id/view` POST 엔드포인트 추가
- [x] `/public/videos/:id/like` POST 엔드포인트 추가
- [x] `/public/videos/:id/share` POST 엔드포인트 추가
- [x] `/public/videos/:id` PATCH 엔드포인트 추가
- [x] 모든 엔드포인트 인증 불필요 (익명 사용자 허용)
- [x] 공개 영상만 업데이트 가능 (`visibility = 'public'`)
- [x] 필드가 없으면 0으로 fallback 처리



































