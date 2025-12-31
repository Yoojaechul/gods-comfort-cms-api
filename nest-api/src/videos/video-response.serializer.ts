/**
 * Video Response Serializer
 * Normalizes video responses to include backward-compatible fields
 * and ensures all required fields for the frontend are present.
 */

export interface NormalizedVideoResponse {
  // Core fields (always present)
  id: string;
  management_id?: string | null;
  platform: string;
  language?: string | null;
  title?: string | null;
  thumbnail_url?: string | null;
  view_count?: number;
  views?: number; // alias for view_count
  created_at?: string | null;
  updated_at?: string | null;

  // Backward-compatible aliases
  youtube_id?: string | null; // same as video_id
  source_url?: string | null; // same as youtube_url or source_url
  url?: string | null; // same as youtube_url (fallback if null)

  // Original fields (preserved)
  video_id?: string | null;
  youtube_url?: string | null;
  site_id?: string | null;
  creator_id?: string | null;
  owner_id?: string | null;
  status?: string | null;
  visibility?: string | null;
  embed_url?: string | null;
  [key: string]: any; // allow other fields
}

/**
 * Normalizes a video object to include backward-compatible fields
 * and ensures all required fields are present.
 */
export function normalizeVideoResponse(video: any): NormalizedVideoResponse {
  if (!video || typeof video !== 'object') {
    throw new Error('Invalid video object');
  }

  // Extract values with fallbacks
  const videoId = video.video_id || null;
  const youtubeUrl = video.youtube_url || null;
  const sourceUrl = video.source_url || null;
  const viewCount = video.view_count ?? video.views ?? 0;
  const url = video.url || youtubeUrl || sourceUrl || null; // url이 null이면 youtube_url로 채움

  // Build normalized response
  const normalized: NormalizedVideoResponse = {
    ...video,
    // Ensure required fields
    management_id: video.management_id || null,
    platform: video.platform || 'youtube',
    language: video.language || 'en',
    title: video.title || null,
    thumbnail_url: video.thumbnail_url || null,
    view_count: viewCount,
    views: viewCount, // alias
    created_at: video.created_at || null,
    updated_at: video.updated_at || null,
    // Backward-compatible aliases
    youtube_id: videoId,
    source_url: youtubeUrl || sourceUrl || null,
    url: url, // url이 null이면 youtube_url로 채움
  };

  return normalized;
}

/**
 * Normalizes an array of videos
 */
export function normalizeVideoListResponse(videos: any[]): NormalizedVideoResponse[] {
  if (!Array.isArray(videos)) {
    return [];
  }
  return videos.map(normalizeVideoResponse);
}

/**
 * Runtime validation: checks if a video response has required fields
 */
export function validateVideoResponse(video: any): {
  valid: boolean;
  missingFields: string[];
} {
  const requiredFields = [
    'id',
    'platform',
    'youtube_id',
    'source_url',
    'management_id',
    'title',
    'thumbnail_url',
    'view_count',
    'created_at',
  ];

  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!(field in video)) {
      missingFields.push(field);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

