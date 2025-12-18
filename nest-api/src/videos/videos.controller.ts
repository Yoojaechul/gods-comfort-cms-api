import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VideosService } from './videos.service';
import {
  VideoMetadataRequestDto,
  VideoMetadataResponseDto,
} from './dto/video-metadata.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  /**
   * 영상 메타데이터 조회
   * YouTube: videoId 추출 및 메타데이터 반환
   * Facebook: 기본값 반환
   */
  @Post('metadata')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '영상 메타데이터 조회',
    description:
      'YouTube 또는 Facebook URL에서 메타데이터(제목, 썸네일 URL)를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '메타데이터 조회 성공',
    type: VideoMetadataResponseDto,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  async getVideoMetadata(
    @Body() dto: VideoMetadataRequestDto,
  ): Promise<VideoMetadataResponseDto> {
    return this.videosService.getVideoMetadata(dto);
  }
}
