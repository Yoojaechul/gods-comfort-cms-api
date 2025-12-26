/**
 * 영상 메타데이터 가져오기 공통 함수
 * - YouTube: CMS API(/metadata/youtube)를 통해 제목/썸네일 자동 가져오기
 * - 썸네일 URL 정규화 유틸 포함
 */

import { CMS_API_BASE } from "../config";

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

export function extractYoutubeId(url: string): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/i,
  ];

  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m?.[1]) return m[1];
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

    // CMS_API_BASE를 사용 (환경 변수 기반, SPA 도메인 차단 로직 포함)
    // window.location.origin fallback 제거 (SPA 도메인으로 API 요청하는 것 방지)
    const base = CMS_API_BASE;
    
    if (!base || !base.trim()) {
      throw new Error(
        "API base URL is not configured. Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL environment variable."
      );
    }

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
 * 썸네일 URL 정규화
 * - 상대경로를 CMS_API_BASE 기준 절대경로로 변환
 * - localhost/127.0.0.1 잘못된 포트가 있으면 baseUrl host로 교체
 * - data URL은 그대로
 */
export function normalizeThumbnailUrl(
  thumbnailUrl: string | null | undefined,
  baseUrl: string = CMS_API_BASE
): string | null {
  if (!thumbnailUrl || !thumbnailUrl.trim()) return null;

  const trimmed = thumbnailUrl.trim();

  if (trimmed.startsWith("data:")) return trimmed;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (trimmed.includes("127.0.0.1:7242") || trimmed.includes("localhost:7242")) {
      try {
        const u = new URL(trimmed);
        const b = new URL(baseUrl);
        u.host = b.host;
        return u.toString();
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${normalizedBase}${normalizedPath}`;
}
