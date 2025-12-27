// frontend/src/lib/cmsClient.ts
import { apiRequest } from "./apiClient";

/* =========================
   Types
========================= */

export type CmsHealthResponse = {
  status: string;
  timestamp: string;
};

export type VideoItem = {
  id: string;
  title: string;
  sourceUrl: string;
  views: number;
};

/* =========================
   API Functions
========================= */

/**
 * CMS 서버 상태 확인
 */
export function fetchCmsHealth(): Promise<CmsHealthResponse> {
  return apiRequest("/health");
}

/**
 * 영상 목록 조회 (관리자 / 크리에이터)
 */
export function fetchVideos(): Promise<VideoItem[]> {
  return apiRequest("/admin/videos");
}

/**
 * 영상 단건 조회
 */
export function fetchVideo(id: string): Promise<VideoItem> {
  return apiRequest(`/admin/videos/${id}`);
}

/**
 * 썸네일 업로드
 * - 엔드포인트: POST /uploads/thumbnail
 * - multipart/form-data (FormData 키: "file")
 * - Authorization 헤더는 자동으로 포함됨 (localStorage의 cms_token 사용)
 */
export async function uploadThumbnail(
  file: File
): Promise<{
  thumbnail_url?: string;
  thumbnailUrl?: string;
  url?: string;
}> {
  const formData = new FormData();
  formData.append("file", file);

  // apiRequest는 기본적으로 Content-Type: application/json을 설정하므로
  // FormData 업로드를 위해 직접 fetch를 사용합니다.
  const apiBase = (() => {
    const env = (import.meta as any).env;
    let apiBase = env?.VITE_CMS_API_BASE_URL || env?.VITE_API_BASE_URL;
    if (!apiBase || String(apiBase).trim() === "") {
      apiBase = "https://api.godcomfortword.com";
    }
    return String(apiBase).trim();
  })();

  const url = `${apiBase.replace(/\/+$/, "")}/uploads/thumbnail`;

  const headers: HeadersInit = {};
  
  // Authorization 토큰 추가 (localStorage에서 가져옴)
  const token = localStorage.getItem("cms_token");
  if (token && token.trim() && token !== "dummy-token") {
    headers["Authorization"] = `Bearer ${token.trim()}`;
  }

  // FormData는 Content-Type을 설정하지 않음 (브라우저가 자동으로 boundary 추가)
  console.log(`[uploadThumbnail] POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    let errorMessage = `썸네일 업로드 실패 (${res.status})`;
    try {
      const json = JSON.parse(errorText);
      errorMessage = json.message || json.error || errorMessage;
    } catch {
      if (errorText) {
        errorMessage = `${errorMessage}: ${errorText.substring(0, 100)}`;
      }
    }
    throw new Error(errorMessage);
  }

  const result = await res.json();
  
  // 응답에서 URL 추출 (다양한 필드명 지원)
  return {
    url: result.url || result.thumbnailUrl || result.thumbnail_url,
    thumbnailUrl: result.thumbnailUrl || result.thumbnail_url || result.url,
    thumbnail_url: result.thumbnail_url || result.thumbnailUrl || result.url,
  };
}
