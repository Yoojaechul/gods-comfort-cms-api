import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite config에서는 import.meta.env를 쓸 수 없으므로 loadEnv 사용
  const env = loadEnv(mode, process.cwd(), "");

  // API 타겟 우선순위: VITE_API_BASE_URL(권장) → VITE_CMS_API_BASE_URL → 기본값(DEV 편의)
  const rawTarget =
    env.VITE_API_BASE_URL || env.VITE_CMS_API_BASE_URL || "http://localhost:8787";

  // target은 absolute URL이어야 합니다. (실수로 "/api" 같은 값을 넣는 경우 방지)
  const apiTarget = rawTarget.startsWith("http://") || rawTarget.startsWith("https://")
    ? rawTarget
    : "http://localhost:8787";

  return {
    plugins: [react()],
    server: {
      proxy: {
        // API 요청을 백엔드 서버로 프록시
        // 사용 예: /api/auth/login → {apiTarget}/auth/login
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          secure: false,
        },
      },
    },
  }
})
