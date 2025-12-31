import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  VideoMetadataRequestDto,
  VideoMetadataResponseDto,
} from './dto/video-metadata.dto';
import { randomBytes } from 'crypto';
import { normalizeVideoResponse, normalizeVideoListResponse, validateVideoResponse } from './video-response.serializer';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * ID 생성 (hex 문자열, 32자리)
   */
  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * 영상 메타데이터 조회
   * YouTube: videoId 추출 및 메타데이터 반환
   * Facebook: 기본값 반환
   */
  async getVideoMetadata(
    dto: VideoMetadataRequestDto,
  ): Promise<VideoMetadataResponseDto> {
    if (dto.sourceType === 'YouTube') {
      return this.getYouTubeMetadata(dto.sourceUrl);
    } else if (dto.sourceType === 'Facebook') {
      return {
        title: null,
        thumbnailUrl: null,
        videoId: null,
      };
    }

    // 기본값 반환
    return {
      title: null,
      thumbnailUrl: null,
      videoId: null,
    };
  }

  /**
   * YouTube 메타데이터 조회 (Public API용)
   * @param urlOrId YouTube URL 또는 Video ID
   * @returns 제목과 썸네일 URL
   */
  async getPublicYouTubeMetadata(
    urlOrId: string,
  ): Promise<{ title: string | null }> {
    try {
      const metadata = await this.getYouTubeMetadata(urlOrId);
      return {
        title: metadata.title,
      };
    } catch (error: any) {
      this.logger.warn(`YouTube metadata fetch failed: ${error.message}`);
      return { title: null };
    }
  }

  /**
   * YouTube 메타데이터 조회
   */
  private async getYouTubeMetadata(
    sourceUrl: string,
  ): Promise<VideoMetadataResponseDto> {
    // YouTube videoId 추출
    const videoId = this.extractYouTubeVideoId(sourceUrl);

    if (!videoId) {
      return {
        title: null,
        thumbnailUrl: null,
        videoId: null,
      };
    }

    // 썸네일 URL 생성 (최소한 maxresdefault.jpg 사용)
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    // YouTube oEmbed로 title 가져오기 시도
    let title: string | null = null;
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
        sourceUrl,
      )}&format=json`;
      
      // AbortController를 사용하여 5초 타임아웃 구현
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(oembedUrl, { signal: controller.signal });
        
        if (response.ok) {
          const data = await response.json();
          title = data.title || null;
        }
      } catch (fetchErr: any) {
        // AbortError는 타임아웃, 다른 에러는 그대로 전달
        if (fetchErr.name === 'AbortError') {
          console.warn('YouTube oEmbed fetch timeout after 5 seconds');
        } else {
          throw fetchErr;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      console.warn('YouTube oEmbed fetch failed:', err.message);
    }

    return {
      title,
      thumbnailUrl,
      videoId,
    };
  }

  /**
   * YouTube URL에서 videoId 추출
   */
  private extractYouTubeVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\s?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * 공개 영상 목록 조회 (기존 메서드가 없는 경우를 대비)
   */
  async getPublicVideos(options: {
    language?: string;
    platform?: string;
    site_id?: string;
    limit: number;
  }): Promise<any[]> {
    const db = this.databaseService.getDb();
    
    // 컬럼 존재 여부 확인
    const cols = db.prepare(`PRAGMA table_info(videos)`).all() as Array<{ name: string }>;
    const columnNames = cols.map((c) => c.name);
    const hasSiteId = columnNames.includes('site_id');
    const hasStatus = columnNames.includes('status');
    const hasPublished = columnNames.includes('published');
    
    let query = "SELECT * FROM videos WHERE visibility = 'public'";
    const params: any[] = [];

    // status 필터: active인 영상만 표시 (status 컬럼이 있는 경우)
    if (hasStatus) {
      query += " AND (status = 'active' OR status IS NULL)";
    }

    // published 필터: published가 true인 영상만 표시 (published 컬럼이 있는 경우)
    if (hasPublished) {
      query += ' AND (published = 1 OR published IS NULL)';
    }

    // site_id 필터
    if (options.site_id && hasSiteId) {
      query += ' AND site_id = ?';
      params.push(options.site_id);
    }

    // language 필터
    if (options.language) {
      query += ' AND language = ?';
      params.push(options.language);
    }

    // platform 필터
    if (options.platform) {
      query += ' AND platform = ?';
      params.push(options.platform);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(options.limit);

    const rawVideos = db.prepare(query).all(...params) || [];
    
    // Normalize video responses with backward-compatible fields
    return normalizeVideoListResponse(rawVideos);
  }

  /**
   * 공개 영상 상세 조회 (기존 메서드가 없는 경우를 대비)
   */
  async getPublicVideoById(id: string): Promise<any | null> {
    const db = this.databaseService.getDb();
    const rawVideo = db
      .prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'")
      .get(id) as any;
    
    if (!rawVideo) {
      return null;
    }

    // Normalize video response with backward-compatible fields
    return normalizeVideoResponse(rawVideo);
  }

  /**
   * Creator 영상 단건 조회 (id 또는 management_id로 조회)
   * creatorId와 site_id를 기반으로 자신의 영상만 반환
   */
  async getCreatorVideoById(
    creatorId: string,
    siteId: string | null,
    idOrManagementId: string,
  ): Promise<any> {
    const db = this.databaseService.getDb();
    
    try {
      // 컬럼 존재 여부 확인
      const cols = db.prepare(`PRAGMA table_info(videos)`).all() as Array<{ name: string }>;
      const columnNames = cols.map((c) => c.name);
      
      const hasCreatorId = columnNames.includes('creator_id');
      const hasOwnerId = columnNames.includes('owner_id');
      const hasCreatedBy = columnNames.includes('created_by');
      const hasSiteId = columnNames.includes('site_id');
      
      // creator_id, owner_id 또는 created_by 컬럼 중 하나는 반드시 있어야 함
      if (!hasCreatorId && !hasOwnerId && !hasCreatedBy) {
        throw new NotFoundException('Video not found');
      }
      
      // 우선순위: creator_id > owner_id > created_by
      const ownerColumn = hasCreatorId ? 'creator_id' : (hasOwnerId ? 'owner_id' : 'created_by');
      
      // management_id 형식인지 확인 (YYMMDD-NN 형식)
      const isManagementId = /^\d{6}-\d{2}$/.test(idOrManagementId);
      
      let sql: string;
      let params: any[];
      
      if (isManagementId) {
        // management_id로 조회
        if (siteId && hasSiteId) {
          sql = `SELECT * FROM videos WHERE management_id = ? AND site_id = ? AND ${ownerColumn} = ?`;
          params = [idOrManagementId, siteId, creatorId];
        } else {
          sql = `SELECT * FROM videos WHERE management_id = ? AND ${ownerColumn} = ?`;
          params = [idOrManagementId, creatorId];
        }
      } else {
        // id로 조회
        if (siteId && hasSiteId) {
          sql = `SELECT * FROM videos WHERE id = ? AND site_id = ? AND ${ownerColumn} = ?`;
          params = [idOrManagementId, siteId, creatorId];
        } else {
          sql = `SELECT * FROM videos WHERE id = ? AND ${ownerColumn} = ?`;
          params = [idOrManagementId, creatorId];
        }
      }
      
      const video = db.prepare(sql).get(...params) as any;
      
      if (!video) {
        throw new NotFoundException('Video not found');
      }
      
      // Normalize video response with backward-compatible fields
      return normalizeVideoResponse(video);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`[getCreatorVideoById] Error: ${error.message}`);
      throw new InternalServerErrorException({
        message: '영상 조회 중 오류가 발생했습니다.',
        error: 'Internal Server Error',
      });
    }
  }

  /**
   * Creator 영상 목록 조회
   * creatorId와 site_id를 기반으로 자신의 영상만 반환
   */
  async getCreatorVideos(creatorId: string, siteId: string | null): Promise<{ videos: any[] }> {
    // creatorId 유효성 검사
    if (!creatorId) {
      throw new BadRequestException('creatorId is missing');
    }

    const db = this.databaseService.getDb();
    
    try {
      // videos 테이블 스키마 확인
      const cols = db
        .prepare(`PRAGMA table_info(videos)`)
        .all() as Array<{ name: string }>;
      const columnNames = cols.map((c) => c.name);

      // 필요한 컬럼 존재 여부 확인
      const hasCreatorId = columnNames.includes('creator_id');
      const hasOwnerId = columnNames.includes('owner_id');
      const hasCreatedBy = columnNames.includes('created_by');
      const hasSiteId = columnNames.includes('site_id');
      const hasCreatedAt = columnNames.includes('created_at');

      // creator_id, owner_id 또는 created_by 컬럼 중 하나는 반드시 있어야 함
      if (!hasCreatorId && !hasOwnerId && !hasCreatedBy) {
        this.logger.warn(
          '[getCreatorVideos] videos 테이블에 creator_id, owner_id 또는 created_by 컬럼이 없습니다. 빈 배열을 반환합니다.',
        );
        return { videos: [] };
      }

      // 우선순위: creator_id > owner_id > created_by
      const ownerColumn = hasCreatorId ? 'creator_id' : (hasOwnerId ? 'owner_id' : 'created_by');

      // site_id 컬럼이 없으면 siteId 필터링 제외
      let sql: string;
      let params: any[];

      if (siteId && hasSiteId) {
        sql = `SELECT * FROM videos WHERE site_id = ? AND ${ownerColumn} = ?`;
        params = [siteId, creatorId];
      } else {
        sql = `SELECT * FROM videos WHERE ${ownerColumn} = ?`;
        params = [creatorId];
      }

      // created_at 컬럼이 있으면 정렬 추가
      if (hasCreatedAt) {
        sql += ` ORDER BY created_at DESC`;
      }

      // SQL과 바인딩 파라미터 로그
      this.logger.log(`[getCreatorVideos] SQL: ${sql}`);
      this.logger.log(
        `[getCreatorVideos] Parameters: siteId=${siteId}, creatorId=${creatorId}, using column=${ownerColumn}`,
      );

      // 쿼리 실행
      const videos = db.prepare(sql).all(...params) as any[];

      // 결과가 없거나 null이면 빈 배열 반환
      if (!videos || !Array.isArray(videos)) {
        this.logger.warn('[getCreatorVideos] 쿼리 결과가 배열이 아닙니다. 빈 배열을 반환합니다.');
        return { videos: [] };
      }

      // Normalize video responses with backward-compatible fields
      const normalizedVideos = normalizeVideoListResponse(videos);

      // Runtime validation: log warnings for missing fields (non-blocking)
      normalizedVideos.forEach((video, index) => {
        const validation = validateVideoResponse(video);
        if (!validation.valid) {
          this.logger.warn(
            `[getCreatorVideos] Video at index ${index} (id: ${video.id}) missing fields: ${validation.missingFields.join(', ')}`,
          );
        }
      });

    return {
        videos: normalizedVideos,
      };
    } catch (error) {
      // 실제 에러 객체를 console.error로 로그에 남기기
      console.error('[getCreatorVideos] 에러 발생:', error);
      
      // 에러 타입에 따라 적절한 HttpException throw
      if (error instanceof BadRequestException) {
        // 이미 BadRequestException인 경우 그대로 전파
        throw error;
      }

      // 데이터베이스 관련 에러 처리
      if (error instanceof Error) {
        const errorMessage = error.message || String(error);
        
        // SQLite 스키마 에러 (테이블 없음, 컬럼 없음 등)
        if (
          errorMessage.includes('no such table') ||
          errorMessage.includes('no such column') ||
          errorMessage.includes('SQLITE_ERROR')
        ) {
          this.logger.error(
            `[getCreatorVideos] 데이터베이스 스키마 에러: ${errorMessage}`,
          );
          throw new InternalServerErrorException({
            message: '데이터베이스 스키마 오류가 발생했습니다.',
            error: 'Internal Server Error',
          });
        }

        // 데이터베이스 연결 에러
        if (
          errorMessage.includes('database is locked') ||
          errorMessage.includes('SQLITE_BUSY') ||
          errorMessage.includes('unable to open database')
        ) {
          this.logger.error(
            `[getCreatorVideos] 데이터베이스 연결 에러: ${errorMessage}`,
          );
          throw new InternalServerErrorException({
            message: '데이터베이스 연결 오류가 발생했습니다.',
            error: 'Internal Server Error',
          });
        }

        // SQL 문법 에러
        if (
          errorMessage.includes('syntax error') ||
          errorMessage.includes('SQLITE_MISUSE')
        ) {
          this.logger.error(
            `[getCreatorVideos] SQL 문법 에러: ${errorMessage}`,
          );
          throw new InternalServerErrorException({
            message: '데이터베이스 쿼리 오류가 발생했습니다.',
            error: 'Internal Server Error',
          });
        }
      }

      // 예상치 못한 에러
      this.logger.error(
        `[getCreatorVideos] 예상치 못한 에러: ${error instanceof Error ? error.stack : String(error)}`,
      );
      throw new InternalServerErrorException({
        message: '영상 목록을 조회하는 중 오류가 발생했습니다.',
        error: 'Internal Server Error',
      });
    }
  }

  /**
   * management_id 생성 (YYMMDD-01, YYMMDD-02 형식)
   * Asia/Seoul 기준 날짜 단위로 증가
   * 동시성 안전 처리 (BEGIN IMMEDIATE 트랜잭션 사용)
   * site_id는 선택적 (있으면 필터링, 없으면 전체에서 증가)
   */
  private generateManagementId(siteId?: string | null): string {
    const db = this.databaseService.getDb();
    
    // Asia/Seoul 시간대 기준 날짜 (YYMMDD)
    const now = new Date();
    const seoulTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const year = seoulTime.getFullYear().toString().slice(-2); // YY
    const month = String(seoulTime.getMonth() + 1).padStart(2, '0'); // MM
    const day = String(seoulTime.getDate()).padStart(2, '0'); // DD
    const datePrefix = `${year}${month}${day}`;
    
    // BEGIN IMMEDIATE 트랜잭션으로 동시성 안전하게 처리
    const transaction = db.transaction(() => {
      const prefix = `${datePrefix}-`;
      
      // site_id가 있으면 site_id로 필터링, 없으면 전체에서 조회
      let maxRow: any;
      if (siteId) {
        // site_id 컬럼 존재 여부 확인
        const cols = db.prepare(`PRAGMA table_info(videos)`).all() as Array<{ name: string }>;
        const hasSiteId = cols.some((c) => c.name === 'site_id');
        
        if (hasSiteId) {
          maxRow = db
            .prepare(`
              SELECT management_id 
              FROM videos 
              WHERE site_id = ? AND management_id LIKE ?
              ORDER BY management_id DESC 
              LIMIT 1
            `)
            .get(siteId, `${prefix}%`) as any;
        } else {
          // site_id 컬럼이 없으면 전체에서 조회
          maxRow = db
            .prepare(`
              SELECT management_id 
              FROM videos 
              WHERE management_id LIKE ?
              ORDER BY management_id DESC 
              LIMIT 1
            `)
            .get(`${prefix}%`) as any;
        }
      } else {
        // site_id가 없으면 전체에서 조회
        maxRow = db
          .prepare(`
            SELECT management_id 
            FROM videos 
            WHERE management_id LIKE ?
            ORDER BY management_id DESC 
            LIMIT 1
          `)
          .get(`${prefix}%`) as any;
      }
      
      let nextNumber = 1;
      
      if (maxRow?.management_id) {
        // 기존 최대값에서 번호 추출 (예: "251227-01" -> 1, "251227-05" -> 5)
        const match = maxRow.management_id.match(/^(\d{6})-(\d+)$/);
        if (match && match[2]) {
          const currentNumber = parseInt(match[2], 10);
          nextNumber = currentNumber + 1;
        }
      }
      
      // 새 management_id 생성 (01, 02, ... 2자리 패딩)
      const managementId = `${datePrefix}-${String(nextNumber).padStart(2, '0')}`;
      return managementId;
    });
    
    return transaction.immediate();
  }

  /**
   * Creator 영상 생성
   * @param userId 사용자 ID (JWT에서 추출)
   * @param userRole 사용자 역할 (creator 또는 admin)
   * @param userSiteId 사용자의 site_id
   * @param dto 영상 생성 DTO
   * @returns 생성된 영상 정보
   */
  async createCreatorVideo(
    userId: string,
    userRole: string,
    userSiteId: string,
    dto: {
      sourceType: string;
      sourceUrl: string;
      title?: string;
      thumbnailUrl?: string;
      language?: string;
      status?: string;
      visibility?: string;
      site_id?: string;
    },
  ): Promise<any> {
    const db = this.databaseService.getDb();

    // sourceType 검증
    const sourceType = dto.sourceType.toLowerCase();
    if (sourceType !== 'youtube' && sourceType !== 'facebook') {
      throw new BadRequestException({
        message: "sourceType must be 'youtube' or 'facebook'",
        error: 'Bad Request',
      });
    }

    // site_id 결정 (Creator는 자신의 site_id, Admin은 body에서 받거나 user.site_id)
    let siteId: string;
    if (userRole === 'admin') {
      siteId = (dto.site_id || userSiteId || 'gods').toString();
    } else {
      siteId = (userSiteId || 'gods').toString();
    }

    // platform 매핑
    const platform = sourceType === 'youtube' ? 'youtube' : 'facebook';

    // video_id 추출
    let extractedVideoId: string | null = null;
    if (platform === 'youtube') {
      extractedVideoId = this.extractYouTubeVideoId(dto.sourceUrl);
    } else if (platform === 'facebook') {
      // Facebook video ID 추출
      const match = dto.sourceUrl.match(/\/videos\/(\d+)/);
      extractedVideoId = match ? match[1] : null;
    }

    // 기타 필드
    const title = dto.title?.trim() || null;
    const thumbnailUrl = dto.thumbnailUrl?.trim() || null;
    const language = dto.language || 'en';
    const status = dto.status || 'active';
    const visibility = dto.visibility || 'public';

    // embed_url 생성
    let embedUrl: string | null = null;
    if (platform === 'youtube' && extractedVideoId) {
      embedUrl = `https://www.youtube.com/embed/${extractedVideoId}`;
    } else if (platform === 'facebook' && extractedVideoId) {
      embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(dto.sourceUrl)}`;
    }

    // YouTube 썸네일 자동 생성 (썸네일이 없고 video_id가 있는 경우)
    let finalThumbnailUrl = thumbnailUrl;
    if (!finalThumbnailUrl && platform === 'youtube' && extractedVideoId) {
      finalThumbnailUrl = `https://img.youtube.com/vi/${extractedVideoId}/maxresdefault.jpg`;
    }

    try {
      // 영상 생성
      const videoId = this.generateId();
      const now = new Date().toISOString();
      
      // management_id 생성 (비어있으면 자동 생성, YYMMDD-01 형식)
      const managementId = this.generateManagementId(siteId || null);

      // 컬럼 존재 여부 확인
      const cols = db.prepare(`PRAGMA table_info(videos)`).all() as Array<{ name: string }>;
      const columnNames = cols.map((c) => c.name);

      // 기본 필수 컬럼 (항상 존재해야 함)
      const insertColumns: string[] = [];
      const insertValues: any[] = [];

      // 필수 컬럼 추가 (순서대로)
      insertColumns.push('id');
      insertValues.push(videoId);

      if (columnNames.includes('site_id')) {
        insertColumns.push('site_id');
        insertValues.push(siteId || null);
      }

      insertColumns.push('owner_id');
      insertValues.push(userId);

      insertColumns.push('creator_id');
      insertValues.push(userId);

      insertColumns.push('platform');
      insertValues.push(platform);

      insertColumns.push('video_id');
      insertValues.push(extractedVideoId);

      if (columnNames.includes('youtube_url')) {
        insertColumns.push('youtube_url');
        insertValues.push(platform === 'youtube' ? dto.sourceUrl : null);
      }

      if (columnNames.includes('facebook_url')) {
        insertColumns.push('facebook_url');
        insertValues.push(platform === 'facebook' ? dto.sourceUrl : null);
      }

      if (columnNames.includes('source_url')) {
        insertColumns.push('source_url');
        insertValues.push(dto.sourceUrl);
      }

      insertColumns.push('title');
      insertValues.push(title);

      insertColumns.push('thumbnail_url');
      insertValues.push(finalThumbnailUrl);

      if (columnNames.includes('embed_url')) {
        insertColumns.push('embed_url');
        insertValues.push(embedUrl);
      }

      insertColumns.push('language');
      insertValues.push(language);

      if (columnNames.includes('status')) {
        insertColumns.push('status');
        insertValues.push(status);
      }

      if (columnNames.includes('visibility')) {
        insertColumns.push('visibility');
        insertValues.push(visibility);
      }

      insertColumns.push('management_id');
      insertValues.push(managementId);

      insertColumns.push('view_count');
      insertValues.push(0);

      insertColumns.push('created_at');
      insertValues.push(now);

      insertColumns.push('updated_at');
      insertValues.push(now);

      const placeholders = insertColumns.map(() => '?').join(', ');
      const sql = `INSERT INTO videos (${insertColumns.join(', ')}) VALUES (${placeholders})`;

      db.prepare(sql).run(...insertValues);

      // 생성된 영상 조회
      const rawVideo = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId) as any;

      // Normalize video response with backward-compatible fields
      const video = normalizeVideoResponse(rawVideo);

      // Runtime validation
      const validation = validateVideoResponse(video);
      if (!validation.valid) {
        this.logger.warn(
          `[createCreatorVideo] Created video missing fields: ${validation.missingFields.join(', ')}`,
        );
      }

      this.logger.log(
        `[createCreatorVideo] Video created: id=${videoId}, management_id=${managementId}, title=${title?.substring(0, 30) || 'N/A'}`,
      );

      return { video };
    } catch (error: any) {
      this.logger.error(`[createCreatorVideo] Error: ${error.message}`);
      throw new InternalServerErrorException({
        message: '영상 생성 중 오류가 발생했습니다.',
        error: 'Internal Server Error',
        details: error.message,
      });
    }
  }

  /**
   * 클라이언트 ID 생성/검증 (쿠키 > body의 clientId > 헤더의 x-client-key > IP + User-Agent)
   * 없으면 IP + User-Agent로 생성
   */
  getClientId(
    cookieClientId?: string,
    bodyClientId?: string,
    headerClientKey?: string,
    ip?: string,
    userAgent?: string,
  ): string {
    // 1. 쿠키의 clientId 최우선
    if (cookieClientId && typeof cookieClientId === 'string' && cookieClientId.trim()) {
      const trimmed = cookieClientId.trim();
      // UUID 형식 검증
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        return trimmed;
      }
    }

    // 2. body의 clientId
    if (bodyClientId && typeof bodyClientId === 'string' && bodyClientId.trim()) {
      const trimmed = bodyClientId.trim();
      // UUID 형식 검증
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        return trimmed;
      }
    }

    // 3. 헤더의 x-client-key
    if (headerClientKey && typeof headerClientKey === 'string' && headerClientKey.trim()) {
      return headerClientKey.trim().substring(0, 200);
    }

    // 4. 없으면 IP + User-Agent로 생성
    const clientIp = ip || 'unknown';
    const ua = userAgent || 'unknown';
    return `${clientIp}:${ua}`.substring(0, 200);
  }

  /**
   * video_likes 테이블 생성 (없으면)
   */
  private ensureVideoLikesTable(): void {
    const db = this.databaseService.getDb();
    try {
      const tableInfo = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='video_likes'")
        .get();

      if (!tableInfo) {
        db.exec(`
          CREATE TABLE IF NOT EXISTS video_likes (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            client_key TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(video_id, client_key)
          )
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_video_likes_video_id ON video_likes(video_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_video_likes_client_key ON video_likes(client_key)");
        this.logger.log('video_likes 테이블 생성됨');
      }
    } catch (err: any) {
      this.logger.warn(`video_likes 테이블 확인 실패: ${err.message}`);
    }
  }

  /**
   * ID 형식 검증 (숫자, hex 문자열, UUID 형식 모두 허용)
   */
  validateVideoId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new BadRequestException({
        message: 'videoId 파라미터가 필요합니다.',
        error: 'Bad Request',
      });
    }

    const trimmedId = id.trim();
    // 숫자
    const isNumeric = /^\d+$/.test(trimmedId);
    // hex 문자열 (길이 제한 없음)
    const isHexString = /^[a-fA-F0-9]+$/.test(trimmedId);
    // UUID 형식 (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);

    if (!isNumeric && !isHexString && !isUuid) {
      throw new BadRequestException({
        message: 'videoId는 숫자, hex 문자열, 또는 UUID 형식이어야 합니다.',
        error: 'Bad Request',
        details: `받은 ID: ${id}`,
      });
    }
  }

  /**
   * 좋아요 토글
   * 이미 좋아요가 있으면 취소, 없으면 추가
   * clientId: UUID 또는 클라이언트 식별자
   */
  async toggleLike(
    videoId: string,
    clientId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const db = this.databaseService.getDb();

    try {
      // 테이블 생성 확인
      this.ensureVideoLikesTable();

      // 영상 존재 확인
      const video = db
        .prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'")
        .get(videoId) as any;

      if (!video) {
        throw new NotFoundException({
          message: '영상을 찾을 수 없거나 비공개 영상입니다.',
          error: 'Not Found',
        });
      }

      // 기존 좋아요 확인
      const existingLike = db
        .prepare('SELECT * FROM video_likes WHERE video_id = ? AND client_key = ?')
        .get(videoId, clientId);

      const isLiked = !!existingLike;
      let newLikesCount: number;
      let liked: boolean;

      // 원자적 처리: 좋아요 토글
      if (isLiked) {
        // 좋아요 취소
        try {
          this.logger.log(`[toggleLike] 좋아요 취소 시작: videoId=${videoId}, clientId=${clientId.substring(0, 20)}...`);
          
          // 좋아요 삭제
          db.prepare('DELETE FROM video_likes WHERE video_id = ? AND client_key = ?').run(videoId, clientId);
          
          // video_likes 테이블의 실제 개수로 동기화
          const actualCount = (db
            .prepare('SELECT COUNT(*) as count FROM video_likes WHERE video_id = ?')
            .get(videoId) as any).count || 0;
          
          // videos 테이블의 likes_count를 실제 개수로 업데이트
          db.prepare('UPDATE videos SET likes_count = ? WHERE id = ?').run(actualCount, videoId);
          
          liked = false;
          newLikesCount = actualCount;
          
          this.logger.log(`[toggleLike] 좋아요 취소 완료: videoId=${videoId}, likeCount=${newLikesCount}`);
        } catch (err: any) {
          this.logger.error(`[toggleLike] 좋아요 취소 실패: videoId=${videoId}, error=${err.message}`);
          throw new InternalServerErrorException({
            message: '좋아요 취소 중 오류가 발생했습니다.',
            error: 'Internal Server Error',
            details: err.message,
          });
        }
      } else {
        // 좋아요 추가 (UNIQUE 제약조건으로 중복 방지)
        try {
          this.logger.log(`[toggleLike] 좋아요 추가 시작: videoId=${videoId}, clientId=${clientId.substring(0, 20)}...`);
          
          const likeId = this.generateId();
          db.prepare('INSERT INTO video_likes (id, video_id, client_key) VALUES (?, ?, ?)').run(
            likeId,
            videoId,
            clientId,
          );
          
          // video_likes 테이블의 실제 개수로 동기화
          const actualCount = (db
            .prepare('SELECT COUNT(*) as count FROM video_likes WHERE video_id = ?')
            .get(videoId) as any).count || 0;
          
          // videos 테이블의 likes_count를 실제 개수로 업데이트
          db.prepare('UPDATE videos SET likes_count = ? WHERE id = ?').run(actualCount, videoId);
          
          liked = true;
          newLikesCount = actualCount;
          
          this.logger.log(`[toggleLike] 좋아요 추가 완료: videoId=${videoId}, likeCount=${newLikesCount}`);
        } catch (err: any) {
          // UNIQUE 제약조건 위반 (중복 요청) 처리
          if (err.message?.includes('UNIQUE constraint')) {
            this.logger.warn(`[toggleLike] 중복 요청 감지: videoId=${videoId}, clientId=${clientId.substring(0, 20)}...`);
            
            // 이미 존재하면 현재 상태 반환 (video_likes 테이블의 실제 개수로)
            const actualCount = (db
              .prepare('SELECT COUNT(*) as count FROM video_likes WHERE video_id = ?')
              .get(videoId) as any).count || 0;
            
            // videos 테이블 동기화
            db.prepare('UPDATE videos SET likes_count = ? WHERE id = ?').run(actualCount, videoId);
            
            return {
              liked: true,
              likeCount: actualCount,
            };
          }
          this.logger.error(`[toggleLike] 좋아요 추가 실패: videoId=${videoId}, error=${err.message}`);
          throw new InternalServerErrorException({
            message: '좋아요 추가 중 오류가 발생했습니다.',
            error: 'Internal Server Error',
            details: err.message,
          });
        }
      }

      return {
        liked,
        likeCount: newLikesCount,
      };
    } catch (err: any) {
      // 이미 예외인 경우 그대로 전달
      if (err instanceof NotFoundException || err instanceof InternalServerErrorException) {
        throw err;
      }
      this.logger.error(`좋아요 토글 실패: ${err.message}`);
      throw new InternalServerErrorException({
        message: '좋아요 처리 중 오류가 발생했습니다.',
        error: 'Internal Server Error',
        details: err.message,
      });
    }
  }

  /**
   * 좋아요 취소 (별도 엔드포인트용)
   */
  async unlike(
    videoId: string,
    clientId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const db = this.databaseService.getDb();

    try {
      // 테이블 생성 확인
      this.ensureVideoLikesTable();

      // 영상 존재 확인
      const video = db
        .prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'")
        .get(videoId) as any;

      if (!video) {
        throw new NotFoundException({
          message: '영상을 찾을 수 없거나 비공개 영상입니다.',
          error: 'Not Found',
        });
      }

      // 기존 좋아요 확인 및 삭제
      const existingLike = db
        .prepare('SELECT * FROM video_likes WHERE video_id = ? AND client_key = ?')
        .get(videoId, clientId);

      if (existingLike) {
        this.logger.log(`[unlike] 좋아요 취소 시작: videoId=${videoId}, clientId=${clientId.substring(0, 20)}...`);
        
        db.prepare('DELETE FROM video_likes WHERE video_id = ? AND client_key = ?').run(videoId, clientId);
        
        // video_likes 테이블의 실제 개수로 동기화
        const actualCount = (db
          .prepare('SELECT COUNT(*) as count FROM video_likes WHERE video_id = ?')
          .get(videoId) as any).count || 0;
        
        // videos 테이블의 likes_count를 실제 개수로 업데이트
        db.prepare('UPDATE videos SET likes_count = ? WHERE id = ?').run(actualCount, videoId);
        
        this.logger.log(`[unlike] 좋아요 취소 완료: videoId=${videoId}, likeCount=${actualCount}`);
        
        return {
          liked: false,
          likeCount: actualCount,
        };
      } else {
        // 이미 좋아요가 없으면 현재 상태 반환 (video_likes 테이블의 실제 개수로)
        const actualCount = (db
          .prepare('SELECT COUNT(*) as count FROM video_likes WHERE video_id = ?')
          .get(videoId) as any).count || 0;
        
        // videos 테이블 동기화
        db.prepare('UPDATE videos SET likes_count = ? WHERE id = ?').run(actualCount, videoId);
        
        return {
          liked: false,
          likeCount: actualCount,
        };
      }
    } catch (err: any) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`[unlike] 좋아요 취소 실패: videoId=${videoId}, error=${err.message}`);
      throw new InternalServerErrorException({
        message: '좋아요 취소 중 오류가 발생했습니다.',
        error: 'Internal Server Error',
        details: err.message,
      });
    }
  }

  /**
   * 조회수 증가 (id 기반)
   */
  async incrementView(videoId: string): Promise<{ viewCount: number }> {
    const db = this.databaseService.getDb();

    try {
      // 영상 존재 확인
      const video = db
        .prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'")
        .get(videoId) as any;

      if (!video) {
        throw new NotFoundException({
          message: '영상을 찾을 수 없거나 비공개 영상입니다.',
          error: 'Not Found',
        });
      }

      // 조회수 증가
      const currentViews = video.view_count ?? video.views_count ?? 0;
      const newViewsCount = currentViews + 1;
      
      // view_count 컬럼 존재 여부 확인
      const cols = db.prepare(`PRAGMA table_info(videos)`).all() as Array<{ name: string }>;
      const hasViewCount = cols.some((c) => c.name === 'view_count');
      
      if (hasViewCount) {
        db.prepare('UPDATE videos SET view_count = ? WHERE id = ?').run(newViewsCount, videoId);
      } else {
        // 하위 호환성: views_count 사용
      db.prepare('UPDATE videos SET views_count = ? WHERE id = ?').run(newViewsCount, videoId);
      }

      this.logger.log(`[incrementView] 조회수 증가: videoId=${videoId}, viewCount=${newViewsCount}`);

      return {
        viewCount: newViewsCount,
      };
    } catch (err: any) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`조회수 증가 실패: ${err.message}`);
      throw new InternalServerErrorException({
        message: '조회수 증가 중 오류가 발생했습니다.',
        error: 'Internal Server Error',
        details: err.message,
      });
    }
  }

  /**
   * 조회수 증가 (management_id 기반)
   */
  async incrementViewByManagementId(managementId: string): Promise<{ viewCount: number }> {
    const db = this.databaseService.getDb();

    try {
      // 영상 존재 확인 (management_id로 조회)
      const video = db
        .prepare("SELECT * FROM videos WHERE management_id = ?")
        .get(managementId) as any;

      if (!video) {
        throw new NotFoundException({
          message: '영상을 찾을 수 없습니다.',
          error: 'Not Found',
        });
      }

      // 조회수 증가
      const currentViews = video.view_count ?? video.views_count ?? 0;
      const newViewsCount = currentViews + 1;
      
      // view_count 컬럼 존재 여부 확인
      const cols = db.prepare(`PRAGMA table_info(videos)`).all() as Array<{ name: string }>;
      const hasViewCount = cols.some((c) => c.name === 'view_count');
      
      if (hasViewCount) {
        db.prepare('UPDATE videos SET view_count = ? WHERE management_id = ?').run(newViewsCount, managementId);
      } else {
        // 하위 호환성: views_count 사용
        db.prepare('UPDATE videos SET views_count = ? WHERE management_id = ?').run(newViewsCount, managementId);
      }

      this.logger.log(`[incrementViewByManagementId] 조회수 증가: managementId=${managementId}, viewCount=${newViewsCount}`);

      return {
        viewCount: newViewsCount,
      };
    } catch (err: any) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`조회수 증가 실패 (management_id): ${err.message}`);
      throw new InternalServerErrorException({
        message: '조회수 증가 중 오류가 발생했습니다.',
        error: 'Internal Server Error',
        details: err.message,
      });
    }
  }

  /**
   * 공유 수 증가
   */
  async incrementShare(videoId: string): Promise<{ shareCount: number }> {
    const db = this.databaseService.getDb();

    try {
      // 영상 존재 확인
      const video = db
        .prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'")
        .get(videoId) as any;

      if (!video) {
        throw new NotFoundException({
          message: '영상을 찾을 수 없거나 비공개 영상입니다.',
          error: 'Not Found',
        });
      }

      // 공유 수 증가
      const currentShares = video.shares_count ?? 0;
      const newSharesCount = currentShares + 1;
      db.prepare('UPDATE videos SET shares_count = ? WHERE id = ?').run(newSharesCount, videoId);

      this.logger.log(`[incrementShare] 공유 수 증가: videoId=${videoId}, shareCount=${newSharesCount}`);

      return {
        shareCount: newSharesCount,
      };
    } catch (err: any) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`공유 수 증가 실패: ${err.message}`);
      throw new InternalServerErrorException({
        message: '공유 수 증가 중 오류가 발생했습니다.',
        error: 'Internal Server Error',
        details: err.message,
      });
    }
  }
}
