import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";

admin.initializeApp();

const app = express();

app.use(
  cors({
    origin: [
      "https://gods-comfort-word-cms.web.app",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
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
