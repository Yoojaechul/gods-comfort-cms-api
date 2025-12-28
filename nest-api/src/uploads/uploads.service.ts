// nest-api/src/uploads/uploads.service.ts
import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class UploadsService {
  /**
   * 썸네일 파일을 저장하고, CMS에서 바로 사용할 수 있는 상대경로 thumbnailUrl을 반환합니다.
   *
   * ✅ Cloud Run 권장:
   * - 저장 경로: /tmp/uploads/thumbnails (쓰기 가능)
   * - 반환 URL:  /uploads/thumbnails/<filename> (정적서빙은 main.ts에서 /uploads -> /tmp/uploads 연결)
   */
  async saveThumbnail(file: Express.Multer.File) {
    // 1) 저장 디렉토리 생성 (Cloud Run 쓰기 가능 경로)
    const uploadsDir = path.join("/tmp", "uploads", "thumbnails");
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    // 2) 확장자/파일명 생성
    const original = file?.originalname || "thumbnail.png";
    const extRaw = path.extname(original).toLowerCase();
    const allowedExts = new Set([".png", ".jpg", ".jpeg", ".webp"]);
    const ext = allowedExts.has(extRaw) ? extRaw : ".png";

    const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // 3) 파일 저장
    if (!file?.buffer || file.buffer.length === 0) {
      throw new Error("Empty file buffer");
    }
    await fs.promises.writeFile(filePath, file.buffer);

    // 4) 반환 URL은 절대 URL이 아닌 상대경로로 (Mixed Content 방지)
    const thumbnailUrl = `/uploads/thumbnails/${filename}`;

    // 5) 로그 (Cloud Run 로그에서 저장/경로 확인용)
    console.log("[saveThumbnail] originalname =", original);
    console.log("[saveThumbnail] uploadsDir    =", uploadsDir);
    console.log("[saveThumbnail] filePath      =", filePath);
    console.log("[saveThumbnail] thumbnailUrl  =", thumbnailUrl);

    return {
      thumbnailUrl,
      filename,
      video_id: null,
    };
  }
}
