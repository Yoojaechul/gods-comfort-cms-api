import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  UseGuards,
  Request,
  Body,
  Param,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VideosService } from './videos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { BulkVideoDto } from './dto/bulk-video.dto';

/**
 * 영상 컨트롤러
 * GET /videos - 현재 사용자의 영상 목록 조회
 */
@ApiTags('videos')
@Controller('videos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  /**
   * 현재 사용자의 영상 목록 조회
   * JWT 인증이 필요하며, 로그인한 사용자의 영상만 반환됩니다.
   */
  @Get()
  @ApiOperation({ summary: '영상 목록 조회 (인증 필요)' })
  @ApiResponse({
    status: 200,
    description: '영상 목록 조회 성공',
    schema: {
      example: {
        videos: [
          {
            id: 'abc123',
            title: '샘플 영상',
            platform: 'youtube',
            visibility: 'public',
            thumbnail_url: 'https://img.youtube.com/vi/.../hqdefault.jpg',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패 (토큰 없음 또는 만료)' })
  async getVideos(@Request() req: any) {
    // JWT Guard를 통해 req.user에 사용자 정보가 주입됨
    const userId = req.user.id;
    const siteId = req.user.site_id;

    const videos = await this.videosService.findVideosByUser(userId, siteId);

    return {
      videos,
    };
  }

  /**
   * 영상 생성
   * JWT 인증이 필요하며, 로그인한 사용자의 site_id로 영상이 생성됩니다.
   */
  @Post()
  @ApiOperation({ summary: '영상 등록 (인증 필요)' })
  @ApiResponse({
    status: 201,
    description: '영상 생성 성공',
    schema: {
      example: {
        id: 'abc123',
        site_id: 'gods',
        owner_id: 'user123',
        platform: 'youtube',
        source_url: 'https://www.youtube.com/watch?v=...',
        title: '샘플 영상',
        thumbnail_url: 'https://img.youtube.com/vi/.../hqdefault.jpg',
        visibility: 'public',
        language: 'ko',
        created_at: '2025-12-05T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 (필수 필드 누락 등)' })
  @ApiResponse({ status: 401, description: '인증 실패 (토큰 없음 또는 만료)' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async createVideo(@Request() req: any, @Body() createVideoDto: CreateVideoDto) {
    try {
      // JWT Guard를 통해 req.user에 사용자 정보가 주입됨
      const userId = req.user.id;
      const siteId = req.user.site_id;

      if (!siteId) {
        throw new BadRequestException(
          '사용자에게 site_id가 설정되어 있지 않습니다.',
        );
      }

      const video = await this.videosService.createVideo(
        userId,
        siteId,
        createVideoDto,
      );

      return video;
    } catch (error) {
      // 이미 HttpException이면 그대로 전달
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      // 그 외의 에러는 500으로 처리
      throw new InternalServerErrorException(
        error.message || '영상 생성 중 오류가 발생했습니다.',
      );
    }
  }

  /**
   * 영상 수정
   * JWT 인증이 필요하며, Creator는 자신의 site_id 영상만 수정 가능합니다.
   */
  @Put(':id')
  @ApiOperation({ summary: '영상 수정 (인증 필요)' })
  @ApiResponse({
    status: 200,
    description: '영상 수정 성공',
    schema: {
      example: {
        id: 'abc123',
        title: '수정된 영상 제목',
        platform: 'youtube',
        visibility: 'public',
        thumbnail_url: 'https://img.youtube.com/vi/.../hqdefault.jpg',
        url: 'https://www.youtube.com/watch?v=...',
        language: 'ko',
      },
    },
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 (필드 검증 실패 등)' })
  @ApiResponse({ status: 401, description: '인증 실패 (토큰 없음 또는 만료)' })
  @ApiResponse({ status: 403, description: '권한 없음 (Creator는 자신의 site_id 영상만 수정 가능)' })
  @ApiResponse({ status: 404, description: '영상을 찾을 수 없음' })
  async updateVideo(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateVideoDto: UpdateVideoDto,
  ) {
    try {
      // JWT Guard를 통해 req.user에 사용자 정보가 주입됨
      const userId = req.user.id;
      const userRole = req.user.role;
      const siteId = req.user.site_id;

      const video = await this.videosService.updateVideo(
        id,
        userId,
        userRole,
        siteId,
        updateVideoDto,
      );

      return video;
    } catch (error) {
      // 이미 HttpException이면 그대로 전달
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // 그 외의 에러는 500으로 처리
      throw new InternalServerErrorException(
        error.message || '영상 수정 중 오류가 발생했습니다.',
      );
    }
  }

  /**
   * 영상 삭제
   * JWT 인증이 필요하며, Creator는 자신의 site_id 영상만 삭제 가능합니다.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '영상 삭제 (인증 필요)' })
  @ApiResponse({
    status: 204,
    description: '영상 삭제 성공 (응답 본문 없음)',
  })
  @ApiResponse({ status: 401, description: '인증 실패 (토큰 없음 또는 만료)' })
  @ApiResponse({ status: 403, description: '권한 없음 (Creator는 자신의 site_id 영상만 삭제 가능)' })
  @ApiResponse({ status: 404, description: '영상을 찾을 수 없음' })
  async deleteVideo(@Request() req: any, @Param('id') id: string) {
    try {
      // JWT Guard를 통해 req.user에 사용자 정보가 주입됨
      const userId = req.user.id;
      const userRole = req.user.role;
      const siteId = req.user.site_id;

      await this.videosService.deleteVideo(id, userId, userRole, siteId);

      // 204 No Content는 응답 본문이 없음
      return;
    } catch (error) {
      // 이미 HttpException이면 그대로 전달
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      // 그 외의 에러는 500으로 처리
      throw new InternalServerErrorException(
        error.message || '영상 삭제 중 오류가 발생했습니다.',
      );
    }
  }

  /**
   * 대량 영상 등록 (간단한 버전)
   * JWT 인증이 필요하며, CreateVideoDto[] 배열을 받아 일괄 생성합니다.
   * sourceUrl이 비어있거나 삭제 체크된 항목은 자동으로 skip됩니다.
   */
  @Post('bulk')
  @ApiOperation({
    summary: '대량 영상 등록 (인증 필요)',
    description:
      'CreateVideoDto[] 배열을 받아 일괄 생성합니다. 모든 영상에 owner_id가 자동으로 설정됩니다.',
  })
  @ApiResponse({
    status: 201,
    description: '대량 영상 등록 완료',
    schema: {
      example: {
        success: 5,
        failed: 1,
        results: [
          {
            id: 'abc123',
            title: '샘플 영상',
            platform: 'youtube',
          },
        ],
        errors: [
          {
            index: 3,
            error: 'sourceUrl이 필요합니다.',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 401, description: '인증 실패 (토큰 없음 또는 만료)' })
  async bulkCreate(
    @Request() req: any,
    @Body() dtos: CreateVideoDto[],
  ) {
    console.log('[VideosController] POST /videos/bulk 요청 수신');
    console.log('[VideosController] 요청 body:', JSON.stringify(dtos, null, 2));
    console.log('[VideosController] 사용자 정보:', {
      id: req.user?.id,
      role: req.user?.role,
      site_id: req.user?.site_id,
    });

    try {
      if (!Array.isArray(dtos) || dtos.length === 0) {
        throw new BadRequestException('영상 배열이 필요합니다.');
      }

      const ownerId = req.user.id;
      const siteId = req.user.site_id;

      if (!siteId && req.user.role !== 'admin') {
        throw new BadRequestException(
          '사용자에게 site_id가 설정되어 있지 않습니다.',
        );
      }

      console.log('[VideosController] bulkCreate 호출:', {
        ownerId,
        siteId,
        count: dtos.length,
      });

      const results = await this.videosService.bulkCreate(
        dtos,
        ownerId,
        siteId || null,
      );

      console.log('[VideosController] bulkCreate 완료:', {
        success: results.success,
        failed: results.failed,
      });

      return results;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        error.message || '대량 영상 등록 중 오류가 발생했습니다.',
      );
    }
  }

  /**
   * 대량 영상 등록/편집/삭제 (Upsert) - 고급 버전
   * JWT 인증이 필요하며, 최대 20개까지 한 번에 처리 가능합니다.
   * - id가 없으면: create (owner_id 자동 설정)
   * - id가 있으면: update
   * - deleteChecked가 true이면: delete
   */
  @Post('bulk/upsert')
  @ApiOperation({
    summary: '대량 영상 등록/편집/삭제 (인증 필요, 최대 20개)',
    description:
      'id가 없으면 생성, id가 있으면 수정, deleteChecked가 true이면 삭제합니다. 모든 작업에서 owner_id가 자동으로 설정됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '대량 영상 처리 완료',
    schema: {
      example: {
        created: 5,
        updated: 10,
        deleted: 2,
        failed: 1,
        errors: [
          {
            index: 3,
            id: 'abc123',
            action: 'update',
            error: '영상을 찾을 수 없습니다.',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 (20개 초과 등)' })
  @ApiResponse({ status: 401, description: '인증 실패 (토큰 없음 또는 만료)' })
  async bulkUpsertVideos(
    @Request() req: any,
    @Body() videos: BulkVideoDto[],
  ) {
    try {
      // 최대 20개 제한
      if (!Array.isArray(videos) || videos.length === 0) {
        throw new BadRequestException('영상 배열이 필요합니다.');
      }

      if (videos.length > 20) {
        throw new BadRequestException('한 번에 최대 20개까지만 처리 가능합니다.');
      }

      const userId = req.user.id;
      const siteId = req.user.site_id;
      const userRole = req.user.role;

      if (!siteId && userRole !== 'admin') {
        throw new BadRequestException(
          '사용자에게 site_id가 설정되어 있지 않습니다.',
        );
      }

      const results = await this.videosService.bulkUpsertVideos(
        userId,
        siteId || null,
        userRole,
        videos,
      );

      return results;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      // DB 오류 등 내부 오류는 사용자 친화적인 메시지로 변환
      throw new InternalServerErrorException(
        '영상 저장 중 오류가 발생했습니다.',
      );
    }
  }

  /**
   * Facebook 썸네일 백필 (관리자용)
   * 기존 Facebook 영상 중 썸네일이 없는 것들에 대해 자동으로 썸네일을 가져옵니다.
   */
  @Post('backfill-facebook-thumbnails')
  @ApiOperation({ summary: 'Facebook 썸네일 백필 (관리자용)' })
  @ApiResponse({
    status: 200,
    description: 'Facebook 썸네일 백필 완료',
    schema: {
      example: {
        processed: 10,
        success: 8,
        failed: 2,
        errors: [
          {
            videoId: 'abc123',
            error: 'Facebook API 호출 실패',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async backfillFacebookThumbnails(@Request() req: any) {
    try {
      // 관리자만 접근 가능하도록 체크 (선택사항)
      const userRole = req.user.role;
      if (userRole !== 'admin') {
        throw new ForbiddenException('관리자만 접근 가능합니다.');
      }

      const results = await this.videosService.backfillFacebookThumbnails();
      return results;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        error.message || 'Facebook 썸네일 백필 중 오류가 발생했습니다.',
      );
    }
  }
}

