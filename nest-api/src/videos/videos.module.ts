import { Module } from '@nestjs/common';
import { VideosController, CreatorVideosController } from './videos.controller';
import { PublicVideosController } from './public-videos.controller';
import { VideosService } from './videos.service';
import { DatabaseModule } from '../database/database.module';

/**
 * 영상 모듈
 * videos 관련 엔드포인트 제공
 */
@Module({
  imports: [DatabaseModule],
  controllers: [VideosController, PublicVideosController, CreatorVideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}

