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

  /**
   * ✅ CORS 설정 (운영 + 로컬)
   * - Firebase CMS(웹앱)에서 Render API 호출 시 preflight(OPTIONS)가 발생하므로
   *   운영 도메인을 반드시 허용해야 합니다.
   * - credentials: true 이면 origin은 '*' 불가 → 정확한 도메인만 허용해야 합니다.
   */
  const allowedOrigins = [
    // 로컬 개발
    'http://localhost:5173',
    'http://localhost:8787',
    'http://localhost:3000',

    // 운영( Firebase Hosting )
    'https://gods-comfort-word-cms.web.app',
    'https://cms.godcomfortword.com',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // origin 없는 요청(서버 간 호출/헬스체크 등)은 허용
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
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

  // Render에서는 PORT 환경변수를 반드시 사용합니다.
  const port = process.env.PORT || 8788;

  await app.listen(port);
  console.log('============================================================');
  console.log(`✅ NestJS API Server running on port ${port}`);
  console.log(`📚 Swagger UI: /api-docs`);
  console.log('============================================================');
}

bootstrap();
