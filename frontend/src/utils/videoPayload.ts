/**
 * 영상 생성/수정을 위한 공통 payload 빌더
 * 대량 등록과 단건 등록에서 동일한 구조를 보장하기 위한 헬퍼 함수
 */

export interface VideoPayloadInput {
  sourceUrl: string; // 필수 필드
  sourceType?: string; // "youtube" | "facebook" | "file" 또는 대소문자 혼합
  title?: string;
  thumbnailUrl?: string;
  description?: string;
  language?: string; // 언어 코드 (예: "en", "ko", "ENGLISH" 등)
  languageCode?: string; // 백엔드 DTO 필드명과 일치 (language의 별칭)
  creatorName?: string;
}

export interface VideoPayload {
  // 백엔드 필수 필드
  platform: "youtube" | "facebook" | "file"; // 백엔드에서 요구하는 필드명
  source_url: string; // 백엔드에서 요구하는 필드명 (snake_case)
  
  // 하위 호환성을 위한 필드 (선택적)
  sourceUrl?: string;
  videoType?: "youtube" | "facebook" | "file";
  sourceType?: string;
  youtubeId?: string; // YouTube platform일 때 필수 (서버 검증용)
  
  // 선택적 필드
  title?: string;
  thumbnail_url?: string | null; // 백엔드 필드명 (snake_case)
  thumbnailUrl?: string | null; // 하위 호환성
  description?: string;
  languageCode?: string; // 백엔드 DTO 필드명과 일치 (language의 변환값)
  language?: string; // 하위 호환성을 위해 유지
  creatorName?: string;
}

/**
 * YouTube URL에서 videoId 추출 함수
 * @param url - YouTube URL 또는 YouTube ID
 * @returns 추출된 YouTube ID 또는 null
 */
function extractYoutubeId(url: string): string | null {
  if (!url || !url.trim()) return null;
  
  const trimmed = url.trim();
  
  // YouTube ID만 입력한 경우 (11자리)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  
  // YouTube URL 패턴들 (www. 포함 및 다양한 형식 지원)
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
 * 영상 payload를 생성하는 공통 함수
 * sourceType을 정규화하여 videoType으로 변환하고,
 * 대량 등록과 단건 등록에서 동일한 구조를 보장합니다.
 * 
 * @param input - 영상 정보 입력값
 * @returns 백엔드에 전송할 payload 객체
 */
export function buildVideoPayload(input: VideoPayloadInput): VideoPayload {
  // sourceType을 소문자로 정규화하여 videoType으로 변환
  // 백엔드에서 요구하는 값: "youtube", "facebook", "file" (소문자만)
  const normalizedSourceType = (input.sourceType || "youtube").toLowerCase();
  const videoType: "youtube" | "facebook" | "file" = 
    normalizedSourceType === "youtube" || 
    normalizedSourceType === "facebook" || 
    normalizedSourceType === "file"
      ? normalizedSourceType as "youtube" | "facebook" | "file"
      : "youtube"; // 기본값은 youtube

  // 대량 등록과 동일한 구조로 payload 생성
  // 백엔드 필수 필드: platform, source_url
  const payload: VideoPayload = {
    platform: videoType, // 백엔드에서 요구하는 필드명 (필수)
    source_url: input.sourceUrl.trim(), // 백엔드에서 요구하는 필드명 (필수, snake_case)
    
    // 하위 호환성을 위한 필드
    sourceUrl: input.sourceUrl.trim(),
    videoType: videoType,
    sourceType: normalizedSourceType,
  };

  // YouTube videoType일 때 youtubeId 추출 및 추가 (서버 검증 요구사항)
  if (videoType === "youtube" && input.sourceUrl) {
    const youtubeId = extractYoutubeId(input.sourceUrl);
    if (youtubeId) {
      payload.youtubeId = youtubeId;
    }
  }

  // 선택적 필드들 추가 (값이 있을 때만)
  if (input.title !== undefined && input.title !== null && input.title.trim() !== "") {
    payload.title = input.title.trim();
  }

  if (input.thumbnailUrl !== undefined && input.thumbnailUrl !== null && input.thumbnailUrl.trim() !== "") {
    const thumbnailUrl = input.thumbnailUrl.trim();
    payload.thumbnail_url = thumbnailUrl; // 백엔드 필드명 (snake_case)
    payload.thumbnailUrl = thumbnailUrl; // 하위 호환성
  }

  if (input.description !== undefined && input.description !== null && input.description.trim() !== "") {
    payload.description = input.description.trim();
  }

  // language 또는 languageCode 처리 (백엔드 DTO는 languageCode를 기대)
  // 빈 문자열이어도 기본값('ko')을 사용하도록 백엔드에서 처리하지만,
  // 프론트엔드에서 명시적으로 전달하는 것이 안전함
  const languageValue = input.languageCode || input.language;
  if (languageValue !== undefined && languageValue !== null) {
    const trimmedLanguage = String(languageValue).trim();
    // 빈 문자열이 아니면 languageCode로 설정
    if (trimmedLanguage !== "") {
      // 백엔드 DTO 필드명에 맞춰 languageCode로 설정
      payload.languageCode = trimmedLanguage;
      // 하위 호환성을 위해 language도 유지
      payload.language = trimmedLanguage;
    }
    // 빈 문자열이면 백엔드 기본값('ko')을 사용하도록 필드를 포함하지 않음
  }

  if (input.creatorName !== undefined && input.creatorName !== null && input.creatorName.trim() !== "") {
    payload.creatorName = input.creatorName.trim();
  }

  return payload;
}

