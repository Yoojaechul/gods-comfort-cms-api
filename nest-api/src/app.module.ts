import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { VideosModule } from './videos/videos.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { FacebookKeyModule } from './facebook-key/facebook-key.module';
import { UploadsModule } from './uploads/uploads.module';
import { DebugModule } from './debug/debug.module';
import { MaintenanceModule } from './admin/maintenance/maintenance.module';
import { AdminVideosModule } from './admin/videos/videos.module';

@Module({
  controllers: [AppController],
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
    // 업로드 모듈
    UploadsModule,
    // 디버그 모듈 (DEBUG_ENDPOINTS=true일 때만 활성화)
    // ⚠️ 중요: 배포 후 원인 확인이 끝나면 DEBUG_ENDPOINTS=false로 되돌려주세요.
    DebugModule,
    // Maintenance 모듈
    MaintenanceModule,
    // Admin Videos 모듈
    AdminVideosModule,
  ],
})
export class AppModule {}




