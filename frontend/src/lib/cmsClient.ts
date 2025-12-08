import { CMS_API_BASE } from "../config";

// 헤더 빌더 함수
function buildHeaders(options: { auth?: boolean; isFormData?: boolean } = {}) {
  const headers: HeadersInit = {};

  // FormData인 경우 Content-Type을 설정하지 않음 (브라우저가 자동으로 boundary 추가)
  if (!options.isFormData) {
    headers["Content-Type"] = "application/json";
  }

  // 인증 토큰 추가
  if (options.auth) {
    const token = localStorage.getItem("cms_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return headers;
}

// 썸네일 업로드 함수
export async function uploadThumbnail(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);

  // 인증 토큰 가져오기
  const token = localStorage.getItem("cms_token");
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${CMS_API_BASE}/admin/uploads/thumbnail`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!res.ok) {
    throw new Error(`thumbnail upload failed: ${res.status}`);
  }

  const data = await res.json();
  console.log("thumbnail upload response:", data);
  return { url: data.url as string };
}


