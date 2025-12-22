// frontend/src/lib/apiClient.ts

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function getBaseUrl() {
  const base =
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_CMS_API_BASE_URL ||
    "http://localhost:8787";

  return String(base).replace(/\/+$/, "");
}

export const API_BASE_URL = getBaseUrl();

export async function apiRequest<T>(
  path: string,
  options: {
    method?: HttpMethod;
    headers?: Record<string, string>;
    body?: any;
    token?: string;
  } = {}
): Promise<T> {
  const method = options.method ?? "GET";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const url = `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text().catch(() => "");
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) || text || `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* =========================
   ✅ 기존 코드 호환용 export
   ========================= */

export function apiGet<T>(path: string, token?: string) {
  return apiRequest<T>(path, { method: "GET", token });
}

export function apiPost<T>(path: string, body?: any, token?: string) {
  return apiRequest<T>(path, { method: "POST", body, token });
}

export function apiDelete<T>(path: string, token?: string) {
  return apiRequest<T>(path, { method: "DELETE", token });
}