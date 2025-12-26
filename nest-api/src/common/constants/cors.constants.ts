/**
 * CORS 허용 Origin 목록
 * main.ts와 Exception Filter에서 공통으로 사용
 */
export const ALLOWED_ORIGINS = [
  // 운영 도메인 (필수)
  'https://cms.godcomfortword.com',
  'https://gods-comfort-word-cms.web.app',

  // 로컬 개발 (선택적)
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8787',
];








