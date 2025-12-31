import { Controller, Delete, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CreatorVideosService } from './videos.service';
import { VideosService } from '../../videos/videos.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('creator')
@Controller('creator/videos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreatorVideosController {
  constructor(
    private readonly creatorVideosService: CreatorVideosService,
    private readonly videosService: VideosService,
  ) {}

  /**
   * 영상 삭제 (id 또는 management_id 지원)
   */
  @Delete(':id')
  @ApiOperation({ summary: '영상 삭제' })
  @ApiParam({ name: 'id', description: '영상 ID 또는 management_id' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '영상을 찾을 수 없음' })
  deleteVideo(@Param('id') id: string) {
    // management_id 형식인지 확인 (YYMMDD-NN 형식)
    const isManagementId = /^\d{6}-\d{2}$/.test(id);
    
    if (isManagementId) {
      return this.creatorVideosService.deleteByManagementId(id);
    } else {
      return this.creatorVideosService.deleteById(id);
    }
  }

  /**
   * 조회수 증가 (management_id 기반)
   */
  @Post(':managementId/view')
  @ApiOperation({ summary: '영상 조회수 증가' })
  @ApiParam({ name: 'managementId', description: '관리번호 (YYMMDD-NN 형식)' })
  @ApiResponse({ status: 200, description: '조회수 증가 성공' })
  @ApiResponse({ status: 404, description: '영상을 찾을 수 없음' })
  incrementView(@Param('managementId') managementId: string) {
    return this.videosService.incrementViewByManagementId(managementId);
  }
}
