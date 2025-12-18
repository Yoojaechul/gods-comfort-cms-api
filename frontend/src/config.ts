/**
 * CMS API 기본 URL 설정
 * 운영(Firebase)에서는 반드시 VITE_CMS_API_BASE_URL 사용
 */

// 운영용 API Base (fallback 금지)
export const CMS_API_BASE = (() => {
  const url = import.meta.env.VITE_CMS_API_BASE_URL;

  if (!url) {
    throw new Error(
      "[config.ts] VITE_CMS_API_BASE_URL is not defined. " +
        "운영 환경에서는 반드시 frontend/.env.production에 설정되어야 합니다."
    );
  }

  return url.endsWith("/") ? url.slice(0, -1) : url;
})();

// (선택) 홈 URL
export const HOME_URL = (import.meta.env.VITE_HOME_URL || "").trim();
