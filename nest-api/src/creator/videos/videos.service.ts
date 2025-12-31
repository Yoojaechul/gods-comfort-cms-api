import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CreatorVideosService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * 영상 삭제 (id 기반)
   */
  deleteById(id: string) {
    const dbInstance = this.db.getDb();
    const stmt = dbInstance.prepare(`DELETE FROM videos WHERE id = ?`);
    const result = stmt.run(id);

    if (!result.changes) {
      throw new NotFoundException('Video not found');
    }

    return { deleted: result.changes };
  }

  /**
   * 영상 삭제 (management_id 기반)
   */
  deleteByManagementId(managementId: string) {
    const dbInstance = this.db.getDb();
    const stmt = dbInstance.prepare(`DELETE FROM videos WHERE management_id = ?`);
    const result = stmt.run(managementId);

    if (!result.changes) {
      throw new NotFoundException('Video not found');
    }

    return { deleted: result.changes };
  }
}
