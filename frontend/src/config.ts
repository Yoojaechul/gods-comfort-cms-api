// frontend/src/config.ts

const RAW_BASE = import.meta.env.VITE_CMS_API_BASE_URL as string | undefined;

/**
 * 기대 입력값 예:
 * - https://api-yzoxeedpua-uc.a.run.app
 * - https://api-yzoxeedpua-uc.a.run.app/
 * - https://api-yzoxeedpua-uc.a.run.app/api
 *
 * 결과는 항상:
 * - https://api-yzoxeedpua-uc.a.run.app
 * (※ 여기서는 /api 를 붙이지 않습니다. 백엔드가 /auth/login 형태이기 때문)
 */
export const CMS_API_BASE = (() => {
  if (!RAW_BASE || !RAW_BASE.trim()) {
    throw new Error("VITE_CMS_API_BASE_URL is not defined");
  }

  const base = RAW_BASE.trim()
    .replace(/\/+$/, "")     // 끝의 /
    .replace(/\/api$/, "");  // 끝이 /api 면 제거

  return base; // ✅ /api 붙이지 않음
})();
