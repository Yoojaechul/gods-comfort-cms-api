/**
 * Facebook SDK 로드 유틸리티
 * SDK를 한 번만 로드하고 재사용
 */

import { getApiBase } from "../config";

const STORAGE_TOKEN_KEY = "cms_token";

declare global {
  interface Window {
    FB?: {
      XFBML: {
        parse: (container?: HTMLElement | Document) => void;
      };
      init: (config: any) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let sdkLoadingPromise: Promise<boolean> | null = null;
let sdkLoaded = false;
let sdkInitSuccess = false;

/**
 * Facebook AppId를 API에서 가져옵니다
 * /my/facebook-keys 시도 → 실패 시 /admin/facebook-keys fallback
 * @returns Promise<string | null> - appId 또는 null
 */
async function fetchFacebookAppId(): Promise<string | null> {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  if (!token) {
    console.warn("[facebookSdk] 토큰이 없어 Facebook AppId를 가져올 수 없습니다.");
    return null;
  }

  const apiBase = getApiBase();

  // 1. /my/facebook-keys 시도
  try {
    const response = await fetch(`${apiBase}/my/facebook-keys`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      const keys = data?.keys || (Array.isArray(data) ? data : []);
      const firstKey = keys[0] || keys;
      const appId = firstKey?.app_id || firstKey?.appId;
      if (appId && typeof appId === "string" && appId.trim()) {
        return appId.trim();
      }
    }
  } catch (error) {
    // 401/403/404 등의 오류는 fallback으로 진행
    console.log("[facebookSdk] /my/facebook-keys 실패, /admin/facebook-keys 시도:", error);
  }

  // 2. /admin/facebook-keys fallback 시도
  try {
    const response = await fetch(`${apiBase}/admin/facebook-keys`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      const keys = data?.keys || (Array.isArray(data) ? data : []);
      const firstKey = keys[0] || keys;
      const appId = firstKey?.app_id || firstKey?.appId;
      if (appId && typeof appId === "string" && appId.trim()) {
        return appId.trim();
      }
    }
  } catch (error) {
    console.warn("[facebookSdk] /admin/facebook-keys도 실패:", error);
  }

  return null;
}

/**
 * Facebook SDK를 로드하고 초기화합니다 (한 번만)
 * @returns Promise<boolean> - SDK 초기화 성공 여부 (true: 성공, false: appId 없음)
 */
export function loadFacebookSDK(): Promise<boolean> {
  // 이미 로드되었으면 즉시 resolve
  if (sdkLoaded && window.FB) {
    return Promise.resolve(sdkInitSuccess);
  }

  // 이미 로딩 중이면 기존 Promise 반환
  if (sdkLoadingPromise) {
    return sdkLoadingPromise;
  }

  // SDK 로드 시작
  sdkLoadingPromise = new Promise<boolean>((resolve) => {
    // fb-root div가 없으면 생성
    if (!document.getElementById("fb-root")) {
      const fbRoot = document.createElement("div");
      fbRoot.id = "fb-root";
      document.body.appendChild(fbRoot);
    }

    // 이미 SDK 스크립트가 있으면 제거하고 다시 로드
    const existingScript = document.getElementById("facebook-jssdk");
    if (existingScript) {
      existingScript.remove();
    }

    // fbAsyncInit 콜백 설정
    window.fbAsyncInit = async () => {
      if (window.FB) {
        // API에서 appId 가져오기
        const appId = await fetchFacebookAppId();

        // FB.init 설정
        const initConfig: any = {
          xfbml: true,
          version: "v19.0",
        };

        if (appId) {
          initConfig.appId = appId;
          sdkInitSuccess = true;
        } else {
          console.warn(
            "[facebookSdk] Facebook AppId를 찾을 수 없습니다. " +
            "Facebook 임베드가 제대로 작동하지 않을 수 있습니다. " +
            "Facebook Keys 설정 페이지에서 AppId를 확인하세요."
          );
          sdkInitSuccess = false;
        }

        // SDK 초기화
        window.FB.init(initConfig);
        sdkLoaded = true;
        resolve(sdkInitSuccess);
      } else {
        console.error("[facebookSdk] Facebook SDK 로드 실패: window.FB가 없습니다.");
        sdkInitSuccess = false;
        resolve(false);
      }
    };

    // SDK 스크립트 로드
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/ko_KR/sdk.js#xfbml=1&version=v19.0";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";

    script.onerror = () => {
      console.error("[facebookSdk] Facebook SDK 스크립트 로드 실패");
      sdkInitSuccess = false;
      resolve(false);
    };

    document.body.appendChild(script);
  });

  return sdkLoadingPromise;
}

/**
 * Facebook SDK가 초기화되었는지 확인하고 필요시 로드합니다
 * @returns Promise<boolean> - SDK 초기화 성공 여부
 */
export async function ensureFacebookSdkInitialized(): Promise<boolean> {
  if (sdkLoaded && window.FB) {
    return sdkInitSuccess;
  }
  return await loadFacebookSDK();
}

/**
 * Facebook XFBML을 파싱합니다
 * @param container - 파싱할 컨테이너 요소 (없으면 전체 문서)
 */
export function parseXFBML(container?: HTMLElement): void {
  // 안전장치: window.FB 존재 여부 확인
  if (!window || !window.FB) {
    console.warn("[facebookSdk] window.FB가 없습니다. loadFacebookSDK()를 먼저 호출하세요.");
    return;
  }

  // 안전장치: XFBML 객체 확인
  if (!window.FB.XFBML) {
    console.warn("[facebookSdk] window.FB.XFBML이 없습니다.");
    return;
  }

  // 안전장치: parse 함수 확인
  if (typeof window.FB.XFBML.parse !== "function") {
    console.warn("[facebookSdk] window.FB.XFBML.parse가 함수가 아닙니다.");
    return;
  }

  try {
    const target = container || document;
    window.FB.XFBML.parse(target);
    console.log("[facebookSdk] XFBML 파싱 완료");
  } catch (error) {
    console.error("[facebookSdk] XFBML 파싱 실패:", error);
    throw error; // 호출자가 에러를 처리할 수 있도록 re-throw
  }
}


