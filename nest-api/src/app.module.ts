import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { VideosModule } from './videos/videos.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { FacebookKeyModule } from './facebook-key/facebook-key.module';

@Module({
  imports: [
    // 환경변수 설정
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // 데이터베이스 모듈
    DatabaseModule,
    // 인증 모듈
    AuthModule,
    // 영상 모듈
    VideosModule,
    // 접속자 통계 모듈
    AnalyticsModule,
    // Facebook Key 모듈
    FacebookKeyModule,
  ],
})
export class AppModule {}




