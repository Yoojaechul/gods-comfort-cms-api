import express from "express";
import cors from "cors";
import db, { initDB } from "./db.js";

const app = express();

/**
 * Cloud Run 필수
 * - 반드시 process.env.PORT 사용
 * - 기본값 8080
 */
const PORT = process.env.PORT || 8080;

/**
 * 미들웨어
 */
app.use(cors());
app.use(express.json());

/**
 * === 서버 부팅 ===
 */
console.log("🚀 CMS API Server starting...");
console.log("PORT =", PORT);

/**
 * === DB 초기화 ===
 */
await initDB();

/**
 * === Health Check (Cloud Run / Load Balancer용) ===
 */
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "cms-api",
    message: "CMS API is running",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

/**
 * === 테스트용 API ===
 */
app.get("/api/ping", (req, res) => {
  res.json({ pong: true });
});

/**
 * === 서버 리슨 ===
 */
app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log(`✅ CMS API listening on port ${PORT}`);
  console.log("========================================");
});
