import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import staticFiles from "@fastify/static";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import db, { initDB, hashApiKey, generateApiKey, generateId, hashPassword, verifyPassword } from "./db.js";
import { getUserByApiKey, authenticate, requireAdmin, requireCreator } from "./auth.js";
import { enrichMetadata, extractYouTubeVideoId } from "./metadata.js";
import { generateToken, verifyToken, getTokenExpiry } from "./jwt.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: true });

// JWT ?ㅼ젙
await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || "change_this_jwt_secret_key_to_secure_random_string"
});

// CORS ?ㅼ젙
const isDevelopment = process.env.NODE_ENV !== 'production';

await app.register(cors, {
  origin: (origin, cb) => {
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
      : ["http://localhost:3000"]; // 湲곕낯媛??ㅼ젙

    // 媛쒕컻 ?섍꼍?먯꽌留??곸꽭 濡쒓렇
    if (isDevelopment) {
      console.log(`?뙋 CORS Request from origin: ${origin}`);
    }

    // origin???놁쑝硫?(curl/server-to-server) ?덉슜
    if (!origin) {
      cb(null, true);
      return;
    }

    // ?덉슜??origin?대㈃ ?듦낵
    if (allowedOrigins.includes(origin)) {
      cb(null, true);
      return;
    }

    // ?덉슜?섏? ?딆? origin (??긽 濡쒓렇)
    console.warn(`?슟 CORS blocked: ${origin} (Allowed: ${allowedOrigins.join(", ")})`);
    cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true, // 荑좏궎/?몄쬆 ?ㅻ뜑 ?덉슜
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // ?덉슜 硫붿꽌??  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"], // ?덉슜 ?ㅻ뜑
  exposedHeaders: ["Content-Length", "X-Total-Count"], // ?대씪?댁뼵?몄뿉???묎렐 媛?ν븳 ?ㅻ뜑
  preflight: true, // preflight ?붿껌 ?먮룞 泥섎━
  optionsSuccessStatus: 204, // OPTIONS ?붿껌 ?묐떟 肄붾뱶
  preflightContinue: false, // preflight ???ㅼ쓬 ?몃뱾?щ줈 ?꾨떖?섏? ?딆쓬
});

// ?뺤쟻 ?뚯씪 ?쒕튃 (Admin UI, Creator UI)
await app.register(staticFiles, {
  root: path.join(__dirname, "public"),
  prefix: "/",
  decorateReply: false
});

// DB 珥덇린??initDB();

// Admin ?먮룞 ?앹꽦 (遺?몄뒪?몃옪 ?ㅻ줈) - 媛쒕컻 ?섍꼍?먯꽌留?const bootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY || "change_this";
const existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!existingAdmin && isDevelopment) {
  const adminId = generateId();
  const adminApiKey = generateApiKey();
  const { hash, salt } = hashApiKey(adminApiKey);
  db.prepare(
    "INSERT INTO users (id, name, role, status, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(adminId, "Admin", "admin", "active", hash, salt);
  console.log("=".repeat(60));
  console.log("??Admin ?먮룞 ?앹꽦 ?꾨즺! (媛쒕컻 ?섍꼍)");
  console.log("?좑툘  API Key??蹂꾨룄濡??덉쟾?섍쾶 愿由ы븯?몄슂!");
  console.log("=".repeat(60));
}

// ==================== 怨듭슜 ?붾뱶?ъ씤??====================

// Health check
app.get("/health", async (request, reply) => {
  return { ok: true, time: new Date().toISOString() };
});

// 諛⑸Ц??濡쒓퉭
app.post("/public/log-visit", async (request, reply) => {
  const { site_id, language, page_url } = request.body;
  
  if (!site_id) {
    return reply.code(400).send({ error: "site_id is required" });
  }

  try {
    const visitId = generateId();
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const userAgent = request.headers['user-agent'] || '';

    // 媛꾨떒??IP 湲곕컲 援?? 異붿젙 (?ㅼ젣濡쒕뒗 GeoIP ?쒕퉬???ъ슜 沅뚯옣)
    // ?ш린?쒕뒗 湲곕낯媛??ъ슜
    let countryCode = 'KR';
    let countryName = 'South Korea';

    db.prepare(
      "INSERT INTO visits (id, site_id, ip_address, country_code, country_name, language, page_url, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(visitId, site_id, ipAddress, countryCode, countryName, language || 'ko', page_url || '/', userAgent);

    return { success: true, id: visitId };
  } catch (err) {
    console.error("諛⑸Ц??濡쒓퉭 ?ㅻ쪟:", err);
    return reply.code(500).send({ error: "Failed to log visit" });
  }
});

// 怨듦컻 ?곸긽 議고쉶
app.get("/public/videos", async (request, reply) => {
  const { site_id, platform, limit = 20, cursor, page = 1 } = request.query;

  if (!site_id) {
    return reply.code(400).send({ error: "site_id query parameter is required" });
  }

  // limit ?쒗븳: 湲곕낯 20, 理쒕? 100
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const currentPage = Math.max(parseInt(page) || 1, 1);

  // ?꾩껜 媛쒖닔 議고쉶
  let countQuery = "SELECT COUNT(*) as total FROM videos v WHERE v.site_id = ? AND v.visibility = 'public'";
  const countParams = [site_id];

  if (platform) {
    countQuery += " AND v.platform = ?";
    countParams.push(platform);
  }

  const { total } = db.prepare(countQuery).get(...countParams);

  // ?곸긽 紐⑸줉 議고쉶
  let query = "SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE v.site_id = ? AND v.visibility = 'public'";
  const params = [site_id];

  if (platform) {
    query += " AND v.platform = ?";
    params.push(platform);
  }

  if (cursor) {
    query += " AND v.created_at < ?";
    params.push(cursor);
  }

  query += " ORDER BY v.created_at DESC LIMIT ?";
  params.push(safeLimit);

  const videos = db.prepare(query).all(...params);

  // video_id 怨꾩궛 (?녿뒗 寃쎌슦)
  const enhancedVideos = videos.map((video) => {
    let videoId = video.video_id;
    
    // video_id媛 ?놁쑝硫?source_url?먯꽌 異붿텧 ?쒕룄
    if (!videoId && video.platform === "youtube") {
      videoId = extractYouTubeVideoId(video.source_url);
    } else if (!videoId && video.platform === "facebook") {
      // Facebook URL?먯꽌 video ID 異붿텧 (媛꾨떒???⑦꽩)
      const match = video.source_url.match(/\/videos\/(\d+)/);
      videoId = match ? match[1] : null;
    }

    return {
      ...video,
      video_id: videoId,
      // status媛 ?놁쑝硫?湲곕낯媛??ㅼ젙
      status: video.status || 'active',
      // language媛 ?놁쑝硫?湲곕낯媛??ㅼ젙
      language: video.language || 'en',
    };
  });

  // ?쒖? ?묐떟 ?뺤떇 (items, total, page, page_size)
  return {
    items: enhancedVideos,
    total,
    page: currentPage,
    page_size: safeLimit,
    cursor: videos.length > 0 ? videos[videos.length - 1].created_at : null,
  };
});

// ==================== ?몄쬆 ?꾩슂 ?붾뱶?ъ씤??====================

// ?꾩옱 ?ъ슜???뺣낫
app.get("/me", { preHandler: authenticate }, async (request, reply) => {
  const user = request.user;
  const site = user.site_id
    ? db.prepare("SELECT * FROM sites WHERE id = ?").get(user.site_id)
    : null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    site_id: user.site_id,
    site: site,
  };
});

// ?대찓??鍮꾨?踰덊샇 濡쒓렇??app.post("/auth/login", async (request, reply) => {
  const { email, password } = request.body;

  if (!email) {
    return reply.code(400).send({ error: "email is required" });
  }

  // ?대찓?쇰줈 ?ъ슜??議고쉶
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);

  if (!user) {
    return reply.code(401).send({ error: "Invalid email" });
  }

  // 鍮꾨?踰덊샇媛 ?ㅼ젙?섏? ?딆? 寃쎌슦 (理쒖큹 濡쒓렇??
  if (!user.password_hash) {
    return reply.code(403).send({ 
      error: "Password not set",
      requires_setup: true,
      user_id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  // 鍮꾨?踰덊샇 ?꾩닔
  if (!password) {
    return reply.code(400).send({ error: "password is required" });
  }

  // 鍮꾨?踰덊샇 寃利?(password_hash瑜?salt濡??ъ슜)
  if (!verifyPassword(password, user.password_hash, user.api_key_salt)) {
    return reply.code(401).send({ error: "Invalid email or password" });
  }

  // JWT ?좏겙 ?앹꽦
  const token = generateToken(user);
  const expiry = getTokenExpiry(token);

  return {
    token,
    expiresAt: expiry,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      site_id: user.site_id,
    },
  };
});

// 理쒖큹 鍮꾨?踰덊샇 ?ㅼ젙
app.post("/auth/setup-password", async (request, reply) => {
  const { email, new_password, new_email } = request.body;

  if (!email || !new_password) {
    return reply.code(400).send({ error: "email and new_password are required" });
  }

  // ?ъ슜??議고쉶
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);

  if (!user) {
    return reply.code(404).send({ error: "User not found" });
  }

  // ?대? 鍮꾨?踰덊샇媛 ?ㅼ젙??寃쎌슦
  if (user.password_hash) {
    return reply.code(400).send({ error: "Password already set. Use change-password instead." });
  }

  // 鍮꾨?踰덊샇 ?댁떛
  const { hash, salt } = hashPassword(new_password);

  // ?대찓??蹂寃??щ? ?뺤씤 (?щ━?먯씠?곗쓽 寃쎌슦)
  let updateEmail = email;
  if (new_email && new_email !== email) {
    // ?대찓??以묐났 ?뺤씤
    const existing = db.prepare("SELECT * FROM users WHERE email = ? AND id != ?").get(new_email, user.id);
    if (existing) {
      return reply.code(409).send({ error: "Email already exists" });
    }
    updateEmail = new_email;
  }

  // 鍮꾨?踰덊샇 諛??대찓???ㅼ젙
  db.prepare(
    "UPDATE users SET email = ?, password_hash = ?, api_key_salt = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(updateEmail, hash, salt, user.id);

  console.log(`??理쒖큹 鍮꾨?踰덊샇 ?ㅼ젙: ${updateEmail}`);

  // JWT ?좏겙 ?앹꽦
  const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  const token = generateToken(updatedUser);
  const expiry = getTokenExpiry(token);

  return {
    token,
    expiresAt: expiry,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      site_id: updatedUser.site_id,
    },
  };
});

// 鍮꾨?踰덊샇 蹂寃?app.post("/auth/change-password", { preHandler: authenticate }, async (request, reply) => {
  const { current_password, new_password } = request.body;
  const user = request.user;

  if (!current_password || !new_password) {
    return reply.code(400).send({ error: "current_password and new_password are required" });
  }

  // ?꾩옱 鍮꾨?踰덊샇 ?뺤씤
  if (!verifyPassword(current_password, user.password_hash, user.api_key_salt)) {
    return reply.code(401).send({ error: "Current password is incorrect" });
  }

  // ??鍮꾨?踰덊샇 ?댁떛
  const { hash, salt } = hashPassword(new_password);

  // 鍮꾨?踰덊샇 ?낅뜲?댄듃
  db.prepare(
    "UPDATE users SET password_hash = ?, api_key_salt = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(hash, salt, user.id);

  console.log(`??鍮꾨?踰덊샇 蹂寃? ${user.email}`);

  return { success: true, message: "Password changed successfully" };
});

// ?꾨줈???섏젙 (?대찓?? ?대쫫)
app.patch("/auth/profile", { preHandler: authenticate }, async (request, reply) => {
  const { name, email } = request.body;
  const user = request.user;

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push("name = ?");
    params.push(name);
  }

  if (email !== undefined && email !== user.email) {
    // ?대찓??以묐났 ?뺤씤
    const existing = db.prepare("SELECT * FROM users WHERE email = ? AND id != ?").get(email, user.id);
    if (existing) {
      return reply.code(409).send({ error: "Email already exists" });
    }
    updates.push("email = ?");
    params.push(email);
  }

  if (updates.length === 0) {
    return reply.code(400).send({ error: "No fields to update" });
  }

  params.push(user.id);

  db.prepare(
    `UPDATE users SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`
  ).run(...params);

  const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role,
    site_id: updatedUser.site_id,
  };
});

// ==================== Admin ?꾩슜 ?붾뱶?ъ씤??====================

// ?ъ씠???앹꽦
app.post(
  "/admin/sites",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id, name } = request.body;

    if (!id || !name) {
      return reply.code(400).send({ error: "id and name are required" });
    }

    try {
      db.prepare("INSERT INTO sites (id, name) VALUES (?, ?)").run(id, name);
      return { id, name };
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT") {
        return reply.code(409).send({ error: "Site ID already exists" });
      }
      throw err;
    }
  }
);

// ?ъ씠??紐⑸줉 議고쉶
app.get(
  "/admin/sites",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const sites = db.prepare("SELECT * FROM sites ORDER BY created_at DESC").all();
    return { sites };
  }
);

// Creator ?앹꽦
app.post(
  "/admin/creators",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { site_id, name, email, password } = request.body;

    if (!site_id || !name) {
      return reply.code(400).send({ error: "site_id and name are required" });
    }

    // site_id 議댁옱 ?뺤씤
    const site = db.prepare("SELECT * FROM sites WHERE id = ?").get(site_id);
    if (!site) {
      return reply.code(404).send({ error: "Site not found" });
    }

    // ?대찓??以묐났 ?뺤씤
    if (email) {
      const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (existing) {
        return reply.code(409).send({ error: "Email already exists" });
      }
    }

    const creatorId = generateId();
    const apiKey = generateApiKey();
    const { hash: apiKeyHash, salt: apiKeySalt } = hashApiKey(apiKey);

    // 鍮꾨?踰덊샇 ?댁떛 (?쒓났??寃쎌슦)
    let passwordHash = null;
    if (password) {
      const { hash } = hashPassword(password);
      passwordHash = hash;
    }

    db.prepare(
      "INSERT INTO users (id, site_id, name, email, password_hash, role, status, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(creatorId, site_id, name, email || null, passwordHash, "creator", "active", apiKeyHash, apiKeySalt);

    return {
      id: creatorId,
      site_id,
      name,
      email: email || null,
      api_key: apiKey, // ?됰Ц ?ㅻ뒗 ?앹꽦 ??1?뚮쭔 諛섑솚
    };
  }
);

// Creator 紐⑸줉 議고쉶
app.get(
  "/admin/creators",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { site_id } = request.query;

    let query = "SELECT id, site_id, name, role, status, created_at FROM users WHERE role = 'creator'";
    const params = [];

    if (site_id) {
      query += " AND site_id = ?";
      params.push(site_id);
    }

    query += " ORDER BY created_at DESC";

    const creators = db.prepare(query).all(...params);
    return { creators };
  }
);

// Creator ?뺣낫 ?섏젙
app.patch(
  "/admin/creators/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;
    const { status, name } = request.body;

    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }

    if (updates.length === 0) {
      return reply.code(400).send({ error: "No fields to update" });
    }

    params.push(id);

    const stmt = db.prepare(
      `UPDATE users SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`
    );
    const result = stmt.run(...params);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Creator not found" });
    }

    const creator = db
      .prepare("SELECT id, site_id, name, role, status, created_at FROM users WHERE id = ?")
      .get(id);

    return creator;
  }
);

// Creator ???щ컻湲?app.post(
  "/admin/creators/:id/rotate-key",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;

    const creator = db
      .prepare("SELECT * FROM users WHERE id = ? AND role = 'creator'")
      .get(id);

    if (!creator) {
      return reply.code(404).send({ error: "Creator not found" });
    }

    const apiKey = generateApiKey();
    const { hash, salt } = hashApiKey(apiKey);

    db.prepare("UPDATE users SET api_key_hash = ?, api_key_salt = ? WHERE id = ?").run(
      hash,
      salt,
      id
    );

    return {
      id: creator.id,
      api_key: apiKey, // ?됰Ц ?ㅻ뒗 ?щ컻湲???1?뚮쭔 諛섑솚
    };
  }
);

// Admin - 諛⑸Ц???듦퀎
app.get(
  "/admin/analytics",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { site_id, period = 'daily', start_date, end_date } = request.query;

    if (!site_id) {
      return reply.code(400).send({ error: "site_id is required" });
    }

    let startDateStr;
    let endDateStr;

    // 而ㅼ뒪? ?좎쭨 踰붿쐞媛 ?쒓났??寃쎌슦
    if (start_date && end_date) {
      startDateStr = start_date;
      endDateStr = end_date;
    } else {
      // 湲곌컙蹂??좎쭨 怨꾩궛
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'daily':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarterly':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'half-yearly':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case 'yearly':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      startDateStr = startDate.toISOString().split('T')[0];
      endDateStr = now.toISOString().split('T')[0];
    }

    // 珥?諛⑸Ц????    const totalVisits = db.prepare(
      "SELECT COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= ? AND date(created_at) <= ?"
    ).get(site_id, startDateStr, endDateStr);

    // 援??蹂??듦퀎
    const byCountry = db.prepare(
      "SELECT country_code, country_name, COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= ? AND date(created_at) <= ? GROUP BY country_code, country_name ORDER BY count DESC"
    ).all(site_id, startDateStr, endDateStr);

    // ?몄뼱蹂??듦퀎
    const byLanguage = db.prepare(
      "SELECT language, COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= ? AND date(created_at) <= ? GROUP BY language ORDER BY count DESC"
    ).all(site_id, startDateStr, endDateStr);

    // ?쇰퀎 諛⑸Ц??異붿씠
    const dailyTrend = db.prepare(
      "SELECT date(created_at) as date, COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= ? AND date(created_at) <= ? GROUP BY date(created_at) ORDER BY date DESC LIMIT 90"
    ).all(site_id, startDateStr, endDateStr);

    return {
      period,
      start_date: startDateStr,
      end_date: endDateStr,
      total_visits: totalVisits.count,
      by_country: byCountry,
      by_language: byLanguage,
      daily_trend: dailyTrend,
      unique_countries: byCountry.length,
      unique_languages: byLanguage.length,
    };
  }
);

// Admin - Videos ?꾩껜 議고쉶 (?ъ씠???꾪꽣 媛??
app.get(
  "/admin/videos",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { site_id, limit = 50, cursor } = request.query;

    let query =
      "SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE 1=1";
    const params = [];

    if (site_id) {
      query += " AND v.site_id = ?";
      params.push(site_id);
    }

    if (cursor) {
      query += " AND v.created_at < ?";
      params.push(cursor);
    }

    query += " ORDER BY v.created_at DESC LIMIT ?";
    params.push(parseInt(limit));

    const videos = db.prepare(query).all(...params);

    return {
      videos,
      cursor: videos.length > 0 ? videos[videos.length - 1].created_at : null,
    };
  }
);

// Admin - Video ??젣
app.delete(
  "/admin/videos/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;

    const result = db.prepare("DELETE FROM videos WHERE id = ?").run(id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Video not found" });
    }

    return { success: true };
  }
);

// Admin - ?쇨큵 ??젣
app.post(
  "/admin/videos/batch-delete",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { video_ids } = request.body;

    if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
      return reply.code(400).send({ error: "video_ids array is required" });
    }

    try {
      const placeholders = video_ids.map(() => "?").join(",");
      const result = db.prepare(
        `DELETE FROM videos WHERE id IN (${placeholders})`
      ).run(...video_ids);

      return {
        success: true,
        deleted_count: result.changes,
      };
    } catch (err) {
      console.error("?쇨큵 ??젣 ?ㅻ쪟:", err);
      return reply.code(500).send({ error: "Batch delete failed" });
    }
  }
);

// Admin - Video ?섏젙 (紐⑤뱺 ?꾨뱶)
app.patch(
  "/admin/videos/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;
    const { platform, source_url, title, thumbnail_url, visibility, language, status } = request.body;

    // ?곸긽 議댁옱 ?뺤씤
    const existing = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);

    if (!existing) {
      return reply.code(404).send({ error: "Video not found" });
    }

    const updates = [];
    const params = [];

    if (platform !== undefined) {
      updates.push("platform = ?");
      params.push(platform);
    }

    if (source_url !== undefined) {
      updates.push("source_url = ?");
      params.push(source_url);
    }

    if (title !== undefined) {
      updates.push("title = ?");
      params.push(title);
    }

    if (thumbnail_url !== undefined) {
      updates.push("thumbnail_url = ?");
      params.push(thumbnail_url);
    }

    if (visibility !== undefined) {
      updates.push("visibility = ?");
      params.push(visibility);
    }

    if (language !== undefined) {
      updates.push("language = ?");
      params.push(language);
    }

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }

    if (updates.length === 0) {
      return reply.code(400).send({ error: "No fields to update" });
    }

    // source_url?대굹 platform??蹂寃쎈릺硫?硫뷀??뺣낫 諛?video_id ?ъ깮??    if (source_url !== undefined || platform !== undefined) {
      const finalPlatform = platform || existing.platform;
      const finalSourceUrl = source_url || existing.source_url;
      const finalTitle = title !== undefined ? title : existing.title;
      const finalThumbnail = thumbnail_url !== undefined ? thumbnail_url : existing.thumbnail_url;

      const metadata = await enrichMetadata(finalPlatform, finalSourceUrl, finalTitle, finalThumbnail);

      if (metadata.title !== null && title === undefined) {
        updates.push("title = ?");
        params.push(metadata.title);
      }

      if (metadata.thumbnail_url !== null && thumbnail_url === undefined) {
        updates.push("thumbnail_url = ?");
        params.push(metadata.thumbnail_url);
      }

      if (metadata.embed_url !== null) {
        updates.push("embed_url = ?");
        params.push(metadata.embed_url);
      }

      // video_id 異붿텧 諛??낅뜲?댄듃
      let extractedVideoId = null;
      if (finalPlatform === "youtube") {
        extractedVideoId = extractYouTubeVideoId(finalSourceUrl);
      } else if (finalPlatform === "facebook") {
        const match = finalSourceUrl.match(/\/videos\/(\d+)/);
        extractedVideoId = match ? match[1] : null;
      }

      if (extractedVideoId) {
        updates.push("video_id = ?");
        params.push(extractedVideoId);
      }
    }

    params.push(id);

    db.prepare(
      `UPDATE videos SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`
    ).run(...params);

    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    return video;
  }
);

// Admin - Video Stats ?섏젙
app.patch(
  "/admin/videos/:id/stats",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;
    const { views_count, likes_count, shares_count } = request.body;
    const user = request.user;

    // ?꾩옱 ?곸긽 ?뺣낫 議고쉶
    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);

    if (!video) {
      return reply.code(404).send({ error: "Video not found" });
    }

    // 蹂寃?濡쒓렇 湲곕줉
    const logId = generateId();
    db.prepare(
      "INSERT INTO stats_adjustments (id, video_id, admin_id, old_views, new_views, old_likes, new_likes, old_shares, new_shares) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      logId,
      id,
      user.id,
      video.views_count || 0,
      views_count !== undefined ? views_count : video.views_count || 0,
      video.likes_count || 0,
      likes_count !== undefined ? likes_count : video.likes_count || 0,
      video.shares_count || 0,
      shares_count !== undefined ? shares_count : video.shares_count || 0
    );

    // Stats ?낅뜲?댄듃
    const updates = [];
    const params = [];

    if (views_count !== undefined) {
      updates.push("views_count = ?");
      params.push(views_count);
    }

    if (likes_count !== undefined) {
      updates.push("likes_count = ?");
      params.push(likes_count);
    }

    if (shares_count !== undefined) {
      updates.push("shares_count = ?");
      params.push(shares_count);
    }

    if (updates.length > 0) {
      updates.push("stats_updated_at = datetime('now')");
      updates.push("stats_updated_by = ?");
      params.push(user.id);
      params.push(id);

      db.prepare(
        `UPDATE videos SET ${updates.join(", ")} WHERE id = ?`
      ).run(...params);
    }

    const updatedVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    return updatedVideo;
  }
);

// ==================== Creator ?꾩슜 ?붾뱶?ъ씤??====================

// Creator - Videos 議고쉶 (?먭린 寃껊쭔)
app.get(
  "/videos",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { site_id } = request.query;
    const user = request.user;

    // creator???먭린 site_id留??묎렐 媛??    const targetSiteId = site_id || user.site_id;

    if (targetSiteId !== user.site_id) {
      return reply.code(403).send({ error: "Access denied to this site_id" });
    }

    const videos = db
      .prepare(
        "SELECT * FROM videos WHERE site_id = ? AND owner_id = ? ORDER BY created_at DESC"
      )
      .all(targetSiteId, user.id);

    return { videos };
  }
);

// Creator - ?쇨큵 ?곸긽 ?앹꽦
app.post(
  "/videos/batch",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { videos: videosToAdd, site_id } = request.body;
    const user = request.user;

    if (!videosToAdd || !Array.isArray(videosToAdd) || videosToAdd.length === 0) {
      return reply.code(400).send({ error: "videos array is required" });
    }

    if (videosToAdd.length > 20) {
      return reply.code(400).send({ error: "Maximum 20 videos per batch" });
    }

    // Admin? site_id 吏??媛?? Creator???먭린 site_id ?ъ슜
    let siteId;
    if (user.role === "admin") {
      siteId = site_id;
      if (!siteId) {
        return reply.code(400).send({ error: "Admin must provide site_id" });
      }
    } else {
      siteId = user.site_id;
      if (!siteId) {
        return reply.code(400).send({ error: "Creator must have a site_id" });
      }
    }

    const results = [];
    const errors = [];

    for (const videoData of videosToAdd) {
      try {
        const { platform, source_url, title, thumbnail_url, visibility = "public", language = "en", status = "active" } = videoData;

        if (!platform || !source_url) {
          errors.push({ source_url, error: "platform and source_url are required" });
          continue;
        }

        // 硫뷀??뺣낫 ?먮룞 蹂닿컯
        const metadata = await enrichMetadata(platform, source_url, title, thumbnail_url);

        // video_id 異붿텧
        let extractedVideoId = null;
        if (platform === "youtube") {
          extractedVideoId = extractYouTubeVideoId(source_url);
        } else if (platform === "facebook") {
          const match = source_url.match(/\/videos\/(\d+)/);
          extractedVideoId = match ? match[1] : null;
        }

        const videoId = generateId();
        db.prepare(
          "INSERT INTO videos (id, site_id, owner_id, platform, video_id, source_url, title, thumbnail_url, embed_url, language, status, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          videoId,
          siteId,
          user.id,
          platform,
          extractedVideoId,
          source_url,
          metadata.title,
          metadata.thumbnail_url,
          metadata.embed_url,
          language,
          status,
          visibility
        );

        const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
        results.push(video);
      } catch (err) {
        errors.push({ source_url: videoData.source_url, error: err.message });
      }
    }

    return {
      success: true,
      created: results.length,
      errors: errors.length,
      results,
      error_details: errors,
    };
  }
);

// Creator - Video ?앹꽦 (Admin???ъ슜 媛??
app.post(
  "/videos",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { platform, source_url, title, thumbnail_url, visibility = "public", language = "en", status = "active", site_id } = request.body;
    const user = request.user;

    if (!platform || !source_url) {
      return reply.code(400).send({ error: "platform and source_url are required" });
    }

    // Admin? site_id瑜?吏??媛?? Creator???먭린 site_id濡?媛뺤젣
    let siteId;
    if (user.role === "admin") {
      // Admin: body?먯꽌 site_id 諛쏄린 (?놁쑝硫??먮윭)
      siteId = site_id;
      if (!siteId) {
        return reply.code(400).send({ error: "Admin must provide site_id" });
      }
    } else {
      // Creator: ?먭린 site_id ?ъ슜
      siteId = user.site_id;
      if (!siteId) {
        return reply.code(400).send({ error: "Creator must have a site_id" });
      }
    }

    // 硫뷀??뺣낫 ?먮룞 蹂닿컯
    const metadata = await enrichMetadata(platform, source_url, title, thumbnail_url);

    // video_id 異붿텧
    let extractedVideoId = null;
    if (platform === "youtube") {
      extractedVideoId = extractYouTubeVideoId(source_url);
    } else if (platform === "facebook") {
      const match = source_url.match(/\/videos\/(\d+)/);
      extractedVideoId = match ? match[1] : null;
    }

    const videoId = generateId();
    db.prepare(
      "INSERT INTO videos (id, site_id, owner_id, platform, video_id, source_url, title, thumbnail_url, embed_url, language, status, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      videoId,
      siteId,
      user.id,
      platform,
      extractedVideoId,
      source_url,
      metadata.title,
      metadata.thumbnail_url,
      metadata.embed_url,
      language,
      status,
      visibility
    );

    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
    return video;
  }
);

// Creator - Video ?섏젙
app.patch(
  "/videos/:id",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { id } = request.params;
    const { platform, source_url, title, thumbnail_url, visibility, language, status } = request.body;
    const user = request.user;

    // 蹂몄씤 ?뚯쑀 ?뺤씤
    const existing = db
      .prepare("SELECT * FROM videos WHERE id = ? AND owner_id = ?")
      .get(id, user.id);

    if (!existing) {
      return reply.code(404).send({ error: "Video not found or access denied" });
    }

    const updates = [];
    const params = [];

    if (platform !== undefined) {
      updates.push("platform = ?");
      params.push(platform);
    }

    if (source_url !== undefined) {
      updates.push("source_url = ?");
      params.push(source_url);
    }

    if (title !== undefined) {
      updates.push("title = ?");
      params.push(title);
    }

    if (thumbnail_url !== undefined) {
      updates.push("thumbnail_url = ?");
      params.push(thumbnail_url);
    }

    if (visibility !== undefined) {
      updates.push("visibility = ?");
      params.push(visibility);
    }

    if (language !== undefined) {
      updates.push("language = ?");
      params.push(language);
    }

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }

    if (updates.length === 0) {
      return reply.code(400).send({ error: "No fields to update" });
    }

    // source_url?대굹 platform??蹂寃쎈릺硫?硫뷀??뺣낫 諛?video_id ?ъ깮??    if (source_url !== undefined || platform !== undefined) {
      const finalPlatform = platform || existing.platform;
      const finalSourceUrl = source_url || existing.source_url;
      const finalTitle = title !== undefined ? title : existing.title;
      const finalThumbnail = thumbnail_url !== undefined ? thumbnail_url : existing.thumbnail_url;

      const metadata = await enrichMetadata(finalPlatform, finalSourceUrl, finalTitle, finalThumbnail);

      if (metadata.title !== null) {
        updates.push("title = ?");
        params.push(metadata.title);
      }

      if (metadata.thumbnail_url !== null) {
        updates.push("thumbnail_url = ?");
        params.push(metadata.thumbnail_url);
      }

      if (metadata.embed_url !== null) {
        updates.push("embed_url = ?");
        params.push(metadata.embed_url);
      }

      // video_id 異붿텧 諛??낅뜲?댄듃
      let extractedVideoId = null;
      if (finalPlatform === "youtube") {
        extractedVideoId = extractYouTubeVideoId(finalSourceUrl);
      } else if (finalPlatform === "facebook") {
        const match = finalSourceUrl.match(/\/videos\/(\d+)/);
        extractedVideoId = match ? match[1] : null;
      }

      if (extractedVideoId) {
        updates.push("video_id = ?");
        params.push(extractedVideoId);
      }
    }

    params.push(id);

    db.prepare(
      `UPDATE videos SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`
    ).run(...params);

    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    return video;
  }
);

// Creator - Video ??젣
app.delete(
  "/videos/:id",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { id } = request.params;
    const user = request.user;

    // 蹂몄씤 ?뚯쑀 ?뺤씤
    const result = db
      .prepare("DELETE FROM videos WHERE id = ? AND owner_id = ?")
      .run(id, user.id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Video not found or access denied" });
    }

    return { success: true };
  }
);

// Creator - ?쇨큵 ??젣
app.post(
  "/videos/batch-delete",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { video_ids } = request.body;
    const user = request.user;

    if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
      return reply.code(400).send({ error: "video_ids array is required" });
    }

    try {
      let deletedCount = 0;

      // Admin?대㈃ 紐⑤뱺 ?곸긽 ??젣 媛?? Creator??蹂몄씤 ?곸긽留?      if (user.role === "admin") {
        const placeholders = video_ids.map(() => "?").join(",");
        const result = db.prepare(
          `DELETE FROM videos WHERE id IN (${placeholders})`
        ).run(...video_ids);
        deletedCount = result.changes;
      } else {
        // Creator: 蹂몄씤 ?곸긽留???젣
        for (const videoId of video_ids) {
          const result = db
            .prepare("DELETE FROM videos WHERE id = ? AND owner_id = ?")
            .run(videoId, user.id);
          deletedCount += result.changes;
        }
      }

      return {
        success: true,
        deleted_count: deletedCount,
      };
    } catch (err) {
      console.error("?쇨큵 ??젣 ?ㅻ쪟:", err);
      return reply.code(500).send({ error: "Batch delete failed" });
    }
  }
);

// Creator - ?뚮옯????議고쉶
app.get(
  "/my/provider-keys",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const user = request.user;

    const keys = db
      .prepare("SELECT * FROM user_provider_keys WHERE user_id = ? ORDER BY created_at DESC")
      .all(user.id);

    return { keys };
  }
);

// Creator - ?뚮옯????????섏젙 (upsert)
app.put(
  "/my/provider-keys",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { provider, key_name, key_value } = request.body;
    const user = request.user;

    if (!provider || !key_name || !key_value) {
      return reply.code(400).send({ error: "provider, key_name, and key_value are required" });
    }

    // 湲곗〈 ???뺤씤
    const existing = db
      .prepare(
        "SELECT * FROM user_provider_keys WHERE user_id = ? AND provider = ? AND key_name = ?"
      )
      .get(user.id, provider, key_name);

    if (existing) {
      // ?낅뜲?댄듃
      db.prepare(
        "UPDATE user_provider_keys SET key_value = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(key_value, existing.id);
      const updated = db
        .prepare("SELECT * FROM user_provider_keys WHERE id = ?")
        .get(existing.id);
      return updated;
    } else {
      // ?앹꽦
      const keyId = generateId();
      db.prepare(
        "INSERT INTO user_provider_keys (id, user_id, provider, key_name, key_value) VALUES (?, ?, ?, ?, ?)"
      ).run(keyId, user.id, provider, key_name, key_value);
      const created = db.prepare("SELECT * FROM user_provider_keys WHERE id = ?").get(keyId);
      return created;
    }
  }
);

// Creator - ?뚮옯??????젣
app.delete(
  "/my/provider-keys/:id",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { id } = request.params;
    const user = request.user;

    // 蹂몄씤 ?뚯쑀 ?뺤씤
    const result = db
      .prepare("DELETE FROM user_provider_keys WHERE id = ? AND user_id = ?")
      .run(id, user.id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Key not found or access denied" });
    }

    return { success: true };
  }
);

// ?쒕쾭 ?쒖옉
const PORT = process.env.PORT || 8787;
app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`??CMS API Server running on ${address}`);
  console.log(`?뱤 Admin UI: http://localhost:${PORT}/admin`);
  console.log(`?렓 Creator UI: http://localhost:${PORT}/creator`);
});


    const { site_id, limit = 50, cursor } = request.query;

    let query =
      "SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE 1=1";
    const params = [];

    if (site_id) {
      query += " AND v.site_id = ?";
      params.push(site_id);
