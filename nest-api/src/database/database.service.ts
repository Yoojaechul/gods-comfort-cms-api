import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { createHash, timingSafeEqual, randomUUID, randomBytes } from 'crypto';

/**
 * SQLite 데이터베이스 서비스
 * - better-sqlite3 동기 API
 * - 기존 프로젝트 호환 메서드(getDb 등) 유지
 */
@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private db: any;
  private readonly configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  async onModuleInit() {
    const dbPath = this.configService.get<string>('DATABASE_PATH') || path.join(process.cwd(), 'data', 'database.db');
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.logger.log(`📦 Database initialized at: ${dbPath}`);

    this.ensureSchema();
    this.ensureMigrations();
    this.logTables();
    this.logUsersTableSchema();
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

    // videos 테이블은 ensureVideosTable에서 처리
    this.ensureVideosTable();

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

    // indexes (videos 인덱스는 ensureVideosTable에서 처리)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(slug);
      CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
    `);

    this.logger.log('✅ Schema ensured');
  }

  /**
   * videos 테이블 자동 생성 및 마이그레이션
   * - 테이블이 없으면 생성
   * - 필요한 모든 컬럼이 없으면 추가 (safeAddColumn 패턴)
   */
  private ensureVideosTable() {
    try {
      this.logger.log('[DB] Ensuring videos table...');

      // 1. 테이블이 없으면 생성 (최소한의 필수 컬럼만 포함)
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY,
          management_id TEXT,
          owner_id TEXT,
          creator_id TEXT,
          video_id TEXT,
          youtube_url TEXT,
          facebook_url TEXT,
          source_url TEXT,
          thumbnail_url TEXT,
          title TEXT,
          platform TEXT,
          language TEXT,
          view_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);

      // 2. 기존 테이블에 필요한 컬럼들이 있는지 확인하고 없으면 추가 (safeAddColumn 패턴)
      const cols = this.db
        .prepare(`PRAGMA table_info(videos)`)
        .all() as Array<{ name: string }>;
      const columnNames = cols.map((c) => c.name);

      // 필수 컬럼 목록 (존재하지 않으면 추가)
      // 운영/개발 DB 마이그레이션 안전장치: youtube_url, facebook_url, source_url 자동 추가
      const requiredColumns = [
        { name: 'management_id', type: 'TEXT' },
        { name: 'owner_id', type: 'TEXT' },  // 기존 코드 호환
        { name: 'creator_id', type: 'TEXT' },  // 향후 통일용
        { name: 'video_id', type: 'TEXT' },
        { name: 'youtube_url', type: 'TEXT' },
        { name: 'facebook_url', type: 'TEXT' },
        { name: 'source_url', type: 'TEXT' },
        { name: 'thumbnail_url', type: 'TEXT' },
        { name: 'title', type: 'TEXT' },
        { name: 'platform', type: 'TEXT' },
        { name: 'language', type: 'TEXT' },
        { name: 'view_count', type: 'INTEGER DEFAULT 0' },
        { name: 'created_at', type: 'TEXT DEFAULT (datetime(\'now\'))' },
        { name: 'updated_at', type: 'TEXT DEFAULT (datetime(\'now\'))' },
      ];

      // safeAddColumn: 컬럼이 없으면 추가, 있으면 무시
      for (const col of requiredColumns) {
        if (!columnNames.includes(col.name)) {
          try {
            this.db.exec(`ALTER TABLE videos ADD COLUMN ${col.name} ${col.type};`);
            this.logger.log(`✅ Migrated: videos.${col.name} column added`);
          } catch (err: any) {
            // 이미 존재하거나 다른 이유로 실패할 수 있음 (무시)
            this.logger.warn(
              `⚠️ Failed to add videos.${col.name}: ${err.message}`,
            );
          }
        }
      }

      // 3. management_id UNIQUE 인덱스 추가 (있으면 무시)
      try {
        this.db.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_management_id ON videos(management_id);
        `);
      } catch (err: any) {
        this.logger.warn(`⚠️ Failed to create index idx_videos_management_id: ${err.message}`);
      }

      this.logger.log('[DB] ✅ videos table ensured');
    } catch (e) {
      this.logger.error('[DB] ❌ ensureVideosTable failed', e);
      throw e;
    }
  }

  /**
   * 마이그레이션: 기존 마이그레이션 로직 (videos는 ensureVideosTable에서 처리)
   */
  private ensureMigrations() {
    try {
      this.logger.log('[DB] ensureMigrations start');
      // videos 테이블은 ensureVideosTable에서 처리되므로 여기서는 다른 마이그레이션만 처리
      this.logger.log('[DB] ensureMigrations done');
    } catch (e) {
      this.logger.error('[DB] ❌ ensureMigrations failed', e);
      throw e;
    }
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

  /**
   * Upsert user by email
   * - If user exists: update only provided fields (not undefined)
   * - If user doesn't exist: insert new user with generated id
   * - Returns the updated/inserted user row
   */
  upsertUserByEmail(data: {
    email: string;
    role?: string;
    password?: string;
    status?: string;
    siteId?: string;
  }): { id: string; email: string; role: string } {
    const { email, role, password, status, siteId } = data;

    if (!email) {
      throw new Error('Email is required for upsertUserByEmail');
    }

    // Find existing user
    const existingUser = this.findUserByEmail(email);
    const hasUpdatedAt = this.hasColumn('users', 'updated_at');

    if (existingUser) {
      // Update existing user - only update fields that are provided (not undefined)
      const updates: string[] = [];
      const values: any[] = [];

      if (role !== undefined) {
        updates.push('role = ?');
        values.push(role);
      }

      if (status !== undefined) {
        updates.push('status = ?');
        values.push(status);
      }

      if (siteId !== undefined) {
        updates.push('siteId = ?');
        values.push(siteId);
      }

      if (password !== undefined) {
        // Generate new salt and hash password
        const salt = randomBytes(16).toString('hex'); // 32 chars
        const passwordHash = this.hashPassword(password, salt);

        updates.push('password_hash = ?');
        updates.push('salt = ?');
        values.push(passwordHash, salt);
      }

      if (hasUpdatedAt) {
        updates.push("updated_at = datetime('now')");
      }

      if (updates.length > 0) {
        values.push(email); // WHERE clause

        const stmt = this.db.prepare(`
          UPDATE users
             SET ${updates.join(', ')}
           WHERE email = ?
        `);
        stmt.run(...values);
      }

      // Return updated user
      const updatedUser = this.findUserByEmail(email);
      return {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role || 'creator',
      };
    } else {
      // Insert new user
      const id = randomUUID();
      const defaultRole = role || 'creator';
      const defaultStatus = status || 'active';

      // Handle password if provided
      let passwordHash: string | null = null;
      let salt: string | null = null;

      if (password !== undefined) {
        salt = randomBytes(16).toString('hex'); // 32 chars
        passwordHash = this.hashPassword(password, salt);
      }

      if (hasUpdatedAt) {
        const stmt = this.db.prepare(`
          INSERT INTO users (id, email, role, status, siteId, password_hash, salt, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        stmt.run(id, email, defaultRole, defaultStatus, siteId || null, passwordHash, salt);
      } else {
        const stmt = this.db.prepare(`
          INSERT INTO users (id, email, role, status, siteId, password_hash, salt, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);
        stmt.run(id, email, defaultRole, defaultStatus, siteId || null, passwordHash, salt);
      }

      // Return inserted user
      return {
        id,
        email,
        role: defaultRole,
      };
    }
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
