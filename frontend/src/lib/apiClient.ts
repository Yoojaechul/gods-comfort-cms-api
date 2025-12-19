// frontend/src/lib/apiClient.ts
import { CMS_API_BASE } from "../config";

type JsonValue = any;

function normalizePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function buildUrl(path: string): string {
  return `${CMS_API_BASE}${normalizePath(path)}`;
}

function getAuthHeaders(auth: boolean = true): Record<string, string> {
  if (!auth) return {};
  const token = localStorage.getItem("cms_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse<T = JsonValue>(res: Response): Promise<T> {
  const text = await res.text().catch(() => "");
  try {
    return (text ? JSON.parse(text) : ({} as any)) as T;
  } catch {
    return text as any;
  }
}

async function request<T = JsonValue>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: any,
  options: { auth?: boolean; isFormData?: boolean } = {}
): Promise<T> {
  const url = buildUrl(path);

  const headers: Record<string, string> = {
    ...getAuthHeaders(options.auth ?? true),
  };

  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    if (options.isFormData) {
      init.body = body; // FormData는 Content-Type 지정 금지
    } else {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const error = new Error(
      `[apiClient] ${method} ${url} failed: ${res.status} ${res.statusText}${errText ? ` | ${errText}` : ""}`
    );
    (error as any).status = res.status;
    throw error;
  }

  return await parseResponse<T>(res);
}

// ✅ AuthContext.tsx가 사용
export async function apiGet<T = JsonValue>(
  path: string,
  options: { auth?: boolean } = {}
): Promise<T> {
  return request<T>("GET", path, undefined, options);
}

export async function apiPost<T = JsonValue>(
  path: string,
  body?: any,
  options: { auth?: boolean; isFormData?: boolean } = {}
): Promise<T> {
  return request<T>("POST", path, body, options);
}

// 선택
export async function apiPut<T = JsonValue>(path: string, body?: any): Promise<T> {
  return request<T>("PUT", path, body);
}

export async function apiDelete<T = JsonValue>(
  path: string,
  options: { auth?: boolean } = {}
): Promise<T> {
  return request<T>("DELETE", path, undefined, options);
}

/**
 * 썸네일 업로드
 * @param file - 업로드할 파일
 * @param role - 사용자 역할 ("admin" | "creator")
 * @returns 업로드된 썸네일 URL 정보
 */
export async function uploadThumbnail(
  file: File,
  role: "admin" | "creator"
): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  // role에 따라 엔드포인트 결정
  const endpoint = role === "admin" 
    ? "/admin/uploads/thumbnail" 
    : "/uploads/thumbnail";

  return apiPost<{ url: string }>(endpoint, formData, {
    auth: true,
    isFormData: true,
  });
}
