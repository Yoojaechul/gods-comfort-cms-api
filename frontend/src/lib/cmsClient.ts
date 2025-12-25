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
 * - multipart/form-data
 * - Content-Type 직접 지정 ❌
 */
export async function uploadThumbnail(
  videoId: string,
  file: File,
  token?: string
): Promise<{
  thumbnail_url?: string;
  thumbnailUrl?: string;
  url?: string;
}> {
  const formData = new FormData();
  formData.append("thumbnail", file);

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return apiRequest(`/admin/videos/${videoId}/thumbnail`, {
    method: "POST",
    headers,
    body: formData,
  });
}
