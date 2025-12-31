import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

/**
 * 접속자 통계 컨트롤러
 * 관리자용 접속자 통계 API
 */
@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * 접속자 통계 조회
   * 관리자만 접근 가능
   */
  @Get()
  @ApiOperation({ summary: '접속자 통계 조회 (관리자용)' })
  @ApiQuery({
    name: 'range',
    required: false,
    description: '기간 (weekly, monthly, quarterly, halfyear, yearly)',
    example: 'weekly',
  })
  @ApiResponse({
    status: 200,
    description: '통계 조회 성공',
    schema: {
      example: {
        totalVisitors: 1234,
        byLanguage: [
          { language: 'ko', count: 400 },
          { language: 'en', count: 300 },
          { language: 'es', count: 200 },
        ],
        byCountry: [
          { country: 'KR', count: 500 },
          { country: 'US', count: 300 },
          { country: 'ES', count: 150 },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음 (관리자만 가능)' })
  async getAnalytics(
    @Request() req: any,
    @Query('range') range?: string,
  ) {
    // 관리자 권한 확인
    if (req.user.role !== 'admin') {
      throw new BadRequestException('관리자만 접근 가능합니다.');
    }

    return await this.analyticsService.getAnalyticsForDashboard(
      range || 'weekly',
    );
  }
}






































































































