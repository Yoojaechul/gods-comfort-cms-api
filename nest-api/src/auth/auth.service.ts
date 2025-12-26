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
import { CheckEmailDto } from './dto/check-email.dto';

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

    // A) 입력값 검증
    this.logger.log(`[LOGIN] 단계 A: 입력값 검증 시작`);
    this.logger.debug(`[LOGIN] 입력값 - username: ${username || '없음'}, email: ${email || '없음'}, password: ${password ? '제공됨' : '없음'}`);

    const identifier = username || email;
    if (!identifier) {
      this.logger.warn(`[LOGIN] 단계 A 실패: username 또는 email이 제공되지 않음`);
      throw new BadRequestException('username 또는 email을 입력해주세요.');
    }

    if (!password) {
      this.logger.warn(`[LOGIN] 단계 A 실패: password가 제공되지 않음`);
      throw new BadRequestException('password를 입력해주세요.');
    }

    this.logger.log(`[LOGIN] 단계 A 완료: 입력값 검증 통과 - identifier: ${identifier}`);

    try {
      // 허용된 계정 목록 (환경변수에서 가져오기)
      const allowedAdminEmail =
        this.configService.get<string>('CMS_TEST_ADMIN_EMAIL') ||
        'consulting_manager@naver.com';
      const allowedCreatorEmail =
        this.configService.get<string>('CMS_TEST_CREATOR_EMAIL') ||
        'j1dly1@naver.com';

      // B) 사용자 조회 (users 테이블, email 또는 name 컬럼)
      this.logger.log(`[LOGIN] 단계 B: 사용자 조회 시작 - 테이블: users, 컬럼: email 또는 name, 값: ${identifier}`);
      let user;
      try {
        user = this.databaseService.findUserByEmailOrUsername(identifier);
        if (user) {
          this.logger.log(`[LOGIN] 단계 B 완료: 사용자 발견 - id: ${user.id}, email: ${user.email}, name: ${user.name}, role: ${user.role}, password_hash: ${user.password_hash ? 'SET' : 'NULL'}`);
        } else {
          this.logger.warn(`[LOGIN] 단계 B 실패: 사용자를 찾을 수 없음 - ${identifier} (users 테이블에서 email 또는 name으로 검색)`);
          throw new UnauthorizedException('Invalid username/email or password');
        }
      } catch (dbError) {
        if (dbError instanceof UnauthorizedException) {
          throw dbError;
        }
        this.logger.error(
          `[LOGIN] 단계 B 실패: DB 조회 오류 - 테이블: users, 컬럼: email 또는 name`,
          dbError instanceof Error ? dbError.stack : String(dbError),
        );
        throw new InternalServerErrorException('데이터베이스 연결 오류가 발생했습니다.');
      }

      // 계정 권한 확인
      this.logger.log(`[LOGIN] 단계 2: 계정 권한 확인 - ${user.email} (${user.role})`);
      const isAllowedAdmin = user.email === allowedAdminEmail && user.role === 'admin';
      const isAllowedCreator = user.email === allowedCreatorEmail && user.role === 'creator';

      if (!isAllowedAdmin && !isAllowedCreator) {
        this.logger.warn(
          `[LOGIN] 단계 2 실패: 허용되지 않은 계정 - ${user.email} (${user.role})`,
        );
        throw new UnauthorizedException('Invalid username/email or password');
      }

      this.logger.log(`[LOGIN] 단계 3: 비밀번호 설정 여부 확인 - ${user.email}`);
      if (!user.password_hash) {
        this.logger.warn(`[LOGIN] 단계 3 실패: 비밀번호가 설정되지 않은 계정 - ${identifier}`);
        throw new BadRequestException(
          '비밀번호가 설정되지 않았습니다. 최초 비밀번호 설정이 필요합니다.',
        );
      }

      // C) 비밀번호 비교 (scrypt 사용)
      this.logger.log(`[LOGIN] 단계 C: 비밀번호 비교 시작 - scrypt 검증`);
      let isValid;
      try {
        isValid = this.databaseService.verifyPassword(
          password,
          user.password_hash,
          user.api_key_salt,
        );
        this.logger.log(`[LOGIN] 단계 C 완료: 비밀번호 비교 결과 - ${isValid ? '일치 (true)' : '불일치 (false)'}`);
      } catch (verifyError) {
        this.logger.error(
          `[LOGIN] 단계 C 실패: 비밀번호 검증 중 오류 (scrypt 비교 실패) - ${user.email}`,
          verifyError instanceof Error ? verifyError.stack : String(verifyError),
        );
        throw new InternalServerErrorException('비밀번호 검증 중 오류가 발생했습니다.');
      }

      if (!isValid) {
        this.logger.warn(`[LOGIN] 단계 C 실패: 비밀번호 불일치 - ${identifier} (bcrypt/scrypt 비교 결과: false)`);
        throw new UnauthorizedException('Invalid username/email or password');
      }

      // D) 토큰 생성 단계
      this.logger.log(`[LOGIN] 단계 D: JWT 토큰 생성 시작 - ${user.email}`);
      
      // JWT_SECRET 존재 여부 확인
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        this.logger.error(`[LOGIN] 단계 D 실패: JWT_SECRET 환경변수가 설정되지 않음`);
        throw new InternalServerErrorException('JWT_SECRET이 설정되지 않았습니다.');
      }
      this.logger.debug(`[LOGIN] JWT_SECRET 확인 완료 (길이: ${jwtSecret.length})`);

      let token;
      try {
        token = this.generateToken(user);
        this.logger.log(`[LOGIN] 단계 D 완료: JWT 토큰 생성 성공 - ${user.email} (토큰 길이: ${token.length})`);
      } catch (tokenError) {
        this.logger.error(
          `[LOGIN] 단계 D 실패: JWT 토큰 생성 오류 (jwt.sign 실패) - ${user.email}`,
          tokenError instanceof Error ? tokenError.stack : String(tokenError),
        );
        throw new InternalServerErrorException('토큰 생성 중 오류가 발생했습니다.');
      }

      this.logger.log(`[LOGIN] 로그인 성공: ${user.email || user.name} (${user.role})`);

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
    } catch (error) {
      // 이미 로깅된 에러는 그대로 throw
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      // 예상치 못한 에러는 상세 로깅
      this.logger.error(
        `[LOGIN] 예상치 못한 에러 발생: ${identifier}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.logger.error(`[LOGIN] 에러 타입: ${error?.constructor?.name || 'Unknown'}`);
      this.logger.error(`[LOGIN] 에러 메시지: ${error instanceof Error ? error.message : String(error)}`);
      
      throw new InternalServerErrorException('로그인 중 오류가 발생했습니다.');
    }
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
    email?: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🔐 비밀번호 변경 시도 - User ID: ${userId}${email ? `, Email: ${email}` : ''}`);

    try {
      // 사용자 조회
      const user = this.databaseService.findUserById(userId);

      if (!user) {
        this.logger.warn(`❌ 사용자를 찾을 수 없음: ${userId}`);
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // email 파라미터가 제공된 경우, 사용자 이메일과 일치하는지 확인
      if (email && user.email !== email) {
        this.logger.warn(`❌ 이메일 불일치: 요청=${email}, 실제=${user.email}`);
        throw new BadRequestException('이메일이 일치하지 않습니다.');
      }

      // admin 또는 creator 역할만 비밀번호 변경 가능
      if (user.role !== 'admin' && user.role !== 'creator') {
        this.logger.warn(`❌ 비밀번호 변경 권한 없음: ${user.role}`);
        throw new ForbiddenException('비밀번호 변경은 관리자 또는 크리에이터 계정만 가능합니다.');
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

  /**
   * 이메일 확인
   * 이메일이 존재하고 활성화된 계정인지 확인
   * @param email 확인할 이메일
   * @returns 이메일 존재 여부 및 역할 정보
   */
  async checkEmail(email: string): Promise<{ exists: boolean; role?: string }> {
    this.logger.log(`📧 이메일 확인 요청: ${email}`);

    try {
      const user = this.databaseService.findUserByEmail(email);

      if (!user) {
        return {
          exists: false,
        };
      }

      return {
        exists: true,
        role: user.role || undefined,
      };
    } catch (error) {
      this.logger.error(`🔥 이메일 확인 중 오류 발생:`, error);
      return {
        exists: false,
      };
    }
  }

  /**
   * 이메일 기반 비밀번호 변경 (JWT 없이)
   * @param email 사용자 이메일
   * @param currentPassword 현재 비밀번호
   * @param newPassword 새 비밀번호
   * @returns 성공 메시지
   */
  async changePasswordByEmail(
    email: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: boolean; message?: string }> {
    // A) 입력값 검증
    this.logger.log(`[CHANGE_PASSWORD] 단계 A: 입력값 검증 시작`);
    this.logger.debug(`[CHANGE_PASSWORD] 입력값 - email: ${email || '없음'}, currentPassword: ${currentPassword ? '제공됨' : '없음'}, newPassword: ${newPassword ? '제공됨' : '없음'}`);

    if (!email) {
      this.logger.warn(`[CHANGE_PASSWORD] 단계 A 실패: email이 제공되지 않음`);
      return {
        ok: false,
        message: '이메일을 입력해주세요.',
      };
    }

    if (!currentPassword) {
      this.logger.warn(`[CHANGE_PASSWORD] 단계 A 실패: currentPassword가 제공되지 않음`);
      return {
        ok: false,
        message: '현재 비밀번호를 입력해주세요.',
      };
    }

    if (!newPassword) {
      this.logger.warn(`[CHANGE_PASSWORD] 단계 A 실패: newPassword가 제공되지 않음`);
      return {
        ok: false,
        message: '새 비밀번호를 입력해주세요.',
      };
    }

    if (newPassword.length < 8) {
      this.logger.warn(`[CHANGE_PASSWORD] 단계 A 실패: 새 비밀번호가 8자 미만`);
      return {
        ok: false,
        message: '새 비밀번호는 최소 8자 이상이어야 합니다.',
      };
    }

    this.logger.log(`[CHANGE_PASSWORD] 단계 A 완료: 입력값 검증 통과 - email: ${email}`);

    try {
      // B) 사용자 조회 (users 테이블, email 컬럼)
      this.logger.log(`[CHANGE_PASSWORD] 단계 B: 사용자 조회 시작 - 테이블: users, 컬럼: email, 값: ${email}`);
      let user;
      try {
        user = this.databaseService.findUserByEmail(email);
        if (user) {
          this.logger.log(`[CHANGE_PASSWORD] 단계 B 완료: 사용자 발견 - id: ${user.id}, email: ${user.email}, role: ${user.role}, password_hash: ${user.password_hash ? 'SET' : 'NULL'}`);
        } else {
          this.logger.warn(`[CHANGE_PASSWORD] 단계 B 실패: 사용자를 찾을 수 없음 - ${email} (users 테이블에서 email로 검색)`);
          return {
            ok: false,
            message: '사용자를 찾을 수 없습니다.',
          };
        }
      } catch (dbError) {
        this.logger.error(
          `[CHANGE_PASSWORD] 단계 B 실패: DB 조회 오류 - 테이블: users, 컬럼: email`,
          dbError instanceof Error ? dbError.stack : String(dbError),
        );
        return {
          ok: false,
          message: '데이터베이스 연결 오류가 발생했습니다.',
        };
      }

      // 계정 권한 확인
      this.logger.log(`[CHANGE_PASSWORD] 단계 2: 계정 권한 확인 - ${user.email} (${user.role})`);
      if (user.role !== 'admin' && user.role !== 'creator') {
        this.logger.warn(`[CHANGE_PASSWORD] 단계 2 실패: 비밀번호 변경 권한 없음 - ${user.role}`);
        throw new ForbiddenException('비밀번호 변경은 관리자 또는 크리에이터 계정만 가능합니다.');
      }

      this.logger.log(`[CHANGE_PASSWORD] 단계 3: 비밀번호 설정 여부 확인 - ${user.email}`);
      if (!user.password_hash) {
        this.logger.warn(`[CHANGE_PASSWORD] 단계 3 실패: 비밀번호가 설정되지 않은 계정 - ${email}`);
        return {
          ok: false,
          message: '비밀번호가 설정되지 않은 계정입니다. 최초 비밀번호 설정을 사용해주세요.',
        };
      }

      // C) 현재 비밀번호 검증 (scrypt 사용)
      this.logger.log(`[CHANGE_PASSWORD] 단계 C: 현재 비밀번호 검증 시작 - scrypt 비교`);
      let isValid;
      try {
        isValid = this.databaseService.verifyPassword(
          currentPassword,
          user.password_hash,
          user.api_key_salt || '',
        );
        this.logger.log(`[CHANGE_PASSWORD] 단계 C 완료: 비밀번호 검증 결과 - ${isValid ? '일치 (true)' : '불일치 (false)'}`);
      } catch (verifyError) {
        this.logger.error(
          `[CHANGE_PASSWORD] 단계 C 실패: 비밀번호 검증 중 오류 (scrypt 비교 실패) - ${user.email}`,
          verifyError instanceof Error ? verifyError.stack : String(verifyError),
        );
        return {
          ok: false,
          message: '비밀번호 검증 중 오류가 발생했습니다.',
        };
      }

      if (!isValid) {
        this.logger.warn(`[CHANGE_PASSWORD] 단계 C 실패: 현재 비밀번호 불일치 - ${email} (bcrypt/scrypt 비교 결과: false)`);
        return {
          ok: false,
          message: '현재 비밀번호가 올바르지 않습니다.',
        };
      }

      // D) 새 비밀번호 해싱 (scrypt 사용)
      this.logger.log(`[CHANGE_PASSWORD] 단계 D: 새 비밀번호 해싱 시작 - scrypt`);
      let salt: string;
      let hash: string;
      try {
        const crypto = require('crypto');
        const { scryptSync, randomBytes } = crypto;

        salt = randomBytes(16).toString('hex');
        hash = scryptSync(newPassword, salt, 64).toString('hex');
        this.logger.log(`[CHANGE_PASSWORD] 단계 D 완료: 비밀번호 해싱 성공 - salt 길이: ${salt.length}, hash 길이: ${hash.length}`);
      } catch (hashError) {
        this.logger.error(
          `[CHANGE_PASSWORD] 단계 D 실패: 비밀번호 해싱 중 오류 (scrypt 실패) - ${user.email}`,
          hashError instanceof Error ? hashError.stack : String(hashError),
        );
        return {
          ok: false,
          message: '비밀번호 해싱 중 오류가 발생했습니다.',
        };
      }

      // E) DB 업데이트 (users 테이블, password_hash, api_key_salt 컬럼)
      this.logger.log(`[CHANGE_PASSWORD] 단계 E: 비밀번호 업데이트 시작 - 테이블: users, 컬럼: password_hash, api_key_salt, WHERE id = ${user.id}`);
      let rowCount: number;
      try {
        rowCount = this.databaseService.updateUserPassword(user.id, hash, salt);
        this.logger.log(`[CHANGE_PASSWORD] 단계 E 완료: DB 업데이트 성공 - 영향받은 행 수: ${rowCount}`);
        
        if (rowCount === 0) {
          this.logger.warn(`[CHANGE_PASSWORD] 단계 E 경고: 업데이트된 행이 없음 - User ID: ${user.id} (존재하지 않는 사용자일 수 있음)`);
          return {
            ok: false,
            message: '비밀번호 업데이트에 실패했습니다. 사용자를 찾을 수 없습니다.',
          };
        }
      } catch (updateError) {
        this.logger.error(
          `[CHANGE_PASSWORD] 단계 E 실패: DB 업데이트 오류 - 테이블: users, WHERE id = ${user.id}`,
          updateError instanceof Error ? updateError.stack : String(updateError),
        );
        return {
          ok: false,
          message: '비밀번호 업데이트 중 오류가 발생했습니다.',
        };
      }

      this.logger.log(`[CHANGE_PASSWORD] 비밀번호 변경 완료: ${user.email || user.name} (영향받은 행: ${rowCount})`);

      return {
        ok: true,
      };
    } catch (error) {
      // ForbiddenException은 그대로 전달 (403 상태 코드)
      if (error instanceof ForbiddenException) {
        throw error;
      }
      
      // 예상치 못한 에러는 상세 로깅
      this.logger.error(
        `[CHANGE_PASSWORD] 예상치 못한 에러 발생: ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.logger.error(`[CHANGE_PASSWORD] 에러 타입: ${error?.constructor?.name || 'Unknown'}`);
      this.logger.error(`[CHANGE_PASSWORD] 에러 메시지: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        ok: false,
        message: '비밀번호 변경 중 오류가 발생했습니다. 관리자에게 문의하세요.',
      };
    }
  }
}

