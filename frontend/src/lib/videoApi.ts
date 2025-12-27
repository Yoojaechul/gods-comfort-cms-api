// frontend/src/lib/videoApi.ts

/**
 * 영상 관련 API 엔드포인트를 role에 따라 반환하는 helper 함수들
 */

export function getVideoApiBasePath(role: "admin" | "creator"): string {
  // Admin은 /admin/videos, Creator는 /creator/videos 사용
  return role === "admin" ? "/admin/videos" : "/creator/videos";
}

export function getVideoApiEndpoint(
  role: "admin" | "creator",
  videoId?: string
): string {
  const basePath = getVideoApiBasePath(role);
  return videoId ? `${basePath}/${videoId}` : basePath;
}

export function getVideoDeleteApiEndpoint(
  role: "admin" | "creator",
  videoId: string
): string {
  // 관리자는 /admin/videos/:id, 크리에이터는 /creator/videos/:id 사용
  if (role === "admin") {
    return `/admin/videos/${videoId}`;
  }
  return `/creator/videos/${videoId}`;
}

export function getBulkVideosApiEndpoint(role: "admin" | "creator"): string {
  // Admin은 /admin/videos/bulk, Creator는 /creator/videos/bulk 사용
  return role === "admin" ? "/admin/videos/bulk" : "/creator/videos/bulk";
}

export function getVideosListApiEndpoint(role: "admin" | "creator"): string {
  return role === "admin" ? "/admin/videos" : "/creator/videos";
}

export function getBatchUploadApiEndpoint(role: "admin" | "creator"): string {
  return role === "admin" ? "/admin/videos/batch" : "/creator/videos/batch";
}

export function getBatchDeleteApiEndpoint(role: "admin" | "creator"): string {
  return role === "admin" ? "/admin/videos/batch-delete" : "/creator/videos/batch-delete";
}
