import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';
import { SetupPasswordDto } from './dto/setup-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 모듈 초기화 시 테스트 계정 생성/업데이트
   */
  async onModuleInit() {
    this.logger.log('🔧 테스트 계정 초기화 시작...');

    try {
      const db = this.databaseService.getDb();

      // 환경변수에서 계정 정보 가져오기
      const adminEmail =
        this.configService.get<string>('CMS_TEST_ADMIN_EMAIL') ||
        'consulting_manager@naver.com';
      const adminUsername =
        this.configService.get<string>('CMS_TEST_ADMIN_USERNAME') || 'admin';
      const adminPassword =
        this.configService.get<string>('CMS_TEST_ADMIN_PASSWORD') || '123456';

      const creatorEmail =
        this.configService.get<string>('CMS_TEST_CREATOR_EMAIL') ||
        'j1dly1@naver.com';
      const creatorUsername =
        this.configService.get<string>('CMS_TEST_CREATOR_USERNAME') || 'creator';
      const creatorPassword =
        this.configService.get<string>('CMS_TEST_CREATOR_PASSWORD') || '123456';

      // 비밀번호 해싱 함수 (scrypt 사용)
      const crypto = require('crypto');
      const { scryptSync, randomBytes } = crypto;

      const hashPassword = (password: string) => {
        const salt = randomBytes(16).toString('hex');
        const hash = scryptSync(password, salt, 64).toString('hex');
        return { hash, salt };
      };

      // Admin 계정 생성/업데이트
      let existingAdmin = db
        .prepare('SELECT * FROM users WHERE email = ? OR name = ?')
        .get(adminEmail, adminUsername) as any;

      if (!existingAdmin) {
        // 새로 생성
        const adminId = randomBytes(16).toString('hex');
        const adminApiKey = randomBytes(32).toString('hex');
        const apiKeyHash = scryptSync(adminApiKey, randomBytes(16).toString('hex'), 64).toString('hex');
        const apiKeySalt = randomBytes(16).toString('hex');
        const { hash: passwordHash, salt: passwordSalt } = hashPassword(adminPassword);

        db.prepare(
          'INSERT INTO users (id, site_id, name, email, password_hash, role, status, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          adminId,
          null,
          adminUsername,
          adminEmail,
          passwordHash,
          'admin',
          'active',
          apiKeyHash,
          apiKeySalt,
        );

        this.logger.log(`✅ Admin 계정 생성: ${adminEmail} (${adminUsername})`);
      } else {
        // 기존 계정 업데이트
        const { hash: passwordHash, salt: passwordSalt } = hashPassword(adminPassword);
        db.prepare(
          "UPDATE users SET name = ?, email = ?, password_hash = ?, api_key_salt = ?, status = 'active', role = 'admin', site_id = NULL WHERE id = ?",
        ).run(adminUsername, adminEmail, passwordHash, passwordSalt, existingAdmin.id);

        this.logger.log(`✅ Admin 계정 업데이트: ${adminEmail} (${adminUsername})`);
      }

      // Creator 계정 생성/업데이트
      let existingCreator = db
        .prepare('SELECT * FROM users WHERE email = ? OR name = ?')
        .get(creatorEmail, creatorUsername) as any;

      if (!existingCreator) {
        // 새로 생성
        const creatorId = randomBytes(16).toString('hex');
        const creatorApiKey = randomBytes(32).toString('hex');
        const apiKeyHash = scryptSync(creatorApiKey, randomBytes(16).toString('hex'), 64).toString('hex');
        const apiKeySalt = randomBytes(16).toString('hex');
        const { hash: passwordHash, salt: passwordSalt } = hashPassword(creatorPassword);

        db.prepare(
          'INSERT INTO users (id, site_id, name, email, password_hash, role, status, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).run(
          creatorId,
          'gods',
          creatorUsername,
          creatorEmail,
          passwordHash,
          'creator',
          'active',
          apiKeyHash,
          apiKeySalt,
        );

        this.logger.log(`✅ Creator 계정 생성: ${creatorEmail} (${creatorUsername})`);
      } else {
        // 기존 계정 업데이트
        const { hash: passwordHash, salt: passwordSalt } = hashPassword(creatorPassword);
        db.prepare(
          "UPDATE users SET name = ?, email = ?, password_hash = ?, api_key_salt = ?, status = 'active', role = 'creator', site_id = 'gods' WHERE id = ?",
        ).run(creatorUsername, creatorEmail, passwordHash, passwordSalt, existingCreator.id);

        this.logger.log(`✅ Creator 계정 업데이트: ${creatorEmail} (${creatorUsername})`);
      }

      this.logger.log('✅ 테스트 계정 초기화 완료');
    } catch (error) {
      this.logger.error('❌ 테스트 계정 초기화 실패:', error);
      // 초기화 실패해도 서버는 계속 실행되도록 함
    }
  }

  /**
   * 로그인 (username 또는 email + password)
   * DB에서 사용자를 조회하고 비밀번호를 검증합니다.
   * 허용된 계정만 로그인 가능: consulting_manager@naver.com (Admin), j1dly1@naver.com (Creator)
   */
  async login(loginDto: LoginDto) {
    const { username, email, password } = loginDto;

    // username 또는 email 중 하나는 필수
    const identifier = username || email;
    if (!identifier) {
      throw new BadRequestException('username 또는 email을 입력해주세요.');
    }

    this.logger.debug(`🔐 로그인 시도: ${identifier}`);

    // 허용된 계정 목록 (환경변수에서 가져오기)
    const allowedAdminEmail =
      this.configService.get<string>('CMS_TEST_ADMIN_EMAIL') ||
      'consulting_manager@naver.com';
    const allowedCreatorEmail =
      this.configService.get<string>('CMS_TEST_CREATOR_EMAIL') ||
      'j1dly1@naver.com';

    // DB에서 사용자 조회 (email 또는 username으로)
    const user = this.databaseService.findUserByEmailOrUsername(identifier);

    if (!user) {
      this.logger.warn(`❌ 사용자를 찾을 수 없음: ${identifier}`);
      throw new UnauthorizedException('Invalid username/email or password');
    }

    // 허용된 계정인지 확인
    const isAllowedAdmin = user.email === allowedAdminEmail && user.role === 'admin';
    const isAllowedCreator = user.email === allowedCreatorEmail && user.role === 'creator';

    if (!isAllowedAdmin && !isAllowedCreator) {
      this.logger.warn(
        `❌ 허용되지 않은 계정 로그인 시도: ${user.email} (${user.role})`,
      );
      throw new UnauthorizedException('Invalid username/email or password');
    }

    // 비밀번호가 설정되지 않은 경우
    if (!user.password_hash) {
      this.logger.warn(`⚠️  비밀번호가 설정되지 않은 계정: ${identifier}`);
      throw new BadRequestException(
        '비밀번호가 설정되지 않았습니다. 최초 비밀번호 설정이 필요합니다.',
      );
    }

    // 비밀번호 검증 (scrypt 사용)
    const isValid = this.databaseService.verifyPassword(
      password,
      user.password_hash,
      user.api_key_salt,
    );

    if (!isValid) {
      this.logger.warn(`❌ 비밀번호 불일치: ${identifier}`);
      throw new UnauthorizedException('Invalid username/email or password');
    }

    this.logger.log(`✅ 로그인 성공: ${user.email || user.name} (${user.role})`);

    // JWT 토큰 생성
    const token = this.generateToken(user);

    return {
      token,
      accessToken: token, // 하위 호환성
      expiresAt: this.getTokenExpiry(token),
      user: {
        id: user.id,
        username: user.name || user.email, // name 또는 email을 username으로 사용
        name: user.name,
        email: user.email,
        role: user.role,
        site_id: user.site_id,
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

  /**
   * 비밀번호 변경
   * @param userId 사용자 ID (JWT에서 가져옴)
   * @param currentPassword 현재 비밀번호
   * @param newPassword 새 비밀번호
   * @returns 성공 메시지
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🔐 비밀번호 변경 시도 - User ID: ${userId}`);

    try {
      // 사용자 조회
      const user = this.databaseService.findUserById(userId);

      if (!user) {
        this.logger.warn(`❌ 사용자를 찾을 수 없음: ${userId}`);
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // 비밀번호가 설정되지 않은 경우
      if (!user.password_hash) {
        this.logger.warn(`⚠️  비밀번호가 설정되지 않은 계정: ${userId}`);
        throw new BadRequestException(
          '비밀번호가 설정되지 않은 계정입니다. 최초 비밀번호 설정을 사용해주세요.',
        );
      }

      // 현재 비밀번호 확인
      const isValid = this.databaseService.verifyPassword(
        currentPassword,
        user.password_hash,
        user.api_key_salt || '',
      );

      if (!isValid) {
        this.logger.warn(`❌ 현재 비밀번호 불일치: ${userId}`);
        throw new BadRequestException('현재 비밀번호가 올바르지 않습니다.');
      }

      // 새 비밀번호 해싱 (scrypt 사용 - 기존 프로젝트와 동일한 방식)
      const crypto = require('crypto');
      const { scryptSync, randomBytes } = crypto;

      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(newPassword, salt, 64).toString('hex');

      // 비밀번호 업데이트
      this.databaseService.updateUserPassword(userId, hash, salt);

      this.logger.log(`✅ 비밀번호 변경 완료: ${user.email || user.name}`);

      return {
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.',
      };
    } catch (error) {
      // 이미 던진 HttpException은 그대로 전달
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // 예상치 못한 에러는 로깅 후 500으로 처리
      this.logger.error(`🔥 비밀번호 변경 중 예상치 못한 에러 발생:`, error);
      throw new InternalServerErrorException(
        '비밀번호 변경 중 오류가 발생했습니다. 관리자에게 문의하세요.',
      );
    }
  }
}

