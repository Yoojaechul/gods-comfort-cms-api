// src/admin/videos/videos.controller.ts
import {
  Controller,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Delete,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UploadsService } from '../../uploads/uploads.service';
import { DatabaseService } from '../../database/database.service';
import * as path from 'path';

@ApiTags('admin/videos')
@Controller('admin/videos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminVideosController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * 영상 썸네일 업로드/업데이트
   * multipart/form-data로 파일을 받아 서버에 저장하고 DB의 thumbnail_url 업데이트
   */
  @Post(':id/thumbnail')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    description: '영상 ID',
    type: String,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '썸네일 이미지 파일 (jpg, jpeg, png, gif, webp)',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: '영상 썸네일 업로드/업데이트',
    description:
      'multipart/form-data로 썸네일 이미지 파일을 업로드하고 해당 영상의 thumbnail_url을 업데이트합니다. 인증 필요(JWT Bearer Token).',
  })
  @ApiResponse({
    status: 200,
    description: '업로드 및 업데이트 성공',
    schema: {
      type: 'object',
      properties: {
        thumbnailUrl: {
          type: 'string',
          example: '/uploads/thumbnails/1234567890_abc123.jpg',
          description: '업로드된 썸네일 이미지의 URL(상대경로)',
        },
      },
      required: ['thumbnailUrl'],
    },
    example: {
      thumbnailUrl: '/uploads/thumbnails/1234567890_abc123.jpg',
    },
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (파일 없음, 잘못된 형식)',
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  @ApiResponse({
    status: 404,
    description: '영상을 찾을 수 없음',
  })
  @ApiResponse({
    status: 500,
    description: '서버 오류',
  })
  async uploadThumbnail(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ thumbnailUrl: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // 파일 확장자 검증(이미지만 허용)
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: jpg, jpeg, png, gif, webp',
      );
    }

    try {
      // 영상 존재 확인
      const db = this.databaseService.getDb();
      const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(id) as any;

      if (!video) {
        throw new NotFoundException({
          message: '영상을 찾을 수 없습니다.',
          error: 'Not Found',
        });
      }

      // 썸네일 파일 저장
      const result = await this.uploadsService.saveThumbnail(file);
      const thumbnailUrl = result.thumbnailUrl;

      // DB에서 해당 video의 thumbnail_url 업데이트
      db.prepare('UPDATE videos SET thumbnail_url = ? WHERE id = ?').run(
        thumbnailUrl,
        id,
      );

      return { thumbnailUrl };
    } catch (err: any) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      console.error('[POST /admin/videos/:id/thumbnail] 썸네일 업로드 오류:', err);
      throw new InternalServerErrorException('Failed to upload thumbnail');
    }
  }

  /**
   * ✅ 관리자 영상 삭제
   * - DELETE /admin/videos/:id
   * - 성공 시 204 No Content
   * - videos 테이블 row 삭제
   * - thumbnail_url이 /uploads/thumbnails/... 이면 /tmp/uploads/thumbnails 파일도 삭제 시도
   */
  @Delete(':id')
  @HttpCode(204)
  @ApiParam({
    name: 'id',
    description: '영상 ID',
    type: String,
  })
  @ApiOperation({
    summary: '관리자 영상 삭제',
    description:
      '해당 영상 ID를 DB에서 삭제합니다. 썸네일이 GCS에 있으면 파일도 삭제 시도합니다. 인증 필요(JWT).',
  })
  @ApiResponse({ status: 204, description: '삭제 성공 (No Content)' })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  @ApiResponse({ status: 404, description: '영상을 찾을 수 없음' })
  async deleteVideo(@Param('id') id: string): Promise<void> {
    const db = this.databaseService.getDb();

    // 1) 영상 존재 확인 + 썸네일 경로 확보
    const video = db
      .prepare('SELECT id, thumbnail_url FROM videos WHERE id = ?')
      .get(id) as any;

    if (!video) {
      throw new NotFoundException({
        message: '영상을 찾을 수 없습니다.',
        error: 'Not Found',
      });
    }

    // 2) DB 삭제
    db.prepare('DELETE FROM videos WHERE id = ?').run(id);

    // 3) GCS 썸네일 파일 삭제 시도 (실패해도 무시)
    try {
      const thumb: string | null = video.thumbnail_url ?? null;

      if (thumb && typeof thumb === 'string') {
        // GCS URL 또는 상대 경로 모두 처리
        const result = await this.uploadsService.deleteThumbnail(thumb);
        if (result.success) {
          console.log(`✅ Deleted thumbnail from GCS: ${thumb}`);
        } else {
          console.warn(`⚠️ Failed to delete thumbnail from GCS: ${thumb}`);
        }
      }
    } catch (e) {
      console.warn('[DELETE /admin/videos/:id] thumbnail file delete skipped:', e);
    }

    // 204 No Content
    return;
  }
}
