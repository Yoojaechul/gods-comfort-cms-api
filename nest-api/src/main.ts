import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cloud Run 필수: PORT 환경변수 사용 (기본값: 8080)
  const port = process.env.PORT || 8080;

  // 정적 파일 서빙: /uploads 경로로 uploads 폴더 서빙
  // 저장 경로: process.cwd()/uploads/thumbnails/<filename>
  // 서빙 경로: /uploads/thumbnails/<filename>
  // 반환 URL: /uploads/thumbnails/<filename>
  const expressApp = app.getHttpAdapter().getInstance();
  const uploadsBasePath = path.join(process.cwd(), 'uploads');
  
  // /uploads 경로로 정적 파일 서빙
  // /uploads/thumbnails/<filename> 요청이 process.cwd()/uploads/thumbnails/<filename> 파일로 매핑됨
  expressApp.use('/uploads', express.static(uploadsBasePath, {
    setHeaders: (res, filePath) => {
      // 파일 확장자에 따라 Content-Type 설정
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.png') {
        res.setHeader('Content-Type', 'image/png');
      } else if (ext === '.jpg' || ext === '.jpeg') {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (ext === '.webp') {
        res.setHeader('Content-Type', 'image/webp');
      } else if (ext === '.gif') {
        res.setHeader('Content-Type', 'image/gif');
      }
    },
  }));
  
  console.log(`📁 Static file serving: /uploads -> ${uploadsBasePath}`);

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
