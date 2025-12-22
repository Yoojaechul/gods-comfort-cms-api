// frontend/src/lib/cmsClient.ts

import { apiRequest } from "./apiClient";

export type CmsHealthResponse = {
  status: string;
  service?: string;
  message?: string;
};

export const cmsClient = {
  async health() {
    return apiRequest<CmsHealthResponse>("/health");
  },

  async publicHealth() {
    return apiRequest<CmsHealthResponse>("/public/health");
  },
};

/* =========================
   ✅ 썸네일 업로드 (기존 코드 호환)
   ========================= */

export async function uploadThumbnail(
  file: File,
  token?: string
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const base =
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_CMS_API_BASE_URL ||
    "";

  const res = await fetch(`${base}/uploads/thumbnail`, {
    method: "POST",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Thumbnail upload failed");
  }

  return res.json();
}
