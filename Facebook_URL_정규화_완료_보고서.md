# Facebook URL 정규화 완료 보고서

## ✅ 완료된 작업

### 1. DB Facebook URL 샘플 조회
- 현재 DB에 Facebook 영상 2개 존재
- URL 형태: `https://www.facebook.com/reel/2062350731189808?locale=ko_KR`
- `fb.watch` 단축 URL은 현재 없음 (향후 대비)

### 2. 프론트엔드 XFBML 확인
- ✅ 프론트엔드에서 이미 XFBML을 사용 중 (`VideoPreviewModal.tsx`)
- ✅ `data-href` 속성에 Facebook URL을 그대로 사용
- ✅ Facebook SDK가 다양한 URL 형식을 지원하므로 정규화는 선택적

### 3. Facebook URL 정규화 함수 추가
- ✅ `metadata.js`에 `normalizeFacebookUrl()` 함수 추가
- ✅ `fb.watch/VIDEO_ID` 형태를 `facebook.com/watch/?v=VIDEO_ID`로 변환 시도
- ✅ 실패 시 원본 URL 유지 (안전한 처리)

### 4. 모든 videos 생성/수정 라우트에 적용
- ✅ `POST /admin/videos` (1543줄)
- ✅ `POST /videos/bulk` (1932줄)
- ✅ `POST /videos/batch` (2071줄)
- ✅ `POST /videos` (2223줄)
- ✅ `PATCH /videos/:id` (2326줄)
- ✅ `PATCH /admin/videos/:id` (1734줄)
- ✅ `PUT /videos/:id` (2440줄)

### 5. metadata.js 버그 수정
- ✅ `enrichFacebookMetadata()` 함수에서 `normalizedUrl` 변수 미정의 버그 수정
- ✅ 정규화 함수를 먼저 호출하여 `normalizedUrl` 생성

## 🔒 적용된 로직

### normalizeFacebookUrl() 함수

```javascript
export function normalizeFacebookUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }

  try {
    // fb.watch 단축 URL을 facebook.com/watch/?v= 형태로 변환 시도
    if (url.includes('fb.watch/')) {
      const match = url.match(/fb\.watch\/([^/?&#]+)/);
      if (match && match[1]) {
        const videoId = match[1];
        const normalized = `https://www.facebook.com/watch/?v=${videoId}`;
        console.log(`[normalizeFacebookUrl] fb.watch 변환: ${url} -> ${normalized}`);
        return normalized;
      }
    }

    // 이미 facebook.com 형태면 그대로 반환 (XFBML이 처리 가능)
    return url;
  } catch (err) {
    // 정규화 실패 시 원본 URL 유지
    console.warn(`[normalizeFacebookUrl] 정규화 실패, 원본 유지: ${url}`, err.message);
    return url;
  }
}
```

### videos 생성/수정 라우트 적용 패턴

```javascript
// Facebook URL 정규화 (선택적, 실패 시 원본 유지)
let normalizedSourceUrl = source_url;
if (platform === "facebook") {
  normalizedSourceUrl = normalizeFacebookUrl(source_url);
  if (normalizedSourceUrl !== source_url) {
    console.log(`[${routeName}] Facebook URL 정규화: ${source_url} -> ${normalizedSourceUrl}`);
  }
}

// 메타정보 자동 보강 (정규화된 URL 사용)
const metadata = await enrichMetadata(platform, normalizedSourceUrl, title, thumbnail_url);

// video_id 추출 (정규화된 URL 사용)
let extractedVideoId = null;
if (platform === "facebook") {
  // 정규화된 URL에서 video_id 추출 시도
  const match = normalizedSourceUrl.match(/\/videos\/(\d+)/) 
    || normalizedSourceUrl.match(/\/reel\/(\d+)/) 
    || normalizedSourceUrl.match(/\/watch\/\?v=(\d+)/);
  extractedVideoId = match ? match[1] : null;
}

// 정규화된 URL 저장
db.prepare("INSERT INTO videos ...").run(..., normalizedSourceUrl, ...);
```

## 📝 정규화 규칙

1. **fb.watch 단축 URL**: `fb.watch/VIDEO_ID` → `https://www.facebook.com/watch/?v=VIDEO_ID`
2. **기존 facebook.com URL**: 그대로 유지 (XFBML이 처리 가능)
3. **정규화 실패**: 원본 URL 유지 (안전한 처리)

## ✅ 완료 기준 달성

- [x] DB Facebook URL 샘플 조회 완료
- [x] 프론트엔드 XFBML 방식 확인 (우선 사용)
- [x] `normalizeFacebookUrl()` 함수 추가
- [x] 모든 videos 생성/수정 라우트에 적용
- [x] 정규화 실패 시 원본 URL 유지
- [x] 기존 데이터 보존 (기존 데이터는 변경하지 않음)

## 🧪 테스트 방법

### 1. fb.watch URL 정규화 테스트
```bash
# fb.watch URL로 영상 생성
curl -X POST http://localhost:8787/admin/videos \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "facebook",
    "source_url": "https://fb.watch/abc123xyz",
    "title": "Test Video"
  }'

# 서버 로그에서 "[normalizeFacebookUrl] fb.watch 변환" 메시지 확인
# DB에서 source_url이 "https://www.facebook.com/watch/?v=abc123xyz"로 저장되었는지 확인
```

### 2. 기존 facebook.com URL 유지 테스트
```bash
# facebook.com/reel/ URL로 영상 생성
curl -X POST http://localhost:8787/admin/videos \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "facebook",
    "source_url": "https://www.facebook.com/reel/2062350731189808",
    "title": "Test Video"
  }'

# 서버 로그에서 정규화 메시지 없음 확인
# DB에서 source_url이 원본 그대로 저장되었는지 확인
```

## 📊 관련 라우트 목록

### Videos 생성/수정 (Facebook URL 정규화 적용)
- `POST /admin/videos` - Admin 영상 생성
- `POST /videos/bulk` - 일괄 영상 생성
- `POST /videos/batch` - 배치 영상 생성
- `POST /videos` - Creator 영상 생성
- `PATCH /videos/:id` - Creator 영상 수정
- `PATCH /admin/videos/:id` - Admin 영상 수정
- `PUT /videos/:id` - Admin/Creator 영상 수정

## 🔒 안전성 보장

1. **기존 데이터 보존**: 기존 DB 데이터는 변경하지 않음
2. **정규화 실패 시 원본 유지**: 에러 발생 시 원본 URL 그대로 저장
3. **프론트엔드 우선**: XFBML이 다양한 URL 형식을 지원하므로 정규화는 선택적
4. **최소 변경**: 정규화는 저장 시점에만 수행, 기존 데이터는 그대로 유지

## 📌 주의사항

1. **프론트엔드 XFBML 우선**: Facebook SDK의 XFBML이 다양한 URL 형식을 지원하므로, 정규화는 보조적 역할만 수행
2. **fb.watch URL**: 현재 DB에 없지만 향후 대비하여 정규화 로직 추가
3. **기존 데이터**: 기존에 저장된 Facebook URL은 변경하지 않음 (새로 저장되는 영상에만 적용)

## ✅ 최종 확인

모든 요구사항이 완료되었으며, Facebook URL 정규화가 모든 videos 생성/수정 라우트에 적용되었습니다:
- 프론트엔드 XFBML 방식 우선 사용
- 서버는 보조적으로 fb.watch URL 정규화 수행
- 정규화 실패 시 원본 URL 유지
- 기존 데이터 보존






































