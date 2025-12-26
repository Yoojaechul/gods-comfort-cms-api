import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * SQLite 데이터베이스 서비스
 * 기존 cms.db 파일을 재사용하여 동기 방식으로 쿼리 실행
 */
@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private db: Database.Database;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // 환경변수에서 DB 경로 가져오기 (없으면 기본값: /app/data/cms.db)
    const dbPath =
      this.configService.get<string>('SQLITE_DB_PATH') ||
      this.configService.get<string>('DB_PATH') ||
      '/app/data/cms.db';

    this.logger.log(`📂 Opening SQLite database: ${dbPath}`);

    try {
      // DB 디렉터리 존재 보장 (Cloud Run에서 필요)
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        this.logger.log(`📁 DB directory created: ${dbDir}`);
      }

      // better-sqlite3로 DB 열기 (파일이 없으면 자동 생성)
      this.db = new Database(dbPath);

      // WAL 모드 활성화 (성능 향상)
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      this.logger.log('✅ SQLite database connected successfully');

      // ✅ 스키마 자동 생성 (테이블이 없으면 생성)
      this.ensureSchema();

      // 테이블 존재 확인
      const tables = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all();
      this.logger.log(`📊 Found ${tables.length} tables in database`);

      // users 테이블 스키마 로깅 (디버그용)
      this.logUsersTableSchema();
    } catch (error) {
      this.logger.error('❌ DB 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 스키마 자동 생성 (마이그레이션)
   * 서버 시작 시 필수 테이블이 없으면 자동으로 생성
   */
  private ensureSchema(): void {
    this.logger.log('🔧 Ensuring database schema...');

    try {
      this.db.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS sites (
          id TEXT PRIMARY KEY,
          domain TEXT,
          name TEXT NOT NULL,
          homepage_url TEXT,
          api_base TEXT,
          facebook_key TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          site_id TEXT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          role TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          password_hash TEXT,
          api_key_hash TEXT,
          api_key_salt TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT,
          FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS user_provider_keys (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          key_name TEXT NOT NULL,
          key_value TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT,
          UNIQUE(user_id, provider, key_name),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY,
          site_id TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          video_id TEXT,
          source_url TEXT NOT NULL,
          title TEXT,
          thumbnail_url TEXT,
          embed_url TEXT,
          language TEXT DEFAULT 'en',
          status TEXT DEFAULT 'active',
          visibility TEXT DEFAULT 'public',
          views_count INTEGER DEFAULT 0,
          likes_count INTEGER DEFAULT 0,
          shares_count INTEGER DEFAULT 0,
          management_id TEXT,
          batch_id TEXT,
          batch_order INTEGER,
          batch_created_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT,
          stats_updated_at TEXT,
          stats_updated_by TEXT,
          FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS visits (
          id TEXT PRIMARY KEY,
          site_id TEXT NOT NULL,
          ip_address TEXT,
          country_code TEXT,
          country_name TEXT,
          language TEXT,
          page_url TEXT,
          user_agent TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS stats_adjustments (
          id TEXT PRIMARY KEY,
          video_id TEXT NOT NULL,
          admin_id TEXT NOT NULL,
          old_views INTEGER,
          new_views INTEGER,
          old_likes INTEGER,
          new_likes INTEGER,
          old_shares INTEGER,
          new_shares INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS video_like_clients (
          id TEXT PRIMARY KEY,
          video_id TEXT NOT NULL,
          client_id TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(video_id, client_id)
        );

        -- 인덱스
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_site_id ON users(site_id);

        CREATE INDEX IF NOT EXISTS idx_videos_site_id ON videos(site_id);
        CREATE INDEX IF NOT EXISTS idx_videos_owner_id ON videos(owner_id);
        CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility);
        CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_management_id
          ON videos(management_id)
          WHERE management_id IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_videos_batch_created_at
          ON videos(batch_created_at DESC)
          WHERE batch_created_at IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_videos_batch_order
          ON videos(batch_order ASC)
          WHERE batch_order IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_visits_site_id ON visits(site_id);
        CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);

        CREATE INDEX IF NOT EXISTS idx_video_like_clients_video_id ON video_like_clients(video_id);
        CREATE INDEX IF NOT EXISTS idx_video_like_clients_client_id ON video_like_clients(client_id);
      `);

      this.logger.log('✅ Database schema ensured successfully');
    } catch (error) {
      this.logger.error('❌ Schema creation failed:', error);
      throw error;
    }
  }

  /**
   * users 테이블 스키마 로깅 (디버그용)
   */
  private logUsersTableSchema(): void {
    try {
      const schema = this.db.prepare("PRAGMA table_info('users')").all();
      
      this.logger.log('='.repeat(60));
      this.logger.log('📋 users 테이블 스키마:');
      
      schema.forEach((col: any) => {
        this.logger.log(
          `  - ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}${col.pk ? ' PRIMARY KEY' : ''}`,
        );
      });
      
      this.logger.log('='.repeat(60));
    } catch (error) {
      this.logger.error('❌ users 테이블 스키마 조회 실패:', error);
    }
  }

  /**
   * DB 인스턴스 가져오기
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * 사용자 조회 (이메일 기준)
   */
  findUserByEmail(email: string): any {
    try {
      const user = this.db
        .prepare("SELECT * FROM users WHERE email = ? AND status = 'active'")
        .get(email) as any;

      if (user) {
        this.logger.debug(
          `✅ 사용자 발견 (${email}): id=${user.id}, password_hash=${user.password_hash ? 'SET' : 'NULL'}`,
        );
      } else {
        this.logger.debug(`❌ 사용자 없음 (${email})`);
      }

      return user;
    } catch (error) {
      this.logger.error(`❌ 사용자 조회 DB 에러:`, (error as any).message);
      this.logger.error('상세 에러:', error);
      throw error;
    }
  }

  /**
   * 사용자 조회 (이메일 또는 username 기준)
   * username은 name 필드에서 검색 (일반적으로 name 필드에 username이 저장됨)
   */
  findUserByEmailOrUsername(identifier: string): any {
    try {
      // 먼저 email로 검색
      let user = this.db
        .prepare("SELECT * FROM users WHERE email = ? AND status = 'active'")
        .get(identifier) as any;

      // email로 찾지 못하면 name 필드로 검색 (username으로 사용)
      if (!user) {
        user = this.db
          .prepare("SELECT * FROM users WHERE name = ? AND status = 'active'")
          .get(identifier) as any;
      }

      if (user) {
        this.logger.debug(
          `✅ 사용자 발견 (${identifier}): id=${user.id}, email=${user.email}, name=${user.name}, password_hash=${user.password_hash ? 'SET' : 'NULL'}`,
        );
      } else {
        this.logger.debug(`❌ 사용자 없음 (${identifier})`);
      }

      return user;
    } catch (error) {
      this.logger.error(`❌ 사용자 조회 DB 에러:`, (error as any).message);
      this.logger.error('상세 에러:', error);
      throw error;
    }
  }

  /**
   * 사용자 조회 (ID 기준)
   */
  findUserById(userId: string): any {
    try {
      const user = this.db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(userId);

      if (user) {
        this.logger.debug(`✅ 사용자 발견 (ID: ${userId})`);
      } else {
        this.logger.debug(`❌ 사용자 없음 (ID: ${userId})`);
      }

      return user;
    } catch (error) {
      this.logger.error(`❌ 사용자 조회 DB 에러 (ID: ${userId}):`, error.message);
      this.logger.error('상세 에러:', error);
      throw error;
    }
  }

  /**
   * 사용자 비밀번호 업데이트
   * @returns 영향받은 행 수 (changes)
   */
  updateUserPassword(
    userId: string,
    passwordHash: string,
    salt: string,
  ): number {
    try {
      this.logger.debug(`비밀번호 업데이트 시작 - User ID: ${userId}`);
      this.logger.debug(`  - passwordHash 길이: ${passwordHash.length}`);
      this.logger.debug(`  - salt 길이: ${salt.length}`);
      
      const result = this.db
        .prepare(
          "UPDATE users SET password_hash = ?, api_key_salt = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .run(passwordHash, salt, userId);

      this.logger.debug(
        `✅ 비밀번호 업데이트 완료 - 영향받은 행: ${result.changes}`,
      );

      if (result.changes === 0) {
        this.logger.warn(`⚠️  업데이트된 행이 없음 - User ID: ${userId}`);
      }

      return result.changes;
    } catch (error) {
      this.logger.error(`❌ 비밀번호 업데이트 DB 에러:`, (error as any).message);
      this.logger.error('상세 에러:', error);
      throw error;
    }
  }

  /**
   * 사용자 이메일 및 비밀번호 업데이트 (최초 설정 시)
   * updated_at 컬럼이 없는 경우 자동으로 fallback 쿼리 실행
   */
  updateUserEmailAndPassword(
    userId: string,
    email: string,
    passwordHash: string,
    salt: string,
  ): void {
    this.logger.debug(
      `이메일/비밀번호 업데이트 시작 - User ID: ${userId}, Email: ${email}`,
    );
    this.logger.debug(`  - passwordHash 길이: ${passwordHash.length}`);
    this.logger.debug(`  - salt 길이: ${salt.length}`);

    try {
      // 첫 번째 시도: updated_at 포함
      this.logger.debug('첫 번째 쿼리 실행 (updated_at 포함)...');
      
      const result = this.db
        .prepare(
          "UPDATE users SET email = ?, password_hash = ?, api_key_salt = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .run(email, passwordHash, salt, userId);

      this.logger.debug(
        `✅ 이메일/비밀번호 업데이트 완료 - 영향받은 행: ${result.changes}`,
      );

      if (result.changes === 0) {
        this.logger.warn(`⚠️  업데이트된 행이 없음 - User ID: ${userId}`);
      }
    } catch (error) {
      const errorMessage = (error as any).message || '';

      // updated_at 컬럼이 없는 경우 fallback 쿼리 실행
      if (errorMessage.includes('no such column: updated_at')) {
        this.logger.warn(
          '⚠️  updated_at 컬럼이 존재하지 않습니다. fallback 쿼리 실행 중...',
        );

        try {
          // 두 번째 시도: updated_at 제외
          const fallbackResult = this.db
            .prepare(
              'UPDATE users SET email = ?, password_hash = ?, api_key_salt = ? WHERE id = ?',
            )
            .run(email, passwordHash, salt, userId);

          this.logger.debug(
            `✅ fallback UPDATE 성공 - 영향받은 행: ${fallbackResult.changes}`,
          );

          if (fallbackResult.changes === 0) {
            this.logger.warn(
              `⚠️  fallback UPDATE에서 업데이트된 행이 없음 - User ID: ${userId}`,
            );
          }

          // fallback 성공 시 정상 종료
          return;
        } catch (fallbackError) {
          this.logger.error(
            `❌ fallback 쿼리도 실패:`,
            (fallbackError as any).message,
          );
          this.logger.error('상세 에러:', fallbackError);
          throw fallbackError;
        }
      }

      // updated_at 컬럼 문제가 아닌 다른 에러
      this.logger.error(
        `❌ 이메일/비밀번호 업데이트 DB 에러:`,
        errorMessage,
      );
      this.logger.error('SQL 쿼리 파라미터:', {
        userId,
        email,
        passwordHashLength: passwordHash.length,
        saltLength: salt.length,
      });
      this.logger.error('상세 에러:', error);
      throw error;
    }
  }

  /**
   * 이메일 중복 확인
   */
  isEmailExists(email: string, excludeUserId?: string): boolean {
    try {
      let query = 'SELECT COUNT(*) as count FROM users WHERE email = ?';
      const params: any[] = [email];

      if (excludeUserId) {
        query += ' AND id != ?';
        params.push(excludeUserId);
      }

      const result = this.db.prepare(query).get(...params) as {
        count: number;
      };
      
      const exists = result.count > 0;
      this.logger.debug(`이메일 중복 확인 (${email}): ${exists ? '중복' : '사용가능'}`);
      
      return exists;
    } catch (error) {
      this.logger.error(`❌ 이메일 중복 확인 DB 에러:`, error.message);
      this.logger.error('상세 에러:', error);
      throw error;
    }
  }

  /**
   * 비밀번호 검증 (scrypt 사용)
   * db.js의 verifyPassword와 동일한 로직
   */
  verifyPassword(password: string, hash: string, salt: string): boolean {
    try {
      const crypto = require('crypto');
      const { scryptSync } = crypto;
      const testHash = scryptSync(password, salt, 64).toString('hex');
      return testHash === hash;
    } catch (error) {
      this.logger.error(`❌ 비밀번호 검증 에러:`, error);
      return false;
    }
  }
}

