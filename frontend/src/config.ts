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

// 기본값 (운영 환경에서 환경 변수가 없을 때 사용)
const DEFAULT_API_BASE = "https://api.godcomfortword.com";
// 개발 환경용 기본값 (DEV일 때만 사용)
const DEV_DEFAULT_API_BASE = "http://localhost:8787";

/**
 * API Base URL을 가져옵니다.
 * Vite 환경 변수를 직접 사용하여 런타임에 결정됩니다.
 * 
 * 우선순위: VITE_CMS_API_BASE_URL > VITE_API_BASE_URL > 환경별 기본값
 * - 운영 환경(PROD): 환경 변수가 없으면 DEFAULT_API_BASE 사용 (또는 에러 throw)
 * - 개발 환경(DEV): 환경 변수가 없으면 DEV_DEFAULT_API_BASE 사용
 */
export function getApiBase(): string {
  const env = import.meta.env;
  const isProd = env.PROD;
  const isDev = env.DEV;
  
  // 환경 변수 우선순위: VITE_CMS_API_BASE_URL > VITE_API_BASE_URL
  const envApiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL;
  
  // 환경 변수가 있는 경우
  if (envApiBase && String(envApiBase).trim()) {
    const trimmed = String(envApiBase).trim();
    
    // HTTP/HTTPS로 시작하는지 확인
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      if (typeof window !== "undefined") {
        console.error(
          "[config] API base URL은 http:// 또는 https://로 시작해야 합니다:",
          trimmed
        );
      }
      // 잘못된 형식이면 환경별 기본값 사용
      return isDev ? DEV_DEFAULT_API_BASE : DEFAULT_API_BASE;
    }
    
    const finalApiBase = trimmed;
    
    // ⚠️ SPA 호스팅 도메인을 가리키는 경우 차단 (런타임에서만 검증)
    if (typeof window !== "undefined") {
      const apiHostname = (() => {
        try {
          return new URL(finalApiBase).hostname;
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
            `Current value: ${finalApiBase}. ` +
            `Please set VITE_CMS_API_BASE_URL to a separate API server. ` +
            `SPA hosting domain (${finalApiBase}) cannot serve API endpoints.`;
          
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
            `Current: ${finalApiBase}`
          );
        }
      }
    }
    
    return finalApiBase;
  }
  
  // 환경 변수가 없는 경우
  let finalApiBase: string;
  if (isProd) {
    // 운영 환경에서는 환경 변수가 필수
    // 기본값을 사용하거나 에러를 throw (빌드 단계에서 잡히도록)
    const errorMessage = 
      `[config] Production 환경에서 VITE_CMS_API_BASE_URL 또는 VITE_API_BASE_URL이 설정되지 않았습니다. ` +
      `기본값 ${DEFAULT_API_BASE}을 사용합니다. ` +
      `빌드 시 환경 변수를 설정하세요: VITE_CMS_API_BASE_URL=https://api.godcomfortword.com npm run build`;
    
    if (typeof window !== "undefined") {
      console.warn(errorMessage);
    } else {
      // 빌드 타임에만 에러 throw (런타임에서는 기본값 사용)
      console.warn(errorMessage);
    }
    
    finalApiBase = DEFAULT_API_BASE;
  } else {
    // 개발 환경에서는 localhost fallback 허용
    finalApiBase = DEV_DEFAULT_API_BASE;
  }
  
  // ⚠️ SPA 호스팅 도메인을 가리키는 경우 차단 (런타임에서만 검증)
  if (typeof window !== "undefined") {
    const apiHostname = (() => {
      try {
        return new URL(finalApiBase).hostname;
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
          `Current value: ${finalApiBase}. ` +
          `Please set VITE_CMS_API_BASE_URL to a separate API server. ` +
          `SPA hosting domain (${finalApiBase}) cannot serve API endpoints.`;
        
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
          `Current: ${finalApiBase}`
        );
      }
    }
  }
  
  return finalApiBase;
}

/**
 * Asset URL 해석 함수
 * - path가 http:// 또는 https://로 시작하면 그대로 사용
 * - 그 외(예: /uploads/...)면 API_BASE_URL + path로 결합
 * - baseURL 끝 슬래시 제거, path 앞 슬래시 보정
 * 
 * @param path - 상대 경로 또는 절대 URL
 * @returns 절대 URL 또는 null (실패 시)
 */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path || !path.trim()) return null;

  const trimmed = path.trim();

  // http:// 또는 https://로 시작하는 경우
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    // localhost 또는 127.0.0.1인 경우 API_BASE_URL로 치환
    try {
      const urlObj = new URL(trimmed);
      const hostname = urlObj.hostname;
      
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        const apiBaseUrl = getApiBase();
        
        // base URL 끝의 슬래시 제거
        const normalizedBase = String(apiBaseUrl).trim().replace(/\/+$/, "");
        // 경로와 쿼리, 해시는 유지
        const pathAndQuery = urlObj.pathname + urlObj.search + urlObj.hash;
        return `${normalizedBase}${pathAndQuery}`;
      }
    } catch {
      // URL 파싱 실패 시 그대로 반환
    }
    
    // localhost가 아닌 경우 그대로 사용
    return trimmed;
  }

  // 그 외의 경우 API_BASE_URL + path로 결합
  const apiBaseUrl = getApiBase();
  
  // base URL 끝의 슬래시 제거
  const normalizedBase = String(apiBaseUrl).trim().replace(/\/+$/, "");
  // path 앞 슬래시 보정 (없으면 추가)
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  
  return `${normalizedBase}${normalizedPath}`;
}
