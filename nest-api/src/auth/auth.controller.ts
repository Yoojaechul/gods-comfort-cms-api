import { Controller, Post, Get, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
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
    try {
      console.log('[POST /auth/login] 요청 수신:', { 
        email: loginDto.email, 
        username: loginDto.username,
        hasPassword: !!loginDto.password 
      });
      
      const result = await this.authService.login(loginDto);
      
      console.log('[POST /auth/login] 로그인 성공:', { 
        userId: result.user?.id, 
        role: result.user?.role 
      });
      
      return result;
    } catch (error) {
      // 에러를 다시 throw하여 Exception Filter가 처리하도록 함
      console.error('[POST /auth/login] 에러 발생:', error);
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
   * 비밀번호 변경 (이메일 기반, JWT 불필요)
   * 역할 체크: admin 또는 creator만 가능
   * DB 업데이트: 현재 비밀번호 검증 후 새 비밀번호 해시하여 업데이트
   */
  @Post('change-password')
  @ApiOperation({ summary: '비밀번호 변경 (이메일 기반)' })
  @ApiResponse({
    status: 200,
    description: '비밀번호 변경 성공',
    schema: {
      example: {
        ok: true,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '비밀번호 변경 실패',
    schema: {
      example: {
        ok: false,
        error: 'INVALID_PASSWORD',
        message: '현재 비밀번호가 올바르지 않습니다.',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: '권한 없음 (admin/creator만 가능)',
    schema: {
      example: {
        statusCode: 403,
        error: 'FORBIDDEN',
        message: '비밀번호 변경은 관리자 또는 크리에이터 계정만 가능합니다.',
      },
    },
  })
  async changePassword(@Body() changePasswordDto: ChangePasswordEmailDto) {
    const result = await this.authService.changePasswordByEmail(
      changePasswordDto.email,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );

    // ok: false인 경우에도 200으로 반환하되, ok 필드로 성공/실패 구분
    // 프론트엔드에서 ok 필드를 확인하여 처리
    // 역할 체크 실패는 서비스에서 ForbiddenException을 던져서 자동으로 403 반환
    return result;
  }

  /**
   * 비밀번호 변경 (JWT 기반, 기존 방식 유지)
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
    // ChangePasswordDto에 email이 선택적으로 포함될 수 있음
    const email = (changePasswordDto as any).email;
    return this.authService.changePassword(
      req.user.id,
      changePasswordDto.current_password,
      changePasswordDto.new_password,
      email,
    );
  }
}










































