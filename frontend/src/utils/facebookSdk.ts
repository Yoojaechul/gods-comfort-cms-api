/**
 * Facebook SDK 로드 유틸리티
 * SDK를 한 번만 로드하고 재사용
 */

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

let sdkLoadingPromise: Promise<void> | null = null;
let sdkLoaded = false;

/**
 * Facebook SDK를 로드합니다 (한 번만)
 * @returns Promise<void> - SDK 로드 완료 시 resolve
 */
export function loadFacebookSDK(): Promise<void> {
  // 이미 로드되었으면 즉시 resolve
  if (sdkLoaded && window.FB) {
    return Promise.resolve();
  }

  // 이미 로딩 중이면 기존 Promise 반환
  if (sdkLoadingPromise) {
    return sdkLoadingPromise;
  }

  // SDK 로드 시작
  sdkLoadingPromise = new Promise((resolve, reject) => {
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
    window.fbAsyncInit = () => {
      if (window.FB) {
        // SDK 초기화 (필요한 경우)
        window.FB.init({
          xfbml: true,
          version: "v19.0",
        });
        sdkLoaded = true;
        resolve();
      } else {
        reject(new Error("Facebook SDK 로드 실패: window.FB가 없습니다."));
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
      reject(new Error("Facebook SDK 스크립트 로드 실패"));
    };

    document.body.appendChild(script);
  });

  return sdkLoadingPromise;
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


