// server.js (ESM)
// Cloud Run Fastify server with health + public health endpoints

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { initDB } from "./db.js";

const fastify = Fastify({
  logger: true,
});

// -----------------------------
// ENV
// -----------------------------
const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";

// -----------------------------
// Plugins
// -----------------------------
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

await fastify.register(multipart, {
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB
  },
});

// -----------------------------
// DB Init (important: before routes if routes use db)
// -----------------------------
try {
  await initDB();
  fastify.log.info("✅ DB initialized");
} catch (e) {
  fastify.log.error(e, "❌ DB init failed");
  // Cloud Run에서는 실패하면 그냥 죽는 게 맞습니다(헬스체크도 실패해야 재기동됨)
  process.exit(1);
}

// -----------------------------
// Routes
// -----------------------------

// Root (optional) - 간단 상태 확인용
fastify.get("/", async () => {
  return { status: "healthy", timestamp: new Date().toISOString() };
});

// health (existing)
fastify.get("/health", async () => {
  return { status: "ok", service: "cms-api", message: "CMS API is running" };
});

// ✅ public health alias (your request)
fastify.get("/public/health", async () => {
  return { status: "ok", service: "cms-api", message: "CMS API is running" };
});

// ✅ (optional) healthz alias
fastify.get("/public/healthz", async () => {
  return { status: "ok", service: "cms-api", message: "CMS API is running" };
});

// 404 handler (명확한 메시지)
fastify.setNotFoundHandler((req, reply) => {
  reply.code(404).send({
    message: `Route ${req.method}:${req.url} not found`,
    error: "Not Found",
    statusCode: 404,
  });
});

// Error handler
fastify.setErrorHandler((err, req, reply) => {
  fastify.log.error(err);
  reply.code(500).send({
    error: "Internal Server Error",
    message: err?.message || "Unknown error",
  });
});

// -----------------------------
// Start
// -----------------------------
try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`🚀 Server listening on http://${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
