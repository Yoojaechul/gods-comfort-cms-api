import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';

/**
 * 영상 서비스
 * videos 테이블에서 데이터를 조회하는 비즈니스 로직
 */
@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 현재 사용자의 영상 목록 조회
   * @param userId 사용자 ID
   * @param siteId 사이트 ID (선택사항)
   * @returns 영상 목록
   */
  async findVideosByUser(userId: string, siteId?: string): Promise<any[]> {
    this.logger.debug(`영상 목록 조회 - User ID: ${userId}, Site ID: ${siteId || 'all'}`);

    try {
      const db = this.databaseService.getDb();

      // videos 테이블 존재 확인
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='videos'",
        )
        .get();

      if (!tableExists) {
        this.logger.warn('videos 테이블이 존재하지 않습니다. 더미 데이터를 반환합니다.');
        return this.getDummyVideos();
      }

      // 사용자 조회 (role 확인)
      const user = this.databaseService.findUserById(userId);
      if (!user) {
        this.logger.warn(`사용자를 찾을 수 없습니다: ${userId}`);
        return [];
      }

      // 쿼리 구성 (url 필드도 포함)
      let query = '';
      const params: any[] = [];

      // Admin은 모든 영상 조회 가능 (owner_id 필터 없음)
      if (user.role === 'admin') {
        query = 'SELECT id, management_id, title, platform, visibility, thumbnail_url, source_url, language, site_id, owner_id, created_at FROM videos WHERE 1=1';
        
        // Admin은 site_id 필터 가능
        if (siteId) {
          query += ' AND site_id = ?';
          params.push(siteId);
        }
      } else {
        // Creator는 자신의 영상만 조회
        query = 'SELECT id, management_id, title, platform, visibility, thumbnail_url, source_url, language, site_id, owner_id, created_at FROM videos WHERE owner_id = ?';
        params.push(userId);

        // Creator는 자신의 site_id만 조회 가능
        if (user.site_id) {
          query += ' AND site_id = ?';
          params.push(user.site_id);
        }
      }

      query += ' ORDER BY created_at DESC';

      const videos = db.prepare(query).all(...params) as any[];

      this.logger.debug(`영상 목록 조회 완료: ${videos.length}개`);

      return videos.map((video) => ({
        id: video.id,
        managementId: video.management_id || null, // 영상 관리번호 추가
        title: video.title || null,
        platform: video.platform || 'other',
        visibility: video.visibility || 'public',
        thumbnail_url: video.thumbnail_url || null,
        url: video.source_url || null,
        language: video.language || null,
        site_id: video.site_id || null,
        owner_id: video.owner_id || null,
        created_at: video.created_at || null,
      }));
    } catch (error) {
      this.logger.error(`영상 목록 조회 오류:`, error);
      // 오류 발생 시 더미 데이터 반환
      return this.getDummyVideos();
    }
  }

  /**
   * 영상 생성
   * @param userId 사용자 ID (JWT에서 가져옴)
   * @param siteId 사이트 ID (JWT에서 가져옴)
   * @param createVideoDto 영상 생성 데이터
   * @returns 생성된 영상 정보
   */
  async createVideo(
    userId: string,
    siteId: string,
    createVideoDto: any,
  ): Promise<any> {
    this.logger.debug(
      `영상 생성 - User ID: ${userId}, Site ID: ${siteId}`,
    );
    this.logger.debug(`영상 데이터:`, createVideoDto);

    try {
      const db = this.databaseService.getDb();

      // videos 테이블 존재 확인
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='videos'",
        )
        .get();

      if (!tableExists) {
        this.logger.error('videos 테이블이 존재하지 않습니다.');
        throw new Error('videos 테이블이 존재하지 않습니다.');
      }

      // 사용자 조회 (role 확인)
      const user = this.databaseService.findUserById(userId);
      if (!user) {
        this.logger.error(`사용자를 찾을 수 없습니다: ${userId}`);
        throw new Error('사용자를 찾을 수 없습니다.');
      }

      // Creator는 자신의 site_id만 사용 가능
      if (user.role === 'creator') {
        if (!user.site_id) {
          this.logger.error(`Creator에게 site_id가 설정되어 있지 않습니다.`);
          throw new Error('Creator에게 site_id가 설정되어 있지 않습니다.');
        }
        if (user.site_id !== siteId) {
          this.logger.error(
            `Creator는 자신의 site_id만 사용할 수 있습니다. 요청: ${siteId}, 사용자: ${user.site_id}`,
          );
          throw new Error('권한이 없습니다.');
        }
      }

      // UUID 생성 (간단한 랜덤 문자열)
      const videoId = this.generateId();

      // 필수 필드 확인
      // sourceType 또는 videoType 중 하나는 있어야 함
      const sourceType = createVideoDto.sourceType || createVideoDto.videoType;
      if (!sourceType) {
        throw new Error('videoType(또는 sourceType)은 필수 필드입니다.');
      }
      
      // title이 없으면 기본값 사용
      let title = createVideoDto.title;
      if (!title || title.trim() === '') {
        title = 'Untitled Video';
      }

      // videoType에 따라 ID 확인
      let sourceUrl: string | null = null;
      let platform: string = sourceType;
      
      // sourceUrl이 직접 제공된 경우 우선 사용
      if (createVideoDto.sourceUrl) {
        sourceUrl = createVideoDto.sourceUrl;
      } else if (sourceType === 'youtube') {
        if (!createVideoDto.youtubeId) {
          throw new Error('youtubeId 또는 sourceUrl은 필수입니다.');
        }
        sourceUrl = `https://www.youtube.com/watch?v=${createVideoDto.youtubeId}`;
      } else if (sourceType === 'facebook') {
        if (!createVideoDto.facebookVideoId) {
          throw new Error('facebookVideoId 또는 sourceUrl은 필수입니다.');
        }
        sourceUrl = `https://www.facebook.com/watch/?v=${createVideoDto.facebookVideoId}`;
      } else if (sourceType === 'file') {
        // file 타입은 sourceUrl이 직접 제공되어야 함 (또는 별도 필드)
        // sourceUrl이 없으면 null로 설정 (나중에 업로드된 파일 URL로 설정 가능)
        sourceUrl = null;
      }

      // 기본값 설정
      const visibility = createVideoDto.isPublic !== false ? 'public' : 'private';
      const language = createVideoDto.languageCode || 'ko';
      // title은 위에서 이미 설정됨
      
      // 썸네일 URL 설정 (DTO에서 제공되면 사용, 없으면 자동 생성)
      let thumbnailUrl: string | null = createVideoDto.thumbnailUrl || null;

      // YouTube 썸네일 자동 생성
      if (sourceType === 'youtube') {
        if (!thumbnailUrl && sourceUrl) {
          // YouTube URL에서 video ID 추출
          const youtubeIdMatch = sourceUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          const youtubeId = youtubeIdMatch ? youtubeIdMatch[1] : createVideoDto.youtubeId;
          if (youtubeId) {
            thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
            this.logger.log(`✅ YouTube 썸네일 자동 생성: ${thumbnailUrl}`);
          }
        }
      }

      // Facebook 썸네일 자동 가져오기
      // 조건: sourceType === 'facebook' && thumbnailUrl이 비어 있거나 undefined
      if (sourceType === 'facebook' && !thumbnailUrl && sourceUrl) {
        this.logger.debug(`🔄 Facebook 썸네일 자동 가져오기 시도: ${sourceUrl}`);
        const fetchedThumbnail = await this.fetchFacebookThumbnail(sourceUrl);
        if (fetchedThumbnail) {
          thumbnailUrl = fetchedThumbnail;
          this.logger.log(
            `✅ Facebook 썸네일 자동 가져오기 성공 - Source URL: ${sourceUrl}, Thumbnail URL: ${thumbnailUrl}`,
          );
        } else {
          this.logger.warn(
            `⚠️ Facebook 썸네일 자동 가져오기 실패 - Source URL: ${sourceUrl}`,
          );
        }
      }

      // 영상 관리번호 자동 생성
      const managementId = this.generateManagementId(db);

      // videos 테이블 스키마 확인
      const tableInfo = db.prepare("PRAGMA table_info('videos')").all();
      const columns = tableInfo.map((col: any) => col.name);

      this.logger.debug(`videos 테이블 컬럼:`, columns);

      // INSERT 쿼리 구성 (컬럼 존재 여부에 따라 동적으로)
      let insertQuery = 'INSERT INTO videos (id, site_id, owner_id, platform, source_url';
      let values = 'VALUES (?, ?, ?, ?, ?';
      const params: any[] = [
        videoId,
        siteId,
        userId,
        platform,
        sourceUrl,
      ];
      
      // management_id 컬럼이 있으면 추가
      if (columns.includes('management_id')) {
        insertQuery += ', management_id';
        values += ', ?';
        params.push(managementId);
      }

      if (columns.includes('title')) {
        insertQuery += ', title';
        values += ', ?';
        params.push(title);
      }

      if (columns.includes('thumbnail_url')) {
        insertQuery += ', thumbnail_url';
        values += ', ?';
        params.push(thumbnailUrl);
      }

      if (columns.includes('visibility')) {
        insertQuery += ', visibility';
        values += ', ?';
        params.push(visibility);
      }

      if (columns.includes('language')) {
        insertQuery += ', language';
        values += ', ?';
        params.push(language);
      }

      if (columns.includes('created_at')) {
        insertQuery += ', created_at';
        values += ', datetime(\'now\')';
      }

      insertQuery += ') ' + values + ')';

      this.logger.debug(`INSERT 쿼리: ${insertQuery}`);
      this.logger.debug(`파라미터:`, params);

      // 영상 생성
      const result = db.prepare(insertQuery).run(...params);

      if (result.changes === 0) {
        throw new Error('영상 생성에 실패했습니다.');
      }

      this.logger.log(`✅ 영상 생성 완료 - Video ID: ${videoId}`);

      // 생성된 영상 조회
      const createdVideo = db
        .prepare('SELECT * FROM videos WHERE id = ?')
        .get(videoId);

      return createdVideo;
    } catch (error) {
      this.logger.error(`영상 생성 오류:`, error);
      throw error;
    }
  }

  /**
   * 대량 영상 생성 (간단한 버전)
   * @param dtos CreateVideoDto 배열
   * @param ownerId 사용자 ID (owner_id로 사용)
   * @param siteId 사이트 ID
   * @returns 생성 결과
   */
  async bulkCreate(
    dtos: any[],
    ownerId: string,
    siteId: string | null,
  ): Promise<{
    success: number;
    failed: number;
    results: any[];
    errors: any[];
  }> {
    this.logger.debug(
      `대량 영상 생성 - Owner ID: ${ownerId}, Site ID: ${siteId}, Count: ${dtos.length}`,
    );

    const results = {
      success: 0,
      failed: 0,
      results: [] as any[],
      errors: [] as any[],
    };

    // sourceUrl이 비어있거나 삭제 체크된 항목은 skip
    const validDtos = dtos.filter((dto) => {
      // sourceUrl이 있고 공백이 아닌 경우만 처리
      const hasSourceUrl = dto.sourceUrl && dto.sourceUrl.trim() && dto.sourceUrl.trim() !== '';
      
      return hasSourceUrl;
    });

    this.logger.debug(`유효한 영상 개수: ${validDtos.length} / ${dtos.length}`);

    // Promise.all을 사용하여 병렬 처리
    const promises = validDtos.map(async (dto, index) => {
      try {
        // ownerId를 포함하여 createVideo 호출
        const created = await this.createVideo(ownerId, siteId || '', dto);
        results.success++;
        results.results.push(created);
        return { success: true, index, video: created };
      } catch (error) {
        results.failed++;
        const errorInfo = {
          index: dtos.indexOf(dto), // 원본 배열의 인덱스
          error: error.message || '알 수 없는 오류',
        };
        results.errors.push(errorInfo);
        this.logger.error(`영상 생성 실패 (인덱스 ${index}):`, error);
        return { success: false, index, error: errorInfo };
      }
    });

    await Promise.all(promises);

    this.logger.log(
      `✅ 대량 영상 생성 완료 - 성공: ${results.success}, 실패: ${results.failed}`,
    );

    return results;
  }

  /**
   * 대량 영상 생성 (기존 메서드 - 호환성 유지)
   * @param userId 사용자 ID
   * @param siteId 사이트 ID
   * @param videos 영상 배열 (최대 20개)
   * @returns 생성 결과
   */
  async bulkCreateVideos(
    userId: string,
    siteId: string,
    videos: any[],
  ): Promise<{ inserted: number; failed: number; errors: any[] }> {
    this.logger.debug(
      `대량 영상 생성 - User ID: ${userId}, Site ID: ${siteId}, Count: ${videos.length}`,
    );

    const results = {
      inserted: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (let i = 0; i < videos.length; i++) {
      try {
        await this.createVideo(userId, siteId, videos[i]);
        results.inserted++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          error: error.message || '알 수 없는 오류',
        });
        this.logger.error(`영상 생성 실패 (인덱스 ${i}):`, error);
      }
    }

    this.logger.log(
      `✅ 대량 영상 생성 완료 - 성공: ${results.inserted}, 실패: ${results.failed}`,
    );

    return results;
  }

  /**
   * 대량 영상 등록/편집/삭제 (Upsert)
   * @param userId 사용자 ID (owner_id로 사용)
   * @param siteId 사이트 ID
   * @param userRole 사용자 역할
   * @param videos 영상 배열
   * @returns 처리 결과
   */
  async bulkUpsertVideos(
    userId: string,
    siteId: string,
    userRole: string,
    videos: any[],
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
    failed: number;
    errors: any[];
  }> {
    this.logger.debug(
      `대량 영상 등록/편집/삭제 - User ID: ${userId}, Site ID: ${siteId}, Role: ${userRole}, Count: ${videos.length}`,
    );

    const results = {
      created: 0,
      updated: 0,
      deleted: 0,
      failed: 0,
      errors: [] as any[],
    };

    const db = this.databaseService.getDb();

    // 각 비디오를 순차적으로 처리
    for (let i = 0; i < videos.length; i++) {
      const videoDto = videos[i];

      try {
        // 삭제 처리
        if (videoDto.deleteChecked === true && videoDto.id) {
          // 영상 존재 확인 및 권한 체크
          const existingVideo = db
            .prepare('SELECT * FROM videos WHERE id = ?')
            .get(videoDto.id) as any;

          if (!existingVideo) {
            results.failed++;
            results.errors.push({
              index: i,
              id: videoDto.id,
              action: 'delete',
              error: '영상을 찾을 수 없습니다.',
            });
            continue;
          }

          // 권한 체크
          if (userRole === 'creator') {
            if (existingVideo.site_id !== siteId) {
              results.failed++;
              results.errors.push({
                index: i,
                id: videoDto.id,
                action: 'delete',
                error: '권한이 없습니다.',
              });
              continue;
            }
          }

          // 삭제 실행
          const deleteResult = db
            .prepare('DELETE FROM videos WHERE id = ?')
            .run(videoDto.id);

          if (deleteResult.changes > 0) {
            results.deleted++;
            this.logger.debug(`✅ 영상 삭제 완료: ${videoDto.id}`);
          } else {
            results.failed++;
            results.errors.push({
              index: i,
              id: videoDto.id,
              action: 'delete',
              error: '삭제에 실패했습니다.',
            });
          }
          continue;
        }

        // 업데이트 처리
        if (videoDto.id) {
          // 영상 존재 확인 및 권한 체크
          const existingVideo = db
            .prepare('SELECT * FROM videos WHERE id = ?')
            .get(videoDto.id) as any;

          if (!existingVideo) {
            results.failed++;
            results.errors.push({
              index: i,
              id: videoDto.id,
              action: 'update',
              error: '영상을 찾을 수 없습니다.',
            });
            continue;
          }

          // 권한 체크
          if (userRole === 'creator') {
            if (existingVideo.site_id !== siteId) {
              results.failed++;
              results.errors.push({
                index: i,
                id: videoDto.id,
                action: 'update',
                error: '권한이 없습니다.',
              });
              continue;
            }
          }

          // UpdateVideoDto 형식으로 변환
          const updateDto: any = {};
          if (videoDto.title !== undefined) {
            updateDto.title = videoDto.title;
          }
          if (videoDto.thumbnailUrl !== undefined) {
            updateDto.thumbnail_url = videoDto.thumbnailUrl;
          }
          if (videoDto.isPublic !== undefined) {
            updateDto.visibility = videoDto.isPublic ? 'public' : 'private';
          }
          if (videoDto.languageCode !== undefined) {
            updateDto.language = videoDto.languageCode;
          }

          // updateVideo 메서드 호출 (owner_id는 변경하지 않음)
          await this.updateVideo(
            videoDto.id,
            userId,
            userRole,
            siteId,
            updateDto,
          );
          results.updated++;
          this.logger.debug(`✅ 영상 업데이트 완료: ${videoDto.id}`);
          continue;
        }

        // 생성 처리 (id가 없으면)
        // CreateVideoDto 형식으로 변환
        const createDto: any = {
          title: videoDto.title,
          videoType: videoDto.videoType,
          youtubeId: videoDto.youtubeId,
          facebookVideoId: videoDto.facebookVideoId,
          thumbnailUrl: videoDto.thumbnailUrl,
          languageCode: videoDto.languageCode,
          isPublic: videoDto.isPublic,
        };

        // createVideo 메서드 호출 (owner_id 자동 설정됨)
        await this.createVideo(userId, siteId, createDto);
        results.created++;
        this.logger.debug(`✅ 영상 생성 완료`);
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          id: videoDto.id || null,
          action: videoDto.deleteChecked
            ? 'delete'
            : videoDto.id
              ? 'update'
              : 'create',
          error: error.message || '알 수 없는 오류',
        });
        this.logger.error(
          `영상 처리 실패 (인덱스 ${i}, ID: ${videoDto.id || 'new'}):`,
          error,
        );
      }
    }

    this.logger.log(
      `✅ 대량 영상 등록/편집/삭제 완료 - 생성: ${results.created}, 수정: ${results.updated}, 삭제: ${results.deleted}, 실패: ${results.failed}`,
    );

    return results;
  }

  /**
   * UUID 생성 (간단한 랜덤 문자열)
   */
  private generateId(): string {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Facebook 동영상 URL에서 videoId 추출
   * @param url Facebook 동영상 URL
   * @returns videoId 또는 null
   */
  private extractFacebookVideoId(url: string): string | null {
    if (!url) return null;

    // 다양한 Facebook URL 형식 지원
    const patterns = [
      // https://www.facebook.com/{page}/videos/{VIDEO_ID}/
      /facebook\.com\/[^\/]+\/videos\/(\d+)/,
      // https://www.facebook.com/watch/?v={VIDEO_ID}
      /facebook\.com\/watch\/\?v=(\d+)/,
      // https://www.facebook.com/video.php?v={VIDEO_ID}
      /facebook\.com\/video\.php\?v=(\d+)/,
      // https://fb.watch/{VIDEO_ID}/
      /fb\.watch\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Facebook 썸네일 가져오기 (oEmbed API 사용)
   * @param sourceUrl Facebook 동영상 URL
   * @returns 썸네일 URL 또는 null
   */
  private async fetchFacebookThumbnail(sourceUrl: string): Promise<string | null> {
    const facebookAccessToken = this.configService.get<string>(
      'FACEBOOK_ACCESS_TOKEN',
    );

    if (!facebookAccessToken) {
      this.logger.warn(
        '⚠️ FACEBOOK_ACCESS_TOKEN이 설정되어 있지 않습니다. Facebook 썸네일 자동 생성을 건너뜁니다.',
      );
      return null;
    }

    if (!sourceUrl) {
      this.logger.warn('⚠️ sourceUrl이 제공되지 않았습니다.');
      return null;
    }

    try {
      // Facebook Graph API oEmbed 엔드포인트 사용
      const oembedUrl = `https://graph.facebook.com/v11.0/oembed_video?url=${encodeURIComponent(sourceUrl)}&access_token=${facebookAccessToken}`;
      
      this.logger.debug(`🔄 Facebook oEmbed API 호출 시도: ${oembedUrl.replace(facebookAccessToken, '***')}`);
      
      const response = await fetch(oembedUrl, { 
        timeout: 5000,
        headers: {
          'User-Agent': 'CMS-API/1.0',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.thumbnail_url) {
          this.logger.log(`✅ Facebook 썸네일 가져오기 성공: ${data.thumbnail_url}`);
          return data.thumbnail_url;
        } else {
          this.logger.warn('⚠️ Facebook oEmbed 응답에 thumbnail_url이 없습니다.');
        }
      } else {
        this.logger.warn(`⚠️ Facebook oEmbed API 호출 실패: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      this.logger.warn(`⚠️ Facebook 썸네일 가져오기 오류: ${err.message}`);
    }

    return null;
  }

  /**
   * 영상 수정
   * @param videoId 수정할 영상 ID
   * @param userId 사용자 ID (JWT에서 가져옴)
   * @param userRole 사용자 역할 (JWT에서 가져옴)
   * @param siteId 사이트 ID (JWT에서 가져옴)
   * @param updateVideoDto 수정할 필드들
   * @returns 수정된 영상 정보
   */
  async updateVideo(
    videoId: string,
    userId: string,
    userRole: string,
    siteId: string,
    updateVideoDto: any,
  ): Promise<any> {
    this.logger.debug(
      `영상 수정 시도 - Video ID: ${videoId}, User ID: ${userId}, Role: ${userRole}, Site ID: ${siteId}`,
    );
    this.logger.debug(`수정 데이터:`, updateVideoDto);

    try {
      const db = this.databaseService.getDb();

      // videos 테이블 존재 확인
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='videos'",
        )
        .get();

      if (!tableExists) {
        this.logger.error('videos 테이블이 존재하지 않습니다.');
        throw new NotFoundException('videos 테이블이 존재하지 않습니다.');
      }

      // 영상 존재 확인
      const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId) as any;

      if (!video) {
        this.logger.warn(`영상을 찾을 수 없습니다: ${videoId}`);
        throw new NotFoundException('영상을 찾을 수 없습니다.');
      }

      // 사용자 조회 (role 확인)
      const user = this.databaseService.findUserById(userId);
      if (!user) {
        this.logger.error(`사용자를 찾을 수 없습니다: ${userId}`);
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // 권한 체크
      if (userRole === 'creator') {
        // Creator는 자신의 site_id 영상만 수정 가능
        if (!siteId) {
          this.logger.error(`Creator에게 site_id가 설정되어 있지 않습니다.`);
          throw new ForbiddenException('사이트 ID가 설정되어 있지 않습니다.');
        }

        if (video.site_id !== siteId) {
          this.logger.warn(
            `Creator는 자신의 site_id 영상만 수정할 수 있습니다. 요청 site_id: ${siteId}, 영상 site_id: ${video.site_id}`,
          );
          throw new ForbiddenException(
            '자신의 사이트 영상만 수정할 수 있습니다.',
          );
        }
      }
      // Admin은 모든 영상 수정 가능 (추가 체크 없음)

      // Facebook 썸네일 자동 가져오기 처리
      let finalThumbnailUrl = updateVideoDto.thumbnail_url;
      const currentSourceType = video.platform || 'other';
      const currentSourceUrl = video.source_url || null;
      
      // Facebook 영상이고 썸네일이 없는 경우 자동으로 가져오기
      // 조건:
      // 1. sourceType이 'facebook'이어야 함
      // 2. 요청에서 thumbnailUrl을 명시적으로 보내지 않았거나 비어 있는 경우
      // 3. 기존 DB에 저장된 thumbnailUrl도 비어 있을 때
      if (currentSourceType === 'facebook') {
        const requestThumbnailEmpty = updateVideoDto.thumbnail_url === undefined || 
                                      !updateVideoDto.thumbnail_url || 
                                      updateVideoDto.thumbnail_url === '';
        const existingThumbnailEmpty = !video.thumbnail_url || video.thumbnail_url === '';
        
        // 요청에서 썸네일을 보내지 않았거나 비어 있고, 기존 DB에도 썸네일이 없는 경우
        if (requestThumbnailEmpty && existingThumbnailEmpty && currentSourceUrl) {
          this.logger.debug(`🔄 Facebook 썸네일 자동 가져오기 시도: ${currentSourceUrl}`);
          const fetchedThumbnail = await this.fetchFacebookThumbnail(currentSourceUrl);
          if (fetchedThumbnail) {
            finalThumbnailUrl = fetchedThumbnail;
            this.logger.log(`✅ Facebook 썸네일 자동 가져오기 성공: ${finalThumbnailUrl}`);
          } else {
            this.logger.warn(`⚠️ Facebook 썸네일을 가져올 수 없습니다.`);
          }
        } else if (requestThumbnailEmpty && !existingThumbnailEmpty) {
          // 요청에서 썸네일을 보내지 않았지만 기존 DB에 썸네일이 있는 경우, 기존 값 유지
          finalThumbnailUrl = video.thumbnail_url;
          this.logger.debug(`ℹ️ 기존 썸네일 유지: ${finalThumbnailUrl}`);
        }
      }

      // 업데이트할 필드 구성
      const updates: string[] = [];
      const params: any[] = [];

      if (updateVideoDto.title !== undefined) {
        updates.push('title = ?');
        params.push(updateVideoDto.title);
      }

      // thumbnail_url 업데이트 (자동 가져온 값 또는 요청 값)
      if (finalThumbnailUrl !== undefined) {
        updates.push('thumbnail_url = ?');
        params.push(finalThumbnailUrl || null);
      }

      if (updateVideoDto.visibility !== undefined) {
        updates.push('visibility = ?');
        params.push(updateVideoDto.visibility);
      }

      if (updateVideoDto.language !== undefined) {
        updates.push('language = ?');
        params.push(updateVideoDto.language);
      }

      if (updates.length === 0) {
        this.logger.warn('수정할 필드가 없습니다.');
        throw new BadRequestException('수정할 필드가 없습니다.');
      }

      // UPDATE 쿼리 실행
      params.push(videoId);
      const updateQuery = `UPDATE videos SET ${updates.join(', ')} WHERE id = ?`;
      
      this.logger.debug(`UPDATE 쿼리: ${updateQuery}`);
      this.logger.debug(`파라미터:`, params);

      const result = db.prepare(updateQuery).run(...params);

      if (result.changes === 0) {
        this.logger.warn(`영상 수정 실패: ${videoId}`);
        throw new NotFoundException('영상 수정에 실패했습니다.');
      }

      this.logger.log(`✅ 영상 수정 완료 - Video ID: ${videoId}`);

      // 수정된 영상 조회
      const updatedVideo = db
        .prepare('SELECT id, management_id, title, platform, visibility, thumbnail_url, source_url, language FROM videos WHERE id = ?')
        .get(videoId) as any;

      // 응답 형식 맞추기
      return {
        id: updatedVideo.id,
        managementId: updatedVideo.management_id || null, // 영상 관리번호 추가
        title: updatedVideo.title || null,
        platform: updatedVideo.platform || 'other',
        visibility: updatedVideo.visibility || 'public',
        thumbnail_url: updatedVideo.thumbnail_url || null,
        url: updatedVideo.source_url || null,
        language: updatedVideo.language || null,
      };
    } catch (error) {
      this.logger.error(`영상 수정 오류:`, error);
      throw error;
    }
  }

  /**
   * 영상 삭제
   * @param videoId 삭제할 영상 ID
   * @param userId 사용자 ID (JWT에서 가져옴)
   * @param userRole 사용자 역할 (JWT에서 가져옴)
   * @param siteId 사이트 ID (JWT에서 가져옴)
   */
  async deleteVideo(
    videoId: string,
    userId: string,
    userRole: string,
    siteId: string,
  ): Promise<void> {
    this.logger.debug(
      `영상 삭제 시도 - Video ID: ${videoId}, User ID: ${userId}, Role: ${userRole}, Site ID: ${siteId}`,
    );

    try {
      const db = this.databaseService.getDb();

      // videos 테이블 존재 확인
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='videos'",
        )
        .get();

      if (!tableExists) {
        this.logger.error('videos 테이블이 존재하지 않습니다.');
        throw new NotFoundException('videos 테이블이 존재하지 않습니다.');
      }

      // 영상 존재 확인
      const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId) as any;

      if (!video) {
        this.logger.warn(`영상을 찾을 수 없습니다: ${videoId}`);
        throw new NotFoundException('영상을 찾을 수 없습니다.');
      }

      // 사용자 조회 (role 확인)
      const user = this.databaseService.findUserById(userId);
      if (!user) {
        this.logger.error(`사용자를 찾을 수 없습니다: ${userId}`);
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // 권한 체크
      if (userRole === 'creator') {
        // Creator는 자신의 site_id 영상만 삭제 가능
        if (!siteId) {
          this.logger.error(`Creator에게 site_id가 설정되어 있지 않습니다.`);
          throw new ForbiddenException('사이트 ID가 설정되어 있지 않습니다.');
        }

        if (video.site_id !== siteId) {
          this.logger.warn(
            `Creator는 자신의 site_id 영상만 삭제할 수 있습니다. 요청 site_id: ${siteId}, 영상 site_id: ${video.site_id}`,
          );
          throw new ForbiddenException(
            '자신의 사이트 영상만 삭제할 수 있습니다.',
          );
        }
      }
      // Admin은 모든 영상 삭제 가능 (추가 체크 없음)

      // 영상 삭제
      const result = db.prepare('DELETE FROM videos WHERE id = ?').run(videoId);

      if (result.changes === 0) {
        this.logger.warn(`영상 삭제 실패: ${videoId}`);
        throw new NotFoundException('영상 삭제에 실패했습니다.');
      }

      this.logger.log(`✅ 영상 삭제 완료 - Video ID: ${videoId}`);
    } catch (error) {
      this.logger.error(`영상 삭제 오류:`, error);
      throw error;
    }
  }

  /**
   * 공개 영상 목록 조회
   * @param query 쿼리 파라미터 (language, platform, limit)
   * @returns 공개 영상 목록
   */
  async getPublicVideos(query: {
    language?: string;
    platform?: string;
    limit?: number;
  }): Promise<any[]> {
    this.logger.debug(`공개 영상 목록 조회 - Query:`, query);

    try {
      const db = this.databaseService.getDb();

      // videos 테이블 존재 확인
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='videos'",
        )
        .get();

      if (!tableExists) {
        this.logger.warn('videos 테이블이 존재하지 않습니다.');
        return [];
      }

      // 쿼리 구성: visibility = 'public'만 조회
      let sqlQuery =
        'SELECT id, management_id, title, platform, visibility, thumbnail_url, source_url, language FROM videos WHERE visibility = ?';
      const params: any[] = ['public'];

      // language 필터
      if (query.language && query.language.trim()) {
        sqlQuery += ' AND language = ?';
        params.push(query.language.trim());
      }

      // platform 필터 (지원하는 플랫폼만)
      const supportedPlatforms = ['youtube', 'facebook', 'other'];
      if (query.platform && supportedPlatforms.includes(query.platform)) {
        sqlQuery += ' AND platform = ?';
        params.push(query.platform);
      }

      // 정렬: 최신순 (created_at DESC, 없으면 id 역순)
      const tableInfo = db.prepare("PRAGMA table_info('videos')").all();
      const hasCreatedAt = tableInfo.some((col: any) => col.name === 'created_at');

      if (hasCreatedAt) {
        sqlQuery += ' ORDER BY created_at DESC';
      } else {
        sqlQuery += ' ORDER BY id DESC';
      }

      // limit 적용
      const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 50) : 12;
      sqlQuery += ` LIMIT ${limit}`;

      this.logger.debug(`SQL Query: ${sqlQuery}`);
      this.logger.debug(`Parameters:`, params);

      const videos = db.prepare(sqlQuery).all(...params) as any[];

      this.logger.debug(`공개 영상 목록 조회 완료: ${videos.length}개`);

      // 응답 형식 맞추기 (내부 필드 제외)
      return videos.map((video) => ({
        id: video.id,
        managementId: video.management_id || null, // 영상 관리번호 추가
        title: video.title || null,
        platform: video.platform || 'other',
        visibility: video.visibility || 'public',
        thumbnail_url: video.thumbnail_url || null,
        url: video.source_url || null,
        language: video.language || null,
      }));
    } catch (error) {
      this.logger.error(`공개 영상 목록 조회 오류:`, error);
      return [];
    }
  }

  /**
   * 공개 영상 상세 조회
   * @param videoId 영상 ID
   * @returns 공개 영상 정보 또는 null
   */
  async getPublicVideoById(videoId: string): Promise<any | null> {
    this.logger.debug(`공개 영상 상세 조회 - Video ID: ${videoId}`);

    try {
      const db = this.databaseService.getDb();

      // videos 테이블 존재 확인
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='videos'",
        )
        .get();

      if (!tableExists) {
        this.logger.warn('videos 테이블이 존재하지 않습니다.');
        return null;
      }

      // 공개 영상만 조회
      const video = db
        .prepare(
          'SELECT id, title, platform, visibility, thumbnail_url, source_url, language FROM videos WHERE id = ? AND visibility = ?',
        )
        .get(videoId, 'public') as any;

      if (!video) {
        this.logger.warn(`공개 영상을 찾을 수 없습니다: ${videoId}`);
        return null;
      }

      this.logger.debug(`공개 영상 상세 조회 완료: ${videoId}`);

      // 응답 형식 맞추기 (내부 필드 제외)
      return {
        id: video.id,
        managementId: video.management_id || null, // 영상 관리번호 추가
        title: video.title || null,
        platform: video.platform || 'other',
        visibility: video.visibility || 'public',
        thumbnail_url: video.thumbnail_url || null,
        url: video.source_url || null,
        language: video.language || null,
      };
    } catch (error) {
      this.logger.error(`공개 영상 상세 조회 오류:`, error);
      return null;
    }
  }

  /**
   * 기존 Facebook 영상의 썸네일 백필 (마이그레이션용)
   * sourceType === 'facebook'이고 thumbnailUrl이 비어 있는 영상들에 대해
   * Facebook API를 호출하여 썸네일을 채워넣습니다.
   * @returns 처리 결과
   */
  async backfillFacebookThumbnails(): Promise<{
    processed: number;
    success: number;
    failed: number;
    errors: any[];
  }> {
    this.logger.log('🔄 Facebook 썸네일 백필 시작...');

    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    try {
      const db = this.databaseService.getDb();

      // videos 테이블 존재 확인
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='videos'",
        )
        .get();

      if (!tableExists) {
        this.logger.error('videos 테이블이 존재하지 않습니다.');
        throw new Error('videos 테이블이 존재하지 않습니다.');
      }

      // thumbnail_url이 비어있고 platform이 facebook인 영상 조회
      const videosWithoutThumbnail = db
        .prepare(
          "SELECT id, source_url, title FROM videos WHERE platform = 'facebook' AND (thumbnail_url IS NULL OR thumbnail_url = '') AND source_url IS NOT NULL AND source_url != ''",
        )
        .all() as any[];

      this.logger.log(
        `📊 썸네일이 없는 Facebook 영상: ${videosWithoutThumbnail.length}개`,
      );

      if (videosWithoutThumbnail.length === 0) {
        this.logger.log('✅ 모든 Facebook 영상에 썸네일이 이미 설정되어 있습니다.');
        return results;
      }

      // 각 영상에 대해 썸네일 가져오기
      for (const video of videosWithoutThumbnail) {
        results.processed++;
        try {
          this.logger.debug(
            `처리 중: ${video.id} - ${video.title || '제목 없음'}`,
          );
          this.logger.debug(`  URL: ${video.source_url}`);

          const thumbnailUrl = await this.fetchFacebookThumbnail(
            video.source_url,
          );

          if (thumbnailUrl) {
            db.prepare('UPDATE videos SET thumbnail_url = ? WHERE id = ?').run(
              thumbnailUrl,
              video.id,
            );
            this.logger.log(`  ✅ 썸네일 가져오기 성공: ${thumbnailUrl}`);
            results.success++;
          } else {
            this.logger.warn(`  ⚠️ 썸네일을 가져올 수 없습니다.`);
            results.failed++;
          }

          // API Rate Limit 방지를 위해 약간의 지연
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (err) {
          this.logger.error(`  ❌ 오류 발생: ${err.message}`);
          results.failed++;
          results.errors.push({
            videoId: video.id,
            error: err.message || '알 수 없는 오류',
          });
        }
      }

      this.logger.log(`\n✅ Facebook 썸네일 백필 완료:`);
      this.logger.log(`   처리: ${results.processed}개`);
      this.logger.log(`   성공: ${results.success}개`);
      this.logger.log(`   실패: ${results.failed}개`);

      return results;
    } catch (error) {
      this.logger.error(`❌ Facebook 썸네일 백필 오류:`, error);
      throw error;
    }
  }

  /**
   * 더미 영상 데이터 (테이블이 없을 때 사용)
   */
  private getDummyVideos(): any[] {
    this.logger.log('더미 영상 데이터 반환');
    return [
      {
        id: 'dummy-1',
        title: '샘플 영상 1',
        platform: 'youtube',
        visibility: 'public',
        thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      },
      {
        id: 'dummy-2',
        title: '샘플 영상 2',
        platform: 'youtube',
        visibility: 'public',
        thumbnail_url: null,
      },
      {
        id: 'dummy-3',
        title: '샘플 영상 3',
        platform: 'other',
        visibility: 'private',
        thumbnail_url: null,
      },
    ];
  }
}

