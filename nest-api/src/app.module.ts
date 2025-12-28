import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';

import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';

import { VideosModule } from './videos/videos.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UploadsModule } from './uploads/uploads.module';
import { DebugModule } from './debug/debug.module';
import { FacebookKeyModule } from './facebook-key/facebook-key.module';

import { AdminVideosModule } from './admin/videos/videos.module';
import { MaintenanceModule } from './admin/maintenance/maintenance.module';

import { CreatorVideosModule } from './creator/videos/videos.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
ConfigModule.forRoot({ isGlobal: true }),

    VideosModule,
    AnalyticsModule,
    UploadsModule,
    DebugModule,
    FacebookKeyModule,

    AdminVideosModule,
    MaintenanceModule,

    // ✅ creator delete 라우트 포함
    CreatorVideosModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
