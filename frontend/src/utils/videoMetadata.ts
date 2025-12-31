/**
 * 영상 메타데이터 가져오기 공통 함수
 * - YouTube: CMS API(/metadata/youtube)를 통해 제목/썸네일 자동 가져오기
 * - 썸네일 URL 정규화 유틸 포함
 */

/**
 * API Base URL을 가져옵니다.
 */
function getApiBase(): string {
  const env = import.meta.env;
  return env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL || "https://api.godcomfortword.com";
}

export interface VideoMetadata {
  title?: string;
  description?: string;
  thumbnail_url?: string;
}

export function validateYouTubeUrl(url: string): boolean {
  if (!url || !url.trim()) return false;

  const trimmed = url.trim();
  const patterns = [
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+$/i,
    /^[a-zA-Z0-9_-]{11}$/, // videoId만
  ];

  return patterns.some((p) => p.test(trimmed));
}

export function validateFacebookUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  const trimmed = url.trim();
  return /facebook\.com/i.test(trimmed) || /fb\.watch/i.test(trimmed);
}

export function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();

  // 이미 ID만 들어온 경우(대부분 11자)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  // URL 형태 처리
  try {
    const u = new URL(trimmed);

    // youtu.be/ID
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "");
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // youtube.com/watch?v=ID
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    // youtube.com/embed/ID
    const m1 = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (m1?.[1]) return m1[1];

    // youtube.com/shorts/ID
    const m2 = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (m2?.[1]) return m2[1];

    // youtube.com/v/ID (구형 URL)
    const m3 = u.pathname.match(/\/v\/([a-zA-Z0-9_-]{11})/);
    if (m3?.[1]) return m3[1];
  } catch {
    // URL이 아니면 정규식으로 한 번 더 시도
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/i,
      /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/i,
      /([a-zA-Z0-9_-]{11})/, // 마지막으로 11자 ID 패턴 찾기
    ];

    for (const p of patterns) {
      const m = trimmed.match(p);
      if (m?.[1]) return m[1];
    }
  }

  return null;
}

/**
 * Video 객체에서 YouTube ID를 우선순위에 따라 추출합니다.
 * 우선순위:
 * 1. video.youtube_id
 * 2. video.video_id
 * 3. video.source_url 에서 파싱
 * 4. video.youtube_url 에서 파싱
 * 5. video.url 에서 파싱
 */
export function extractYouTubeIdFromVideo(video: any): string | null {
  if (!video) return null;

  // 1. video.youtube_id
  if (video.youtube_id && typeof video.youtube_id === "string") {
    const id = extractYoutubeId(video.youtube_id);
    if (id) return id;
  }

  // 2. video.video_id
  if (video.video_id && typeof video.video_id === "string") {
    const id = extractYoutubeId(video.video_id);
    if (id) return id;
  }

  // 3. video.source_url 에서 파싱
  const sourceUrl = video.source_url || video.sourceUrl;
  if (sourceUrl && typeof sourceUrl === "string") {
    const id = extractYoutubeId(sourceUrl);
    if (id) return id;
  }

  // 4. video.youtube_url 에서 파싱
  const youtubeUrl = video.youtube_url || video.youtubeUrl;
  if (youtubeUrl && typeof youtubeUrl === "string") {
    const id = extractYoutubeId(youtubeUrl);
    if (id) return id;
  }

  // 5. video.url 에서 파싱
  const url = video.url || video.videoUrl;
  if (url && typeof url === "string") {
    const id = extractYoutubeId(url);
    if (id) return id;
  }

  return null;
}

function normalizeYouTubeUrlForRequest(urlOrId: string): string {
  const trimmed = (urlOrId || "").trim();

  // ID만 들어오면 표준 watch URL로 변환
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/watch?v=${trimmed}`;
  }

  // http(s)면 그대로
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // 그 외는 https:// 붙임
  return `https://${trimmed}`;
}

/**
 * ✅ YouTube 메타데이터 (CMS API 사용)
 * - 프론트에서 유튜브 oEmbed 직접 호출하면 CORS/401/HTML 응답(doctype) 문제가 생길 수 있어
 *   반드시 배포된 CMS API의 /public/videos/youtube/metadata를 사용합니다.
 */
export async function fetchYouTubeMetadata(
  sourceUrlOrId: string
): Promise<VideoMetadata> {
  try {
    const normalized = normalizeYouTubeUrlForRequest(sourceUrlOrId);

    // API Base URL 가져오기
    const base = getApiBase();

    // Public API 엔드포인트 사용: /public/videos/youtube/metadata
    const apiUrl = `${String(base).replace(/\/+$/, "")}/public/videos/youtube/metadata?url=${encodeURIComponent(
      normalized
    )}`;

    const resp = await fetch(apiUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.warn("[fetchYouTubeMetadata] failed:", resp.status, t.slice(0, 200));
      return {};
    }

    const data = await resp.json().catch(() => null);

    const title = data?.title ?? "";

    const meta: VideoMetadata = {
      title: title || undefined,
      thumbnail_url: undefined, // 썸네일은 별도로 처리
    };

    // 썸네일은 videoId 기반으로 생성 (항상 생성)
    const vid = extractYoutubeId(sourceUrlOrId);
    if (vid) {
      meta.thumbnail_url = `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`;
    }

    return meta;
  } catch (e) {
    console.warn("[fetchYouTubeMetadata] error:", e);
    return {};
  }
}

/**
 * 미디어 URL 해석 함수
 * - https:// 또는 http://로 시작하면 그대로 반환
 * - "/uploads/..."로 시작하면 VITE_API_BASE_URL을 prefix로 붙여서 절대 URL로 변환
 * - 기존 유튜브 썸네일 동작은 절대 깨지지 않게 보장
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null;

  const trimmed = url.trim();

  // https:// 또는 http://로 시작하면 그대로 사용
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }

  // "/uploads/..."로 시작하면 VITE_API_BASE_URL을 prefix로 붙여서 절대 URL로 변환
  if (trimmed.startsWith("/uploads/")) {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    if (!apiBaseUrl) {
      console.warn("[resolveMediaUrl] VITE_API_BASE_URL이 설정되지 않았습니다.");
      return trimmed;
    }

    // base URL 끝의 슬래시 제거
    const normalizedBase = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
    return `${normalizedBase}${trimmed}`;
  }

  // 그 외의 경우는 그대로 반환 (기존 동작 유지)
  return trimmed;
}

/**
 * 썸네일 URL 정규화
 * - 상대경로를 API Base URL 기준 절대경로로 변환
 * - localhost/127.0.0.1 잘못된 포트가 있으면 baseUrl host로 교체
 * - data URL은 그대로
 */
export function normalizeThumbnailUrl(
  thumbnailUrl: string | null | undefined,
  baseUrl?: string
): string | null {
  // baseUrl이 제공되지 않으면 환경 변수에서 가져오기
  const apiBase = baseUrl || getApiBase();
  if (!thumbnailUrl || !thumbnailUrl.trim()) return null;

  const trimmed = thumbnailUrl.trim();

  if (trimmed.startsWith("data:")) return trimmed;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (trimmed.includes("127.0.0.1:7242") || trimmed.includes("localhost:7242")) {
      try {
        const u = new URL(trimmed);
        const b = new URL(apiBase);
        u.host = b.host;
        return u.toString();
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  const normalizedBase = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${normalizedBase}${normalizedPath}`;
}
