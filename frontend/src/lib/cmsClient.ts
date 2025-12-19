// frontend/src/lib/cmsClient.ts
// 하위 호환성 유지용 (기존 코드가 cmsClient를 import해도 동작하게)
// 신규 코드는 가능하면 apiClient.ts를 직접 사용하세요.

export { uploadThumbnail, apiGet, apiPost, apiPut, apiDelete } from "./apiClient";
