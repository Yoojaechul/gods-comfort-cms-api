import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * Facebook Key 서비스
 * Creator의 Facebook API 키를 관리합니다.
 */
@Injectable()
export class FacebookKeyService {
  private readonly logger = new Logger(FacebookKeyService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * 현재 사용자의 Facebook Key 조회
   */
  async getCurrentUserKey(userId: string, userRole: string): Promise<any> {
    this.logger.debug(`Facebook Key 조회 - User ID: ${userId}, Role: ${userRole}`);

    try {
      const db = this.databaseService.getDb();

      // facebook_keys 테이블 존재 확인 및 생성
      this.ensureTableExists(db);

      // 사용자 조회
      const user = this.databaseService.findUserById(userId);
      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // Creator는 자신의 키만 조회 가능
      if (userRole === 'creator') {
        const key = db
          .prepare('SELECT * FROM facebook_keys WHERE creator_id = ?')
          .get(userId) as any;

        return {
          key: key?.api_key || null,
          creatorId: userId,
          creatorUsername: 'creator',
        };
      }

      // Admin은 자신의 키 조회 (없으면 null)
      const key = db
        .prepare('SELECT * FROM facebook_keys WHERE creator_id = ?')
        .get(userId) as any;

      return {
        key: key?.api_key || null,
        creatorId: userId,
      };
    } catch (error) {
      this.logger.error(`Facebook Key 조회 오류:`, error);
      throw error;
    }
  }

  /**
   * 현재 사용자의 Facebook Key 저장/업데이트
   */
  async saveCurrentUserKey(
    userId: string,
    userRole: string,
    apiKey: string,
  ): Promise<any> {
    this.logger.debug(
      `Facebook Key 저장 - User ID: ${userId}, Role: ${userRole}`,
    );

    try {
      const db = this.databaseService.getDb();

      // facebook_keys 테이블 존재 확인 및 생성
      this.ensureTableExists(db);

      // 사용자 조회
      const user = this.databaseService.findUserById(userId);
      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // Creator만 자신의 키를 저장할 수 있음
      if (userRole !== 'creator' && userRole !== 'admin') {
        throw new ForbiddenException('Creator만 Facebook Key를 저장할 수 있습니다.');
      }

      // 기존 키 확인
      const existing = db
        .prepare('SELECT * FROM facebook_keys WHERE creator_id = ?')
        .get(userId) as any;

      if (existing) {
        // 업데이트
        db.prepare(
          'UPDATE facebook_keys SET api_key = ?, updated_at = datetime("now") WHERE creator_id = ?',
        ).run(apiKey, userId);
        this.logger.log(`✅ Facebook Key 업데이트 완료 - User ID: ${userId}`);
      } else {
        // 새로 생성
        const keyId = this.generateId();
        db.prepare(
          'INSERT INTO facebook_keys (id, creator_id, api_key, created_at, updated_at) VALUES (?, ?, ?, datetime("now"), datetime("now"))',
        ).run(keyId, userId, apiKey);
        this.logger.log(`✅ Facebook Key 생성 완료 - User ID: ${userId}`);
      }

      return {
        key: apiKey,
        creatorId: userId,
      };
    } catch (error) {
      this.logger.error(`Facebook Key 저장 오류:`, error);
      throw error;
    }
  }

  /**
   * 모든 Creator의 Facebook Key 조회 (Admin만)
   */
  async getAllKeys(userRole: string): Promise<any[]> {
    this.logger.debug(`모든 Facebook Key 조회 - Role: ${userRole}`);

    if (userRole !== 'admin') {
      throw new ForbiddenException('관리자만 모든 키를 조회할 수 있습니다.');
    }

    try {
      const db = this.databaseService.getDb();

      // facebook_keys 테이블 존재 확인 및 생성
      this.ensureTableExists(db);

      const keys = db
        .prepare('SELECT * FROM facebook_keys ORDER BY created_at DESC')
        .all() as any[];

      return keys.map((key) => ({
        creatorId: key.creator_id,
        key: key.api_key,
        createdAt: key.created_at,
        updatedAt: key.updated_at,
      }));
    } catch (error) {
      this.logger.error(`모든 Facebook Key 조회 오류:`, error);
      throw error;
    }
  }

  /**
   * 특정 Creator의 Facebook Key 설정 (Admin만)
   */
  async setKeyForCreator(
    adminUserId: string,
    creatorId: string,
    apiKey: string,
  ): Promise<any> {
    this.logger.debug(
      `Creator Facebook Key 설정 - Admin ID: ${adminUserId}, Creator ID: ${creatorId}`,
    );

    try {
      const db = this.databaseService.getDb();

      // facebook_keys 테이블 존재 확인 및 생성
      this.ensureTableExists(db);

      // Creator 존재 확인
      const creator = this.databaseService.findUserById(creatorId);
      if (!creator) {
        throw new NotFoundException('Creator를 찾을 수 없습니다.');
      }

      if (creator.role !== 'creator') {
        throw new ForbiddenException('지정된 사용자는 Creator가 아닙니다.');
      }

      // 기존 키 확인
      const existing = db
        .prepare('SELECT * FROM facebook_keys WHERE creator_id = ?')
        .get(creatorId) as any;

      if (existing) {
        // 업데이트
        db.prepare(
          'UPDATE facebook_keys SET api_key = ?, updated_at = datetime("now") WHERE creator_id = ?',
        ).run(apiKey, creatorId);
        this.logger.log(`✅ Creator Facebook Key 업데이트 완료 - Creator ID: ${creatorId}`);
      } else {
        // 새로 생성
        const keyId = this.generateId();
        db.prepare(
          'INSERT INTO facebook_keys (id, creator_id, api_key, created_at, updated_at) VALUES (?, ?, ?, datetime("now"), datetime("now"))',
        ).run(keyId, creatorId, apiKey);
        this.logger.log(`✅ Creator Facebook Key 생성 완료 - Creator ID: ${creatorId}`);
      }

      return {
        key: apiKey,
        creatorId: creatorId,
      };
    } catch (error) {
      this.logger.error(`Creator Facebook Key 설정 오류:`, error);
      throw error;
    }
  }

  /**
   * ID 생성 (간단한 랜덤 문자열)
   */
  private generateId(): string {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * facebook_keys 테이블이 존재하는지 확인하고 없으면 생성
   */
  private ensureTableExists(db: any): void {
    try {
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='facebook_keys'",
        )
        .get();

      if (!tableExists) {
        this.logger.log('facebook_keys 테이블이 없습니다. 생성 중...');
        db.exec(`
          CREATE TABLE IF NOT EXISTS facebook_keys (
            id TEXT PRIMARY KEY,
            creator_id TEXT NOT NULL UNIQUE,
            api_key TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
        this.logger.log('✅ facebook_keys 테이블 생성 완료');
      }
    } catch (error) {
      this.logger.error('facebook_keys 테이블 생성 오류:', error);
      throw error;
    }
  }
}

