# 프로덕션 API_BASE_URL 수정 요약

## 문제

프로덕션에서 API 요청이 SPA 도메인으로 나가면서 404 발생:
- 요청 URL: `https://cms.godcomfortword.com/creator/videos`
- 응답: HTML 404 "Cannot GET /creator/videos"
- 원인: `.env.production`에 SPA 도메인이 설정됨

## 해결

### .env.production 파일 수정

**이전 (잘못됨):**
```env
VITE_API_BASE_URL=https://cms.godcomfortword.com
VITE_CMS_API_BASE=https://cms.godcomfortword.com
```

**수정 후 (올바름):**
```env
VITE_CMS_API_BASE_URL=https://api.godcomfortword.com
```

**또는:**
```env
VITE_API_BASE_URL=https://api.godcomfortword.com
```

### 빌드 및 배포

```bash
# 1. 빌드
npm run build

# 2. Firebase 배포
firebase deploy --only hosting
```

## 결과

**수정 전:**
- 요청: `https://cms.godcomfortword.com/creator/videos`
- 응답: HTML 404

**수정 후:**
- 요청: `https://api.godcomfortword.com/creator/videos`
- 응답: JSON (정상)

## 확인 방법

1. **빌드 후 Network 탭 확인:**
   - ✅ 올바름: `https://api.godcomfortword.com/creator/videos`
   - ❌ 잘못됨: `https://cms.godcomfortword.com/creator/videos`

2. **브라우저 콘솔:**
   ```javascript
   console.log(import.meta.env.VITE_CMS_API_BASE_URL);
   // 예상: "https://api.godcomfortword.com"
   ```

## 중요 사항

- 환경 변수는 빌드 타임에 번들에 포함됩니다
- 환경 변수를 변경한 후에는 반드시 다시 빌드해야 합니다
- `.env.production` 파일은 프로젝트 루트에 있어야 합니다













