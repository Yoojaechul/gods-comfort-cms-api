import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { VideosService } from './videos.service';

/**
 * 공개용 영상 컨트롤러
 * 인증 없이 접근 가능한 공개 영상 조회 API
 */
@ApiTags('public-videos')
@Controller('public/videos')
export class PublicVideosController {
  constructor(private readonly videosService: VideosService) {}

  /**
   * 공개 영상 목록 조회
   * 인증 없이 접근 가능하며, visibility = 'public'인 영상만 반환됩니다.
   */
  @Get()
  @ApiOperation({ summary: '공개 영상 목록 조회 (비회원용)' })
  @ApiQuery({
    name: 'language',
    required: false,
    description: '언어 필터 (예: "ko", "en")',
    example: 'ko',
  })
  @ApiQuery({
    name: 'platform',
    required: false,
    description: '플랫폼 필터 ("youtube" | "facebook" | "other")',
    example: 'youtube',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '최대 개수 (기본값: 12, 최대: 50)',
    example: 12,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: '공개 영상 목록 조회 성공',
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
          },
        ],
      },
    },
  })
  async getPublicVideos(
    @Query('language') language?: string,
    @Query('platform') platform?: string,
    @Query('limit') limit?: string,
  ) {
    // limit 파라미터 검증 및 변환
    let limitNum = 12; // 기본값
    if (limit) {
      const parsed = parseInt(limit, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
        limitNum = parsed;
      } else if (parsed > 50) {
        limitNum = 50; // 최대값 제한
      }
    }

    const videos = await this.videosService.getPublicVideos({
      language,
      platform,
      limit: limitNum,
    });

    return {
      videos,
    };
  }

  /**
   * 공개 영상 상세 조회
   * 인증 없이 접근 가능하며, visibility = 'public'인 영상만 반환됩니다.
   */
  @Get(':id')
  @ApiOperation({ summary: '공개 영상 상세 조회 (비회원용)' })
  @ApiResponse({
    status: 200,
    description: '공개 영상 상세 조회 성공',
    schema: {
      example: {
        id: 'abc123',
        title: '샘플 영상',
        platform: 'youtube',
        visibility: 'public',
        thumbnail_url: 'https://img.youtube.com/vi/.../hqdefault.jpg',
        url: 'https://www.youtube.com/watch?v=...',
        language: 'ko',
      },
    },
  })
  @ApiResponse({ status: 404, description: '영상을 찾을 수 없거나 비공개 영상입니다.' })
  async getPublicVideoById(@Param('id') id: string) {
    const video = await this.videosService.getPublicVideoById(id);

    if (!video) {
      throw new NotFoundException('영상을 찾을 수 없거나 비공개 영상입니다.');
    }

    return video;
  }
}




































