import { CMS_API_BASE } from "../config";

/**
 * API 클라이언트 유틸리티
 * 모든 API 요청을 통합 관리
 */

// 토큰 가져오기
function getToken(): string | null {
  return localStorage.getItem("cms_token");
}

// 기본 헤더 생성
function buildHeaders(options: { auth?: boolean; isFormData?: boolean } = {}): HeadersInit {
  const headers: HeadersInit = {};

  // FormData인 경우 Content-Type을 설정하지 않음 (브라우저가 자동으로 boundary 추가)
  // 주의: FormData를 사용할 때도 Authorization 헤더는 명시적으로 추가해야 함
  if (!options.isFormData) {
    headers["Content-Type"] = "application/json";
  }

  // 인증 토큰 추가
  // auth 옵션이 명시적으로 false가 아닌 경우 (true이거나 undefined) 토큰 자동 추가
  // 모든 보호된 API 요청에 토큰이 있으면 자동으로 포함
  // FormData를 사용할 때도 Authorization 헤더는 포함됨
  if (options.auth !== false) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      console.warn("[apiClient] Authorization 토큰이 없습니다. localStorage에서 'cms_token'을 확인하세요.");
    }
  }

  return headers;
}

// API 응답 처리
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `HTTP ${response.status}: ${response.statusText}`,
    }));
    const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
    const error = new Error(errorMessage);
    // 상태 코드를 에러 객체에 포함 (401/403/404 구분용)
    (error as any).status = response.status;
    throw error;
  }
  return response.json();
}

// 네트워크 에러 확인 및 처리
function handleNetworkError(error: unknown, url: string): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // ERR_CONNECTION_REFUSED, Failed to fetch 등의 네트워크 에러 감지
  if (
    errorMessage.includes("ERR_CONNECTION_REFUSED") ||
    errorMessage.includes("Failed to fetch") ||
    errorMessage.includes("NetworkError") ||
    errorMessage.includes("Network request failed") ||
    (error instanceof TypeError && errorMessage.includes("fetch"))
  ) {
    const friendlyError = new Error(
      `백엔드 서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.`
    );
    (friendlyError as any).isNetworkError = true;
    (friendlyError as any).status = 0; // 네트워크 에러는 상태 코드가 없음
    throw friendlyError;
  }
  
  // 기타 에러는 그대로 전달
  throw error;
}

/**
 * GET 요청
 */
export async function apiGet<T>(
  endpoint: string,
  options: { auth?: boolean } = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${CMS_API_BASE}${endpoint}`;
  
  // 개발 환경에서 API 호출 URL 로그 출력
  if (import.meta.env.DEV) {
    console.log(`[apiGet] API 호출: ${url}`, {
      endpoint,
      CMS_API_BASE,
      fullUrl: url,
    });
  }
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders({ auth: options.auth }),
    });
    return handleResponse<T>(response);
  } catch (error) {
    handleNetworkError(error, url);
  }
}

/**
 * POST 요청
 */
export async function apiPost<T>(
  endpoint: string,
  data?: any,
  options: { auth?: boolean; isFormData?: boolean } = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${CMS_API_BASE}${endpoint}`;
  const body = options.isFormData ? data : JSON.stringify(data);
  const headers = buildHeaders({ auth: options.auth, isFormData: options.isFormData });
  
  // FormData 사용 시 헤더 디버깅 로그 (개발 환경에서만)
  if (options.isFormData && process.env.NODE_ENV === "development") {
    console.log(`[apiPost] FormData 요청: ${endpoint}`, {
      hasAuthorization: !!headers["Authorization"],
      headers: Object.keys(headers),
    });
  }
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      credentials: "include", // CORS credentials 지원
    });
    return handleResponse<T>(response);
  } catch (error) {
    handleNetworkError(error, url);
  }
}

/**
 * PUT 요청
 */
export async function apiPut<T>(
  endpoint: string,
  data?: any,
  options: { auth?: boolean } = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${CMS_API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: buildHeaders({ auth: options.auth }),
      body: JSON.stringify(data),
      credentials: "include", // CORS credentials 지원
    });
    return handleResponse<T>(response);
  } catch (error) {
    handleNetworkError(error, url);
  }
}

/**
 * PATCH 요청
 */
export async function apiPatch<T>(
  endpoint: string,
  data?: any,
  options: { auth?: boolean } = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${CMS_API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: buildHeaders({ auth: options.auth }),
      body: JSON.stringify(data),
    });
    return handleResponse<T>(response);
  } catch (error) {
    handleNetworkError(error, url);
  }
}

/**
 * DELETE 요청
 */
export async function apiDelete<T>(
  endpoint: string,
  options: { auth?: boolean } = {}
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${CMS_API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: buildHeaders({ auth: options.auth }),
      credentials: "include", // CORS credentials 지원
    });
    return handleResponse<T>(response);
  } catch (error) {
    handleNetworkError(error, url);
  }
}

/**
 * 썸네일 업로드 (FormData 전용)
 * 관리자는 /admin/uploads/thumbnail, 크리에이터는 /uploads/thumbnail 사용
 * @param file - 업로드할 파일
 * @param role - 사용자 역할 ("admin" | "creator"). 기본값은 "admin"
 * @returns 업로드된 썸네일 URL 또는 null (실패 시)
 */
export async function uploadThumbnail(
  file: File,
  role: "admin" | "creator" = "admin"
): Promise<{ url: string } | null> {
  const form = new FormData();
  form.append("file", file);
  
  // role에 따라 엔드포인트 결정
  const endpoint = role === "admin" 
    ? "/admin/uploads/thumbnail" 
    : "/uploads/thumbnail";
  
  try {
    // Authorization 헤더가 포함되도록 auth: true, isFormData: true 명시
    // apiPost 내부에서 buildHeaders가 Authorization 헤더를 자동으로 추가함
    const result = await apiPost<{ url: string }>(endpoint, form, {
      auth: true, // Authorization 헤더 포함
      isFormData: true, // FormData 사용 (Content-Type은 브라우저가 자동 설정)
    });
    
    if (result && result.url) {
      return result;
    }
  } catch (err) {
    // 업로드 실패 시 null 반환 (에러를 throw하지 않음)
    console.warn(`썸네일 업로드 실패 (${endpoint}):`, err instanceof Error ? err.message : err);
    return null;
  }
  
  return null;
}
















































