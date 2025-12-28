import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FacebookKeyService } from './facebook-key.service';
import { SaveFacebookKeyDto } from './dto/facebook-key.dto';

/**
 * Facebook Key 컨트롤러
 * Creator의 Facebook API 키 관리
 */
@ApiTags('facebook-key')
@Controller('facebook-key')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FacebookKeyController {
  constructor(private readonly facebookKeyService: FacebookKeyService) {}

  /**
   * 현재 사용자의 Facebook Key 조회
   */
  @Get()
  @ApiOperation({ summary: '현재 사용자의 Facebook Key 조회' })
  @ApiResponse({
    status: 200,
    description: 'Facebook Key 조회 성공',
    schema: {
      example: {
        key: 'EAABwzLixnjYBO7ZC...',
        creatorId: 'creator-001',
        creatorUsername: 'creator',
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async getCurrentUserKey(@Request() req: any) {
    return this.facebookKeyService.getCurrentUserKey(
      req.user.id,
      req.user.role,
    );
  }

  /**
   * 현재 사용자의 Facebook Key 저장/업데이트
   */
  @Put()
  @ApiOperation({ summary: '현재 사용자의 Facebook Key 저장/업데이트' })
  @ApiResponse({
    status: 200,
    description: 'Facebook Key 저장 성공',
    schema: {
      example: {
        key: 'EAABwzLixnjYBO7ZC...',
        creatorId: 'creator-001',
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음 (Creator만 가능)' })
  async saveCurrentUserKey(
    @Request() req: any,
    @Body() saveKeyDto: SaveFacebookKeyDto,
  ) {
    return this.facebookKeyService.saveCurrentUserKey(
      req.user.id,
      req.user.role,
      saveKeyDto.key,
    );
  }

  /**
   * 모든 Creator의 Facebook Key 조회 (Admin만)
   */
  @Get('all')
  @ApiOperation({ summary: '모든 Creator의 Facebook Key 조회 (Admin만)' })
  @ApiResponse({
    status: 200,
    description: '모든 Facebook Key 조회 성공',
    schema: {
      example: [
        {
          creatorId: 'creator-001',
          key: 'EAABwzLixnjYBO7ZC...',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음 (Admin만 가능)' })
  async getAllKeys(@Request() req: any) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('관리자만 모든 키를 조회할 수 있습니다.');
    }
    return this.facebookKeyService.getAllKeys(req.user.role);
  }

  /**
   * 특정 Creator의 Facebook Key 설정 (Admin만)
   */
  @Put(':creatorId')
  @ApiOperation({
    summary: '특정 Creator의 Facebook Key 설정 (Admin만)',
  })
  @ApiResponse({
    status: 200,
    description: 'Facebook Key 설정 성공',
    schema: {
      example: {
        key: 'EAABwzLixnjYBO7ZC...',
        creatorId: 'creator-001',
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음 (Admin만 가능)' })
  @ApiResponse({ status: 404, description: 'Creator를 찾을 수 없음' })
  async setKeyForCreator(
    @Request() req: any,
    @Param('creatorId') creatorId: string,
    @Body() saveKeyDto: SaveFacebookKeyDto,
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('관리자만 Creator의 키를 설정할 수 있습니다.');
    }
    return this.facebookKeyService.setKeyForCreator(
      req.user.id,
      creatorId,
      saveKeyDto.key,
    );
  }
}























