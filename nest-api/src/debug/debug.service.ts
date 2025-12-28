import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DebugService {
  private readonly logger = new Logger(DebugService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 버전 정보 조회
   */
  async getVersionInfo(): Promise<{
    appName: string;
    nodeEnv: string;
    envVars: Record<string, 'set' | 'unset'>;
    buildInfo?: {
      gitCommitSha?: string;
      buildTimestamp?: string;
    };
  }> {
    const appName = 'godscomfortword-nest-api';

    const envVars: Record<string, 'set' | 'unset'> = {
      CMS_TEST_ADMIN_EMAIL: process.env.CMS_TEST_ADMIN_EMAIL ? 'set' : 'unset',
      CMS_TEST_ADMIN_PASSWORD: process.env.CMS_TEST_ADMIN_PASSWORD ? 'set' : 'unset',
      CMS_TEST_CREATOR_EMAIL: process.env.CMS_TEST_CREATOR_EMAIL ? 'set' : 'unset',
      CMS_TEST_CREATOR_PASSWORD: process.env.CMS_TEST_CREATOR_PASSWORD ? 'set' : 'unset',
      SEED_FORCE_PASSWORD_UPDATE: process.env.SEED_FORCE_PASSWORD_UPDATE ? 'set' : 'unset',
      DEBUG_ENDPOINTS: process.env.DEBUG_ENDPOINTS ? 'set' : 'unset',
      JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'unset',
      SQLITE_DB_PATH: process.env.SQLITE_DB_PATH ? 'set' : 'unset',
    };

    const buildInfo: any = {};

    // Git commit SHA
    try {
      if (process.env.GIT_COMMIT_SHA) {
        buildInfo.gitCommitSha = process.env.GIT_COMMIT_SHA.substring(0, 7);
      } else {
        const gitHeadPath = path.join(process.cwd(), '.git', 'HEAD');
        if (fs.existsSync(gitHeadPath)) {
          const headContent = fs.readFileSync(gitHeadPath, 'utf-8').trim();
          if (headContent.startsWith('ref: ')) {
            const refPath = path.join(process.cwd(), '.git', headContent.substring(5));
            if (fs.existsSync(refPath)) {
              buildInfo.gitCommitSha = fs.readFileSync(refPath, 'utf-8').trim().substring(0, 7);
            }
          } else {
            buildInfo.gitCommitSha = headContent.substring(0, 7);
          }
        }
      }
    } catch {
      // ignore
    }

    // Build timestamp
    try {
      if (process.env.BUILD_TIMESTAMP) {
        buildInfo.buildTimestamp = process.env.BUILD_TIMESTAMP;
      } else {
        const distMainPath = path.join(process.cwd(), 'dist', 'main.js');
        if (fs.existsSync(distMainPath)) {
          const stats = fs.statSync(distMainPath);
          buildInfo.buildTimestamp = stats.mtime.toISOString();
        }
      }
    } catch {
      // ignore
    }

    const result: any = {
      appName,
      nodeEnv: process.env.NODE_ENV || 'development',
      envVars,
    };

    if (Object.keys(buildInfo).length > 0) {
      result.buildInfo = buildInfo;
    }

    return result;
  }

  /**
   * DB 정보 조회
   * - users 테이블 count 및 특정 계정 존재 여부 확인
   * - ✅ salt 컬럼 기준(구: api_key_salt 사용 금지)
   */
  async getDbInfo(): Promise<{
    connection: { driver: string; type: string };
    sqlite: { dbPath: string; dbPathAbsolute: string; fileExists: boolean; fileSize?: number };
    users: {
      totalCount: number;
      consulting_manager: any;
      j1dly1: any;
    };
  }> {
    const db = this.databaseService.getDb();

    const connection = {
      driver: 'better-sqlite3',
      type: 'sqlite',
    };

    const dbPath =
      this.configService.get<string>('SQLITE_DB_PATH') ||
      this.configService.get<string>('DB_PATH') ||
      '/app/data/cms.db';

    const dbPathAbsolute = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

    let dbFileExists = false;
    let dbFileSize: number | undefined;

    try {
      if (fs.existsSync(dbPathAbsolute)) {
        dbFileExists = true;
        const stats = fs.statSync(dbPathAbsolute);
        dbFileSize = stats.size;
      }
    } catch (error) {
      this.logger.debug('DB 파일 정보 조회 실패:', error as any);
    }

    // total users
    let totalCount = 0;
    try {
      totalCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count || 0;
    } catch {
      totalCount = 0;
    }

    const adminEmail = 'consulting_manager@naver.com';
    const creatorEmail = 'j1dly1@naver.com';

    const adminUser = db
      .prepare('SELECT password_hash, salt, role, status, siteId FROM users WHERE email = ?')
      .get(adminEmail) as any;

    const creatorUser = db
      .prepare('SELECT password_hash, salt, role, status, siteId FROM users WHERE email = ?')
      .get(creatorEmail) as any;

    const packUser = (u: any) => {
      if (!u) {
        return {
          exists: false,
          role: '',
          status: '',
          siteId: null,
          passwordHashLength: 0,
          saltLength: 0,
        };
      }

      return {
        exists: true,
        role: u.role || '',
        status: u.status || '',
        siteId: u.siteId ?? null,
        passwordHashLength: u.password_hash?.length || 0,
        passwordHashMasked: u.password_hash ? this.maskHash(u.password_hash) : undefined,
        saltLength: u.salt?.length || 0,
        saltMasked: u.salt ? this.maskHash(u.salt) : undefined,
      };
    };

    return {
      connection,
      sqlite: {
        dbPath,
        dbPathAbsolute,
        fileExists: dbFileExists,
        fileSize: dbFileSize,
      },
      users: {
        totalCount,
        consulting_manager: packUser(adminUser),
        j1dly1: packUser(creatorUser),
      },
    };
  }

  /**
   * ✅ 테이블 목록/row count 조회
   * - GET /debug/db-tables 에서 사용
   */
  async getDbTables(): Promise<{ tables: Array<{ name: string; count: number }> }> {
    const db = this.databaseService.getDb();

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>;

    const result = tables.map((t) => {
      try {
        const row = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get() as any;
        return { name: t.name, count: row?.count ?? 0 };
      } catch {
        return { name: t.name, count: -1 };
      }
    });

    return { tables: result };
  }

  /**
   * 로그인 검증 테스트
   */
  async checkLogin(email: string, password: string): Promise<{
    userFound: boolean;
    passwordHashLength?: number;
    saltLength?: number;
    hashMethod?: 'sha512' | 'bcrypt' | 'scrypt' | 'unknown';
    match?: boolean;
    error?: string;
  }> {
    try {
      const db = this.databaseService.getDb();

      // ✅ 현재 스키마: salt 컬럼 사용
      const user = db
        .prepare("SELECT password_hash, salt FROM users WHERE email = ? AND status = 'active'")
        .get(email) as any;

      if (!user) {
        return { userFound: false };
      }

      const passwordHashLength = user.password_hash?.length || 0;
      const saltLength = user.salt?.length || 0;

      // 참고용 해시 방식 판별
      let hashMethod: 'sha512' | 'bcrypt' | 'scrypt' | 'unknown' = 'unknown';
      if (user.password_hash) {
        if (user.password_hash.startsWith('$2')) {
          hashMethod = 'bcrypt';
        } else if (user.password_hash.length === 128 && /^[0-9a-f]+$/i.test(user.password_hash)) {
          // sha512 hex(128)도 이 조건에 걸리므로, 프로젝트 DB 서비스가 sha512이면 sha512로 표기
          hashMethod = 'sha512';
        }
      }

      let match = false;
      try {
        // ✅ DatabaseService 시그니처: verifyPassword(password, storedHash, salt)
        match = this.databaseService.verifyPassword(
          password,
          user.password_hash || '',
          user.salt || '',
        );
      } catch (verifyError) {
        return {
          userFound: true,
          passwordHashLength,
          saltLength,
          hashMethod,
          match: false,
          error: verifyError instanceof Error ? verifyError.message : String(verifyError),
        };
      }

      return {
        userFound: true,
        passwordHashLength,
        saltLength,
        hashMethod,
        match,
      };
    } catch (error) {
      return {
        userFound: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 테이블 스키마 조회
   * PRAGMA table_info()를 사용하여 테이블의 컬럼 정보를 반환
   */
  async getTableSchema(tableName: string): Promise<Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: any;
    pk: number;
  }>> {
    // 허용된 테이블 이름만 허용 (SQL injection 방지)
    const allowedTables = ['users', 'videos'];
    if (!allowedTables.includes(tableName)) {
      throw new Error(`허용되지 않은 테이블 이름입니다: ${tableName}`);
    }

    const db = this.databaseService.getDb();
    
    try {
      // PRAGMA는 파라미터화를 지원하지 않으므로 화이트리스트 검증 후 사용
      const result = db
        .prepare(`PRAGMA table_info('${tableName}')`)
        .all() as Array<{
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: any;
          pk: number;
        }>;
      
      return result;
    } catch (error) {
      this.logger.error(`테이블 스키마 조회 실패: ${tableName}`, error);
      throw error;
    }
  }

  /**
   * 해시/솔트 마스킹 (앞 8글자 + ... + 뒤 8글자)
   */
  private maskHash(hash: string): string {
    if (!hash || hash.length <= 16) return '***';
    const front = hash.substring(0, 8);
    const back = hash.substring(hash.length - 8);
    return `${front}...${back}`;
    }
}
