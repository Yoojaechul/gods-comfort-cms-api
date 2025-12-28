import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * SQLite 데이터베이스 서비스
 * - better-sqlite3 동기 API
 * - 기존 프로젝트 호환 메서드(getDb 등) 유지
 */
@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  /**
   * NOTE:
   * better-sqlite3 Database 타입을 외부로 직접 노출하면 빌드 환경에서 TS4053 문제가 날 수 있어 any 사용
   */
  private db: any;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const dbPath =
      this.configService.get<string>('SQLITE_DB_PATH') ||
      this.configService.get<string>('DB_PATH') ||
      '/mnt/cmsdata/cms.db';

    this.logger.log(`Using SQLite DB Path: ${dbPath}`);

    try {
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        this.logger.log(`[DB] 디렉터리 생성: ${dbDir}`);
      }

      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      this.logger.log('[DB] ✅ SQLite 데이터베이스 연결 성공');

      this.ensureSchema();
      this.logTables();
      this.logUsersTableSchema();
    } catch (error) {
      this.logger.error('❌ DB 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * ✅ 기존 코드 호환: DB 인스턴스 반환
   */
  getDb(): any {
    return this.db as any;
  }

  /**
   * (추가) helper
   */
  prepare(sql: string): any {
    return (this.db as any).prepare(sql);
  }

  /**
   * 스키마 자동 생성/마이그레이션
   */
  private ensureSchema() {
    this.logger.log('🔧 Ensuring database schema...');

    // users
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        salt TEXT,
        role TEXT DEFAULT 'creator',
        status TEXT DEFAULT 'active',
        siteId TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // videos
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        management_id TEXT,
        platform TEXT,
        language TEXT,
        title TEXT,
        description TEXT,
        url TEXT,
        thumbnail_url TEXT,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        batch_id TEXT,
        batch_order INTEGER,
        batch_total INTEGER,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // sites (Seed가 domain 컬럼을 기대함)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT,
        domain TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // 이미 만들어진 sites 테이블에 domain 없으면 추가
    try {
      const cols = this.db.prepare(`PRAGMA table_info(sites)`).all() as Array<{ name: string }>;
      const hasDomain = cols.some((c) => c.name === 'domain');
      if (!hasDomain) {
        this.db.exec(`ALTER TABLE sites ADD COLUMN domain TEXT;`);
        this.logger.log('✅ Migrated: sites.domain column added');
      }
    } catch (e) {
      this.logger.warn('⚠️ sites.domain migration check failed:', e);
    }

    // indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_videos_management_id ON videos(management_id);
      CREATE INDEX IF NOT EXISTS idx_videos_batch_id ON videos(batch_id);
      CREATE INDEX IF NOT EXISTS idx_videos_created_by ON videos(created_by);

      CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(slug);
      CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
    `);

    this.logger.log('✅ Schema ensured');
  }

  private logTables() {
    try {
      const tables = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all();
      this.logger.log(`📊 Found ${tables.length} tables in database`);
    } catch (e) {
      this.logger.warn('⚠️ Table list failed:', e);
    }
  }

  private logUsersTableSchema() {
    try {
      const columns = this.db.prepare(`PRAGMA table_info(users)`).all() as Array<{
        name: string;
        type: string;
      }>;

      this.logger.log('='.repeat(60));
      this.logger.log('🧾 users 테이블 컬럼 목록:');
      columns.forEach((c) => this.logger.log(` - ${c.name} (${c.type})`));
      this.logger.log('='.repeat(60));
    } catch (error) {
      this.logger.error('❌ users 테이블 스키마 조회 실패:', error);
    }
  }

  // ---------------------------
  // 기존 서비스 호환 메서드들
  // ---------------------------

  findUserByEmail(email: string) {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE email = ? LIMIT 1`);
    return stmt.get(email);
  }

  findUserByEmailOrUsername(identifier: string) {
    return this.findUserByEmail(identifier);
  }

  findUserById(userId: string) {
    const stmt = this.db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`);
    return stmt.get(userId);
  }

  isEmailExists(newEmail: string, excludeUserId?: string) {
    if (excludeUserId) {
      const stmt = this.db.prepare(`SELECT 1 FROM users WHERE email = ? AND id != ? LIMIT 1`);
      return !!stmt.get(newEmail, excludeUserId);
    }
    const stmt = this.db.prepare(`SELECT 1 FROM users WHERE email = ? LIMIT 1`);
    return !!stmt.get(newEmail);
  }

  updateUserEmailAndPassword(
    userId: string,
    newEmail: string,
    newPasswordHash: string,
    newSalt: string,
  ) {
    const hasUpdatedAt = this.hasColumn('users', 'updated_at');

    if (hasUpdatedAt) {
      const stmt = this.db.prepare(`
        UPDATE users
           SET email = ?,
               password_hash = ?,
               salt = ?,
               updated_at = datetime('now')
         WHERE id = ?
      `);
      return stmt.run(newEmail, newPasswordHash, newSalt, userId).changes;
    }

    const stmt = this.db.prepare(`
      UPDATE users
         SET email = ?,
             password_hash = ?,
             salt = ?
       WHERE id = ?
    `);
    return stmt.run(newEmail, newPasswordHash, newSalt, userId).changes;
  }

  updateUserPassword(userId: string, newHash: string, newSalt: string) {
    const hasUpdatedAt = this.hasColumn('users', 'updated_at');

    if (hasUpdatedAt) {
      const stmt = this.db.prepare(`
        UPDATE users
           SET password_hash = ?,
               salt = ?,
               updated_at = datetime('now')
         WHERE id = ?
      `);
      return stmt.run(newHash, newSalt, userId).changes;
    }

    const stmt = this.db.prepare(`
      UPDATE users
         SET password_hash = ?,
             salt = ?
       WHERE id = ?
    `);
    return stmt.run(newHash, newSalt, userId).changes;
  }

  private hasColumn(table: string, column: string): boolean {
    try {
      const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      return cols.some((c) => c.name === column);
    } catch {
      return false;
    }
  }

  // ---------------------------
  // 비밀번호 해시/검증 (✅ 여기 수정이 핵심)
  // ---------------------------

  hashPassword(password: string, salt: string): string {
    return createHash('sha512').update(password + salt).digest('hex');
  }

  /**
   * ✅ 동기 boolean 반환 (better-sqlite3는 sync)
   * - debug.service.ts에서 boolean으로 사용 가능
   * - auth.service.ts에서 await 해도 문제 없음(await boolean -> boolean)
   */
  verifyPassword(password: string, storedHash: string, salt: string): boolean {
    try {
      const testHash = this.hashPassword(password, salt);

      const hashBuffer = Buffer.from(storedHash || '', 'hex');
      const testHashBuffer = Buffer.from(testHash || '', 'hex');

      if (hashBuffer.length !== testHashBuffer.length) return false;

      return timingSafeEqual(hashBuffer, testHashBuffer);
    } catch (error) {
      this.logger.error(`❌ 비밀번호 검증 에러:`, error);
      return false;
    }
  }

  /**
   * ✅ 호환용 alias
   * - auth.service.ts에서 verifyPasswordCompat() 호출하므로 반드시 제공
   */
  verifyPasswordCompat(password: string, storedHash: string, salt: string): boolean {
    return this.verifyPassword(password, storedHash, salt);
  }
}
