# .env.production 파일 수정 가이드

## ⚠️ 현재 문제

`.env.production` 파일에 잘못된 API_BASE_URL이 설정되어 있습니다:

```env
# 잘못된 설정 (현재)
VITE_API_BASE_URL=https://cms.godcomfortword.com
VITE_CMS_API_BASE=https://cms.godcomfortword.com
```

**문제점:**
- `cms.godcomfortword.com`은 SPA 호스팅 도메인입니다
- 이 도메인으로 API 요청을 보내면 Firebase Hosting이 HTML을 반환합니다
- 결과: "API endpoint mismatch (received HTML)" 오류 발생

## ✅ 올바른 설정

`.env.production` 파일을 다음과 같이 수정하세요:

```env
# Production API Base URL
# ⚠️ 중요: API 서버는 SPA 호스팅 도메인과 별도의 도메인을 사용해야 합니다.
# SPA: https://cms.godcomfortword.com (Firebase Hosting)
# API: https://api.godcomfortword.com (별도 API 서버)

# 실제 API 서버 주소로 변경:
VITE_API_BASE_URL=https://api.godcomfortword.com

# 또는 (두 개 중 하나만 설정)
# VITE_CMS_API_BASE_URL=https://api.godcomfortword.com
```

**중요:**
- `VITE_API_BASE_URL` 또는 `VITE_CMS_API_BASE_URL` 중 하나만 설정하세요
- 값은 반드시 `https://` 또는 `http://`로 시작해야 합니다
- SPA 호스팅 도메인(`cms.godcomfortword.com`)을 사용하면 안 됩니다

## 수정 방법

1. `.env.production` 파일 열기
2. `VITE_API_BASE_URL` 값을 실제 API 서버 주소로 변경:
   ```env
   VITE_API_BASE_URL=https://api.godcomfortword.com
   ```
3. 잘못된 `VITE_CMS_API_BASE` 줄 제거 (또는 `VITE_CMS_API_BASE_URL`로 변경)
4. 파일 저장
5. 빌드 다시 실행:
   ```bash
   npm run build
   ```

## 확인 방법

빌드 후 브라우저 콘솔에서 확인:

```javascript
// 브라우저 콘솔에서 실행
console.log(import.meta.env.VITE_API_BASE_URL);
// 예상 출력: "https://api.godcomfortword.com"
```

Network 탭에서 실제 요청 URL 확인:
- ✅ 올바름: `https://api.godcomfortword.com/creator/videos`
- ❌ 잘못됨: `https://cms.godcomfortword.com/creator/videos`













