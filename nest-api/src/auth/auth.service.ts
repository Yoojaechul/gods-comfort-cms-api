import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';
import { SetupPasswordDto } from './dto/setup-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 로그인 (username + password)
   * Hardcoded accounts: admin/creator
   */
  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // Hardcoded accounts
    const accounts = {
      admin: {
        id: 'admin-001',
        username: 'admin',
        role: 'admin' as const,
        password: 'admin123', // Simple password for now (can be hashed later)
      },
      creator: {
        id: 'creator-001',
        username: 'creator',
        role: 'creator' as const,
        password: 'creator123', // Simple password for now (can be hashed later)
      },
    };

    // Find account
    const account = accounts[username.toLowerCase() as keyof typeof accounts];

    if (!account) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Simple password validation (plain text for now)
    if (account.password !== password) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Create user object for token generation
    const userForToken = {
      id: account.id,
      username: account.username,
      role: account.role,
      email: `${account.username}@example.com`, // Placeholder
      site_id: account.role === 'creator' ? 'gods' : null,
    };

    // JWT 토큰 생성
    const accessToken = this.generateToken(userForToken);

    return {
      token: accessToken, // 프론트엔드와 일관성을 위해 token으로 통일
      accessToken, // 하위 호환성을 위해 유지
      user: {
        id: account.id,
        username: account.username,
        name: account.username, // name 필드 추가
        email: `${account.username}@example.com`, // email 필드 추가
        role: account.role, // role 필드 명시적으로 반환
        site_id: account.role === 'creator' ? 'gods' : null,
      },
    };
  }

  /**
   * 최초 비밀번호 설정
   */
  async setupPassword(setupPasswordDto: SetupPasswordDto) {
    const { email, new_password, new_email } = setupPasswordDto;

    this.logger.log(`🔐 비밀번호 설정 시도: ${email}`);

    try {
      // 사용자 조회
      const user = this.databaseService.findUserByEmail(email);
      
      this.logger.debug(`사용자 조회 결과: ${user ? '발견됨' : 'null'}`);

      if (!user) {
        this.logger.warn(`❌ 사용자를 찾을 수 없음: ${email}`);
        throw new NotFoundException('해당 이메일의 사용자를 찾을 수 없습니다.');
      }

      // 이미 비밀번호가 설정된 경우
      if (user.password_hash) {
        this.logger.warn(`⚠️  이미 비밀번호가 설정된 계정: ${email}`);
        throw new BadRequestException(
          '이미 비밀번호가 설정된 계정입니다. 비밀번호 변경 기능을 사용하세요.',
        );
      }

      // 비밀번호 해싱
      this.logger.debug('비밀번호 해싱 중...');
      const passwordHash = await bcrypt.hash(new_password, 10);
      const salt = user.api_key_salt || ''; // 기존 salt 재사용

      // 이메일 변경 여부 확인
      let updateEmail = email;
      if (new_email && new_email !== email) {
        this.logger.debug(`이메일 변경 요청: ${email} -> ${new_email}`);
        
        // 이메일 중복 확인
        if (this.databaseService.isEmailExists(new_email, user.id)) {
          this.logger.warn(`❌ 이메일 중복: ${new_email}`);
          throw new ConflictException('이미 사용 중인 이메일입니다.');
        }
        updateEmail = new_email;
      }

      // 비밀번호 및 이메일 설정
      this.logger.debug(`DB 업데이트 시작 - User ID: ${user.id}`);
      this.databaseService.updateUserEmailAndPassword(
        user.id,
        updateEmail,
        passwordHash,
        salt,
      );

      this.logger.log(`✅ 비밀번호 설정 완료: ${updateEmail}`);

      // 업데이트된 사용자 정보 조회
      const updatedUser = this.databaseService.findUserById(user.id);

      if (!updatedUser) {
        this.logger.error(`❌ 업데이트된 사용자 조회 실패: ${user.id}`);
        throw new InternalServerErrorException('사용자 정보 업데이트 중 오류가 발생했습니다.');
      }

      // JWT 토큰 생성
      const token = this.generateToken(updatedUser);

      return {
        token,
        expiresAt: this.getTokenExpiry(token),
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          site_id: updatedUser.site_id,
        },
      };
    } catch (error) {
      // 이미 던진 HttpException은 그대로 전달
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      // 예상치 못한 에러는 로깅 후 500으로 처리
      this.logger.error(`🔥 예상치 못한 에러 발생:`, error);
      throw new InternalServerErrorException(
        '서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.',
      );
    }
  }

  /**
   * JWT 토큰 생성
   */
  private generateToken(user: any): string {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      site_id: user.site_id,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * 토큰 만료 시간 계산
   */
  private getTokenExpiry(token: string): string {
    const decoded = this.jwtService.decode(token) as any;
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000).toISOString();
    }
    return null;
  }

  /**
   * JWT 토큰 검증
   */
  async validateUser(userId: string) {
    const user = this.databaseService.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}

