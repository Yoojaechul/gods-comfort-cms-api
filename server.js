/**
 * server.js
 * Cloud Run + Fastify CMS API
 */

import Fastify from "fastify";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import crypto from "crypto";

dotenv.config();

// ==================== ENV ====================
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || "development";
const isDevelopment = NODE_ENV !== "production";

const LOCAL_BASE_URL =
  process.env.LOCAL_BASE_URL || `http://localhost:${PORT}`;

// ==================== Fastify ====================
const fastify = Fastify({
  logger: true,
});

// ==================== DB ====================
const db = new Database("cms.db");

// ==================== Utils ====================
function generateId() {
  return crypto.randomBytes(16).toString("hex");
}

function generateApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

function hashApiKey(apiKey) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(apiKey, salt, 10000, 64, "sha512")
    .toString("hex");
  return { hash, salt };
}

// ==================== DB INIT ====================
async function initDB() {
  return true;
}

// ==================== Schema ====================
function ensureSchema() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      domain TEXT,
      name TEXT NOT NULL,
      homepage_url TEXT,
      api_base TEXT,
      facebook_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      site_id TEXT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      password_hash TEXT,
      api_key_hash TEXT,
      api_key_salt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      video_id TEXT,
      source_url TEXT NOT NULL,
      title TEXT,
      thumbnail_url TEXT,
      embed_url TEXT,
      language TEXT DEFAULT 'en',
      status TEXT DEFAULT 'active',
      visibility TEXT DEFAULT 'public',
      views_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (site_id) REFERENCES sites(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );
  `);
}

// ==================== Default Site ====================
function ensureDefaultSiteRow() {
  const exists = db
    .prepare("SELECT id FROM sites WHERE id = ?")
    .get("gods");

  if (!exists) {
    db.prepare(
      `
      INSERT INTO sites (id, domain, name, homepage_url, api_base)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(
      "gods",
      "godcomfortword.com",
      "God's Comfort Word",
      "https://www.godcomfortword.com",
      LOCAL_BASE_URL
    );

    console.log("✅ Default site created");
  }
}

// ==================== Dev Admin ====================
function safeAdminBootstrap() {
  if (!isDevelopment) return;

  const admin = db
    .prepare("SELECT id FROM users WHERE role='admin' LIMIT 1")
    .get();

  if (admin) return;

  const adminId = generateId();
  const apiKey = generateApiKey();
  const { hash, salt } = hashApiKey(apiKey);

  db.prepare(
    `
    INSERT INTO users
    (id, site_id, name, role, api_key_hash, api_key_salt)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  ).run(adminId, "gods", "Admin", "admin", hash, salt);

  console.log("=".repeat(60));
  console.log("✅ Dev Admin Created");
  console.log("API KEY:", apiKey);
  console.log("=".repeat(60));
}

// ==================== Routes ====================

// root
fastify.get("/", async () => {
  return {
    service: "cms-api",
    status: "running",
  };
});

// health (internal)
fastify.get("/health", async () => {
  return {
    status: "ok",
    service: "cms-api",
    message: "CMS API is running",
  };
});

// ✅ public health (Cloud Run / external check)
fastify.get("/public/health", async () => {
  return {
    status: "ok",
    service: "cms-api",
    message: "CMS API is running",
  };
});

// ✅ public healthz (K8s / monitoring)
fastify.get("/public/healthz", async () => {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
  };
});

// ==================== Boot ====================
async function start() {
  await initDB();
  ensureSchema();
  ensureDefaultSiteRow();
  safeAdminBootstrap();

  await fastify.listen({
    port: PORT,
    host: "0.0.0.0",
  });

  console.log(`🚀 CMS API running on port ${PORT}`);
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
