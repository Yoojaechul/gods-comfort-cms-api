// frontend/src/lib/videoApi.ts

/**
 * 영상 관련 API 엔드포인트를 role에 따라 반환하는 helper 함수들
 */

export function getVideoApiBasePath(role: "admin" | "creator"): string {
  // 관리자/크리에이터 모두 동일한 엔드포인트 사용 (권한은 JWT role로 서버에서 처리)
  return "/videos";
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
  // 관리자는 /admin/videos/:id, 크리에이터는 /videos/:id 사용
  if (role === "admin") {
    return `/admin/videos/${videoId}`;
  }
  return `/videos/${videoId}`;
}

export function getBulkVideosApiEndpoint(role: "admin" | "creator"): string {
  // 관리자/크리에이터 모두 동일한 엔드포인트 사용
  return "/videos/bulk";
}

export function getVideosListApiEndpoint(role: "admin" | "creator"): string {
  return role === "admin" ? "/admin/videos" : "/videos";
}

export function getBatchUploadApiEndpoint(role: "admin" | "creator"): string {
  return role === "admin" ? "/admin/videos/batch" : "/videos/batch";
}

export function getBatchDeleteApiEndpoint(role: "admin" | "creator"): string {
  return role === "admin" ? "/admin/videos/batch-delete" : "/videos/batch-delete";
}
