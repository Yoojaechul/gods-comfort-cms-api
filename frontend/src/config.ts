// frontend/src/config.ts
// CMS API Base URL 유틸 함수
// 환경변수 우선순위: VITE_CMS_API_BASE_URL > VITE_API_BASE_URL
// 
// 중요: 프로덕션 배포 시 반드시 VITE_CMS_API_BASE_URL 환경 변수를 설정해야 합니다.
// 환경 변수가 없으면 기본값 https://api.godcomfortword.com을 사용합니다.
//
// 설정 방법:
//   .env.production 파일: VITE_CMS_API_BASE_URL=https://api.godcomfortword.com
//   또는 빌드 시: VITE_CMS_API_BASE_URL=https://api.godcomfortword.com npm run build
//
// 중요: API_BASE_URL은 반드시 SPA 호스팅 도메인과 다른 별도의 API 서버 주소여야 합니다.

// 기본값 (환경 변수가 없을 때 사용)
const DEFAULT_API_BASE = "https://api.godcomfortword.com";

/**
 * API Base URL을 가져옵니다.
 * Vite 환경 변수를 직접 사용하여 런타임에 결정됩니다.
 */
export function getApiBase(): string {
  const env = import.meta.env;
  // 환경 변수 우선순위: VITE_CMS_API_BASE_URL > VITE_API_BASE_URL
  const apiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL || DEFAULT_API_BASE;
  
  // 빈 문자열이 아닌 경우만 반환 (공백만 있어도 제거 후 확인)
  const trimmed = String(apiBase).trim();
  if (!trimmed) {
    return DEFAULT_API_BASE;
  }
  
  // HTTP/HTTPS로 시작하는지 확인 (프로덕션 안전성)
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    if (typeof window !== "undefined") {
      console.error(
        "[config] API base URL은 http:// 또는 https://로 시작해야 합니다:",
        trimmed
      );
    }
    return DEFAULT_API_BASE; // 잘못된 형식이면 기본값 사용
  }
  
  // ⚠️ SPA 호스팅 도메인을 가리키는 경우 차단 (런타임에서만 검증)
  if (typeof window !== "undefined") {
    const apiHostname = (() => {
      try {
        return new URL(trimmed).hostname;
      } catch {
        return null;
      }
    })();

    if (apiHostname) {
      const currentHost = window.location.hostname;
      
      // SPA 호스팅 도메인 패턴 체크
      if (apiHostname.includes("cms.godcomfortword.com") || 
          apiHostname === "cms.godcomfortword.com") {
        const errorMessage = 
          `API_BASE_URL cannot point to SPA hosting domain. ` +
          `Current value: ${trimmed}. ` +
          `Please set VITE_CMS_API_BASE_URL to a separate API server. ` +
          `SPA hosting domain (${trimmed}) cannot serve API endpoints.`;
        
        console.error(`[config] ${errorMessage}`);
        
        if (currentHost !== "localhost" && currentHost !== "127.0.0.1") {
          throw new Error(errorMessage);
        }
      }
      
      // 런타임에서 현재 호스트와 동일한 경우도 차단
      if (apiHostname === currentHost && currentHost !== "localhost" && currentHost !== "127.0.0.1") {
        throw new Error(
          `API_BASE_URL cannot point to the same domain as the SPA (${currentHost}). ` +
          `Please set VITE_CMS_API_BASE_URL to a separate API server. ` +
          `Current: ${trimmed}`
        );
      }
    }
  }
  
  return trimmed;
}
