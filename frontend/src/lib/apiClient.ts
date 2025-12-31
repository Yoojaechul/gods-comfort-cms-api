// frontend/src/lib/apiClient.ts

/**
 * API Base URL을 가져옵니다.
 * Vite 환경 변수를 직접 사용하며, production에서는 기본값을 강제합니다.
 */
function getApiBase(): string {
  const env = import.meta.env;
  
  // 환경 변수에서 읽기
  let apiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL;
  
  // 환경 변수가 없거나 빈 문자열이면 기본값 사용 (production 안전성)
  if (!apiBase || String(apiBase).trim() === "") {
    apiBase = "https://api.godcomfortword.com";
  }
  
  const trimmed = String(apiBase).trim();
  
  // 빈 문자열 체크 (방어 로직)
  if (!trimmed) {
    return "https://api.godcomfortword.com";
  }
  
  // HTTP/HTTPS 체크
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    console.warn(`[apiClient] Invalid API base URL format, using default: ${trimmed}`);
    return "https://api.godcomfortword.com";
  }
  
  return trimmed;
}

/**
 * baseURL과 path를 안전하게 결합합니다.
 * baseURL이 없거나 잘못된 형식이면 에러를 던집니다 (상대 경로 요청 방지).
 * 
 * 단일 진실 원천(Single Source of Truth): 모든 API URL 결합은 이 함수만 사용합니다.
 */
export function buildUrl(baseUrl: string, path: string): string {
  if (!baseUrl || !baseUrl.trim()) {
    throw new Error(
      "API base URL is not configured. Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL environment variable. " +
      "Example: VITE_CMS_API_BASE_URL=https://api.godcomfortword.com npm run build"
    );
  }

  const trimmed = baseUrl.trim();
  
  // 절대 URL 형식인지 확인 (http:// 또는 https://로 시작해야 함)
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    throw new Error(
      `API base URL must be an absolute URL starting with http:// or https://. ` +
      `Current value: "${trimmed}". ` +
      `Please set VITE_CMS_API_BASE_URL to a valid API server URL.`
    );
  }

  // URL 파싱 검증
  try {
    const urlObj = new URL(trimmed);
    // 호스트가 있는지 확인
    if (!urlObj.hostname) {
      throw new Error(`API base URL has invalid hostname: ${trimmed}`);
    }
  } catch (e) {
    throw new Error(
      `API base URL is not a valid URL: "${trimmed}". ` +
      `Please set VITE_CMS_API_BASE_URL to a valid API server URL.`
    );
  }

  const cleanBase = trimmed.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * 공통 API 요청 함수
 */
export async function apiRequest(
  path: string,
  options: RequestInit = {}
) {
  const apiBase = getApiBase();
  
  if (!apiBase || !apiBase.trim()) {
    throw new Error(
      "API base URL is not configured. Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL environment variable."
    );
  }

  // path가 상대 경로인지 확인 (절대 경로는 허용하지 않음)
  if (path.startsWith("http://") || path.startsWith("https://")) {
    throw new Error(
      `apiRequest path must be relative (e.g., "/creator/videos"), not absolute URL. ` +
      `Received: "${path}". Use VITE_CMS_API_BASE_URL environment variable to configure the API server base URL.`
    );
  }

  const url = buildUrl(apiBase, path);

  // 디버깅을 위해 항상 requestUrl을 콘솔에 출력
  console.log(`[apiRequest] ${options.method || "GET"} ${url}`);

  // Get auth token from localStorage
  // 중요: Authorization 헤더는 항상 추가되어야 하므로 명시적으로 처리
  const token = localStorage.getItem("cms_token");
  
  // 기본 헤더 설정
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  // Authorization 헤더 추가 (토큰이 있으면 Bearer 토큰)
  if (token && token.trim().length > 0) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  
  // options.headers가 있으면 병합 (Authorization은 위에서 설정한 것을 우선시)
  if (options.headers) {
    Object.assign(headers, options.headers);
    // Authorization이 options.headers에 있었더라도 우리가 설정한 것을 다시 적용 (토큰이 있는 경우)
    if (token && token.trim().length > 0) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }
  }

  const response = await fetch(url, {
    credentials: "include",
    headers,
    ...options,
  });

  // Content-Type 확인: HTML 응답 감지
  const contentType = response.headers.get("content-type") || "";
  const isHtmlResponse = contentType.includes("text/html");

  // 응답 본문을 텍스트로 먼저 읽어서 HTML인지 확인 (response.json() 호출 전에)
  // response.text()를 한 번만 호출할 수 있으므로 먼저 읽어서 재사용
  const responseText = await response.text().catch(() => "");
  const isHtmlContent = responseText.trim().startsWith("<!DOCTYPE") || 
                        responseText.trim().startsWith("<!doctype") || 
                        responseText.trim().startsWith("<html");

  if (!response.ok) {
    // HTML 응답인 경우 (잘못된 API 엔드포인트로 요청한 경우)
    if (isHtmlResponse || isHtmlContent) {
      const errorMessage = `잘못된 API 엔드포인트입니다. API 서버 주소를 확인해주세요. (${response.status})`;
      // 네트워크 탭 확인용으로 console.error에 status/responseText/requestUrl 출력
      console.error(`[apiRequest Error] Received HTML instead of JSON. Status: ${response.status}, URL: ${url}, Response (HTML):`, responseText.substring(0, 500));
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      throw error;
    }
    
    // JSON 응답인 경우 - 상태 코드별로 사용자 친화적인 에러 메시지 생성
    let errorMessage = "";
    const status = response.status;
    
    if (status === 400) {
      // 400: 입력값/현재 비밀번호 확인 필요(서버 로그 확인 필요)
      if (responseText) {
        try {
          const json = JSON.parse(responseText);
          const serverMessage = json.message || json.error || "";
          if (serverMessage) {
            errorMessage = `${serverMessage} | URL: ${url} | 상태: ${status}`;
          } else {
            errorMessage = `입력값/현재 비밀번호 확인 필요 | URL: ${url} | 상태: ${status}`;
          }
        } catch {
          errorMessage = `입력값/현재 비밀번호 확인 필요 | URL: ${url} | 상태: ${status} | 응답: ${responseText.substring(0, 100)}`;
        }
      } else {
        errorMessage = `입력값/현재 비밀번호 확인 필요 | URL: ${url} | 상태: ${status}`;
      }
    } else if (status === 401) {
      // 401: 권한/인증 실패(로그인 상태 또는 토큰 확인)
      if (responseText) {
        try {
          const json = JSON.parse(responseText);
          const serverMessage = json.message || json.error || "";
          errorMessage = serverMessage ? `${serverMessage} | URL: ${url} | 상태: ${status}` : `권한/인증 실패 | URL: ${url} | 상태: ${status}`;
        } catch {
          errorMessage = `권한/인증 실패 | URL: ${url} | 상태: ${status} | 응답: ${responseText.substring(0, 100)}`;
        }
      } else {
        errorMessage = `권한/인증 실패 | URL: ${url} | 상태: ${status}`;
      }
    } else if (status === 404) {
      // 404: 요청한 리소스를 찾을 수 없음
      if (responseText) {
        try {
          const json = JSON.parse(responseText);
          const serverMessage = json.message || json.error || "";
          errorMessage = serverMessage || `요청한 리소스를 찾을 수 없습니다 (404)`;
        } catch {
          errorMessage = `요청한 리소스를 찾을 수 없습니다 (404)`;
        }
      } else {
        errorMessage = `요청한 리소스를 찾을 수 없습니다 (404)`;
      }
    } else if (status === 500) {
      // 500: 서버 내부 오류(Cloud Run 로그 확인 필요)
      if (responseText) {
        try {
          const json = JSON.parse(responseText);
          const serverMessage = json.message || json.error || "";
          errorMessage = serverMessage ? `${serverMessage} | URL: ${url} | 상태: ${status}` : `서버 내부 오류 | URL: ${url} | 상태: ${status}`;
        } catch {
          errorMessage = `서버 내부 오류 | URL: ${url} | 상태: ${status} | 응답: ${responseText.substring(0, 100)}`;
        }
      } else {
        errorMessage = `서버 내부 오류 | URL: ${url} | 상태: ${status}`;
      }
    } else {
      // 기타 상태 코드
      if (responseText) {
        try {
          const json = JSON.parse(responseText);
          const serverMessage = json.message || json.error || "";
          errorMessage = serverMessage ? `${serverMessage} | URL: ${url} | 상태: ${status}` : `${status} ${response.statusText} | URL: ${url}`;
        } catch {
          const cleanText = responseText.replace(/<[^>]*>/g, "").trim();
          if (cleanText.length > 0 && cleanText.length < 200) {
            errorMessage = `${cleanText} | URL: ${url} | 상태: ${status}`;
          } else {
            errorMessage = `${status} ${response.statusText} | URL: ${url}`;
          }
        }
      } else {
        errorMessage = `${status} ${response.statusText} | URL: ${url}`;
      }
    }
    
    // 네트워크 탭 확인용으로 console.error에 status/responseText/requestUrl 출력
    console.error(`[apiRequest Error] Status: ${status}, URL: ${url}, Response:`, responseText);
    
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    throw error;
  }

  // 204 No Content 대응
  if (response.status === 204) {
    return null;
  }

  // 성공 응답도 HTML인지 확인
  if (isHtmlResponse || isHtmlContent) {
    // HTML 응답은 잘못된 API 엔드포인트로 요청한 경우
    const errorMessage = `잘못된 API 엔드포인트입니다. API 서버 주소를 확인해주세요.`;
    console.error(`[apiRequest Error] Received HTML instead of JSON, URL: ${url}, Response (HTML):`, responseText.substring(0, 500));
    throw new Error(errorMessage);
  }

  // HTML이 아니면 JSON으로 파싱
  try {
    return JSON.parse(responseText);
  } catch (e) {
    // JSON 파싱 실패 시 에러 처리
    throw new Error(
      `Failed to parse JSON response. The API endpoint may be incorrect. ` +
      `Check that VITE_CMS_API_BASE_URL or VITE_API_BASE_URL is set to the correct API server. ` +
      `URL: ${url}`
    );
  }
}

/* === 편의 함수들 === */

export function apiGet(path: string) {
  return apiRequest(path, { method: "GET" });
}

export function apiPost(path: string, body?: unknown) {
  return apiRequest(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPut(path: string, body?: unknown) {
  return apiRequest(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete(path: string) {
  return apiRequest(path, { method: "DELETE" });
}









