// src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
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
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT || 8787;
  await app.listen(port);
  console.log('============================================================');
  console.log(`✅ NestJS API Server running on http://localhost:${port}`);
  console.log(`📚 Swagger UI: http://localhost:${port}/api-docs`);
  console.log('============================================================');
}
bootstrap();



