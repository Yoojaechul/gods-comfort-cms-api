
import { Module } from '@nestjs/common';
import { CreatorVideosController } from './videos.controller';
import { CreatorVideosService } from './videos.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CreatorVideosController],
  providers: [CreatorVideosService],
})
export class CreatorVideosModule {}

