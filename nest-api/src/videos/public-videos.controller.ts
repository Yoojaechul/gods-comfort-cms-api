import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { VideosService } from './videos.service';
import { ToggleLikeDto } from './dto/toggle-like.dto';

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

  /**
   * 공개 영상 좋아요 토글
   * 인증 없이 접근 가능하며, IP + User-Agent 또는 x-client-key 헤더로 클라이언트 식별
   */
  @Post(':id/like')
  @ApiOperation({ summary: '공개 영상 좋아요 토글 (비회원용)' })
  @ApiParam({
    name: 'id',
    description: '영상 ID (숫자, hex 문자열, 또는 UUID)',
    example: 'abc123',
  })
  @ApiHeader({
    name: 'x-client-key',
    required: false,
    description: '클라이언트 식별자 (선택사항, 없으면 쿠키 > body > IP+User-Agent 사용)',
  })
  @ApiResponse({
    status: 200,
    description: '좋아요 토글 성공',
    schema: {
      example: {
        liked: true,
        likeCount: 42,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (ID 형식 오류 등)',
    schema: {
      example: {
        message: 'videoId는 숫자 또는 유효한 ID 형식이어야 합니다.',
        error: 'Bad Request',
        details: '받은 ID: invalid',
      },
    },
  })
  @ApiResponse({ status: 404, description: '영상을 찾을 수 없거나 비공개 영상입니다.' })
  @ApiResponse({ status: 500, description: '서버 오류' })
  async toggleLike(
    @Param('id') id: string,
    @Body() body: ToggleLikeDto | undefined,
    @Request() req: any,
  ): Promise<{ liked: boolean; likeCount: number }> {
    try {
      // ID 검증
      this.videosService.validateVideoId(id);

      // 클라이언트 ID 생성 (쿠키 > body의 clientId > 헤더의 x-client-key > IP+User-Agent)
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const clientKeyHeader = req.headers['x-client-key'];
      const cookieClientId = req.cookies?.clientId || req.signedCookies?.clientId;
      const bodyClientId = body?.clientId;

      const clientId = this.videosService.getClientId(
        cookieClientId,
        bodyClientId,
        clientKeyHeader,
        ip,
        userAgent,
      );

      return await this.videosService.toggleLike(id, clientId);
    } catch (error: any) {
      // BadRequestException 등은 그대로 전달
      throw error;
    }
  }

  /**
   * 공개 영상 좋아요 취소
   * 인증 없이 접근 가능하며, IP + User-Agent 또는 x-client-key 헤더로 클라이언트 식별
   */
  @Post(':id/unlike')
  @ApiOperation({ summary: '공개 영상 좋아요 취소 (비회원용)' })
  @ApiParam({
    name: 'id',
    description: '영상 ID (숫자 또는 hex 문자열)',
    example: 'abc123',
  })
  @ApiHeader({
    name: 'x-client-key',
    required: false,
    description: '클라이언트 식별자 (선택사항, 없으면 IP+User-Agent 사용)',
  })
  @ApiResponse({
    status: 200,
    description: '좋아요 취소 성공',
    schema: {
      example: {
        liked: false,
        likeCount: 41,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (ID 형식 오류 등)',
  })
  @ApiResponse({ status: 404, description: '영상을 찾을 수 없거나 비공개 영상입니다.' })
  @ApiResponse({ status: 500, description: '서버 오류' })
  async unlike(
    @Param('id') id: string,
    @Body() body: ToggleLikeDto | undefined,
    @Request() req: any,
  ): Promise<{ liked: boolean; likeCount: number }> {
    try {
      // ID 검증
      this.videosService.validateVideoId(id);

      // 클라이언트 ID 생성 (쿠키 > body의 clientId > 헤더의 x-client-key > IP+User-Agent)
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const clientKeyHeader = req.headers['x-client-key'];
      const cookieClientId = req.cookies?.clientId || req.signedCookies?.clientId;
      const bodyClientId = body?.clientId;

      const clientId = this.videosService.getClientId(
        cookieClientId,
        bodyClientId,
        clientKeyHeader,
        ip,
        userAgent,
      );

      return await this.videosService.unlike(id, clientId);
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * 공개 영상 조회수 증가
   * 인증 없이 접근 가능
   */
  @Post(':id/view')
  @ApiOperation({ summary: '공개 영상 조회수 증가 (비회원용)' })
  @ApiParam({
    name: 'id',
    description: '영상 ID (숫자, hex 문자열, 또는 UUID)',
    example: 'abc123',
  })
  @ApiResponse({
    status: 200,
    description: '조회수 증가 성공',
    schema: {
      example: {
        viewCount: 100,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (ID 형식 오류 등)',
  })
  @ApiResponse({ status: 404, description: '영상을 찾을 수 없거나 비공개 영상입니다.' })
  @ApiResponse({ status: 500, description: '서버 오류' })
  async view(
    @Param('id') id: string,
  ): Promise<{ viewCount: number }> {
    // ID 검증
    this.videosService.validateVideoId(id);

    return await this.videosService.incrementView(id);
  }

  /**
   * 공개 영상 공유 수 증가
   * 인증 없이 접근 가능
   */
  @Post(':id/share')
  @ApiOperation({ summary: '공개 영상 공유 수 증가 (비회원용)' })
  @ApiParam({
    name: 'id',
    description: '영상 ID (숫자, hex 문자열, 또는 UUID)',
    example: 'abc123',
  })
  @ApiResponse({
    status: 200,
    description: '공유 수 증가 성공',
    schema: {
      example: {
        shareCount: 10,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (ID 형식 오류 등)',
  })
  @ApiResponse({ status: 404, description: '영상을 찾을 수 없거나 비공개 영상입니다.' })
  @ApiResponse({ status: 500, description: '서버 오류' })
  async share(
    @Param('id') id: string,
  ): Promise<{ shareCount: number }> {
    // ID 검증
    this.videosService.validateVideoId(id);

    return await this.videosService.incrementShare(id);
  }
}












































































