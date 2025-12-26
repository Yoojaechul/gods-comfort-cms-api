import { Controller, Post, Get, Body, UseGuards, Request, ForbiddenException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
  async login(@Body() loginDto: LoginDto) {
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
  async getMe(@Request() req: any) {
    // JWT 토큰에서 추출한 사용자 정보 반환
    return {
      id: req.user.sub || req.user.id,
      username: req.user.username,
      name: req.user.username,
      email: req.user.email || `${req.user.username}@example.com`,
      role: req.user.role,
      site_id: req.user.site_id || null,
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
    @Request() req: any,
  ) {
    return this.authService.changePassword(
      req.user.id,
      changePasswordDto.current_password,
      changePasswordDto.new_password,
    );
  }

}










































