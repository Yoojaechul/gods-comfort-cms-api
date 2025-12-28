import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../database/database.service';

import { LoginDto } from './dto/login.dto';
import { SetupPasswordDto } from './dto/setup-password.dto';
import { CheckEmailDto } from './dto/check-email.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 로그인
   * - identifier: username/email 둘 다 허용 (현재는 email 위주)
   */
  async login(loginDto: LoginDto) {
    const identifier = (loginDto as any)?.username || (loginDto as any)?.email || (loginDto as any)?.identifier;
    const password = (loginDto as any)?.password;

    if (!identifier) throw new BadRequestException('아이디를 입력해주세요.');
    if (!password) throw new BadRequestException('비밀번호를 입력해주세요.');

    try {
      // 테스트 계정 기본값 (env 없을 때도 최소 동작)
      const adminEmail =
        this.configService.get<string>('CMS_TEST_ADMIN_EMAIL') || 'consulting_manager@naver.com';
      const creatorEmail =
        this.configService.get<string>('CMS_TEST_CREATOR_EMAIL') || 'j1dly1@naver.com';

      // DB에서 사용자 조회
      const user = this.databaseService.findUserByEmailOrUsername(identifier);
      if (!user) {
        this.logger.warn(`[LOGIN] user not found: ${identifier}`);
        throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
      }

      // 상태 체크
      if (user.status && user.status !== 'active') {
        throw new UnauthorizedException('비활성화된 계정입니다.');
      }

      // role 제한 (원하시는 정책)
      if (user.role !== 'admin' && user.role !== 'creator') {
        throw new UnauthorizedException('접근 권한이 없습니다.');
      }

      // 패스워드 세팅 여부
      if (!user.password_hash || !user.salt) {
        // setup-password 흐름 유도
        throw new UnauthorizedException('비밀번호 설정이 필요합니다.');
      }

      // 비밀번호 검증
      const ok = this.databaseService.verifyPasswordCompat(
        password,
        user.password_hash,
        user.salt,
      );

      if (!ok) {
        this.logger.warn(`[LOGIN] bad password: ${identifier}`);
        throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
      }

      const token = this.generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
        site_id: user.siteId ?? user.site_id ?? null,
        username: user.username ?? user.name ?? user.email,
      });

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          siteId: user.siteId ?? user.site_id ?? null,
        },
        expiresAt: this.getTokenExpiry(token),
        // 참고용: env에 테스트 계정 존재 여부
        envHint: {
          isAdminEnv: user.email === adminEmail,
          isCreatorEnv: user.email === creatorEmail,
        },
      };
    } catch (error: any) {
      // Nest 예외는 그대로 throw
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(`[LOGIN] unexpected: ${this.stringifyErrorOneLine(error)}`);
      throw new UnauthorizedException('로그인 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * 최초 비밀번호 설정 / 이메일 변경 포함
   * - setupPasswordDto: { email, new_password, new_email? }
   */
  async setupPassword(setupPasswordDto: SetupPasswordDto) {
    const email = (setupPasswordDto as any)?.email;
    const newPassword = (setupPasswordDto as any)?.new_password;
    const newEmail = (setupPasswordDto as any)?.new_email;

    if (!email) throw new BadRequestException('아이디를 입력해주세요.');
    if (!newPassword) throw new BadRequestException('새 비밀번호를 입력해주세요.');
    if (String(newPassword).length < 8)
      throw new BadRequestException('새 비밀번호는 최소 8자 이상이어야 합니다.');

    try {
      const user = this.databaseService.findUserByEmail(email);
      if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

      // 이메일 변경이 있으면 중복 체크
      const updateEmail = newEmail && String(newEmail).trim() ? String(newEmail).trim() : email;
      if (updateEmail !== email) {
        if (this.databaseService.isEmailExists(updateEmail, user.id)) {
          throw new BadRequestException('이미 사용 중인 아이디입니다.');
        }
      }

      // 해시 저장 (sha512(password+salt))
      const salt = randomBytes(16).toString('hex'); // 32 chars
      const passwordHash = this.databaseService.hashPassword(String(newPassword), salt);

      this.databaseService.updateUserEmailAndPassword(user.id, updateEmail, passwordHash, salt);

      const updatedUser = this.databaseService.findUserById(user.id);
      if (!updatedUser) throw new NotFoundException('업데이트된 사용자를 찾을 수 없습니다.');

      const token = this.generateToken({
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        site_id: updatedUser.siteId ?? updatedUser.site_id ?? null,
        username: updatedUser.username ?? updatedUser.name ?? updatedUser.email,
      });

      return {
        success: true,
        token,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          siteId: updatedUser.siteId ?? updatedUser.site_id ?? null,
        },
        expiresAt: this.getTokenExpiry(token),
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(`[setupPassword] unexpected: ${this.stringifyErrorOneLine(error)}`);
      throw new BadRequestException('비밀번호 설정 중 오류가 발생했습니다.');
    }
  }

  /**
   * 아이디(=email) 존재 여부 체크
   */
  async checkEmail(dto: CheckEmailDto): Promise<{ exists: boolean; role?: string }> {
    const email = (dto as any)?.email;
    if (!email) return { exists: false };

    try {
      const user = this.databaseService.findUserByEmail(email);
      if (!user) return { exists: false };
      return { exists: true, role: user.role || undefined };
    } catch {
      return { exists: false };
    }
  }

  /**
   * JWT payload -> 사용자 조회
   */
  async validateUser(userId: string) {
    const user = this.databaseService.findUserById(userId);
    return user || null;
  }

  /**
   * 로그인 상태에서 비밀번호 변경 (userId 기준)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    email?: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!userId) return { success: false, message: '사용자 정보가 없습니다.' };
    if (!currentPassword) return { success: false, message: '현재 비밀번호를 입력해주세요.' };
    if (!newPassword) return { success: false, message: '새 비밀번호를 입력해주세요.' };
    if (String(newPassword).length < 8)
      return { success: false, message: '새 비밀번호는 최소 8자 이상이어야 합니다.' };

    try {
      const user = this.databaseService.findUserById(userId);
      if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

      if (email && user.email !== email) {
        throw new UnauthorizedException('권한이 없습니다.');
      }

      if (user.role !== 'admin' && user.role !== 'creator') {
        throw new UnauthorizedException('권한이 없습니다.');
      }

      if (!user.password_hash || !user.salt) {
        throw new BadRequestException('비밀번호가 설정되어 있지 않습니다.');
      }

      const ok = this.databaseService.verifyPasswordCompat(
        currentPassword,
        user.password_hash,
        user.salt,
      );
      if (!ok) return { success: false, message: '현재 비밀번호가 올바르지 않습니다.' };

      const salt = randomBytes(16).toString('hex');
      const hash = this.databaseService.hashPassword(String(newPassword), salt);

      const rowCount = this.databaseService.updateUserPassword(user.id, hash, salt);
      if (!rowCount) return { success: false, message: '비밀번호 변경에 실패했습니다.' };

      return { success: true, message: '비밀번호가 변경되었습니다.' };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(`[changePassword] unexpected: ${this.stringifyErrorOneLine(error)}`);
      return { success: false, message: '비밀번호 변경 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 아이디(=email) 기반 비밀번호 변경
   */
  async changePasswordByEmail(
    email: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: boolean; message?: string }> {
    if (!email) return { ok: false, message: '아이디를 입력해주세요.' };
    if (!currentPassword) return { ok: false, message: '현재 비밀번호를 입력해주세요.' };
    if (!newPassword) return { ok: false, message: '새 비밀번호를 입력해주세요.' };
    if (String(newPassword).length < 8)
      return { ok: false, message: '새 비밀번호는 최소 8자 이상이어야 합니다.' };

    try {
      const user = this.databaseService.findUserByEmail(email);
      if (!user) return { ok: false, message: '사용자를 찾을 수 없습니다.' };

      if (user.role !== 'admin' && user.role !== 'creator') {
        return { ok: false, message: '권한이 없습니다.' };
      }

      if (!user.password_hash || !user.salt) {
        return { ok: false, message: '비밀번호가 설정되어 있지 않습니다.' };
      }

      const ok = this.databaseService.verifyPasswordCompat(
        currentPassword,
        user.password_hash,
        user.salt,
      );
      if (!ok) return { ok: false, message: '현재 비밀번호가 올바르지 않습니다.' };

      const salt = randomBytes(16).toString('hex');
      const hash = this.databaseService.hashPassword(String(newPassword), salt);

      const rowCount = this.databaseService.updateUserPassword(user.id, hash, salt);
      if (!rowCount) return { ok: false, message: '비밀번호 변경에 실패했습니다.' };

      return { ok: true };
    } catch (error: any) {
      this.logger.error(`[changePasswordByEmail] unexpected: ${this.stringifyErrorOneLine(error)}`);
      return { ok: false, message: '비밀번호 변경 중 오류가 발생했습니다.' };
    }
  }

  /**
   * seed 상태 확인 (컨트롤러에서 쓰는 용도)
   */
  async getSeedStatus(): Promise<{
    admin?: {
      email: string;
      hashLength: number;
      saltLength: number;
      updatedAt: string | null;
      forceUpdateApplied: boolean;
      envExists: boolean;
    };
    creator?: {
      email: string;
      hashLength: number;
      saltLength: number;
      updatedAt: string | null;
      forceUpdateApplied: boolean;
      envExists: boolean;
    };
  }> {
    const db = this.databaseService.getDb();
    const result: any = {};

    const adminEmail = this.configService.get<string>('CMS_TEST_ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('CMS_TEST_ADMIN_PASSWORD');
    const creatorEmail = this.configService.get<string>('CMS_TEST_CREATOR_EMAIL');
    const creatorPassword = this.configService.get<string>('CMS_TEST_CREATOR_PASSWORD');

    const forcePasswordUpdate =
      this.configService.get<string>('SEED_FORCE_PASSWORD_UPDATE') === 'true';

    if (adminEmail) {
      const adminUser = db
        .prepare(`SELECT email, password_hash, salt, updated_at FROM users WHERE email = ? LIMIT 1`)
        .get(adminEmail);

      result.admin = adminUser
        ? {
            email: adminUser.email,
            hashLength: (adminUser.password_hash || '').length,
            saltLength: (adminUser.salt || '').length,
            updatedAt: adminUser.updated_at || null,
            forceUpdateApplied: forcePasswordUpdate,
            envExists: !!(adminEmail && adminPassword),
          }
        : {
            email: adminEmail,
            hashLength: 0,
            saltLength: 0,
            updatedAt: null,
            forceUpdateApplied: forcePasswordUpdate,
            envExists: !!(adminEmail && adminPassword),
          };
    }

    if (creatorEmail) {
      const creatorUser = db
        .prepare(`SELECT email, password_hash, salt, updated_at FROM users WHERE email = ? LIMIT 1`)
        .get(creatorEmail);

      result.creator = creatorUser
        ? {
            email: creatorUser.email,
            hashLength: (creatorUser.password_hash || '').length,
            saltLength: (creatorUser.salt || '').length,
            updatedAt: creatorUser.updated_at || null,
            forceUpdateApplied: forcePasswordUpdate,
            envExists: !!(creatorEmail && creatorPassword),
          }
        : {
            email: creatorEmail,
            hashLength: 0,
            saltLength: 0,
            updatedAt: null,
            forceUpdateApplied: forcePasswordUpdate,
            envExists: !!(creatorEmail && creatorPassword),
          };
    }

    return result;
  }

  private generateToken(user: any): string {
    const payload = {
      sub: user.id,
      username: user.username || user.email,
      email: user.email,
      role: user.role,
      site_id: user.site_id ?? null,
    };
    return this.jwtService.sign(payload);
  }

  private getTokenExpiry(token: string): string | null {
    try {
      const decoded = this.jwtService.decode(token) as any;
      if (!decoded?.exp) return null;
      return new Date(decoded.exp * 1000).toISOString();
    } catch {
      return null;
    }
  }

  private stringifyErrorOneLine(err: any): string {
    try {
      if (!err) return 'unknown';
      if (typeof err === 'string') return err;
      if (err?.message) return String(err.message);
      return JSON.stringify(err);
    } catch {
      return 'unknown';
    }
  }
}
