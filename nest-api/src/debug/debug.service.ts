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
    envVars: {
      CMS_TEST_ADMIN_EMAIL: 'set' | 'unset';
      CMS_TEST_ADMIN_PASSWORD: 'set' | 'unset';
      CMS_TEST_CREATOR_EMAIL: 'set' | 'unset';
      CMS_TEST_CREATOR_PASSWORD: 'set' | 'unset';
      SEED_FORCE_PASSWORD_UPDATE: 'set' | 'unset';
      DEBUG_ENDPOINTS: 'set' | 'unset';
    };
    buildInfo?: {
      gitCommitSha?: string;
      buildTimestamp?: string;
    };
  }> {
    // App name
    const appName = 'godscomfortword-nest-api';

    // 환경변수 존재 여부 (set/unset)
    const envVars = {
      CMS_TEST_ADMIN_EMAIL: process.env.CMS_TEST_ADMIN_EMAIL ? 'set' : 'unset',
      CMS_TEST_ADMIN_PASSWORD: process.env.CMS_TEST_ADMIN_PASSWORD ? 'set' : 'unset',
      CMS_TEST_CREATOR_EMAIL: process.env.CMS_TEST_CREATOR_EMAIL ? 'set' : 'unset',
      CMS_TEST_CREATOR_PASSWORD: process.env.CMS_TEST_CREATOR_PASSWORD ? 'set' : 'unset',
      SEED_FORCE_PASSWORD_UPDATE: process.env.SEED_FORCE_PASSWORD_UPDATE ? 'set' : 'unset',
      DEBUG_ENDPOINTS: process.env.DEBUG_ENDPOINTS ? 'set' : 'unset',
    };

    // Build info (있으면 표시)
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
    } catch (error) {
      // buildInfo에 추가하지 않음 (없으면 생략)
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
    } catch (error) {
      // buildInfo에 추가하지 않음 (없으면 생략)
    }

    const result: any = {
      appName,
      nodeEnv: process.env.NODE_ENV || 'development',
      envVars,
    };

    // buildInfo가 비어있지 않으면 추가
    if (Object.keys(buildInfo).length > 0) {
      result.buildInfo = buildInfo;
    }

    return result;
  }

  /**
   * DB 정보 조회
   */
  async getDbInfo(): Promise<{
    connection: {
      driver: string;
      type: string;
    };
    sqlite?: {
      dbPath: string;
      dbPathAbsolute: string;
      fileExists: boolean;
      fileSize?: number;
    };
    users: {
      totalCount: number;
      consulting_manager: {
        exists: boolean;
        role: string;
        status: string;
        siteId: string | null;
        passwordHashLength: number;
        passwordHashMasked?: string;
        saltLength: number;
        saltMasked?: string;
      };
      j1dly1: {
        exists: boolean;
        role: string;
        status: string;
        siteId: string | null;
        passwordHashLength: number;
        passwordHashMasked?: string;
        saltLength: number;
        saltMasked?: string;
      };
    };
  }> {
    const db = this.databaseService.getDb();

    // DB 연결 정보
    const connection = {
      driver: 'better-sqlite3',
      type: 'sqlite',
    };

    // SQLite DB 경로 확인
    const dbPath =
      this.configService.get<string>('SQLITE_DB_PATH') ||
      this.configService.get<string>('DB_PATH') ||
      '/app/data/cms.db';

    const dbPathAbsolute = path.isAbsolute(dbPath)
      ? dbPath
      : path.join(process.cwd(), dbPath);

    let dbFileExists = false;
    let dbFileSize: number | undefined;

    try {
      if (fs.existsSync(dbPathAbsolute)) {
        dbFileExists = true;
        const stats = fs.statSync(dbPathAbsolute);
        dbFileSize = stats.size;
      }
    } catch (error) {
      this.logger.debug('DB 파일 정보 조회 실패:', error);
    }

    // Users 테이블 집계
    const totalCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;

    const adminEmail = 'consulting_manager@naver.com';
    const creatorEmail = 'j1dly1@naver.com';

    const adminUser = db
      .prepare('SELECT password_hash, api_key_salt, role, status, site_id FROM users WHERE email = ?')
      .get(adminEmail) as any;

    const creatorUser = db
      .prepare('SELECT password_hash, api_key_salt, role, status, site_id FROM users WHERE email = ?')
      .get(creatorEmail) as any;

    const result: any = {
      connection,
      sqlite: {
        dbPath,
        dbPathAbsolute,
        fileExists: dbFileExists,
        fileSize: dbFileSize,
      },
      users: {
        totalCount,
        consulting_manager: adminUser
          ? {
              exists: true,
              role: adminUser.role || '',
              status: adminUser.status || '',
              siteId: adminUser.site_id,
              passwordHashLength: adminUser.password_hash?.length || 0,
              passwordHashMasked: adminUser.password_hash
                ? this.maskHash(adminUser.password_hash)
                : undefined,
              saltLength: adminUser.api_key_salt?.length || 0,
              saltMasked: adminUser.api_key_salt
                ? this.maskHash(adminUser.api_key_salt)
                : undefined,
            }
          : {
              exists: false,
              role: '',
              status: '',
              siteId: null,
              passwordHashLength: 0,
              saltLength: 0,
            },
        j1dly1: creatorUser
          ? {
              exists: true,
              role: creatorUser.role || '',
              status: creatorUser.status || '',
              siteId: creatorUser.site_id,
              passwordHashLength: creatorUser.password_hash?.length || 0,
              passwordHashMasked: creatorUser.password_hash
                ? this.maskHash(creatorUser.password_hash)
                : undefined,
              saltLength: creatorUser.api_key_salt?.length || 0,
              saltMasked: creatorUser.api_key_salt
                ? this.maskHash(creatorUser.api_key_salt)
                : undefined,
            }
          : {
              exists: false,
              role: '',
              status: '',
              siteId: null,
              passwordHashLength: 0,
              saltLength: 0,
            },
      },
    };

    return result;
  }

  /**
   * 로그인 검증 테스트
   */
  async checkLogin(email: string, password: string): Promise<{
    userFound: boolean;
    passwordHashLength?: number;
    saltLength?: number;
    hashMethod?: 'scrypt' | 'bcrypt' | 'unknown';
    match?: boolean;
    error?: string;
  }> {
    try {
      const db = this.databaseService.getDb();
      const user = db
        .prepare("SELECT password_hash, api_key_salt FROM users WHERE email = ? AND status = 'active'")
        .get(email) as any;

      if (!user) {
        return {
          userFound: false,
        };
      }

      const passwordHashLength = user.password_hash?.length || 0;
      const saltLength = user.api_key_salt?.length || 0;

      // 해시 방식 판별
      let hashMethod: 'scrypt' | 'bcrypt' | 'unknown' = 'unknown';
      if (user.password_hash) {
        if (user.password_hash.startsWith('$2')) {
          hashMethod = 'bcrypt';
        } else if (user.password_hash.length === 128 && /^[0-9a-f]+$/i.test(user.password_hash)) {
          hashMethod = 'scrypt';
        }
      }

      // 비밀번호 매칭 확인
      let match = false;
      try {
        match = this.databaseService.verifyPassword(
          password,
          user.password_hash,
          user.api_key_salt || '',
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
   * 해시/솔트 마스킹 (앞 8글자 + ... + 뒤 8글자)
   */
  private maskHash(hash: string): string {
    if (!hash || hash.length <= 16) {
      return '***';
    }
    const front = hash.substring(0, 8);
    const back = hash.substring(hash.length - 8);
    return `${front}...${back}`;
  }
}

