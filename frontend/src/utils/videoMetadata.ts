/**
 * 영상 메타데이터 가져오기 공통 함수
 * YouTube 영상의 제목, 썸네일 등을 자동으로 가져옵니다.
 */

import { CMS_API_BASE } from "../config";

export interface VideoMetadata {
  title?: string;
  description?: string;
  thumbnail_url?: string;
}

/**
 * YouTube URL 검증 함수
 */
export function validateYouTubeUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  
  const patterns = [
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+$/,
    /^[a-zA-Z0-9_-]{11}$/, // YouTube ID만 입력한 경우
  ];
  
  return patterns.some(pattern => pattern.test(url.trim()));
}

/**
 * Facebook URL 검증 함수 (완화된 검증)
 * facebook.com/* 또는 fb.watch/* 패턴 허용
 */
export function validateFacebookUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  
  const trimmed = url.trim();
  
  // facebook.com 또는 fb.watch 포함 여부 확인
  const patterns = [
    /facebook\.com/i,
    /fb\.watch/i,
  ];
  
  return patterns.some(pattern => pattern.test(trimmed));
}

/**
 * YouTube URL에서 videoId 추출 함수
 */
export function extractYoutubeId(url: string): string | null {
  if (!url || !url.trim()) return null;
  
  const trimmed = url.trim();
  
  // YouTube ID만 입력한 경우 (11자리)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  
  // YouTube URL 패턴들
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
    /(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /(?:www\.)?youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * YouTube URL을 정규화하여 oembed API에 전달 가능한 형태로 변환
 */
function normalizeYouTubeUrlForOembed(url: string): string {
  const trimmed = url.trim();
  
  // YouTube ID만 입력한 경우
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/watch?v=${trimmed}`;
  }
  
  // 이미 http:// 또는 https://로 시작하면 그대로 사용
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  
  // 그 외의 경우 https://를 앞에 붙임
  return `https://${trimmed}`;
}

/**
 * YouTube 영상 메타데이터 가져오기 (oembed API 사용)
 * @param sourceUrl - YouTube URL 또는 ID
 * @param token - 인증 토큰 (사용하지 않음, 호환성을 위해 유지)
 * @returns 메타데이터 객체 (title, description, thumbnail_url)
 */
export async function fetchYouTubeMetadata(
  sourceUrl: string,
  token?: string
): Promise<VideoMetadata> {
  try {
    // URL 정규화
    const normalizedUrl = normalizeYouTubeUrlForOembed(sourceUrl);
    
    // YouTube oembed API 호출
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`;
    
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      // oembed API 실패 시 빈 객체 반환 (에러를 throw하지 않음)
      console.warn("YouTube oembed API 호출 실패:", response.status, response.statusText);
      return {};
    }
    
    const data = await response.json();
    
    // oembed 응답에서 title과 thumbnail_url 추출
    const metadata: VideoMetadata = {
      title: data.title || undefined,
      thumbnail_url: data.thumbnail_url || undefined,
    };
    
    // thumbnail_url이 없으면 youtubeId 기반으로 자동 생성
    if (!metadata.thumbnail_url) {
      const youtubeId = extractYoutubeId(sourceUrl);
      if (youtubeId) {
        metadata.thumbnail_url = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
      }
    }
    
    return metadata;
  } catch (error) {
    // 네트워크 오류 등 예외 발생 시 빈 객체 반환 (에러를 throw하지 않음)
    console.warn("YouTube 메타데이터 가져오기 중 오류 발생:", error);
    return {};
  }
}

/**
 * 썸네일 URL을 정규화합니다
 * - 상대경로를 절대경로로 변환 (CMS_API_BASE 기준)
 * - 잘못된 포트(127.0.0.1:7242 등)를 제거하거나 수정
 * - data URL은 그대로 유지
 * @param thumbnailUrl - 정규화할 썸네일 URL
 * @param baseUrl - 기본 URL (기본값: CMS_API_BASE)
 * @returns 정규화된 썸네일 URL
 */
export function normalizeThumbnailUrl(
  thumbnailUrl: string | null | undefined,
  baseUrl: string = CMS_API_BASE
): string | null {
  if (!thumbnailUrl || !thumbnailUrl.trim()) {
    return null;
  }

  const trimmed = thumbnailUrl.trim();

  // data URL은 그대로 반환
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  // 이미 절대 URL인 경우
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    // 잘못된 포트(127.0.0.1:7242 등)가 포함되어 있으면 제거하거나 수정
    if (trimmed.includes("127.0.0.1:7242") || trimmed.includes("localhost:7242")) {
      console.warn(`[normalizeThumbnailUrl] 잘못된 포트가 포함된 URL 감지: ${trimmed}`);
      // 포트 부분을 제거하거나 baseUrl로 대체
      try {
        const url = new URL(trimmed);
        // baseUrl의 포트를 사용하거나 기본 포트 사용
        const baseUrlObj = new URL(baseUrl);
        url.host = baseUrlObj.host;
        return url.toString();
      } catch {
        // URL 파싱 실패 시 원본 반환
        return trimmed;
      }
    }
    return trimmed;
  }

  // 상대경로인 경우 절대경로로 변환
  try {
    // baseUrl이 /로 끝나지 않으면 제거
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    // thumbnailUrl이 /로 시작하지 않으면 / 추가
    const normalizedThumbnail = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    const result = `${normalizedBaseUrl}${normalizedThumbnail}`;
    
    // 디버깅: 상대경로 변환 로그
    console.log(`[normalizeThumbnailUrl] 상대경로 변환: "${trimmed}" + "${baseUrl}" → "${result}"`);
    
    return result;
  } catch (err) {
    // 변환 실패 시 원본 반환
    console.warn(`[normalizeThumbnailUrl] 상대경로 변환 실패:`, err);
    return trimmed;
  }
}
















