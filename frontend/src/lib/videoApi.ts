/**
 * 영상 관련 API 엔드포인트를 role에 따라 반환하는 helper 함수들
 */

/**
 * 영상 API의 기본 경로를 role에 따라 반환
 * @param role - 사용자 역할 ("admin" | "creator")
 * @returns API 기본 경로 (항상 "/videos" - 백엔드에서 권한은 JWT role로 처리)
 */
export function getVideoApiBasePath(role: "admin" | "creator"): string {
  // 관리자/크리에이터 모두 동일한 엔드포인트 사용 (권한은 JWT role로 서버에서 처리)
  return "/videos";
}

/**
 * 영상 생성/수정 API 엔드포인트 반환
 * @param role - 사용자 역할
 * @param videoId - 영상 ID (수정 시에만 필요)
 * @returns API 엔드포인트
 */
export function getVideoApiEndpoint(role: "admin" | "creator", videoId?: string): string {
  const basePath = getVideoApiBasePath(role);
  return videoId ? `${basePath}/${videoId}` : basePath;
}

/**
 * 영상 삭제 API 엔드포인트 반환
 * @param role - 사용자 역할
 * @param videoId - 영상 ID
 * @returns API 엔드포인트
 */
export function getVideoDeleteApiEndpoint(role: "admin" | "creator", videoId: string): string {
  // 관리자는 /admin/videos/:id, 크리에이터는 /videos/:id 사용
  if (role === "admin") {
    return `/admin/videos/${videoId}`;
  }
  return `/videos/${videoId}`;
}

/**
 * 대량 등록/편집 API 엔드포인트 반환
 * 관리자/크리에이터 모두 동일한 엔드포인트 사용 (권한은 JWT role로 서버에서 처리)
 * @param role - 사용자 역할 (사용되지 않음, 호환성을 위해 유지)
 * @returns API 엔드포인트
 */
export function getBulkVideosApiEndpoint(role: "admin" | "creator"): string {
  // 관리자/크리에이터 모두 동일한 엔드포인트 사용 (권한은 JWT role로 서버에서 처리)
  // #region agent log - 함수 호출 및 반환값 확인
  const endpoint = "/videos/bulk";
  console.log(`[getBulkVideosApiEndpoint] role=${role}, 반환값=${endpoint}`);
  fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'videoApi.ts:42',message:'getBulkVideosApiEndpoint 호출',data:{role,returnValue:endpoint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  return endpoint;
}

/**
 * 영상 목록 조회 API 엔드포인트 반환
 * @param role - 사용자 역할
 * @returns API 엔드포인트
 */
export function getVideosListApiEndpoint(role: "admin" | "creator"): string {
  return role === "admin" ? "/admin/videos" : "/videos";
}

/**
 * 배치 업로드 API 엔드포인트 반환
 * @param role - 사용자 역할
 * @returns API 엔드포인트
 */
export function getBatchUploadApiEndpoint(role: "admin" | "creator"): string {
  return role === "admin" ? "/admin/videos/batch" : "/videos/batch";
}

/**
 * 배치 삭제 API 엔드포인트 반환
 * @param role - 사용자 역할
 * @returns API 엔드포인트
 */
export function getBatchDeleteApiEndpoint(role: "admin" | "creator"): string {
  return role === "admin" ? "/admin/videos/batch-delete" : "/videos/batch-delete";
}

