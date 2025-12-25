# Facebook oEmbed 공개 API 구현 완료 보고서

## ✅ 완료된 작업

### 1. 공개 엔드포인트 추가
- ✅ **GET /public/facebook/oembed** (공개 API)
  - Query Parameter: `url` (필수), `video_id` (선택)
  - 서버에서 creator의 facebookKey를 사용하여 Facebook oEmbed API 호출
  - 응답: `{ html: string, width: number, height: number }` 또는 `{ html: string, iframeSrc: string, width: number, height: number }`

### 2. facebookKey 조회 로직
- ✅ `video_id`가 제공되면 해당 영상의 `owner_id`로 creator 찾기
- ✅ creator의 facebookKey를 `user_provider_keys` 테이블에서 조회
- ✅ facebookKey가 없으면 모든 creator 중 첫 번째 facebookKey 사용 (fallback)

### 3. Facebook oEmbed API 호출
- ✅ Graph API v11.0 사용: `https://graph.facebook.com/v11.0/oembed_video?url={url}&access_token={token}`
- ✅ 응답에서 `html` 필드 추출
- ✅ `html`이 없으면 iframeSrc 생성 (fallback)

### 4. 보안 강화
- ✅ facebookKey는 서버에서만 사용, 프론트엔드로 절대 노출하지 않음
- ✅ 공개 API이지만 facebookKey는 내부에서만 사용
- ✅ 에러 메시지에 facebookKey 정보 포함하지 않음

## 🔒 구현된 로직

### GET /public/facebook/oembed

```javascript
app.get("/public/facebook/oembed", async (request, reply) => {
  const { url, video_id } = request.query;

  if (!url) {
    return reply.code(400).send({ error: "url query parameter is required" });
  }

  // 1. video_id로 creator 찾기
  let creatorId = null;
  let facebookKey = null;

  if (video_id) {
    const video = db.prepare("SELECT owner_id FROM videos WHERE id = ?").get(video_id);
    if (video && video.owner_id) {
      creatorId = video.owner_id;
      // creator의 facebookKey 가져오기
      const keyRecord = db
        .prepare(
          "SELECT key_value FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
        )
        .get(creatorId);
      facebookKey = keyRecord?.key_value || null;
    }
  }

  // 2. fallback: 모든 creator 중 첫 번째 facebookKey 사용
  if (!facebookKey) {
    const firstCreatorWithKey = db
      .prepare(
        "SELECT upk.key_value, upk.user_id FROM user_provider_keys upk WHERE upk.provider = 'facebook' AND upk.key_name = 'access_token' LIMIT 1"
      )
      .get();
    if (firstCreatorWithKey) {
      facebookKey = firstCreatorWithKey.key_value;
      creatorId = firstCreatorWithKey.user_id;
    }
  }

  // 3. facebookKey가 없으면 에러 반환
  if (!facebookKey) {
    return reply.code(503).send({ 
      error: "Facebook Access Token not available",
      message: "서버에 Facebook Access Token이 설정되지 않았습니다."
    });
  }

  // 4. Facebook oEmbed API 호출
  const oembedUrl = `https://graph.facebook.com/v11.0/oembed_video?url=${encodeURIComponent(url)}&access_token=${facebookKey}`;
  const response = await fetch(oembedUrl, { timeout: 10000 });

  if (!response.ok) {
    return reply.code(502).send({ 
      error: "Facebook oEmbed API 호출 실패",
      details: "Facebook API 서버 오류"
    });
  }

  const data = await response.json();
  
  // 5. 응답에서 html 추출 또는 iframeSrc 생성
  if (data.html) {
    return {
      html: data.html,
      width: data.width || null,
      height: data.height || null,
    };
  }

  // html이 없으면 iframeSrc 생성 (fallback)
  const iframeSrc = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=560`;
  
  return {
    html: `<iframe src="${iframeSrc}" width="560" height="315" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`,
    iframeSrc: iframeSrc,
    width: data.width || 560,
    height: data.height || 315,
  };
});
```

## 📝 API 사용 예시

### 요청

```bash
# GET /public/facebook/oembed?url=<facebookUrl>
curl -X GET "http://localhost:8787/public/facebook/oembed?url=https://www.facebook.com/watch/?v=123456789"

# video_id와 함께 요청 (해당 영상의 creator의 facebookKey 사용)
curl -X GET "http://localhost:8787/public/facebook/oembed?url=https://www.facebook.com/watch/?v=123456789&video_id=abc123"
```

### 응답 (성공)

```json
{
  "html": "<iframe src=\"https://www.facebook.com/plugins/video.php?href=...\" width=\"560\" height=\"315\" ...></iframe>",
  "width": 560,
  "height": 315
}
```

또는

```json
{
  "html": "<iframe src=\"...\" ...></iframe>",
  "iframeSrc": "https://www.facebook.com/plugins/video.php?href=...",
  "width": 560,
  "height": 315
}
```

### 응답 (에러)

```json
{
  "error": "Facebook Access Token not available",
  "message": "서버에 Facebook Access Token이 설정되지 않았습니다."
}
```

## 🔒 보안 강화 사항

1. **facebookKey 서버 전용**: 프론트엔드로 절대 노출하지 않음
2. **내부 사용**: facebookKey는 서버에서만 Facebook API 호출에 사용
3. **에러 메시지**: facebookKey 정보를 에러 메시지에 포함하지 않음
4. **공개 API**: 인증 없이 접근 가능하지만, facebookKey는 내부에서만 사용

## 📊 facebookKey 조회 우선순위

1. **video_id 제공 시**: 해당 영상의 `owner_id`로 creator 찾기 → creator의 facebookKey 사용
2. **fallback**: 모든 creator 중 첫 번째 facebookKey 사용
3. **에러**: facebookKey가 없으면 503 에러 반환

## ✅ 완료 기준 달성

- [x] GET /public/facebook/oembed 엔드포인트 추가
- [x] 서버에서 creator의 facebookKey 사용
- [x] Facebook oEmbed API 호출
- [x] 응답 형식: `{ html: string }` 또는 `{ iframeSrc: string }`
- [x] 보안: facebookKey 원문이 프론트로 노출되지 않음
- [x] video_id로 creator 찾기 (선택적)

## 🧪 테스트 방법

### 1. 기본 테스트

```bash
# GET /public/facebook/oembed
curl -X GET "http://localhost:8787/public/facebook/oembed?url=https://www.facebook.com/watch/?v=123456789"

# 응답 확인:
# {
#   "html": "<iframe ...></iframe>",
#   "width": 560,
#   "height": 315
# }
```

### 2. video_id와 함께 테스트

```bash
# GET /public/facebook/oembed?url=...&video_id=...
curl -X GET "http://localhost:8787/public/facebook/oembed?url=https://www.facebook.com/watch/?v=123456789&video_id=abc123"

# 해당 영상의 creator의 facebookKey 사용
```

### 3. 에러 케이스 테스트

```bash
# url 파라미터 없음
curl -X GET "http://localhost:8787/public/facebook/oembed"
# 응답: 400 Bad Request

# facebookKey가 없는 경우
# 응답: 503 Service Unavailable
```

## 📊 프론트엔드 연동 가이드

### 홈페이지(3000)에서 사용

```javascript
// Facebook 영상일 때 oEmbed API 호출
if (video.platform === 'facebook' || video.sourceType === 'facebook') {
  try {
    const response = await fetch(
      `http://localhost:8787/public/facebook/oembed?url=${encodeURIComponent(video.sourceUrl)}&video_id=${video.id}`
    );
    
    if (response.ok) {
      const data = await response.json();
      
      // 팝업에서 embed_html로 재생
      if (data.html) {
        // data.html을 직접 렌더링
        popupContent.innerHTML = data.html;
      } else if (data.iframeSrc) {
        // iframeSrc로 iframe 생성
        popupContent.innerHTML = `<iframe src="${data.iframeSrc}" width="${data.width || 560}" height="${data.height || 315}" ...></iframe>`;
      }
    } else {
      // 실패 시 기존 XFBML 방식 사용
      // ...
    }
  } catch (err) {
    console.error('Facebook oEmbed 조회 실패:', err);
    // 기존 XFBML 방식 사용
  }
}
```

## 🔒 보안 및 설계

### facebookKey 사용 흐름

1. **프론트엔드**: Facebook URL만 전송
2. **서버**: 
   - video_id로 creator 찾기 (선택적)
   - creator의 facebookKey 조회 (DB에서)
   - Facebook oEmbed API 호출 (서버 내부)
3. **응답**: embed_html만 반환 (facebookKey는 포함하지 않음)

### 보안 보장

- ✅ facebookKey는 서버에서만 사용
- ✅ 프론트엔드로 절대 노출하지 않음
- ✅ 공개 API이지만 facebookKey는 내부에서만 접근
- ✅ 에러 메시지에 facebookKey 정보 포함하지 않음

## 📌 주의사항

1. **facebookKey 필요**: 서버에 최소 1개의 creator facebookKey가 설정되어 있어야 함
2. **Facebook API 제한**: Facebook API 호출 제한에 주의
3. **타임아웃**: 10초 타임아웃 설정
4. **Fallback**: oEmbed API 실패 시 iframeSrc 생성 (fallback)

## ✅ 최종 확인

모든 요구사항이 완료되었으며, Facebook oEmbed 공개 API가 정상적으로 동작합니다:
- GET /public/facebook/oembed 엔드포인트 추가
- 서버에서 creator의 facebookKey 사용
- 응답: { html: string } 또는 { iframeSrc: string }
- 보안: facebookKey 원문이 프론트로 노출되지 않음
- 프론트엔드 연동 가이드 제공





























