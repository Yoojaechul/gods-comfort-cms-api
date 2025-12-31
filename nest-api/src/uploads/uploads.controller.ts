import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import * as path from 'path';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * 썸네일 파일 업로드
   * multipart/form-data로 파일을 받아서 서버에 저장
   */
  @Post('thumbnail')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '썸네일 이미지 파일 (jpg, jpeg, png, gif, webp)',
        },
        video_id: {
          type: 'string',
          description: '선택: 썸네일을 업데이트할 영상 ID',
        },
      },
    },
  })
  @ApiOperation({
    summary: '썸네일 파일 업로드',
    description:
      'multipart/form-data로 썸네일 이미지 파일을 업로드합니다. 인증이 필요합니다 (JWT Bearer Token).',
  })
  @ApiResponse({
    status: 201,
    description: '업로드 성공',
    schema: {
      type: 'object',
      properties: {
        thumbnailUrl: {
          type: 'string',
          example: '/uploads/thumbnails/1234567890_abc123.jpg',
          description: '업로드된 썸네일 이미지의 상대경로 URL (정적 서빙 경로)',
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
    schema: {
      type: 'object',
      properties: {
        statusCode: {
          type: 'number',
          example: 400,
        },
        message: {
          type: 'string',
          example: 'No file uploaded',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
    schema: {
      type: 'object',
      properties: {
        statusCode: {
          type: 'number',
          example: 401,
        },
        message: {
          type: 'string',
          example: 'Unauthorized',
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: '서버 오류',
    schema: {
      type: 'object',
      properties: {
        statusCode: {
          type: 'number',
          example: 500,
        },
        message: {
          type: 'string',
          example: 'Failed to upload thumbnail',
        },
      },
    },
  })
  async uploadThumbnail(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ thumbnailUrl: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // 파일 확장자 검증 (이미지만 허용)
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: jpg, jpeg, png, gif, webp',
      );
    }

    try {
      const result = await this.uploadsService.saveThumbnail(file);
      return result;
    } catch (err) {
      console.error('[POST /uploads/thumbnail] 썸네일 업로드 오류:', err);
      throw new InternalServerErrorException('Failed to upload thumbnail');
    }
  }
}































