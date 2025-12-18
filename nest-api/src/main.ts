// src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 쿠키 파서 설정 (JWT 토큰을 쿠키에서 읽기 위해 필요)
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());

  // 정적 파일 서빙 설정 (업로드된 썸네일 파일 접근)
  const uploadsPath = join(process.cwd(), 'uploads', 'thumbnails');
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/thumbnails',
  });

  app.enableCors({
    origin: [
      'http://localhost:5173',  // React 프론트엔드
      'http://localhost:8787',  // CMS 서버 (Fastify)
      'http://localhost:3000',  // Next.js 홈페이지
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // 쿠키 전송을 위해 credentials: true 필요
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false, // 빈 body 허용
      skipNullProperties: false,
      skipUndefinedProperties: false,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('선교홈페이지 CMS API')
    .setDescription("God's Comfort Word - 영상 관리 시스템 API")
    .setVersion('1.0')
    .addTag('auth')
    .addTag('videos')
    .addTag('public-videos')
    .addTag('analytics')
    .addTag('uploads')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // NestJS API 서버는 8788 포트에서 실행 (CMS 서버 8787과 구분)
  const port = process.env.PORT || 8788;
  await app.listen(port);
  console.log('============================================================');
  console.log(`✅ NestJS API Server running on http://localhost:${port}`);
  console.log(`📚 Swagger UI: http://localhost:${port}/api-docs`);
  console.log('============================================================');
}
bootstrap();



