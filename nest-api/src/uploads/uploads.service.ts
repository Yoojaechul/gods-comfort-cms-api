// nest-api/src/uploads/uploads.service.ts
import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class UploadsService {
  /**
   * 썸네일 파일을 저장하고, CMS에서 바로 사용할 수 있는 상대경로 thumbnailUrl을 반환합니다.
   *
   * ✅ 저장 경로: /tmp/uploads/thumbnails
   * ✅ 반환 URL:  /uploads/thumbnails/<filename>
   * ✅ 정적 서빙: main.ts에서 /uploads -> /tmp/uploads 연결
   *
   * @param file - 업로드된 파일 (Express.Multer.File)
   * @returns { thumbnailUrl: string } - 상대경로 썸네일 URL
   * @throws {Error} 파일 버퍼가 비어있거나 저장 실패 시
   */
  async saveThumbnail(
    file: Express.Multer.File,
  ): Promise<{ thumbnailUrl: string }> {
    // 1) 저장 디렉토리 생성 (/tmp/uploads/thumbnails)
    const uploadsDir = path.join("/tmp", "uploads", "thumbnails");
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    // 2) 확장자/파일명 생성
    const original = file?.originalname || "thumbnail.png";
    const extRaw = path.extname(original).toLowerCase();
    const allowedExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
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

    // 반환: 상대경로 thumbnailUrl만 반환 (프론트엔드에서 바로 사용 가능)
    return {
      thumbnailUrl,
    };
  }

  /**
   * 썸네일 파일 삭제
   * 입력값: /uploads/thumbnails/...png 같은 URL/상대경로/파일명
   * 내부 저장 경로(/tmp/uploads/thumbnails/)로 변환 후 파일이 존재하면 삭제, 없으면 조용히 통과
   * @param thumbnailPathOrUrl - 삭제할 썸네일 경로 또는 URL
   * @returns { success: boolean } - 삭제 성공 여부
   */
  async deleteThumbnail(thumbnailPathOrUrl: string | null): Promise<{ success: boolean }> {
    if (!thumbnailPathOrUrl || typeof thumbnailPathOrUrl !== 'string') {
      return { success: false };
    }

    try {
      // GCS URL인 경우 (https://storage.googleapis.com/... 또는 gs://...)
      if (thumbnailPathOrUrl.startsWith('https://storage.googleapis.com/') || thumbnailPathOrUrl.startsWith('gs://')) {
        // GCS 삭제 로직은 나중에 구현 가능
        // 현재는 로컬 파일 삭제만 처리
        console.log(`[deleteThumbnail] GCS URL 삭제는 현재 지원하지 않습니다: ${thumbnailPathOrUrl}`);
        return { success: false };
      }

      // 로컬 파일 경로 변환
      // /uploads/thumbnails/filename.png -> /tmp/uploads/thumbnails/filename.png
      // filename.png -> /tmp/uploads/thumbnails/filename.png
      let filename: string;
      if (thumbnailPathOrUrl.startsWith('/uploads/thumbnails/')) {
        // 상대경로나 URL 형식인 경우
        filename = path.basename(thumbnailPathOrUrl);
      } else if (thumbnailPathOrUrl.includes('/')) {
        // 다른 경로 형식은 지원하지 않음 (안전)
        console.log(`[deleteThumbnail] 지원하지 않는 경로 형식: ${thumbnailPathOrUrl}`);
        return { success: false };
      } else {
        // 파일명만 있는 경우
        filename = thumbnailPathOrUrl;
      }

      // 내부 저장 경로로 변환 (saveThumbnail과 동일한 경로 규칙 사용)
      const filePath = path.join('/tmp', 'uploads', 'thumbnails', filename);
      
      // 파일 존재 여부 확인 후 삭제 (없으면 조용히 통과)
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`[deleteThumbnail] 로컬 파일 삭제 성공: ${filePath}`);
        return { success: true };
      } else {
        // 파일이 없어도 에러를 throw하지 않고 조용히 통과
        return { success: false };
      }
    } catch (error: any) {
      // 삭제 실패해도 에러를 throw하지 않음 (안전)
      console.warn(`[deleteThumbnail] 파일 삭제 실패: ${error.message}`);
      return { success: false };
    }
  }
}



