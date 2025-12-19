import Fastify from "fastify";
import cors from "@fastify/cors";
import db, { initDB } from "./db.js";

const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
});

/**
 * Cloud Run / LB 용 health
 */
app.get("/", async () => {
  return {
    status: "ok",
    service: "cms-api",
    message: "CMS API is running",
  };
});

app.get("/health", async () => {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
});

app.get("/api/ping", async () => {
  return { pong: true };
});

/**
 * DB init
 */
await initDB();

/**
 * start
 */
try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`✅ CMS API listening on ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
