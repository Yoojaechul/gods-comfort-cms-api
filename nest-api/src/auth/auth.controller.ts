import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
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
    return this.authService.login(loginDto);
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
   * 비밀번호 변경
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '비밀번호 변경' })
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
  async changePassword(
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










































