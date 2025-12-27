import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';


@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * management_id가 NULL 또는 ''인 videos 행에 대해 management_id 재생성
   * 형식: YYMMDD-001, YYMMDD-002 ...
   * 날짜 기준으로 하루 단위 증가
   * 이미 존재하는 management_id는 절대 덮어쓰지 않음
   */
  async regenerateManagementIds(): Promise<{ ok: boolean; updated: number }> {
    const db = this.databaseService.getDb();

    try {
      // management_id가 NULL 또는 ''인 videos 조회
      const videosWithoutManagementId = db
        .prepare(
          `SELECT id, created_at FROM videos 
           WHERE management_id IS NULL OR management_id = '' 
           ORDER BY created_at ASC`
        )
        .all() as Array<{ id: string; created_at: string }>;

      if (videosWithoutManagementId.length === 0) {
        this.logger.log('[regenerateManagementIds] No videos to update');
        return { ok: true, updated: 0 };
      }

      this.logger.log(
        `[regenerateManagementIds] Found ${videosWithoutManagementId.length} videos without management_id`
      );

      let updatedCount = 0;

      // 날짜별 카운터 맵 (날짜 prefix -> 다음 번호)
      const dateCounters = new Map<string, number>();

      // 트랜잭션으로 안전하게 처리
      const transaction = db.transaction(() => {
        for (const video of videosWithoutManagementId) {
          // 영상의 created_at을 기준으로 날짜 결정 (Asia/Seoul 시간대)
          const createdAt = new Date(video.created_at);
          const seoulTime = new Date(
            createdAt.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
          );
          const year = seoulTime.getFullYear().toString().slice(-2); // YY
          const month = String(seoulTime.getMonth() + 1).padStart(2, '0'); // MM
          const day = String(seoulTime.getDate()).padStart(2, '0'); // DD
          const datePrefix = `${year}${month}${day}`;

          // 날짜별 카운터 초기화 (처음 조회 시)
          if (!dateCounters.has(datePrefix)) {
            // 해당 날짜로 시작하는 management_id 중 최대값 조회
            const prefix = `${datePrefix}-`;
            const maxRow = db
              .prepare(
                `SELECT management_id 
                 FROM videos 
                 WHERE management_id LIKE ? AND management_id IS NOT NULL AND management_id != ''
                 ORDER BY management_id DESC 
                 LIMIT 1`
              )
              .get(`${prefix}%`) as { management_id: string } | undefined;

            let startNumber = 1;

            if (maxRow?.management_id) {
              // 기존 최대값에서 번호 추출 (예: "251227-005" -> 5)
              const match = maxRow.management_id.match(/^(\d{6})-(\d+)$/);
              if (match && match[2]) {
                const currentNumber = parseInt(match[2], 10);
                startNumber = currentNumber + 1;
              }
            }

            dateCounters.set(datePrefix, startNumber);
          }

          // 다음 번호 가져오기 및 증가
          const nextNumber = dateCounters.get(datePrefix)!;
          dateCounters.set(datePrefix, nextNumber + 1);

          // 새 management_id 생성 (001, 002, ...)
          const managementId = `${datePrefix}-${String(nextNumber).padStart(3, '0')}`;

          // 중복 확인 (안전장치)
          const existing = db
            .prepare('SELECT id FROM videos WHERE management_id = ?')
            .get(managementId) as { id: string } | undefined;

          if (existing) {
            this.logger.warn(
              `[regenerateManagementIds] Management ID ${managementId} already exists, skipping video ${video.id}`
            );
            // 카운터를 다시 증가시켜서 다음 번호로 시도
            const currentCounter = dateCounters.get(datePrefix)!;
            dateCounters.set(datePrefix, currentCounter + 1);
            continue;
          }

          // management_id 업데이트
          const result = db
            .prepare('UPDATE videos SET management_id = ? WHERE id = ?')
            .run(managementId, video.id);

          if (result.changes > 0) {
            updatedCount++;
            this.logger.debug(
              `[regenerateManagementIds] Updated video ${video.id} with management_id ${managementId}`
            );
          }
        }
      });

      // 트랜잭션 실행
      transaction();

      this.logger.log(
        `[regenerateManagementIds] Successfully updated ${updatedCount} videos`
      );

      return { ok: true, updated: updatedCount };
    } catch (error: any) {
      this.logger.error(
        `[regenerateManagementIds] Error: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}

