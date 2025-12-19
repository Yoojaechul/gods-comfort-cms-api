// src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CorsResponseInterceptor } from './common/interceptors/cors-response.interceptor';
import { ALLOWED_ORIGINS } from './common/constants/cors.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /**
   * ✅ CORS 설정 (최상단 배치 - 라우터, 인증, 에러 핸들러보다 먼저 적용)
   * - Cloud Run API에서 CMS 웹앱 호출 시 preflight(OPTIONS)가 발생하므로
   *   운영 도메인을 반드시 허용해야 합니다.
   * - credentials: true 이면 origin은 '*' 불가 → 정확한 도메인만 허용해야 합니다.
   * - OPTIONS preflight 요청에 대해 204로 빠르게 응답합니다.
   * - 모든 응답(POST, GET, 에러 포함)에 Access-Control-Allow-Origin 헤더가 포함됩니다.
   */
  app.enableCors({
    origin: (origin, callback) => {
      // origin 없는 요청(서버 간 호출/헬스체크 등)은 허용
      if (!origin) {
        return callback(null, true);
      }

      // 허용된 origin인지 확인
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      // 차단된 origin 로깅
      console.warn(`⚠️ CORS blocked: ${origin} (Allowed: ${ALLOWED_ORIGINS.join(', ')})`);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Total-Count'],
    credentials: true, // 쿠키 지원 (JWT 전략에서 쿠키 토큰도 지원)
    maxAge: 86400, // preflight 캐싱 24시간
    optionsSuccessStatus: 204, // OPTIONS 요청에 204 응답
  });

  // Global Exception Filter 등록 (에러 응답에도 CORS 헤더 포함)
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global Interceptor 등록 (정상 응답에도 CORS 헤더 명시적으로 추가)
  app.useGlobalInterceptors(new CorsResponseInterceptor());

  // 쿠키 파서 설정 (JWT 토큰을 쿠키에서 읽기 위해 필요)
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());

  // 정적 파일 서빙 설정 (업로드된 썸네일 파일 접근)
  const uploadsPath = join(process.cwd(), 'uploads', 'thumbnails');
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/thumbnails',
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
