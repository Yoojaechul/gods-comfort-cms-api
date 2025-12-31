import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';

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

    // 정적 파일 서빙: /uploads -> /app/data/uploads (Cloud Run 영구 볼륨)
    ServeStaticModule.forRoot({
      rootPath: process.env.UPLOADS_BASE_PATH || '/app/data/uploads',
      serveRoot: '/uploads',
      serveStaticOptions: {
        setHeaders: (res, filePath, stat) => {
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
      },
    }),

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
