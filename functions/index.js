const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

// Firebase Admin 초기화
admin.initializeApp();

// Express 앱 생성
const app = express();

// CORS 설정
const allowedOrigins = [
  "https://gods-comfort-word-cms.web.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // origin이 없으면 (서버 간 요청, curl 등) 허용
      if (!origin) {
        callback(null, true);
        return;
      }

      // 허용된 origin이면 통과
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // 허용되지 않은 origin
      console.warn(`CORS blocked: ${origin}`);
      callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "Accept",
      "Origin",
    ],
  })
);

// JSON 파싱 미들웨어
app.use(express.json());

// ==================== 라우트 ====================

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// 로그인 (임시 - 프론트 동작 확인용)
app.post("/auth/login", (req, res) => {
  // 임시로 dev-token 반환
  res.json({ token: "dev-token" });
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

// Firebase Functions로 내보내기
exports.api = functions.https.onRequest(app);


