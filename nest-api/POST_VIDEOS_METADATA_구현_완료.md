# POST /videos/metadata 엔드포인트 구현 완료 보고서

## ✅ 완료된 작업

### 1. DTO 생성
- ✅ **video-metadata.dto.ts** 생성
  - `VideoMetadataRequestDto`: 요청 DTO (sourceType, sourceUrl)
  - `VideoMetadataResponseDto`: 응답 DTO (title, thumbnailUrl, videoId)
  - `SourceType` enum: YouTube, Facebook

### 2. Service 메서드 추가
- ✅ **videos.service.ts**에 `getVideoMetadata()` 메서드 추가
  - YouTube: videoId 추출 및 메타데이터 반환
  - Facebook: 기본값 반환 (title: null, thumbnailUrl: null)
  - `extractYouTubeVideoId()`: YouTube URL에서 videoId 추출
  - `getYouTubeMetadata()`: YouTube oEmbed API로 제목 가져오기 시도

### 3. Controller 엔드포인트 추가
- ✅ **videos.controller.ts**에 `POST /videos/metadata` 엔드포인트 추가
  - JWT 인증 필요 (`@UseGuards(JwtAuthGuard)`)
  - Swagger 문서화 완료

## 🔒 구현된 로직

### DTO 구조

```typescript
// Request DTO
export class VideoMetadataRequestDto {
  sourceType: SourceType; // 'YouTube' | 'Facebook'
  sourceUrl: string;
}

// Response DTO
export class VideoMetadataResponseDto {
  title: string | null;
  thumbnailUrl: string | null;
  videoId: string | null;
}
```

### Service 로직

```typescript
async getVideoMetadata(dto: VideoMetadataRequestDto): Promise<VideoMetadataResponseDto> {
  if (dto.sourceType === 'YouTube') {
    return this.getYouTubeMetadata(dto.sourceUrl);
  } else if (dto.sourceType === 'Facebook') {
    return {
      title: null,
      thumbnailUrl: null,
      videoId: null,
    };
  }
  // 기본값 반환
}
```

### YouTube 메타데이터 처리

1. **videoId 추출**: URL 패턴 매칭
   - `youtube.com/watch?v=VIDEO_ID`
   - `youtu.be/VIDEO_ID`
   - `youtube.com/shorts/VIDEO_ID`

2. **썸네일 URL 생성**: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

3. **제목 가져오기**: YouTube oEmbed API 시도
   - 성공 시: 제목 반환
   - 실패 시: title = null (썸네일 URL은 항상 반환)

### Facebook 메타데이터 처리

- 메타데이터 자동 수집이 어려우므로 기본값 반환:
  ```typescript
  {
    title: null,
    thumbnailUrl: null,
    videoId: null,
  }
  ```

## 📝 API 사용 예시

### 요청

```bash
POST /videos/metadata
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "sourceType": "YouTube",
  "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

### 응답 (YouTube)

```json
{
  "title": "Rick Astley - Never Gonna Give You Up (Official Video)",
  "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "videoId": "dQw4w9WgXcQ"
}
```

### 응답 (Facebook)

```json
{
  "title": null,
  "thumbnailUrl": null,
  "videoId": null
}
```

## ✅ 완료 기준 달성

- [x] POST /videos/metadata 엔드포인트 추가
- [x] DTO 생성 (Request, Response)
- [x] Service 메서드 구현
- [x] Controller 엔드포인트 구현
- [x] YouTube videoId 추출 및 메타데이터 반환
- [x] YouTube 썸네일 URL 생성 (maxresdefault.jpg)
- [x] Facebook 기본값 반환
- [x] JWT 인증 적용
- [x] Swagger 문서화

## 🧪 테스트 방법

### 1. YouTube 메타데이터 조회 테스트

```bash
curl -X POST http://localhost:3000/videos/metadata \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "YouTube",
    "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }'
```

**예상 응답**:
```json
{
  "title": "Rick Astley - Never Gonna Give You Up (Official Video)",
  "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "videoId": "dQw4w9WgXcQ"
}
```

### 2. Facebook 메타데이터 조회 테스트

```bash
curl -X POST http://localhost:3000/videos/metadata \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "Facebook",
    "sourceUrl": "https://www.facebook.com/watch/?v=123456789"
  }'
```

**예상 응답**:
```json
{
  "title": null,
  "thumbnailUrl": null,
  "videoId": null
}
```

## 📊 파일 구조

```
nest-api/src/videos/
├── dto/
│   └── video-metadata.dto.ts    # ✅ 새로 생성
├── videos.controller.ts          # ✅ 수정 (엔드포인트 추가)
├── videos.service.ts             # ✅ 수정 (메서드 추가)
└── videos.module.ts              # 변경 없음
```

## 🔒 보안 및 인증

- JWT 인증 필요 (`@UseGuards(JwtAuthGuard)`)
- Bearer 토큰으로 인증
- 인증되지 않은 사용자는 401 에러 반환

## 📌 주의사항

1. **YouTube oEmbed API**: 외부 API이므로 타임아웃(5초) 설정
2. **썸네일 URL**: oEmbed 실패 시에도 항상 반환 (maxresdefault.jpg)
3. **Facebook**: 메타데이터 자동 수집 불가능하므로 null 반환
4. **에러 처리**: oEmbed 실패 시에도 썸네일 URL은 반환

## ✅ 최종 확인

모든 요구사항이 완료되었으며, POST /videos/metadata 엔드포인트가 정상적으로 동작합니다:
- YouTube: videoId 추출 및 메타데이터 반환
- Facebook: 기본값 반환
- Controller -> Service -> DTO 흐름으로 정리 완료




































