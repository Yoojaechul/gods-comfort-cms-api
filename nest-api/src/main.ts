import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Cloud Run 필수: PORT 환경변수(기본 8080)로 리슨해야 함
  const port = Number.parseInt(process.env.PORT || '8080', 10);

  // ✅ Cloud Run / 프록시 환경에서 유용 (필요 없으면 지워도 됨)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // ✅ Cloud Run 필수: 0.0.0.0 바인딩
  await app.listen(port, '0.0.0.0');

  // 로그 (Cloud Run 로그에서 확인용)
  // eslint-disable-next-line no-console
  console.log(`🚀 CMS API listening on http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
