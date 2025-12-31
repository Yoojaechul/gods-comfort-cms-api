import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cloud Run 필수: PORT 환경변수 사용 (기본값: 8080)
  const port = process.env.PORT || 8080;

  // 정적 파일 서빙: /uploads 경로로 uploads 폴더의 파일 서빙
  // thumbnails 하위 파일은 /uploads/thumbnails/... 로 접근 가능
  const expressApp = app.getHttpAdapter().getInstance();
  const uploadsPath = path.join(process.cwd(), 'uploads');
  expressApp.use('/uploads', express.static(uploadsPath));

  // Cloud Run / 프록시 환경에서 유용
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Cloud Run 필수: 0.0.0.0 바인딩
  await app.listen(port, '0.0.0.0');

  // 실제 리슨 포트 출력 (Cloud Run 로그에서 확인용)
  console.log(`🚀 CMS API listening on http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
