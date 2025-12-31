// nest-api/src/uploads/uploads.service.ts
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Storage } from "@google-cloud/storage";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class UploadsService {
  private readonly gcsBucket: string | null;
  private readonly storage: Storage | null;
  private readonly bucket: any;

  constructor(private readonly configService: ConfigService) {
    // GCS_BUCKET 환경변수 확인
    this.gcsBucket = this.configService.get<string>("GCS_BUCKET") || null;

    if (this.gcsBucket) {
      // GCS 사용 가능한 경우 Storage 클라이언트 초기화
      this.storage = new Storage();
      this.bucket = this.storage.bucket(this.gcsBucket);
      console.log(`[UploadsService] GCS 모드 활성화: bucket=${this.gcsBucket}`);
    } else {
      // 로컬 /tmp 모드
      this.storage = null;
      this.bucket = null;
      console.log(`[UploadsService] 로컬 /tmp 모드 사용 (GCS_BUCKET 미설정)`);
    }
  }

  /**
   * 썸네일 파일을 저장하고, CMS에서 바로 사용할 수 있는 URL을 반환합니다.
   *
   * GCS 모드 (GCS_BUCKET 설정 시):
   * - 저장 경로: Google Cloud Storage
   * - 반환 URL: https://storage.googleapis.com/${bucket}/${objectName}
   *
   * 로컬 모드 (GCS_BUCKET 미설정):
   * - 저장 경로: /tmp/uploads/thumbnails
   * - 반환 URL: /uploads/thumbnails/<filename>
   * - 정적 서빙: main.ts에서 /uploads -> /tmp/uploads 연결
   *
   * @param file - 업로드된 파일 (Express.Multer.File)
   * @returns { thumbnailUrl: string; url: string } - 썸네일 URL (두 필드는 동일한 값)
   * @throws {Error} 파일 버퍼가 비어있거나 저장 실패 시
   */
  async saveThumbnail(
    file: Express.Multer.File,
  ): Promise<{ thumbnailUrl: string; url: string }> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new Error("Empty file buffer");
    }

    // 확장자/파일명 생성
    const original = file?.originalname || "thumbnail.png";
    const extRaw = path.extname(original).toLowerCase();
    const allowedExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
    const ext = allowedExts.has(extRaw) ? extRaw : ".png";
    const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;

    // Content-Type 결정
    const contentTypeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };
    const contentType = contentTypeMap[ext] || "image/png";

    if (this.gcsBucket && this.bucket) {
      // GCS 모드
      try {
        const objectName = `thumbnails/${filename}`;
        const gcsFile = this.bucket.file(objectName);

        // 파일 업로드 (버퍼 사용)
        await gcsFile.save(file.buffer, {
          metadata: {
            contentType: contentType,
            cacheControl: "public, max-age=31536000",
          },
        });

        // 공개 읽기 권한 설정
        await gcsFile.makePublic();

        const thumbnailUrl = `https://storage.googleapis.com/${this.gcsBucket}/${objectName}`;

        console.log(`[saveThumbnail] GCS 업로드 성공: ${objectName}`);
        console.log(`[saveThumbnail] URL: ${thumbnailUrl}`);

        return { thumbnailUrl, url: thumbnailUrl };
      } catch (error: any) {
        console.error(`[saveThumbnail] GCS 업로드 실패:`, error);
        throw new Error(`Failed to upload thumbnail to GCS: ${error.message}`);
      }
    } else {
      // 로컬 /tmp 모드 (기존 동작)
      const uploadsDir = path.join("/tmp", "uploads", "thumbnails");
      await fs.promises.mkdir(uploadsDir, { recursive: true });

      const filePath = path.join(uploadsDir, filename);
      await fs.promises.writeFile(filePath, file.buffer);

      const thumbnailUrl = `/uploads/thumbnails/${filename}`;

      console.log(`[saveThumbnail] 로컬 파일 저장: ${filePath}`);
      console.log(`[saveThumbnail] URL: ${thumbnailUrl}`);

      return { thumbnailUrl, url: thumbnailUrl };
    }
  }

  /**
   * 썸네일 파일 삭제
   *
   * GCS 모드: GCS URL인 경우 객체 삭제
   * 로컬 모드: /tmp/uploads/thumbnails/ 파일 삭제
   *
   * @param thumbnailPathOrUrl - 삭제할 썸네일 경로 또는 URL
   * @returns { success: boolean } - 삭제 성공 여부
   */
  async deleteThumbnail(
    thumbnailPathOrUrl: string | null,
  ): Promise<{ success: boolean }> {
    if (!thumbnailPathOrUrl || typeof thumbnailPathOrUrl !== "string") {
      return { success: false };
    }

    try {
      // GCS URL인 경우
      if (
        this.gcsBucket &&
        thumbnailPathOrUrl.startsWith(
          `https://storage.googleapis.com/${this.gcsBucket}/`,
        )
      ) {
        // GCS 객체 경로 추출
        const objectName = thumbnailPathOrUrl.replace(
          `https://storage.googleapis.com/${this.gcsBucket}/`,
          "",
        );

        if (!objectName || !this.bucket) {
          console.warn(
            `[deleteThumbnail] 잘못된 GCS URL 형식: ${thumbnailPathOrUrl}`,
          );
          return { success: false };
        }

        try {
          const file = this.bucket.file(objectName);
          await file.delete();
          console.log(`[deleteThumbnail] GCS 객체 삭제 성공: ${objectName}`);
          return { success: true };
        } catch (error: any) {
          // 404 (파일 없음)는 조용히 통과
          if (error.code === 404) {
            console.log(
              `[deleteThumbnail] GCS 객체가 이미 존재하지 않음: ${objectName}`,
            );
            return { success: false };
          }
          console.warn(
            `[deleteThumbnail] GCS 객체 삭제 실패: ${error.message}`,
          );
          return { success: false };
        }
      } else if (
        thumbnailPathOrUrl.startsWith("gs://") ||
        thumbnailPathOrUrl.startsWith("https://storage.googleapis.com/")
      ) {
        // 다른 GCS 버킷 URL이거나 GCS_BUCKET이 설정되지 않은 경우
        console.log(
          `[deleteThumbnail] GCS URL이지만 현재 버킷과 일치하지 않음: ${thumbnailPathOrUrl}`,
        );
        return { success: false };
      }

      // 로컬 파일 경로 변환 (기존 동작)
      let filename: string;
      if (thumbnailPathOrUrl.startsWith("/uploads/thumbnails/")) {
        filename = path.basename(thumbnailPathOrUrl);
      } else if (thumbnailPathOrUrl.includes("/")) {
        console.log(
          `[deleteThumbnail] 지원하지 않는 경로 형식: ${thumbnailPathOrUrl}`,
        );
        return { success: false };
      } else {
        filename = thumbnailPathOrUrl;
      }

      const filePath = path.join("/tmp", "uploads", "thumbnails", filename);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`[deleteThumbnail] 로컬 파일 삭제 성공: ${filePath}`);
        return { success: true };
      } else {
        // 파일이 없어도 조용히 통과
        return { success: false };
      }
    } catch (error: any) {
      console.warn(
        `[deleteThumbnail] 파일 삭제 실패: ${error.message}`,
      );
      return { success: false };
    }
  }
}
