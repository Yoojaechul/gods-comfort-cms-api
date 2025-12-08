export interface Video {
  id: number | string;
  title: string;
  description?: string | null;
  creatorId?: number;
  creatorName?: string;
  createdAt?: string;
  thumbnailUrl?: string | null;
  videoUrl?: string;
  video_code?: string;
  
  // 플랫폼 및 소스 정보
  platform?: 'youtube' | 'facebook' | 'file' | string;
  sourceType?: 'youtube' | 'facebook' | 'file' | string;
  sourceUrl?: string;
  
  // 언어 및 관리번호
  language?: string; // 'en', 'ko' 등 언어 코드
  managementId?: string | null; // 영상 관리번호 (YYMMDD-XXX 형식)

  // metrics from backend
  viewCountReal?: number;
  likeCountReal?: number;
  shareCountReal?: number;

  // display metrics for users
  viewDisplay?: number;
  likeDisplay?: number;
  shareDisplay?: number;
}

// 비디오 생성/수정용 페이로드 (type-only)
export interface VideoPayload {
  title: string;
  description?: string;
  creatorName?: string;
  sourceType?: "youtube" | "facebook" | "file";
  sourceUrl?: string;
  thumbnailUrl?: string;
  language?: string; // 언어 코드 ('en', 'ko' 등)
  views_actual?: number;
  views_display?: number;
  likes_actual?: number;
  likes_display?: number;
  shares_actual?: number;
  shares_display?: number;
}

// Only types are needed; there are no runtime exports
export type { Video, VideoPayload };

