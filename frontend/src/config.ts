// frontend/src/config.ts
// CMS API Base URL (배포/로컬 모두 여기 기준으로 통일)
// 환경변수 우선순위: VITE_CMS_API_BASE_URL > VITE_API_BASE_URL
// 
// 중요: 프로덕션 배포 시 반드시 VITE_API_BASE_URL 환경 변수를 설정해야 합니다.
// 환경 변수가 없으면 임시 fallback으로 Cloud Run URL을 사용하되 콘솔 경고를 출력합니다.
//
// 설정 방법:
//   .env.production 파일: VITE_API_BASE_URL=https://api.godcomfortword.com
//   또는 빌드 시: VITE_API_BASE_URL=https://api.godcomfortword.com npm run build
//
// 중요: API_BASE_URL은 반드시 SPA 호스팅 도메인과 다른 별도의 API 서버 주소여야 합니다.

// 임시 fallback (환경 변수가 없을 때만 사용, 콘솔 경고와 함께)
const FALLBACK_API_BASE = "https://cms-api-388547952090.asia-northeast3.run.app";

const getApiBase = (): string => {
  const env = import.meta.env;
  // 환경 변수 우선순위: VITE_CMS_API_BASE_URL > VITE_API_BASE_URL
  const apiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL || "";
  
  // 빈 문자열이 아닌 경우만 반환 (공백만 있어도 제거 후 확인)
  const trimmed = apiBase.trim();
  if (!trimmed) {
    // 환경 변수가 없으면 임시 fallback 사용 (콘솔 경고와 함께)
    if (typeof window !== "undefined") {
      const isProduction = window.location.hostname !== "localhost" && 
                           window.location.hostname !== "127.0.0.1";
      if (isProduction) {
        console.warn(
          "[config] ⚠️ VITE_API_BASE_URL 환경 변수가 설정되지 않았습니다. " +
          "임시로 Cloud Run 서비스를 사용합니다:",
          FALLBACK_API_BASE,
          "\n프로덕션 배포 시 반드시 .env.production 파일에 VITE_API_BASE_URL을 설정하세요."
        );
      }
    }
    return FALLBACK_API_BASE;
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
        `Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL to a separate API server. ` +
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
          `Please set VITE_CMS_API_BASE_URL or VITE_API_BASE_URL to a separate API server. ` +
          `Current: ${trimmed}`
        );
      }
    }
  }
  
  return trimmed;
};

export const CMS_API_BASE: string = getApiBase();
