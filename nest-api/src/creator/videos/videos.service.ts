import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CreatorVideosService {
  constructor(private readonly db: DatabaseService) {}

  deleteById(id: string) {
    const db = this.db.getDb();
    const stmt = db.prepare(`DELETE FROM videos WHERE id = ?`);
    const result = stmt.run(id);

    if (!result.changes) {
      throw new NotFoundException('Video not found');
    }

    return { deleted: result.changes };
  }
}
