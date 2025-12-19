// frontend/src/config.ts
export const CMS_API_BASE = (import.meta.env.VITE_CMS_API_BASE_URL || "").replace(/\/+$/, "");

// 필요하면 다른 값들도 유지
export const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
export const FIREBASE_AUTH_DOMAIN = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
export const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID;
export const FIREBASE_APP_ID = import.meta.env.VITE_FIREBASE_APP_ID;

// 배포 확인용(나중에 제거 가능)
console.log("[config] CMS_API_BASE =", CMS_API_BASE);
