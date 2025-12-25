// frontend/src/lib/apiClient.ts
import { CMS_API_BASE } from "../config";

/**
 * baseURL과 path를 안전하게 결합합니다.
 * baseURL이 없거나 잘못된 형식이면 에러를 던집니다 (상대 경로 요청 방지).
 */
function buildUrl(baseUrl: string, path: string): string {
  if (!baseUrl || !baseUrl.trim()) {
    throw new Error(
      "CMS_API_BASE is not configured. Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL environment variable. " +
      "Example: VITE_API_BASE_URL=https://api.godcomfortword.com npm run build"
    );
  }

  const trimmed = baseUrl.trim();
  
  // 절대 URL 형식인지 확인 (http:// 또는 https://로 시작해야 함)
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    throw new Error(
      `CMS_API_BASE must be an absolute URL starting with http:// or https://. ` +
      `Current value: "${trimmed}". ` +
      `Please set VITE_API_BASE_URL to a valid API server URL (e.g., https://api.godcomfortword.com).`
    );
  }

  // URL 파싱 검증
  try {
    const urlObj = new URL(trimmed);
    // 호스트가 있는지 확인
    if (!urlObj.hostname) {
      throw new Error(`CMS_API_BASE has invalid hostname: ${trimmed}`);
    }
  } catch (e) {
    throw new Error(
      `CMS_API_BASE is not a valid URL: "${trimmed}". ` +
      `Please set VITE_API_BASE_URL to a valid API server URL (e.g., https://api.godcomfortword.com).`
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
  if (!CMS_API_BASE || !CMS_API_BASE.trim()) {
    throw new Error(
      "API base URL is not configured. Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL environment variable."
    );
  }

  // path가 상대 경로인지 확인 (절대 경로는 허용하지 않음)
  if (path.startsWith("http://") || path.startsWith("https://")) {
    throw new Error(
      `apiRequest path must be relative (e.g., "/creator/videos"), not absolute URL. ` +
      `Received: "${path}". Use CMS_API_BASE environment variable to configure the API server base URL.`
    );
  }

  const url = buildUrl(CMS_API_BASE, path);

  // Get auth token from localStorage if available
  const token = localStorage.getItem("cms_token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

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
    // HTML 응답인 경우 (404 Not Found로 HTML이 반환된 경우)
    if (isHtmlResponse || isHtmlContent) {
      const errorMessage = 
        `API endpoint mismatch: Received HTML instead of JSON. ` +
        `The API_BASE_URL (${CMS_API_BASE}) may be pointing to the SPA hosting domain instead of the API server. ` +
        `Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL to the correct API server URL (e.g., https://api.godcomfortword.com). ` +
        `Status: ${response.status}, Requested URL: ${url}`;
      throw new Error(errorMessage);
    }
    
    // JSON 응답인 경우
    let errorMessage = `${response.status} ${response.statusText}`;
    if (responseText) {
      try {
        const json = JSON.parse(responseText);
        errorMessage = json.message || json.error || errorMessage;
      } catch {
        // JSON 파싱 실패 시 텍스트 사용 (짧은 경우만)
        const cleanText = responseText.replace(/<[^>]*>/g, "").trim();
        if (cleanText.length > 0 && cleanText.length < 200) {
          errorMessage = cleanText;
        }
      }
    }
    
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
    // HTML 응답은 잘못된 API_BASE_URL 설정을 의미
    const errorMessage = 
      `API endpoint mismatch: Received HTML instead of JSON. ` +
      `The API_BASE_URL (${CMS_API_BASE}) may be pointing to the SPA hosting domain instead of the API server. ` +
      `Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL to the correct API server URL (e.g., https://api.godcomfortword.com). ` +
      `Requested URL: ${url}`;
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




