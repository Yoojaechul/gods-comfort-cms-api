/**
 * CMS API 기본 URL 설정
 * 환경변수 우선순위: VITE_API_BASE_URL > VITE_CMS_API_BASE_URL > 기본값
 * 
 * 사용법:
 * 1. .env 파일에 추가: VITE_API_BASE_URL=http://localhost:8787
 * 2. 또는 환경변수로 설정: $env:VITE_API_BASE_URL="http://localhost:8787"
 * 3. 기본값: http://localhost:8787
 */

// 환경변수에서 값 확인
const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const envCmsApiBaseUrl = import.meta.env.VITE_CMS_API_BASE_URL;

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

// 기본값 (DEV 편의): http://localhost:8787
export const CMS_API_BASE = normalizeBaseUrl(
  envApiBaseUrl ||
    envCmsApiBaseUrl ||
    "http://localhost:8787" // 기본값 (DEV 편의). 운영에서는 env 사용 권장.
);

// 개발 환경에서 사용 중인 API Base URL 로그 출력
if (import.meta.env.DEV) {
  console.log("[config.ts] CMS_API_BASE 설정:", {
    VITE_API_BASE_URL: envApiBaseUrl || "(설정되지 않음)",
    VITE_CMS_API_BASE_URL: envCmsApiBaseUrl || "(설정되지 않음)",
    최종_사용_값: CMS_API_BASE,
    "⚠️ API Base URL이 비정상(빈 값/상대경로)처럼 보이면 Vite 서버 재시작 및 .env 확인하세요.": CMS_API_BASE ? "✅" : "❌",
  });
}

// 홈페이지 URL도 하드코딩 제거 (필요 시 .env로 주입)
export const HOME_URL = (import.meta.env.VITE_HOME_URL || "").trim();
