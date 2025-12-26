/**
 * ============================================================================
 * AuthService - 인증 서비스
 * ============================================================================
 * 
 * [비밀번호 해싱 및 검증 방식]
 * - 알고리즘: scrypt (crypto.scryptSync)
 * - password_hash: scrypt(password, salt, 64).toString('hex') (128 hex 길이)
 * - salt 저장: api_key_salt 컬럼에 저장
 * - 검증: DatabaseService.verifyPassword() 사용
 * 
 * [주의사항]
 * - Seed와 Login 모두 동일한 scrypt 방식 사용 (통일됨)
 * - bcrypt는 setupPassword에서만 사용 (레거시 호환)
 * 
 * [테스트 방법]
 * - Windows PowerShell: Invoke-RestMethod 사용 (curl.exe 사용 금지)
 * - Frontend: fetch / axios 사용
 * - curl: Linux / WSL 환경에서만 사용
 * 
 * ============================================================================
 */

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
   * 모듈 초기화 시 seed 계정 자동 생성
   * - ensureSchema() 이후에 실행되도록 DatabaseService에 의존
   * - 환경변수로 계정 정보를 받음 (운영용)
   * - 이미 있으면 skip, 없으면 생성
   * - SEED_FORCE_PASSWORD_UPDATE=true일 때는 기존 계정도 강제 업데이트
   * - 트랜잭션으로 처리하여 실패 시 롤백
   */
  async onModuleInit() {
    // DatabaseService의 ensureSchema()가 완료될 때까지 대기
    // DatabaseService는 OnModuleInit에서 ensureSchema()를 호출하므로
    // AuthService의 onModuleInit은 DatabaseService 이후에 실행됨
    this.logger.log('🔧 Seed 계정 초기화 시작...');

    try {
      const db = this.databaseService.getDb();

      // 환경변수에서 계정 정보 가져오기 (CMS_TEST_* 키만 사용, fallback 제거)
      // ⚠️ 중요: env 없으면 seed를 SKIP하고 WARN 로그만 남김 (프로덕션에서 실수로 랜덤/빈 값으로 업데이트 방지)
      const adminEmail = this.configService.get<string>('CMS_TEST_ADMIN_EMAIL');
      const adminPassword = this.configService.get<string>('CMS_TEST_ADMIN_PASSWORD');
      const adminRole = this.configService.get<string>('ADMIN_ROLE') || 'admin';

      const creatorEmail = this.configService.get<string>('CMS_TEST_CREATOR_EMAIL');
      const creatorPassword = this.configService.get<string>('CMS_TEST_CREATOR_PASSWORD');
      const creatorRole = this.configService.get<string>('CREATOR_ROLE') || 'creator';
      const creatorSiteId = this.configService.get<string>('CREATOR_SITE_ID') || 'gods';

      // 실제로 사용한 환경변수 키 이름을 로그로 출력
      const adminEmailKey = 'CMS_TEST_ADMIN_EMAIL';
      const adminPasswordKey = 'CMS_TEST_ADMIN_PASSWORD';
      const creatorEmailKey = 'CMS_TEST_CREATOR_EMAIL';
      const creatorPasswordKey = 'CMS_TEST_CREATOR_PASSWORD';

      // Seed 시작 로그 (배포에서 seed가 돌았는지 확정하기 위한 상세 로그)
      this.logger.log(`[SEED] ========================================`);
      this.logger.log(`[SEED] Seed 계정 초기화 시작`);
      this.logger.log(`[SEED] SEED_FORCE_PASSWORD_UPDATE=${process.env.SEED_FORCE_PASSWORD_UPDATE || 'undefined (false)'}`);
      this.logger.log(`[SEED] 환경변수 사용 현황:`);
      this.logger.log(`  - Admin Email: ${adminEmailKey}=${adminEmail ? this.maskEmail(adminEmail) : '(not set)'}`);
      this.logger.log(`  - Admin Password: ${adminPasswordKey}=${adminPassword ? '(set, length=' + adminPassword.length + ')' : '(not set)'}`);
      this.logger.log(`  - Creator Email: ${creatorEmailKey}=${creatorEmail ? this.maskEmail(creatorEmail) : '(not set)'}`);
      this.logger.log(`  - Creator Password: ${creatorPasswordKey}=${creatorPassword ? '(set, length=' + creatorPassword.length + ')' : '(not set)'}`);

      // ⚠️ 중요: env 없으면 seed를 SKIP하고 명확한 WARN 로그만 남김
      if (!adminEmail || !adminPassword) {
        this.logger.warn(`[SEED] ⚠️  SKIP: ${adminEmailKey} 또는 ${adminPasswordKey}가 설정되지 않아 Admin 계정 seed를 SKIP합니다.`);
        this.logger.warn(`[SEED] ⚠️  프로덕션에서 실수로 랜덤/빈 값으로 업데이트되지 않도록 DB를 건드리지 않습니다.`);
      }
      if (!creatorEmail || !creatorPassword) {
        this.logger.warn(`[SEED] ⚠️  SKIP: ${creatorEmailKey} 또는 ${creatorPasswordKey}가 설정되지 않아 Creator 계정 seed를 SKIP합니다.`);
        this.logger.warn(`[SEED] ⚠️  프로덕션에서 실수로 랜덤/빈 값으로 업데이트되지 않도록 DB를 건드리지 않습니다.`);
      }

      // 강제 업데이트 플래그 (기본값: false, SEED_FORCE_PASSWORD_UPDATE=true일 때만 강제 업데이트)
      const forcePasswordUpdate = this.configService.get<string>('SEED_FORCE_PASSWORD_UPDATE') === 'true';
      if (forcePasswordUpdate) {
        this.logger.warn(`[SEED] ⚠️  SEED_FORCE_PASSWORD_UPDATE=true로 설정되어 기존 계정의 비밀번호를 강제 업데이트합니다.`);
      }
      this.logger.log(`[SEED] ========================================`);

      // 비밀번호 해싱 함수 (scrypt 사용 - DatabaseService.verifyPassword와 호환)
      // ⚠️ 중요: password_hash = scryptSync(password, api_key_salt, 64).toString('hex') (128 hex 길이)
      // api_key_salt는 반드시 password 검증에 쓰이는 salt로 저장 (길이 32 hex 유지)
      const crypto = require('crypto');
      const { scryptSync, randomBytes } = crypto;

      const hashPassword = (password: string) => {
        // salt는 16바이트(32 hex 문자)로 생성
        const salt = randomBytes(16).toString('hex');
        // hash는 scryptSync(password, salt, 64).toString('hex') (128 hex 문자)
        const hash = scryptSync(password, salt, 64).toString('hex');
        return { hash, salt };
      };

      // ✅ 1단계: 기본 site 레코드 upsert (FK 제약 조건을 위해 필수)
      this.logger.log('📋 1단계: 기본 site 레코드 확인/생성 중...');
      const defaultSiteId = creatorSiteId || 'gods';
      try {
        const existingSite = db
          .prepare('SELECT id FROM sites WHERE id = ?')
          .get(defaultSiteId) as any;

        if (!existingSite) {
          db.prepare(
            `INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          ).run(
            defaultSiteId,
            'godcomfortword.com',
            "God's Comfort Word",
            'https://www.godcomfortword.com',
            null,
            null,
          );
          this.logger.log(`✅ Site '${defaultSiteId}' 생성 완료`);
        } else {
          this.logger.log(`⏭️  Site '${defaultSiteId}' 이미 존재 (skip)`);
        }
      } catch (siteError: any) {
        this.logger.error(`❌ [1단계 실패] Site '${defaultSiteId}' 생성 실패:`, siteError.message);
        throw new Error(`Site 생성 실패: ${siteError.message}`);
      }

      // ✅ 2단계: 기존 users의 site_id 복구/마이그레이션
      this.logger.log('📋 2단계: 기존 users의 site_id 복구/마이그레이션 중...');
      try {
        const usersWithInvalidSiteId = db
          .prepare(
            `SELECT u.id, u.email, u.site_id 
             FROM users u 
             WHERE u.site_id IS NOT NULL 
             AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.id = u.site_id)`,
          )
          .all() as any[];

        if (usersWithInvalidSiteId.length > 0) {
          this.logger.warn(`⚠️  ${usersWithInvalidSiteId.length}명의 사용자가 유효하지 않은 site_id를 가지고 있습니다. 복구 중...`);
          for (const user of usersWithInvalidSiteId) {
            // 유효하지 않은 site_id를 default site로 마이그레이션
            db.prepare('UPDATE users SET site_id = ? WHERE id = ?').run(defaultSiteId, user.id);
            this.logger.log(`  ✅ User ${user.email?.substring(0, 3) || user.id.substring(0, 8)}***의 site_id를 '${defaultSiteId}'로 마이그레이션`);
          }
        } else {
          this.logger.log(`⏭️  모든 users의 site_id가 유효합니다 (skip)`);
        }
      } catch (migrationError: any) {
        this.logger.error(`❌ [2단계 실패] site_id 마이그레이션 실패:`, migrationError.message);
        throw new Error(`site_id 마이그레이션 실패: ${migrationError.message}`);
      }

      // ✅ 3단계: Admin 계정 생성/업데이트 (idempotent - email 기준으로 조회 후 INSERT/UPDATE)
      if (adminEmail && adminPassword) {
        this.logger.log(`[SEED] 3단계: Admin 계정 seed 시작 (email: ${adminEmail.substring(0, 3)}***)`);
        try {
          const transaction = db.transaction(() => {
            // email 기준으로 기존 계정 조회 (idempotent 보장)
            const existingAdmin = db
              .prepare('SELECT id, email, role, site_id, password_hash, api_key_salt FROM users WHERE email = ?')
              .get(adminEmail) as any;

            if (!existingAdmin) {
              // 새로 생성 (INSERT)
              this.logger.log(`[SEED] Admin 계정 없음 → INSERT 실행`);
              const adminId = randomBytes(16).toString('hex');
              const adminApiKey = randomBytes(32).toString('hex');
              const { hash: passwordHash, salt: passwordSalt } = hashPassword(adminPassword);
              // passwordSalt를 api_key_salt에 저장 (비밀번호 검증에 사용)
              const apiKeyHash = scryptSync(adminApiKey, passwordSalt, 64).toString('hex');

              const insertResult = db
                .prepare(
                  'INSERT INTO users (id, site_id, name, email, password_hash, role, status, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )
                .run(
                  adminId,
                  null, // Admin은 site_id가 null
                  'Admin',
                  adminEmail,
                  passwordHash,
                  adminRole,
                  'active',
                  apiKeyHash,
                  passwordSalt, // passwordSalt를 api_key_salt에 저장
                );

              if (insertResult.changes === 0) {
                throw new Error('Admin 계정 INSERT 실패: changes = 0');
              }

              this.logger.log(`[SEED] ✅ Admin 계정 INSERT 완료 - affected rows: ${insertResult.changes}, email: ${adminEmail.substring(0, 3)}***, role: ${adminRole}, password_hash 길이: ${passwordHash.length}, api_key_salt 길이: ${passwordSalt.length}`);
            } else {
              // 기존 계정이 있는 경우
              if (forcePasswordUpdate) {
                // 강제 업데이트: password_hash, api_key_hash, api_key_salt 재생성 (UPDATE)
                this.logger.log(`[SEED] Admin 계정 존재 + SEED_FORCE_PASSWORD_UPDATE=true → UPDATE 실행`);
                const adminApiKey = randomBytes(32).toString('hex');
                const { hash: passwordHash, salt: passwordSalt } = hashPassword(adminPassword);
                // passwordSalt를 api_key_salt에 저장 (비밀번호 검증에 사용)
                const apiKeyHash = scryptSync(adminApiKey, passwordSalt, 64).toString('hex');

                const updateResult = db
                  .prepare(
                    'UPDATE users SET password_hash = ?, api_key_hash = ?, api_key_salt = ?, role = ?, status = ?, site_id = ? WHERE id = ?',
                  )
                  .run(
                    passwordHash,
                    apiKeyHash,
                    passwordSalt, // passwordSalt를 api_key_salt에 저장
                    adminRole,
                    'active',
                    null, // Admin은 site_id가 null
                    existingAdmin.id,
                  );

                if (updateResult.changes === 0) {
                  throw new Error('Admin 계정 UPDATE 실패: changes = 0');
                }

                this.logger.log(`[SEED] 🔁 Admin 계정 UPDATE 완료 - affected rows: ${updateResult.changes}, email: ${adminEmail.substring(0, 3)}***, role: ${adminRole}, password_hash 길이: ${passwordHash.length}, api_key_salt 길이: ${passwordSalt.length}`);
              } else {
                // 기존 계정이 있고 강제 업데이트가 아닌 경우 (SKIP)
                this.logger.log(`[SEED] ⏭️  Admin 계정 이미 존재 (skip) - email: ${adminEmail.substring(0, 3)}***, role: ${existingAdmin.role}, password_hash 길이: ${existingAdmin.password_hash?.length || 0}, api_key_salt 길이: ${existingAdmin.api_key_salt?.length || 0}`);
              }
            }
          });

          transaction();
        } catch (adminError: any) {
          this.logger.error(`[SEED] ❌ 3단계 실패: Admin 계정 seed 실패:`, adminError.message);
          this.logger.error(`[SEED] 상세 에러:`, adminError);
          throw new Error(`Admin 계정 seed 실패: ${adminError.message}`);
        }
      } else {
        this.logger.warn(`[SEED] ⚠️  ${adminEmailKey} 또는 ${adminPasswordKey}가 설정되지 않아 Admin 계정 seed를 SKIP합니다.`);
      }

      // ✅ 4단계: Creator 계정 생성/업데이트 (idempotent - email 기준으로 조회 후 INSERT/UPDATE)
      if (creatorEmail && creatorPassword) {
        this.logger.log(`[SEED] 4단계: Creator 계정 seed 시작 (email: ${creatorEmail.substring(0, 3)}***)`);
        try {
          const transaction = db.transaction(() => {
            // site_id가 반드시 존재하는지 재확인
            const siteExists = db
              .prepare('SELECT id FROM sites WHERE id = ?')
              .get(creatorSiteId) as any;

            if (!siteExists) {
              throw new Error(`Site '${creatorSiteId}'가 존재하지 않습니다. 1단계에서 생성되었어야 합니다.`);
            }

            // email 기준으로 기존 계정 조회 (idempotent 보장)
            const existingCreator = db
              .prepare('SELECT id, email, role, site_id, password_hash, api_key_salt FROM users WHERE email = ?')
              .get(creatorEmail) as any;

            if (!existingCreator) {
              // 새로 생성 (INSERT)
              this.logger.log(`[SEED] Creator 계정 없음 → INSERT 실행`);
              const creatorId = randomBytes(16).toString('hex');
              const creatorApiKey = randomBytes(32).toString('hex');
              const { hash: passwordHash, salt: passwordSalt } = hashPassword(creatorPassword);
              // passwordSalt를 api_key_salt에 저장 (비밀번호 검증에 사용)
              const apiKeyHash = scryptSync(creatorApiKey, passwordSalt, 64).toString('hex');

              const insertResult = db
                .prepare(
                  'INSERT INTO users (id, site_id, name, email, password_hash, role, status, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )
                .run(
                  creatorId,
                  creatorSiteId,
                  'Creator',
                  creatorEmail,
                  passwordHash,
                  creatorRole,
                  'active',
                  apiKeyHash,
                  passwordSalt, // passwordSalt를 api_key_salt에 저장
                );

              if (insertResult.changes === 0) {
                throw new Error('Creator 계정 INSERT 실패: changes = 0');
              }

              this.logger.log(`[SEED] ✅ Creator 계정 INSERT 완료 - affected rows: ${insertResult.changes}, email: ${creatorEmail.substring(0, 3)}***, role: ${creatorRole}, site_id: ${creatorSiteId}, password_hash 길이: ${passwordHash.length}, api_key_salt 길이: ${passwordSalt.length}`);
            } else {
              // 기존 계정이 있는 경우
              if (forcePasswordUpdate) {
                // 강제 업데이트: password_hash, api_key_hash, api_key_salt 재생성, site_id 보정 (UPDATE)
                this.logger.log(`[SEED] Creator 계정 존재 + SEED_FORCE_PASSWORD_UPDATE=true → UPDATE 실행`);
                const creatorApiKey = randomBytes(32).toString('hex');
                const { hash: passwordHash, salt: passwordSalt } = hashPassword(creatorPassword);
                // passwordSalt를 api_key_salt에 저장 (비밀번호 검증에 사용)
                const apiKeyHash = scryptSync(creatorApiKey, passwordSalt, 64).toString('hex');

                const updateResult = db
                  .prepare(
                    'UPDATE users SET password_hash = ?, api_key_hash = ?, api_key_salt = ?, role = ?, status = ?, site_id = ? WHERE id = ?',
                  )
                  .run(
                    passwordHash,
                    apiKeyHash,
                    passwordSalt, // passwordSalt를 api_key_salt에 저장
                    creatorRole,
                    'active',
                    creatorSiteId, // site_id 보정
                    existingCreator.id,
                  );

                if (updateResult.changes === 0) {
                  throw new Error('Creator 계정 UPDATE 실패: changes = 0');
                }

                this.logger.log(`[SEED] 🔁 Creator 계정 UPDATE 완료 - affected rows: ${updateResult.changes}, email: ${creatorEmail.substring(0, 3)}***, role: ${creatorRole}, site_id: ${creatorSiteId}, password_hash 길이: ${passwordHash.length}, api_key_salt 길이: ${passwordSalt.length}`);
              } else {
                // 기존 계정이 있고 강제 업데이트가 아닌 경우 (SKIP)
                this.logger.log(`[SEED] ⏭️  Creator 계정 이미 존재 (skip) - email: ${creatorEmail.substring(0, 3)}***, role: ${existingCreator.role}, site_id: ${existingCreator.site_id}, password_hash 길이: ${existingCreator.password_hash?.length || 0}, api_key_salt 길이: ${existingCreator.api_key_salt?.length || 0}`);
              }
            }
          });

          transaction();
        } catch (creatorError: any) {
          this.logger.error(`[SEED] ❌ 4단계 실패: Creator 계정 seed 실패:`, creatorError.message);
          this.logger.error(`[SEED] 상세 에러:`, creatorError);
          throw new Error(`Creator 계정 seed 실패: ${creatorError.message}`);
        }
      } else {
        this.logger.warn(`[SEED] ⚠️  ${creatorEmailKey} 또는 ${creatorPasswordKey}가 설정되지 않아 Creator 계정 seed를 SKIP합니다.`);
      }

      // Seed 완료 요약 로그
      this.logger.log(`[SEED] ========================================`);
      this.logger.log(`[SEED] ✅ Seed 계정 초기화 완료`);
      this.logger.log(`[SEED] ========================================`);
    } catch (error: any) {
      this.logger.error(`[SEED] ========================================`);
      this.logger.error(`[SEED] ❌ Seed 계정 초기화 실패:`, error.message);
      this.logger.error(`[SEED] 상세 에러:`, error);
      this.logger.error(`[SEED] ========================================`);
      // 초기화 실패해도 서버는 계속 실행되도록 함
    }
  }

  /**
   * 로그인 (username 또는 email + password)
   * 
   * DB에서 사용자를 조회하고 비밀번호를 검증합니다.
   * 허용된 계정만 로그인 가능: consulting_manager@naver.com (Admin), j1dly1@naver.com (Creator)
   * 
   * [비밀번호 검증 방식]
   * - scrypt 알고리즘 사용 (crypto.scryptSync)
   * - password_hash와 api_key_salt를 사용하여 검증
   * - DatabaseService.verifyPassword() 메서드 사용
   * 
   * [테스트 방법]
   * - Windows PowerShell: Invoke-RestMethod 사용
   *   예: Invoke-RestMethod -Method POST -Uri "http://localhost:3000/auth/login" `
   *       -ContentType "application/json" -Body '{"email":"user@example.com","password":"pass"}'
   * - Windows PowerShell에서 curl.exe 사용 금지 (JSON 파싱 오류 발생)
   * - curl은 Linux/WSL 환경에서만 사용
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
          // password_hash 형식 분석
          const passwordHashLength = user.password_hash ? user.password_hash.length : 0;
          const isBcryptFormat = user.password_hash ? user.password_hash.startsWith('$2') : false;
          const hashFormat = isBcryptFormat ? 'bcrypt ($2...)' : (user.password_hash ? 'scrypt (hex)' : 'NULL');
          const apiKeySaltLength = user.api_key_salt ? user.api_key_salt.length : 0;
          
          this.logger.log(`[LOGIN] 단계 B 완료: 사용자 발견 - id: ${user.id}, email: ${user.email?.substring(0, 3)}***, name: ${user.name}, role: ${user.role}`);
          this.logger.log(`[LOGIN] 단계 B-1: password_hash 분석 - 형식: ${hashFormat}, 길이: ${passwordHashLength}, api_key_salt 길이: ${apiKeySaltLength}`);
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

      // C) 비밀번호 비교 (scrypt 사용, timingSafeEqual)
      // ⚠️ 배포 환경 디버깅을 위한 최소 로그 (비밀번호 원문은 절대 출력 금지)
      this.logger.log(`[LOGIN] 단계 C: 비밀번호 비교 시작 - scrypt 검증 (timingSafeEqual)`);
      this.logger.log(`[LOGIN] user found: true, email: ${user.email?.substring(0, 3)}***`);
      
      let isValid;
      let computedHashLength = 0;
      try {
        // scryptSync로 computed hash 계산 (로깅용)
        const crypto = require('crypto');
        const { scryptSync } = crypto;
        const computedHash = scryptSync(password, user.api_key_salt || '', 64).toString('hex');
        computedHashLength = computedHash.length;
        
        // DatabaseService.verifyPassword로 검증 (timingSafeEqual 사용)
        isValid = this.databaseService.verifyPassword(
      password,
      user.password_hash,
          user.api_key_salt || '',
        );
        
        // ⚠️ 배포 환경 디버깅을 위한 최소 로그 (비밀번호 원문은 절대 출력 금지)
        this.logger.log(`[LOGIN] 검증 결과 - salt length: ${user.api_key_salt?.length || 0}, hash length: ${user.password_hash?.length || 0}, computed length: ${computedHashLength}, match: ${isValid}`);
        this.logger.log(`[LOGIN] 단계 C 완료: 비밀번호 비교 결과 - ${isValid ? '일치 (true)' : '불일치 (false)'}`);
      } catch (verifyError) {
        this.logger.error(
          `[LOGIN] 단계 C 실패: 비밀번호 검증 중 오류 (scrypt 비교 실패) - ${user.email?.substring(0, 3)}***`,
          verifyError instanceof Error ? verifyError.stack : String(verifyError),
        );
        this.logger.error(`[LOGIN] 검증 상세 - user 존재: true, password_hash 길이: ${user.password_hash?.length || 0}, api_key_salt 길이: ${user.api_key_salt?.length || 0}, computed hash 길이: ${computedHashLength}, match: false (에러)`);
        throw new InternalServerErrorException('비밀번호 검증 중 오류가 발생했습니다.');
      }

      if (!isValid) {
        // ⚠️ 배포 환경 디버깅을 위한 최소 로그 (비밀번호 원문은 절대 출력 금지)
        this.logger.warn(`[LOGIN] 단계 C 실패: 비밀번호 불일치 - ${identifier} (scrypt 비교 결과: false)`);
        this.logger.warn(`[LOGIN] 검증 상세 - user found: true, salt length: ${user.api_key_salt?.length || 0}, hash length: ${user.password_hash?.length || 0}, computed length: ${computedHashLength}, match: false`);
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
  private getTokenExpiry(token: string): string | null {
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

  /**
   * Seed 상태 진단
   * - 프로덕션에서 실제로 어떤 값으로 seed가 돌았는지 즉시 확인 가능
   * - 응답에는 "이메일", "hash 길이", "salt 길이", "updated_at", "force update 적용 여부", "env 존재 여부"만 포함
   * - password/hash/salt 원문은 절대 노출 금지
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

    // Admin 계정 상태 확인
    const adminEmail = this.configService.get<string>('CMS_TEST_ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('CMS_TEST_ADMIN_PASSWORD');
    const forcePasswordUpdate = this.configService.get<string>('SEED_FORCE_PASSWORD_UPDATE') === 'true';

    if (adminEmail) {
      const adminUser = db
        .prepare("SELECT email, password_hash, api_key_salt, updated_at FROM users WHERE email = ?")
        .get(adminEmail) as any;

      if (adminUser) {
        result.admin = {
          email: adminUser.email,
          hashLength: adminUser.password_hash?.length || 0,
          saltLength: adminUser.api_key_salt?.length || 0,
          updatedAt: adminUser.updated_at || null,
          forceUpdateApplied: forcePasswordUpdate,
          envExists: !!(adminEmail && adminPassword),
        };
      } else {
        result.admin = {
          email: adminEmail,
          hashLength: 0,
          saltLength: 0,
          updatedAt: null,
          forceUpdateApplied: false,
          envExists: !!(adminEmail && adminPassword),
        };
      }
    }

    // Creator 계정 상태 확인
    const creatorEmail = this.configService.get<string>('CMS_TEST_CREATOR_EMAIL');
    const creatorPassword = this.configService.get<string>('CMS_TEST_CREATOR_PASSWORD');

    if (creatorEmail) {
      const creatorUser = db
        .prepare("SELECT email, password_hash, api_key_salt, updated_at FROM users WHERE email = ?")
        .get(creatorEmail) as any;

      if (creatorUser) {
        result.creator = {
          email: creatorUser.email,
          hashLength: creatorUser.password_hash?.length || 0,
          saltLength: creatorUser.api_key_salt?.length || 0,
          updatedAt: creatorUser.updated_at || null,
          forceUpdateApplied: forcePasswordUpdate,
          envExists: !!(creatorEmail && creatorPassword),
        };
      } else {
        result.creator = {
          email: creatorEmail,
          hashLength: 0,
          saltLength: 0,
          updatedAt: null,
          forceUpdateApplied: false,
          envExists: !!(creatorEmail && creatorPassword),
        };
      }
    }

    return result;
  }

  /**
   * 이메일 마스킹 (예: consulting_manager@naver.com -> con***@naver.com)
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) {
      return email.substring(0, 3) + '***';
    }
    if (localPart.length <= 3) {
      return `${localPart.substring(0, 1)}***@${domain}`;
    }
    return `${localPart.substring(0, 3)}***@${domain}`;
  }
}

