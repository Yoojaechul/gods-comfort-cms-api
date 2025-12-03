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

// JWT 설정
await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || "change_this_jwt_secret_key_to_secure_random_string"
});

// CORS 설정
const isDevelopment = process.env.NODE_ENV !== 'production';

await app.register(cors, {
  origin: (origin, cb) => {
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
      : ["http://localhost:3000", "https://gods-comfort-word.web.app", "https://godcomfortword.com", "https://www.godcomfortword.com"]; // 기본값 설정

    // 개발 환경에서만 상세 로그
    if (isDevelopment) {
      console.log(`🌐 CORS Request from origin: ${origin}`);
    }

    // origin이 없으면 (curl/server-to-server) 허용
    if (!origin) {
      cb(null, true);
      return;
    }

    // 허용된 origin이면 통과
    if (allowedOrigins.includes(origin)) {
      cb(null, true);
      return;
    }

    // 허용되지 않은 origin (항상 로그)
    console.warn(`🚫 CORS blocked: ${origin} (Allowed: ${allowedOrigins.join(", ")})`);
    cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true, // 쿠키/인증 헤더 허용
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // 허용 메서드
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"], // 허용 헤더
  exposedHeaders: ["Content-Length", "X-Total-Count"], // 클라이언트에서 접근 가능한 헤더
  preflight: true, // preflight 요청 자동 처리
  optionsSuccessStatus: 204, // OPTIONS 요청 응답 코드
  preflightContinue: false, // preflight 후 다음 핸들러로 전달하지 않음
});

// 정적 파일 서빙 (Admin UI, Creator UI)
await app.register(staticFiles, {
  root: path.join(__dirname, "public"),
  prefix: "/",
  decorateReply: false
});

// DB 초기화
initDB();

// Admin 자동 생성 (부트스트랩 키로) - 모든 환경에서
const bootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY || "change_this";
const existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!existingAdmin) {
  const adminId = generateId();
  const adminApiKey = generateApiKey();
  const { hash, salt } = hashApiKey(adminApiKey);
  
  // gods 사이트 확인/생성
  const existingSite = db.prepare("SELECT * FROM sites WHERE id = ?").get("gods");
  if (!existingSite) {
    db.prepare("INSERT INTO sites (id, name) VALUES (?, ?)").run("gods", "God's Comfort Word");
    console.log("✅ 사이트 'gods' 자동 생성");
  }
  
  db.prepare(
    "INSERT INTO users (id, name, email, role, status, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(adminId, "Manager", "consulting_manager@naver.com", "admin", "active", hash, salt);
  
  console.log("=".repeat(60));
  console.log("✅ Admin 자동 생성 완료!");
  console.log("이메일: consulting_manager@naver.com");
  console.log("비밀번호: (최초 로그인 시 설정)");
  console.log("⚠️  API Key는 별도로 안전하게 관리하세요!");
  console.log("=".repeat(60));
  
  // 크리에이터 계정도 생성
  const creatorId = generateId();
  const creatorApiKey = generateApiKey();
  const { hash: creatorHash, salt: creatorSalt } = hashApiKey(creatorApiKey);
  
  db.prepare(
    "INSERT INTO users (id, site_id, name, email, role, status, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(creatorId, "gods", "Creator", "01023942042", "creator", "active", creatorHash, creatorSalt);
  
  console.log("✅ Creator 자동 생성 완료!");
  console.log("초기 ID: 01023942042");
  console.log("비밀번호: (최초 로그인 시 설정)");
  console.log("=".repeat(60));
}

// ==================== 공용 엔드포인트 ====================

// Health check
app.get("/health", async (request, reply) => {
  return { ok: true, time: new Date().toISOString() };
});

// 방문자 로깅
app.post("/public/log-visit", async (request, reply) => {
  const { site_id, language, page_url } = request.body;
  
  if (!site_id) {
    return reply.code(400).send({ error: "site_id is required" });
  }

  try {
    const visitId = generateId();
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const userAgent = request.headers['user-agent'] || '';

    // 간단한 IP 기반 국가 추정 (실제로는 GeoIP 서비스 사용 권장)
    // 여기서는 기본값 사용
    let countryCode = 'KR';
    let countryName = 'South Korea';

    db.prepare(
      "INSERT INTO visits (id, site_id, ip_address, country_code, country_name, language, page_url, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(visitId, site_id, ipAddress, countryCode, countryName, language || 'ko', page_url || '/', userAgent);

    return { success: true, id: visitId };
  } catch (err) {
    console.error("방문자 로깅 오류:", err);
    return reply.code(500).send({ error: "Failed to log visit" });
  }
});

// 공개 영상 조회
app.get("/public/videos", async (request, reply) => {
  const { site_id, platform, limit = 20, cursor, page = 1 } = request.query;

  if (!site_id) {
    return reply.code(400).send({ error: "site_id query parameter is required" });
  }

  // limit 제한: 기본 20, 최대 100
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const currentPage = Math.max(parseInt(page) || 1, 1);

  // 전체 개수 조회
  let countQuery = "SELECT COUNT(*) as total FROM videos v WHERE v.site_id = ? AND v.visibility = 'public'";
  const countParams = [site_id];

  if (platform) {
    countQuery += " AND v.platform = ?";
    countParams.push(platform);
  }

  const { total } = db.prepare(countQuery).get(...countParams);

  // 영상 목록 조회
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

  // video_id 계산 (없는 경우)
  const enhancedVideos = videos.map((video) => {
    let videoId = video.video_id;
    
    // video_id가 없으면 source_url에서 추출 시도
    if (!videoId && video.platform === "youtube") {
      videoId = extractYouTubeVideoId(video.source_url);
    } else if (!videoId && video.platform === "facebook") {
      // Facebook URL에서 video ID 추출 (간단한 패턴)
      const match = video.source_url.match(/\/videos\/(\d+)/);
      videoId = match ? match[1] : null;
    }

    return {
      ...video,
      video_id: videoId,
      // status가 없으면 기본값 설정
      status: video.status || 'active',
      // language가 없으면 기본값 설정
      language: video.language || 'en',
    };
  });

  // 표준 응답 형식 (items, total, page, page_size)
  return {
    items: enhancedVideos,
    total,
    page: currentPage,
    page_size: safeLimit,
    cursor: videos.length > 0 ? videos[videos.length - 1].created_at : null,
  };
});

// ==================== 인증 필요 엔드포인트 ====================

// 현재 사용자 정보
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

// 이메일/비밀번호 로그인
app.post("/auth/login", async (request, reply) => {
  const { email, password } = request.body;

  if (!email) {
    return reply.code(400).send({ error: "email is required" });
  }

  // 이메일로 사용자 조회
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);

  if (!user) {
    return reply.code(401).send({ error: "Invalid email" });
  }

  // 비밀번호가 설정되지 않은 경우 (최초 로그인)
  if (!user.password_hash) {
    return reply.code(403).send({ 
      error: "Password not set",
      requires_setup: true,
      user_id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  // 비밀번호 필수
  if (!password) {
    return reply.code(400).send({ error: "password is required" });
  }

  // 비밀번호 검증 (password_hash를 salt로 사용)
  if (!verifyPassword(password, user.password_hash, user.api_key_salt)) {
    return reply.code(401).send({ error: "Invalid email or password" });
  }

  // JWT 토큰 생성
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

// 최초 비밀번호 설정
app.post("/auth/setup-password", async (request, reply) => {
  const { email, new_password, new_email } = request.body;

  if (!email || !new_password) {
    return reply.code(400).send({ error: "email and new_password are required" });
  }

  // 사용자 조회
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);

  if (!user) {
    return reply.code(404).send({ error: "User not found" });
  }

  // 이미 비밀번호가 설정된 경우
  if (user.password_hash) {
    return reply.code(400).send({ error: "Password already set. Use change-password instead." });
  }

  // 비밀번호 해싱
  const { hash, salt } = hashPassword(new_password);

  // 이메일 변경 여부 확인 (크리에이터의 경우)
  let updateEmail = email;
  if (new_email && new_email !== email) {
    // 이메일 중복 확인
    const existing = db.prepare("SELECT * FROM users WHERE email = ? AND id != ?").get(new_email, user.id);
    if (existing) {
      return reply.code(409).send({ error: "Email already exists" });
    }
    updateEmail = new_email;
  }

  // 비밀번호 및 이메일 설정
  db.prepare(
    "UPDATE users SET email = ?, password_hash = ?, api_key_salt = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(updateEmail, hash, salt, user.id);

  console.log(`✅ 최초 비밀번호 설정: ${updateEmail}`);

  // JWT 토큰 생성
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

// 비밀번호 변경
app.post("/auth/change-password", { preHandler: authenticate }, async (request, reply) => {
  const { current_password, new_password } = request.body;
  const user = request.user;

  if (!current_password || !new_password) {
    return reply.code(400).send({ error: "current_password and new_password are required" });
  }

  // 현재 비밀번호 확인
  if (!verifyPassword(current_password, user.password_hash, user.api_key_salt)) {
    return reply.code(401).send({ error: "Current password is incorrect" });
  }

  // 새 비밀번호 해싱
  const { hash, salt } = hashPassword(new_password);

  // 비밀번호 업데이트
  db.prepare(
    "UPDATE users SET password_hash = ?, api_key_salt = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(hash, salt, user.id);

  console.log(`✅ 비밀번호 변경: ${user.email}`);

  return { success: true, message: "Password changed successfully" };
});

// 프로필 수정 (이메일, 이름)
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
    // 이메일 중복 확인
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

// ==================== Admin 전용 엔드포인트 ====================

// 사이트 생성
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

// 사이트 목록 조회
app.get(
  "/admin/sites",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const sites = db.prepare("SELECT * FROM sites ORDER BY created_at DESC").all();
    return { sites };
  }
);

// Creator 생성
app.post(
  "/admin/creators",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { site_id, name, email, password } = request.body;

    if (!site_id || !name) {
      return reply.code(400).send({ error: "site_id and name are required" });
    }

    // site_id 존재 확인
    const site = db.prepare("SELECT * FROM sites WHERE id = ?").get(site_id);
    if (!site) {
      return reply.code(404).send({ error: "Site not found" });
    }

    // 이메일 중복 확인
    if (email) {
      const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      if (existing) {
        return reply.code(409).send({ error: "Email already exists" });
      }
    }

    const creatorId = generateId();
    const apiKey = generateApiKey();
    const { hash: apiKeyHash, salt: apiKeySalt } = hashApiKey(apiKey);

    // 비밀번호 해싱 (제공된 경우)
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
      api_key: apiKey, // 평문 키는 생성 시 1회만 반환
    };
  }
);

// Creator 목록 조회
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

// Creator 정보 수정
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

// Creator 키 재발급
app.post(
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
      api_key: apiKey, // 평문 키는 재발급 시 1회만 반환
    };
  }
);

// Admin - 방문자 통계
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

    // 커스텀 날짜 범위가 제공된 경우
    if (start_date && end_date) {
      startDateStr = start_date;
      endDateStr = end_date;
    } else {
      // 기간별 날짜 계산
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

    // 총 방문자 수
    const totalVisits = db.prepare(
      "SELECT COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= ? AND date(created_at) <= ?"
    ).get(site_id, startDateStr, endDateStr);

    // 국가별 통계
    const byCountry = db.prepare(
      "SELECT country_code, country_name, COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= ? AND date(created_at) <= ? GROUP BY country_code, country_name ORDER BY count DESC"
    ).all(site_id, startDateStr, endDateStr);

    // 언어별 통계
    const byLanguage = db.prepare(
      "SELECT language, COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= ? AND date(created_at) <= ? GROUP BY language ORDER BY count DESC"
    ).all(site_id, startDateStr, endDateStr);

    // 일별 방문자 추이
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

// Admin - Videos 전체 조회 (사이트 필터 가능)
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

// Admin - Video 삭제
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

// Admin - 일괄 삭제
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
      console.error("일괄 삭제 오류:", err);
      return reply.code(500).send({ error: "Batch delete failed" });
    }
  }
);

// Admin - Video 수정 (모든 필드)
app.patch(
  "/admin/videos/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;
    const { platform, source_url, title, thumbnail_url, visibility, language, status } = request.body;

    // 영상 존재 확인
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

    // source_url이나 platform이 변경되면 메타정보 및 video_id 재생성
    if (source_url !== undefined || platform !== undefined) {
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

      // video_id 추출 및 업데이트
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

// Admin - Video Stats 수정
app.patch(
  "/admin/videos/:id/stats",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;
    const { views_count, likes_count, shares_count } = request.body;
    const user = request.user;

    // 현재 영상 정보 조회
    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);

    if (!video) {
      return reply.code(404).send({ error: "Video not found" });
    }

    // 변경 로그 기록
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

    // Stats 업데이트
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

// ==================== Creator 전용 엔드포인트 ====================

// Creator - Videos 조회 (자기 것만)
app.get(
  "/videos",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { site_id } = request.query;
    const user = request.user;

    // creator는 자기 site_id만 접근 가능
    const targetSiteId = site_id || user.site_id;

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

// Creator - 일괄 영상 생성
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

    // Admin은 site_id 지정 가능, Creator는 자기 site_id 사용
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

        // 메타정보 자동 보강
        const metadata = await enrichMetadata(platform, source_url, title, thumbnail_url);

        // video_id 추출
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

// Creator - Video 생성 (Admin도 사용 가능)
app.post(
  "/videos",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { platform, source_url, title, thumbnail_url, visibility = "public", language = "en", status = "active", site_id } = request.body;
    const user = request.user;

    if (!platform || !source_url) {
      return reply.code(400).send({ error: "platform and source_url are required" });
    }

    // Admin은 site_id를 지정 가능, Creator는 자기 site_id로 강제
    let siteId;
    if (user.role === "admin") {
      // Admin: body에서 site_id 받기 (없으면 에러)
      siteId = site_id;
      if (!siteId) {
        return reply.code(400).send({ error: "Admin must provide site_id" });
      }
    } else {
      // Creator: 자기 site_id 사용
      siteId = user.site_id;
      if (!siteId) {
        return reply.code(400).send({ error: "Creator must have a site_id" });
      }
    }

    // 메타정보 자동 보강
    const metadata = await enrichMetadata(platform, source_url, title, thumbnail_url);

    // video_id 추출
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

// Creator - Video 수정
app.patch(
  "/videos/:id",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { id } = request.params;
    const { platform, source_url, title, thumbnail_url, visibility, language, status } = request.body;
    const user = request.user;

    // 본인 소유 확인
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

    // source_url이나 platform이 변경되면 메타정보 및 video_id 재생성
    if (source_url !== undefined || platform !== undefined) {
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

      // video_id 추출 및 업데이트
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

// Creator - Video 삭제
app.delete(
  "/videos/:id",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { id } = request.params;
    const user = request.user;

    // 본인 소유 확인
    const result = db
      .prepare("DELETE FROM videos WHERE id = ? AND owner_id = ?")
      .run(id, user.id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Video not found or access denied" });
    }

    return { success: true };
  }
);

// Creator - 일괄 삭제
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

      // Admin이면 모든 영상 삭제 가능, Creator는 본인 영상만
      if (user.role === "admin") {
        const placeholders = video_ids.map(() => "?").join(",");
        const result = db.prepare(
          `DELETE FROM videos WHERE id IN (${placeholders})`
        ).run(...video_ids);
        deletedCount = result.changes;
      } else {
        // Creator: 본인 영상만 삭제
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
      console.error("일괄 삭제 오류:", err);
      return reply.code(500).send({ error: "Batch delete failed" });
    }
  }
);

// Creator - 플랫폼 키 조회
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

// Creator - 플랫폼 키 저장/수정 (upsert)
app.put(
  "/my/provider-keys",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { provider, key_name, key_value } = request.body;
    const user = request.user;

    if (!provider || !key_name || !key_value) {
      return reply.code(400).send({ error: "provider, key_name, and key_value are required" });
    }

    // 기존 키 확인
    const existing = db
      .prepare(
        "SELECT * FROM user_provider_keys WHERE user_id = ? AND provider = ? AND key_name = ?"
      )
      .get(user.id, provider, key_name);

    if (existing) {
      // 업데이트
      db.prepare(
        "UPDATE user_provider_keys SET key_value = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(key_value, existing.id);
      const updated = db
        .prepare("SELECT * FROM user_provider_keys WHERE id = ?")
        .get(existing.id);
      return updated;
    } else {
      // 생성
      const keyId = generateId();
      db.prepare(
        "INSERT INTO user_provider_keys (id, user_id, provider, key_name, key_value) VALUES (?, ?, ?, ?, ?)"
      ).run(keyId, user.id, provider, key_name, key_value);
      const created = db.prepare("SELECT * FROM user_provider_keys WHERE id = ?").get(keyId);
      return created;
    }
  }
);

// Creator - 플랫폼 키 삭제
app.delete(
  "/my/provider-keys/:id",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { id } = request.params;
    const user = request.user;

    // 본인 소유 확인
    const result = db
      .prepare("DELETE FROM user_provider_keys WHERE id = ? AND user_id = ?")
      .run(id, user.id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Key not found or access denied" });
    }

    return { success: true };
  }
);

// 서버 시작
const PORT = process.env.PORT || 8787;
app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`✅ CMS API Server running on ${address}`);
  console.log(`📊 Admin UI: http://localhost:${PORT}/admin`);
  console.log(`🎨 Creator UI: http://localhost:${PORT}/creator`);
});
