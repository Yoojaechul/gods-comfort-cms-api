/**
 * ============================================================================
 * ⚠️ 중요: API 테스트 방법 안내
 * ============================================================================
 * 
 * Windows PowerShell에서 curl.exe 사용 시 JSON 파싱 오류가 발생할 수 있습니다.
 * 
 * [문제 원인]
 * - Windows PowerShell의 curl.exe는 JSON 문자열을 PowerShell 문법으로 선파싱하여
 *   `{}`, `"`, `\` 문자가 깨질 수 있음
 * - 이로 인해 서버에서는 다음과 같은 오류가 발생할 수 있음:
 *   "Expected property name or '}' in JSON at position 1"
 * - 이는 서버 문제가 아니라 **클라이언트 테스트 도구 문제**임
 * 
 * [권장 테스트 방법]
 * 1. PowerShell: Invoke-RestMethod 사용 (권장)
 *    예: Invoke-RestMethod -Method POST -Uri "http://localhost:3000/auth/login" `
 *        -ContentType "application/json" -Body '{"email":"user@example.com","password":"pass"}'
 * 
 * 2. Frontend: fetch / axios 사용
 * 
 * 3. curl: Linux / WSL 환경에서만 사용
 *    Windows PowerShell에서 curl.exe 사용 금지
 * 
 * [인증 로직]
 * - password_hash: scrypt 알고리즘으로 해싱 (128 hex 길이)
 * - 검증: DatabaseService.verifyPassword() 사용 (scrypt 기반)
 * - salt: api_key_salt 컬럼에 저장
 * 
 * ============================================================================
 */

import { Controller, Post, Get, Body, UseGuards, Req, ForbiddenException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetupPasswordDto } from './dto/setup-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangePasswordEmailDto } from './dto/change-password-email.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * 헬스 체크 엔드포인트
   */
  @Get('health')
  @ApiOperation({ summary: 'Auth 모듈 헬스 체크' })
  @ApiResponse({ status: 200, description: 'Auth 모듈이 정상 동작 중' })
  healthCheck() {
    return {
      status: 'ok',
      message: 'Auth module is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 로그인 (username + password)
   * 
   * ⚠️ 테스트 시 주의사항:
   * - Windows PowerShell에서 curl.exe 사용 금지 (JSON 파싱 오류 발생 가능)
   * - 권장: Invoke-RestMethod 또는 Frontend fetch/axios 사용
   * - curl은 Linux/WSL 환경에서만 사용
   */
  @Post('login')
  @ApiOperation({ summary: '사용자명/비밀번호 로그인' })
  @ApiResponse({
    status: 200,
    description: '로그인 성공, JWT 토큰 발급',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIs...',
        user: {
          id: 'admin-001',
          username: 'admin',
          role: 'admin',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: '잘못된 사용자명 또는 비밀번호' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    // JSON 파싱 디버그 로그 (비밀번호 마스킹 처리)
    const contentType = req.headers['content-type'] || 'undefined';
    this.logger.log(`[LOGIN] content-type=${contentType}`);
    
    // 비밀번호를 마스킹한 loginDto 복사본 생성
    const maskedLoginDto = {
      ...loginDto,
      password: loginDto.password ? `*** (length=${loginDto.password.length})` : undefined,
    };
    this.logger.log(`[LOGIN] body=${JSON.stringify(maskedLoginDto)}`);
    
    const identifier = loginDto.username || loginDto.email || 'unknown';
    this.logger.log(`[LOGIN] 로그인 시도 시작: ${identifier}`);

    try {
      const result = await this.authService.login(loginDto);
      this.logger.log(`[LOGIN] 로그인 성공: ${result.user?.id} (${result.user?.role})`);
      return result;
    } catch (error) {
      // 상세 에러 로깅 (스택 트레이스 포함)
      this.logger.error(
        `[LOGIN] 로그인 실패: ${identifier}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.logger.error(`[LOGIN] 에러 타입: ${error?.constructor?.name || 'Unknown'}`);
      this.logger.error(`[LOGIN] 에러 메시지: ${error instanceof Error ? error.message : String(error)}`);
      
      // 원인별 상세 로깅
      if (error instanceof Error) {
        if (error.message.includes('Invalid username/email or password')) {
          this.logger.warn(`[LOGIN] 인증 실패 - 사용자 없음 또는 비밀번호 불일치: ${identifier}`);
        } else if (error.message.includes('비밀번호가 설정되지 않았습니다')) {
          this.logger.warn(`[LOGIN] 비밀번호 미설정 계정: ${identifier}`);
        } else if (error.message.includes('DB') || error.message.includes('database')) {
          this.logger.error(`[LOGIN] DB 연결/쿼리 오류 발생`);
        }
      }
      
      // 에러를 다시 throw하여 Exception Filter가 처리하도록 함
      throw error;
    }
  }

  /**
   * 최초 비밀번호 설정
   */
  @Post('setup-password')
  @ApiOperation({ summary: '최초 비밀번호 설정 또는 재설정' })
  @ApiResponse({
    status: 200,
    description: '비밀번호 설정 성공, JWT 토큰 발급',
    schema: {
      example: {
        token: 'eyJhbGciOiJIUzI1NiIs...',
        expiresAt: '2025-12-11T...',
        user: {
          id: 'abc123',
          name: 'Manager',
          email: 'manager@example.com',
          role: 'admin',
          site_id: null,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: '이미 비밀번호가 설정됨' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  @ApiResponse({ status: 409, description: '이메일 중복' })
  async setupPassword(@Body() setupPasswordDto: SetupPasswordDto) {
    return this.authService.setupPassword(setupPasswordDto);
  }

  /**
   * 현재 로그인한 사용자 정보 조회
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '현재 로그인한 사용자 정보 조회' })
  @ApiResponse({
    status: 200,
    description: '사용자 정보 반환',
    schema: {
      example: {
        id: 'admin-001',
        username: 'admin',
        name: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        site_id: null,
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  async getMe(@Req() req: Request) {
    // JWT 토큰에서 추출한 사용자 정보 반환
    const user = (req as any).user;
    return {
      id: user.sub || user.id,
      username: user.username,
      name: user.username,
      email: user.email || `${user.username}@example.com`,
      role: user.role,
      site_id: user.site_id || null,
    };
  }

  /**
   * 이메일 확인
   */
  @Post('check-email')
  @ApiOperation({ summary: '이메일 존재 여부 확인' })
  @ApiResponse({
    status: 200,
    description: '이메일 확인 결과',
    schema: {
      example: {
        exists: true,
        role: 'admin',
      },
    },
  })
  async checkEmail(@Body() checkEmailDto: CheckEmailDto) {
    return this.authService.checkEmail(checkEmailDto.email);
  }

  /**
   * 비밀번호 변경 (이메일 기반, JWT 인증 없음)
   * email + currentPassword로 사용자 인증 후 비밀번호 변경
   */
  @Post('change-password')
  @ApiOperation({ summary: '비밀번호 변경 (이메일 기반)' })
  @ApiResponse({
    status: 200,
    description: '비밀번호 변경 성공',
    schema: {
      example: {
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.',
      },
    },
  })
  @ApiResponse({ status: 400, description: '현재 비밀번호가 올바르지 않음 또는 잘못된 요청' })
  @ApiResponse({ status: 403, description: '권한 없음 (admin/creator만 가능)' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async changePassword(@Body() changePasswordEmailDto: ChangePasswordEmailDto) {
    const { email } = changePasswordEmailDto;
    this.logger.log(`[CHANGE_PASSWORD] 비밀번호 변경 시도 시작: ${email}`);

    try {
      const result = await this.authService.changePasswordByEmail(
        changePasswordEmailDto.email,
        changePasswordEmailDto.currentPassword,
        changePasswordEmailDto.newPassword,
      );

      if (!result.ok) {
        // 사용자를 찾을 수 없는 경우 404
        if (result.message === '사용자를 찾을 수 없습니다.') {
          this.logger.warn(`[CHANGE_PASSWORD] 사용자 없음: ${email}`);
          throw new NotFoundException(result.message);
        }
        // 그 외의 경우 400
        this.logger.warn(`[CHANGE_PASSWORD] 실패: ${email} - ${result.message}`);
        throw new BadRequestException(result.message || '비밀번호 변경에 실패했습니다.');
      }

      this.logger.log(`[CHANGE_PASSWORD] 비밀번호 변경 성공: ${email}`);
      return {
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.',
      };
    } catch (error) {
      // NotFoundException, BadRequestException은 그대로 전달
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }

      // 예상치 못한 에러는 상세 로깅
      this.logger.error(
        `[CHANGE_PASSWORD] 예상치 못한 에러 발생: ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.logger.error(`[CHANGE_PASSWORD] 에러 타입: ${error?.constructor?.name || 'Unknown'}`);
      this.logger.error(`[CHANGE_PASSWORD] 에러 메시지: ${error instanceof Error ? error.message : String(error)}`);
      
      // 클라이언트에는 일반적인 메시지만 반환 (보안)
      throw new BadRequestException('비밀번호 변경 중 오류가 발생했습니다.');
    }
  }

  /**
   * 비밀번호 변경 (JWT 기반)
   * 역할 체크: admin 또는 creator만 가능
   * DB 업데이트: 현재 비밀번호 검증 후 새 비밀번호 해시하여 업데이트
   */
  @Post('change-password-jwt')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '비밀번호 변경 (JWT 기반)' })
  @ApiResponse({
    status: 200,
    description: '비밀번호 변경 성공',
    schema: {
      example: {
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.',
      },
    },
  })
  @ApiResponse({ status: 400, description: '현재 비밀번호가 올바르지 않음' })
  @ApiResponse({ status: 401, description: '인증되지 않은 사용자' })
  @ApiResponse({ status: 403, description: '권한 없음 (admin/creator만 가능)' })
  async changePasswordJwt(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.authService.changePassword(
      user.id,
      changePasswordDto.current_password,
      changePasswordDto.new_password,
    );
  }

  /**
   * Seed 상태 진단 엔드포인트
   * - NODE_ENV !== 'production' 또는 CMS_DEBUG=true일 때만 활성화
   * - 응답에는 "이메일", "hash 길이", "salt 길이", "updated_at", "force update 적용 여부", "env 존재 여부"만 포함
   * - password/hash/salt 원문은 절대 노출 금지
   */
  @Get('seed-status')
  @ApiOperation({ summary: 'Seed 상태 진단 (디버그용)' })
  @ApiResponse({ status: 200, description: 'Seed 상태 정보 반환' })
  @ApiResponse({ status: 403, description: '프로덕션 환경에서는 접근 불가' })
  async getSeedStatus() {
    // 운영 안전장치: NODE_ENV !== 'production' 또는 CMS_DEBUG=true일 때만 활성화
    const isProduction = process.env.NODE_ENV === 'production';
    const isDebugEnabled = process.env.CMS_DEBUG === 'true';
    
    if (isProduction && !isDebugEnabled) {
      this.logger.warn('[SEED_STATUS] 프로덕션 환경에서 CMS_DEBUG=true 없이 접근 시도');
      throw new ForbiddenException('이 엔드포인트는 프로덕션 환경에서 CMS_DEBUG=true일 때만 사용 가능합니다.');
    }

    return this.authService.getSeedStatus();
  }

}










































