// nest-api/src/uploads/uploads.service.ts
import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  /**
   * 썸네일 파일을 로컬 파일 시스템에 저장하고, 상대경로 URL을 반환합니다.
   *
   * ✅ 저장 경로: process.cwd()/uploads/thumbnails
   * ✅ 반환 URL:  /uploads/thumbnails/<filename>
   * ✅ 정적 서빙: main.ts에서 /uploads/thumbnails -> process.cwd()/uploads/thumbnails 매핑
   *
   * @param file - 업로드된 파일 (Express.Multer.File)
   * @returns { thumbnailUrl: string } - 상대경로 썸네일 URL
   * @throws {Error} 파일 버퍼가 비어있거나 저장 실패 시
   */
  async saveThumbnail(
    file: Express.Multer.File,
  ): Promise<{ thumbnailUrl: string }> {
    // 1) 파일 버퍼 검증
    if (!file?.buffer || file.buffer.length === 0) {
      throw new Error("Empty file buffer");
    }

    // 2) 저장 디렉토리 경로 (process.cwd()/uploads/thumbnails)
    const uploadsDir = path.join(process.cwd(), "uploads", "thumbnails");

    // 3) 디렉토리가 없으면 재귀 생성 (mkdirp)
    try {
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      this.logger.log(`[saveThumbnail] 📁 Directory ensured: ${uploadsDir}`);
    } catch (error: any) {
      this.logger.error(
        `[saveThumbnail] ❌ Failed to create directory: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to create upload directory: ${error.message}`);
    }

    // 4) 확장자/파일명 생성
    const original = file?.originalname || "thumbnail.png";
    const extRaw = path.extname(original).toLowerCase();
    const allowedExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
    const ext = allowedExts.has(extRaw) ? extRaw : ".png";

    // 타임스탬프 + 랜덤 문자열로 파일명 생성
    const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // 5) 파일 저장
    try {
      await fs.promises.writeFile(filePath, file.buffer);
      this.logger.log(
        `[saveThumbnail] ✅ File saved: ${filePath} (size: ${file.buffer.length} bytes)`,
      );
    } catch (error: any) {
      this.logger.error(
        `[saveThumbnail] ❌ Failed to save file: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to save thumbnail file: ${error.message}`);
    }

    // 6) 저장된 파일 존재 여부 확인
    try {
      const stats = await fs.promises.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Saved path is not a file: ${filePath}`);
      }
      this.logger.log(
        `[saveThumbnail] ✅ File verified: ${filePath} (size: ${stats.size} bytes)`,
      );
    } catch (error: any) {
      this.logger.error(
        `[saveThumbnail] ❌ File verification failed: ${error.message}`,
        error.stack,
      );
      throw new Error(`File was not saved properly: ${error.message}`);
    }

    // 7) 반환 URL 생성 (상대경로로 반환 - 정적 서빙 경로와 일치)
    // 저장 경로: process.cwd()/uploads/thumbnails/<filename>
    // 반환 URL:  /uploads/thumbnails/<filename>
    // 정적 서빙: /uploads/thumbnails -> process.cwd()/uploads/thumbnails
    const thumbnailUrl = `/uploads/thumbnails/${filename}`;

    // 8) 로그
    this.logger.log("[saveThumbnail] 📋 Summary:");
    this.logger.log("  - originalname:", original);
    this.logger.log("  - uploadsDir   :", uploadsDir);
    this.logger.log("  - filePath     :", filePath);
    this.logger.log("  - thumbnailUrl :", thumbnailUrl);

    return {
      thumbnailUrl,
    };
  }
}


