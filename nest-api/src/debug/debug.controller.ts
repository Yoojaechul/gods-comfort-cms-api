import { Controller, Get, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DebugService } from './debug.service';
import { ConfigService } from '@nestjs/config';
import { DebugEndpointsGuard } from './guards/debug-endpoints.guard';

/**
 * ⚠️ 중요: 이 디버그 엔드포인트는 DEBUG_ENDPOINTS=true일 때만 활성화됩니다.
 * 배포 후 원인 확인이 끝나면 반드시 DEBUG_ENDPOINTS=false로 되돌려주세요.
 */
@ApiTags('debug')
@Controller('debug')
@UseGuards(DebugEndpointsGuard)
export class DebugController {
  private readonly logger = new Logger(DebugController.name);

  constructor(
    private readonly debugService: DebugService,
    private readonly configService: ConfigService,
  ) {
    const debugEnabled = this.configService.get<string>('DEBUG_ENDPOINTS') === 'true';
    
    if (debugEnabled) {
      this.logger.warn('⚠️  [DEBUG] Debug endpoints are ENABLED. Remember to set DEBUG_ENDPOINTS=false after diagnosis.');
    } else {
      this.logger.log('[DEBUG] Debug endpoints are DISABLED. Set DEBUG_ENDPOINTS=true to enable.');
    }
  }

  /**
   * 버전 정보 조회
   */
  @Get('version')
  @ApiOperation({ summary: '버전 정보 조회 (디버그용)' })
  @ApiResponse({ status: 200, description: '버전 정보 반환' })
  @ApiResponse({ status: 404, description: 'DEBUG_ENDPOINTS가 false일 때' })
  async getVersion() {
    return this.debugService.getVersionInfo();
  }

  /**
   * DB 정보 조회
   */
  @Get('db-info')
  @ApiOperation({ summary: 'DB 정보 조회 (디버그용)' })
  @ApiResponse({ status: 200, description: 'DB 정보 반환' })
  @ApiResponse({ status: 404, description: 'DEBUG_ENDPOINTS가 false일 때' })
  async getDbInfo() {
    return this.debugService.getDbInfo();
  }

  /**
   * 로그인 검증 테스트
   */
  @Post('login-check')
  @ApiOperation({ summary: '로그인 검증 테스트 (디버그용)' })
  @ApiResponse({ status: 200, description: '검증 결과 반환' })
  @ApiResponse({ status: 404, description: 'DEBUG_ENDPOINTS가 false일 때' })
  async checkLogin(@Body() body: { email: string; password: string }) {
    if (!body.email || !body.password) {
      return {
        error: 'email and password are required',
      };
    }

    // 비밀번호는 로그에 남기지 않음 (길이만)
    this.logger.log(`[DEBUG] Login check requested for: ${body.email.substring(0, 3)}***, password length: ${body.password.length}`);

    return this.debugService.checkLogin(body.email, body.password);
  }
}

