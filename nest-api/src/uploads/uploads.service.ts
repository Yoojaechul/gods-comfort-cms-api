import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { randomBytes } from 'crypto';

@Injectable()
export class UploadsService {
  /**
   * 썸네일 파일 저장
   * @param file - 업로드된 파일
   * @returns 저장된 파일의 URL과 파일명
   */
  async saveThumbnail(
    file: Express.Multer.File,
  ): Promise<{ url: string; filename: string; video_id?: string | null }> {
    // 업로드 디렉토리 경로 (프로젝트 루트 기준)
    const uploadsDir = path.join(process.cwd(), 'uploads', 'thumbnails');

    // 디렉토리가 없으면 생성
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`[UploadsService] 업로드 디렉토리 생성: ${uploadsDir}`);
    }

    // 고유한 파일명 생성 (타임스탬프 + 랜덤 문자열)
    const timestamp = Date.now();
    const randomStr = randomBytes(5).toString('hex');
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const filename = `${timestamp}_${randomStr}${fileExtension}`;
    const filepath = path.join(uploadsDir, filename);

    // 파일 저장
    fs.writeFileSync(filepath, file.buffer);
    console.log(`[UploadsService] 파일 저장 완료: ${filename}`);

    // URL 생성 (프론트엔드에서 접근 가능한 경로)
    // NestJS 서버 포트는 8788이지만, 프론트엔드가 8787을 사용하므로 8787로 반환
    // 또는 상대 경로로 반환하여 프론트엔드가 자동으로 처리하도록 함
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:8788';
    // Fastify 서버(8787)에서도 같은 경로로 서빙되므로 절대 URL 반환
    const thumbnailUrl = `${baseUrl}/uploads/thumbnails/${filename}`;

    return {
      url: thumbnailUrl,
      filename: filename,
      video_id: null, // video_id는 추후 확장 가능
    };
  }
}




















