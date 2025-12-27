import { Module } from '@nestjs/common';
import { AdminVideosController } from './videos.controller';
import { UploadsModule } from '../../uploads/uploads.module';
import { DatabaseModule } from '../../database/database.module';

/**
 * Admin Videos 모듈
 * admin/videos 관련 엔드포인트 제공
 */
@Module({
  imports: [UploadsModule, DatabaseModule],
  controllers: [AdminVideosController],
})
export class AdminVideosModule {}

