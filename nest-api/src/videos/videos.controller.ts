import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { VideosService } from './videos.service';
import {
  VideoMetadataRequestDto,
  VideoMetadataResponseDto,
} from './dto/video-metadata.dto';
import { CreateVideoDto } from './dto/create-video.dto';
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

/**
 * Creator 전용 영상 컨트롤러
 * Creator가 자신의 영상만 조회할 수 있는 API
 */
@ApiTags('creator')
@Controller('creator')
export class CreatorVideosController {
  constructor(private readonly videosService: VideosService) {}

  /**
   * Creator 영상 목록 조회
   * JWT에서 추출한 사용자 정보를 기반으로 자신의 영상만 반환
   */
  @Get('videos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Creator 영상 목록 조회' })
  @ApiQuery({
    name: 'site_id',
    required: false,
    description: '사이트 ID (선택적, JWT에서 가져온 값 사용)',
  })
  @ApiResponse({
    status: 200,
    description: 'Creator 영상 목록 조회 성공',
    schema: {
      example: {
        videos: [
          {
            id: 'abc123',
            title: '샘플 영상',
            platform: 'youtube',
            visibility: 'public',
            thumbnail_url: 'https://img.youtube.com/vi/.../hqdefault.jpg',
            url: 'https://www.youtube.com/watch?v=...',
            language: 'ko',
            site_id: 'gods',
            owner_id: 'creator-001',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  @ApiResponse({ status: 403, description: 'Creator 역할이 아님' })
  async getCreatorVideos(@Request() req: any, @Query('site_id') siteId?: string) {
    const user = req.user;
    const targetSiteId = siteId || user.site_id;

    // Creator는 자신의 site_id만 접근 가능
    if (user.role === 'creator' && targetSiteId !== user.site_id) {
      throw new ForbiddenException('Access denied to this site_id');
    }

    return this.videosService.getCreatorVideos(user.id, targetSiteId);
  }

  /**
   * Creator 영상 생성
   * JWT 인증 필요 (creator/admin)
   */
  @Post('videos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Creator 영상 생성' })
  @ApiResponse({
    status: 201,
    description: '영상 생성 성공',
    schema: {
      example: {
        video: {
          id: 'abc123def456...',
          site_id: 'gods',
          owner_id: 'creator-001',
          platform: 'youtube',
          video_id: 'dQw4w9WgXcQ',
          source_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: '샘플 영상',
          thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
          embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          language: 'ko',
          status: 'active',
          visibility: 'public',
          created_at: '2025-01-15T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 (필수 필드 누락 등)' })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  @ApiResponse({ status: 403, description: 'Creator 또는 Admin 역할이 아님' })
  async createCreatorVideo(@Request() req: any, @Body() dto: CreateVideoDto) {
    const user = req.user;

    // role 검증 (creator 또는 admin만 가능)
    if (user.role !== 'creator' && user.role !== 'admin') {
      throw new ForbiddenException('Only creator and admin can create videos');
    }

    // 필수 필드 검증
    if (!dto.sourceType || !dto.sourceUrl) {
      throw new BadRequestException({
        message: 'sourceType and sourceUrl are required',
        error: 'Bad Request',
      });
    }

    return this.videosService.createCreatorVideo(
      user.id,
      user.role,
      user.site_id || 'gods',
      dto,
    );
  }
}
