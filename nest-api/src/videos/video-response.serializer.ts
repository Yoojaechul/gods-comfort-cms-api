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
  facebook_url?: string | null; // Facebook video URL
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
  const facebookUrl = video.facebook_url || null;
  const viewCount = video.view_count ?? video.views ?? 0;
  
  // Collect all possible URL fields (platform-agnostic)
  // Check all possible URL fields that might contain the video URL
  const allPossibleUrls = [
    video.url,
    youtubeUrl,
    sourceUrl,
    facebookUrl,
    video.embed_url,
  ].filter((url): url is string => url != null && typeof url === 'string' && url.trim() !== '');
  
  // Resolve url field: prefer youtube_url for YouTube (backward compatibility),
  // otherwise use any available URL (source_url for Facebook, etc.)
  // This ensures url is never null if any URL field exists in DB
  const resolvedUrl = youtubeUrl || allPossibleUrls[0] || null;
  
  // Resolve source_url field: prefer youtube_url for YouTube (backward compatibility),
  // then source_url, then facebook_url, then any other available URL
  // This ensures source_url is never null if any URL field exists in DB
  // For Facebook videos, source_url should contain the Facebook URL
  const resolvedSourceUrl = youtubeUrl || sourceUrl || facebookUrl || allPossibleUrls[0] || null;

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
    source_url: resolvedSourceUrl,
    url: resolvedUrl,
    // Platform-specific URL fields (명시적으로 포함)
    youtube_url: youtubeUrl || (video.platform === 'youtube' ? resolvedSourceUrl : null),
    facebook_url: facebookUrl || (video.platform === 'facebook' ? resolvedSourceUrl : null),
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



