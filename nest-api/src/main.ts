// nest-api/src/main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 필수 환경변수 체크 (앱 부팅 시)
  logger.log('[BOOT] 필수 환경변수 체크 시작...');

  // JWT_SECRET 체크
  if (!process.env.JWT_SECRET) {
    logger.error('[FATAL] JWT_SECRET 환경변수가 설정되지 않았습니다.');
    logger.error('[FATAL] Cloud Run 환경변수 또는 .env 파일에 JWT_SECRET을 설정해주세요.');
    logger.warn('[WARN] JWT_SECRET이 없으면 JwtStrategy 초기화 시 앱이 크래시됩니다.');
  } else {
    logger.log(`[BOOT] ✅ JWT_SECRET 환경변수 확인 완료 (길이: ${process.env.JWT_SECRET.length})`);
  }

  // DB 관련 환경변수 체크
  const dbPath = process.env.SQLITE_DB_PATH;
  if (dbPath) {
    logger.log(`[BOOT] ✅ SQLITE_DB_PATH 환경변수 확인 완료: ${dbPath}`);
  } else {
    logger.warn('[BOOT] ⚠️  SQLITE_DB_PATH 환경변수가 설정되지 않음 (기본값 사용: cms.db)');
  }

  // CMS 테스트 계정 환경변수 체크 (선택사항)
  const adminEmail = process.env.CMS_TEST_ADMIN_EMAIL;
  const creatorEmail = process.env.CMS_TEST_CREATOR_EMAIL;
  if (adminEmail) {
    logger.log(`[BOOT] ✅ CMS_TEST_ADMIN_EMAIL 환경변수 확인 완료: ${adminEmail}`);
  } else {
    logger.warn('[BOOT] ⚠️  CMS_TEST_ADMIN_EMAIL 환경변수가 설정되지 않음 (기본값 사용: consulting_manager@naver.com)');
  }
  if (creatorEmail) {
    logger.log(`[BOOT] ✅ CMS_TEST_CREATOR_EMAIL 환경변수 확인 완료: ${creatorEmail}`);
  } else {
    logger.warn('[BOOT] ⚠️  CMS_TEST_CREATOR_EMAIL 환경변수가 설정되지 않음 (기본값 사용: j1dly1@naver.com)');
  }

  logger.log('[BOOT] 필수 환경변수 체크 완료');

  const app = await NestFactory.create(AppModule);

  // 전역 Exception Filter 등록 (모든 에러를 JSON으로 반환)
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: [
      "https://cms.godcomfortword.com",
      "https://gods-comfort-word-cms.web.app",
      "https://gods-comfort-word-cms.firebaseapp.com",
      "https://www.godcomfortword.com",
      "https://godcomfortword.com",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  const port = Number(process.env.PORT || 8080);
  logger.log(`[BOOT] PORT env = ${process.env.PORT || 'undefined (기본값 8080 사용)'}`);
  await app.listen(port, "0.0.0.0");
  logger.log(`[BOOT] Listening on 0.0.0.0:${port}`);
}

bootstrap();
