import { Module } from '@nestjs/common';
import { CreatorVideosController } from './videos.controller';
import { CreatorVideosService } from './videos.service';
import { VideosService } from '../../videos/videos.service';
import { DatabaseModule } from '../../database/database.module';
import { VideosModule } from '../../videos/videos.module';

@Module({
  imports: [DatabaseModule, VideosModule],
  controllers: [CreatorVideosController],
  providers: [CreatorVideosService],
})
export class CreatorVideosModule {}

