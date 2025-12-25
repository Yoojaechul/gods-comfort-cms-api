// frontend/src/config.ts
// CMS API Base URL (배포/로컬 모두 여기 기준으로 통일)
// 환경변수 우선순위: VITE_CMS_API_BASE_URL > VITE_API_BASE_URL
// 프로덕션에서는 반드시 환경 변수를 설정해야 합니다.
// 
// 빌드 방법:
//   VITE_API_BASE_URL=https://api.godcomfortword.com npm run build
// 또는 .env.production 파일에 설정:
//   VITE_API_BASE_URL=https://api.godcomfortword.com
//
// 중요: API_BASE_URL은 반드시 SPA 호스팅 도메인과 다른 별도의 API 서버 주소여야 합니다.
// 예: SPA는 https://cms.godcomfortword.com, API는 https://api.godcomfortword.com

const getApiBase = (): string => {
  const env = import.meta.env;
  // vite.config.ts와 동일한 우선순위
  const apiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL || "";
  
  // 빈 문자열이 아닌 경우만 반환 (공백만 있어도 제거 후 확인)
  const trimmed = apiBase.trim();
  if (!trimmed) {
    // 프로덕션 빌드 시 환경 변수가 없으면 명확한 에러 메시지
    if (typeof window !== "undefined") {
      console.error(
        "[config] VITE_CMS_API_BASE_URL 또는 VITE_API_BASE_URL이 설정되지 않았습니다. " +
        "프로덕션에서는 API 서버의 base URL을 반드시 설정해야 합니다. " +
        "빌드 시 환경 변수를 설정하세요: VITE_API_BASE_URL=https://api.godcomfortword.com npm run build"
      );
    }
    return "";
  }
  
  // HTTP/HTTPS로 시작하는지 확인 (프로덕션 안전성)
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    if (typeof window !== "undefined") {
      console.error(
        "[config] API base URL은 http:// 또는 https://로 시작해야 합니다:",
        trimmed
      );
    }
    return ""; // 잘못된 형식이면 빈 문자열 반환하여 apiClient에서 에러 발생시키기
  }
  
  // ⚠️ SPA 호스팅 도메인을 가리키는 경우 차단
  // 빌드 타임과 런타임 모두에서 검증
  const apiHostname = (() => {
    try {
      return new URL(trimmed).hostname;
    } catch {
      return null;
    }
  })();

  if (apiHostname) {
    // SPA 호스팅 도메인 패턴 체크 (런타임 및 빌드 타임)
    if (apiHostname.includes("cms.godcomfortword.com") || 
        apiHostname === "cms.godcomfortword.com") {
      const errorMessage = 
        `API_BASE_URL cannot point to SPA hosting domain. ` +
        `Current value: ${trimmed}. ` +
        `Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL to a separate API server ` +
        `(e.g., https://api.godcomfortword.com). ` +
        `SPA hosting domain (${trimmed}) cannot serve API endpoints.`;
      
      console.error(`[config] ${errorMessage}`);
      
      // 런타임에서만 에러를 던짐 (빌드 타임에는 경고만)
      if (typeof window !== "undefined") {
        const currentHost = window.location.hostname;
        if (currentHost !== "localhost" && currentHost !== "127.0.0.1") {
          throw new Error(errorMessage);
        }
      }
    }
    
    // 런타임에서 현재 호스트와 동일한 경우도 차단
    if (typeof window !== "undefined") {
      const currentHost = window.location.hostname;
      if (apiHostname === currentHost && currentHost !== "localhost" && currentHost !== "127.0.0.1") {
        throw new Error(
          `API_BASE_URL cannot point to the same domain as the SPA (${currentHost}). ` +
          `Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL to a separate API server ` +
          `(e.g., https://api.godcomfortword.com). ` +
          `Current: ${trimmed}`
        );
      }
    }
  }
  
  return trimmed;
};

export const CMS_API_BASE: string = getApiBase();
