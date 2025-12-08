import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import * as path from 'path';

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
    // 환경변수에서 DB 경로 가져오기 (없으면 기본값)
    const dbPath =
      this.configService.get<string>('SQLITE_DB_PATH') ||
      path.join(__dirname, '../../..', 'cms.db');

    this.logger.log(`📂 Opening SQLite database: ${dbPath}`);

    try {
      // better-sqlite3로 DB 열기
      this.db = new Database(dbPath);

      // WAL 모드 활성화 (성능 향상)
      this.db.pragma('journal_mode = WAL');

      this.logger.log('✅ SQLite database connected successfully');

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
      .get(email) as any;   // 👈 여기 캐스팅 추가

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
   */
  updateUserPassword(
    userId: string,
    passwordHash: string,
    salt: string,
  ): void {
    try {
      this.logger.debug(`비밀번호 업데이트 시작 - User ID: ${userId}`);
      
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
    } catch (error) {
      this.logger.error(`❌ 비밀번호 업데이트 DB 에러:`, error.message);
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
}

