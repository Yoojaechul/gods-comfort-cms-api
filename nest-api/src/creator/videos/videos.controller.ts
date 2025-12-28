import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { CreatorVideosService } from './videos.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('creator/videos')
@UseGuards(JwtAuthGuard)
export class CreatorVideosController {
  constructor(private readonly videosService: CreatorVideosService) {}

  @Delete(':id')
  deleteVideo(@Param('id') id: string) {
    return this.videosService.deleteById(id);
  }
}
