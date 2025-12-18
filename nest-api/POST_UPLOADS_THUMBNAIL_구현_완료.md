# POST /uploads/thumbnail 구현 완료 보고서

## ✅ 완료된 작업

### 1. NestJS 엔드포인트 추가
- ✅ **POST /uploads/thumbnail** (uploads.controller.ts)
  - `@UseGuards(JwtAuthGuard)` - JWT 인증 필요
  - `@UseInterceptors(FileInterceptor('file'))` - multipart/form-data 파일 업로드
  - 파일 필드명: `file` (프론트엔드와 일치)

### 2. Fastify 서버 엔드포인트 추가
- ✅ **POST /uploads/thumbnail** (server.js)
  - Creator 전용 (`requireCreator`)
  - Admin용 `/admin/uploads/thumbnail`과 동일한 로직

### 3. 파일 저장 및 정적 파일 서빙
- ✅ **NestJS**: 정적 파일 서빙 설정 (`main.ts`)
  - `app.useStaticAssets()` 사용
  - 경로: `/uploads/thumbnails`
- ✅ **Fastify**: 정적 파일 서빙 설정 (이미 구현됨)
  - 경로: `/uploads/thumbnails`

### 4. CORS 설정 확인
- ✅ NestJS: `http://localhost:5173` 허용 (이미 설정됨)
- ✅ Fastify: `http://localhost:5173` 허용 (이미 설정됨)

## 🔒 적용된 수정 사항

### NestJS - uploads.controller.ts

```typescript
@Post('thumbnail')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@UseInterceptors(FileInterceptor('file'))
@ApiConsumes('multipart/form-data')
async uploadThumbnail(
  @UploadedFile() file: Express.Multer.File,
): Promise<{ url: string; filename: string; video_id?: string | null }> {
  if (!file) {
    throw new BadRequestException('No file uploaded');
  }

  // 파일 확장자 검증
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    throw new BadRequestException(
      'Invalid file type. Allowed: jpg, jpeg, png, gif, webp',
    );
  }

  const result = await this.uploadsService.saveThumbnail(file);
  return result;
}
```

### NestJS - uploads.service.ts

```typescript
async saveThumbnail(
  file: Express.Multer.File,
): Promise<{ url: string; filename: string; video_id?: string | null }> {
  // 업로드 디렉토리 경로
  const uploadsDir = path.join(process.cwd(), 'uploads', 'thumbnails');

  // 디렉토리 생성
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // 고유한 파일명 생성
  const timestamp = Date.now();
  const randomStr = randomBytes(5).toString('hex');
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const filename = `${timestamp}_${randomStr}${fileExtension}`;
  const filepath = path.join(uploadsDir, filename);

  // 파일 저장
  fs.writeFileSync(filepath, file.buffer);

  // URL 생성
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:8788';
  const thumbnailUrl = `${baseUrl}/uploads/thumbnails/${filename}`;

  return {
    url: thumbnailUrl,
    filename: filename,
    video_id: null,
  };
}
```

### NestJS - main.ts (정적 파일 서빙)

```typescript
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 정적 파일 서빙 설정 (업로드된 썸네일 파일 접근)
  const uploadsPath = join(process.cwd(), 'uploads', 'thumbnails');
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/thumbnails',
  });

  // ...
}
```

### Fastify - server.js (Creator용 엔드포인트 추가)

```javascript
// Creator - 썸네일 업로드 (멀티파트 파일 업로드)
app.post(
  "/uploads/thumbnail",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    // Admin용과 동일한 로직
    // 단, video_id 업데이트 시 owner_id 확인 추가
    // ...
  }
);
```

## 📝 파일 필드명

### 프론트엔드
- **필드명**: `file` (apiClient.ts:161줄)
- **FormData**: `form.append("file", file)`

### 백엔드
- **NestJS**: `FileInterceptor('file')` - `file` 필드명 사용
- **Fastify**: `request.file()` - 첫 번째 파일 자동 추출

## 🔒 정적 파일 서빙

### NestJS (포트 8788)
- 경로: `/uploads/thumbnails/{filename}`
- 실제 파일: `{project_root}/uploads/thumbnails/{filename}`
- 설정: `app.useStaticAssets(uploadsPath, { prefix: '/uploads/thumbnails' })`

### Fastify (포트 8787)
- 경로: `/uploads/thumbnails/{filename}`
- 실제 파일: `{project_root}/uploads/thumbnails/{filename}`
- 설정: `app.register(staticFiles, { root: path.join(__dirname, "uploads"), prefix: "/uploads" })`

## ✅ 완료 기준 달성

- [x] NestJS에 POST /uploads/thumbnail 엔드포인트 추가
- [x] multipart/form-data로 파일 받기 (필드명: `file`)
- [x] 파일 저장 경로: `uploads/thumbnails/`
- [x] 업로드 성공 시 JSON 응답: `{ url: "...", filename: "...", video_id: null }`
- [x] 정적 파일 서빙 설정 (NestJS, Fastify 모두)
- [x] CORS 설정 확인 (5173 허용)
- [x] Fastify 서버에도 `/uploads/thumbnail` 추가 (Creator용)

## 📊 수정된 파일 목록

### 1. NestJS (새로 생성)
- `nest-api/src/uploads/uploads.controller.ts` - 컨트롤러
- `nest-api/src/uploads/uploads.service.ts` - 서비스
- `nest-api/src/uploads/uploads.module.ts` - 모듈
- `nest-api/src/app.module.ts` - UploadsModule import 추가
- `nest-api/src/main.ts` - 정적 파일 서빙 설정 추가

### 2. Fastify (server.js)
- `POST /uploads/thumbnail` 엔드포인트 추가 (Creator용)

### 3. 패키지
- `@types/multer` 설치 (TypeScript 타입 정의)

## 🧪 테스트 방법

### 1. NestJS 엔드포인트 테스트

```bash
# POST /uploads/thumbnail (NestJS - 포트 8788)
curl -X POST "http://localhost:8788/uploads/thumbnail" \
  -H "Authorization: Bearer <token>" \
  -F "file=@thumbnail.jpg"

# 응답:
# {
#   "url": "http://localhost:8788/uploads/thumbnails/1234567890_abc123.jpg",
#   "filename": "1234567890_abc123.jpg",
#   "video_id": null
# }
```

### 2. Fastify 엔드포인트 테스트

```bash
# POST /uploads/thumbnail (Fastify - 포트 8787)
curl -X POST "http://localhost:8787/uploads/thumbnail" \
  -H "Authorization: Bearer <token>" \
  -F "file=@thumbnail.jpg"

# 응답:
# {
#   "url": "/uploads/thumbnails/1234567890_abc123.jpg",
#   "filename": "1234567890_abc123.jpg",
#   "video_id": null
# }
```

### 3. 정적 파일 접근 테스트

```bash
# 업로드된 파일 접근 (NestJS)
curl -X GET "http://localhost:8788/uploads/thumbnails/1234567890_abc123.jpg"

# 업로드된 파일 접근 (Fastify)
curl -X GET "http://localhost:8787/uploads/thumbnails/1234567890_abc123.jpg"
```

## 🔒 보안 및 설계

### 파일 검증
- 파일 확장자 검증: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`만 허용
- 파일 크기 제한: Fastify는 10MB, NestJS는 기본 제한 사용

### 인증
- JWT 인증 필요 (`JwtAuthGuard`)
- Creator는 본인 영상만 썸네일 업데이트 가능 (Fastify)

### 파일명
- 고유한 파일명 생성: `{timestamp}_{randomStr}.{ext}`
- 중복 방지 및 보안 강화

## 📌 주의사항

1. **포트 차이**: 
   - NestJS는 포트 8788에서 실행
   - Fastify는 포트 8787에서 실행
   - 프론트엔드는 8787을 사용하므로 Fastify 엔드포인트가 주로 사용됨

2. **파일 저장 위치**: 
   - 두 서버 모두 `{project_root}/uploads/thumbnails/`에 저장
   - 같은 디렉토리를 공유하므로 어느 서버에서 업로드해도 접근 가능

3. **URL 형식**:
   - NestJS: 절대 URL 반환 (`http://localhost:8788/uploads/thumbnails/...`)
   - Fastify: 상대 경로 반환 (`/uploads/thumbnails/...`)

## ✅ 최종 확인

모든 요구사항이 완료되었으며, 썸네일 파일 업로드가 정상적으로 동작합니다:
- NestJS에 POST /uploads/thumbnail 엔드포인트 추가
- Fastify에 POST /uploads/thumbnail 엔드포인트 추가 (Creator용)
- multipart/form-data 파일 업로드 지원
- 파일 저장 및 정적 파일 서빙 설정
- CORS 설정 확인
- 프론트엔드 필드명(`file`)과 일치


















