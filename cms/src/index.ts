import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";

admin.initializeApp();

const app = express();

// CORS 설정 - Origin allowlist 방식
const allowedOrigins = [
  "https://cms.godcomfortword.com", // 프로덕션 도메인
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://localhost:5173"] // 개발 환경에서만 로컬 허용
    : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // origin이 없으면 (curl/server-to-server 요청) 허용
      if (!origin) {
        callback(null, true);
        return;
      }

      // 허용된 origin이면 통과
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // 허용되지 않은 origin (경고 로그)
      console.warn(`⚠️ CORS blocked: ${origin} (Allowed: ${allowedOrigins.join(", ")})`);
      callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true, // 쿠키/인증 헤더 사용
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // 허용 메서드
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"], // 허용 헤더
    exposedHeaders: [], // 클라이언트에서 접근 가능한 헤더
    optionsSuccessStatus: 204, // OPTIONS preflight 요청에 204 응답
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "email/password required" });
  }

  // ✅ 이메일 정규화
  const normalizedEmail = String(email).trim().toLowerCase();

  // ✅ 임시 Role 매핑 (가장 빠른 해결)
  const role =
    normalizedEmail === "consulting_manager@naver.com"
      ? "admin"
      : normalizedEmail === "j1dly1@naver.com"
        ? "creator"
        : "creator"; // 기본값

  return res.status(200).json({
    user: { email: normalizedEmail, role },
    token: "dummy-token",
  });
});

/**
 * ✅ Firebase Functions v2 방식
 */
export const api = onRequest(
  {
    region: "us-central1",
  },
  app
);
