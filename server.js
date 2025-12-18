import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import multipart from "@fastify/multipart";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { randomUUID } from "crypto";
import fetch from "node-fetch";
import db, { initDB, hashApiKey, generateApiKey, generateId, hashPassword, verifyPassword, generateManagementNo } from "./db.js";
import { getUserByApiKey, authenticate, requireAdmin, requireCreator } from "./auth.js";
import { enrichMetadata, extractYouTubeVideoId, normalizeFacebookUrl } from "./metadata.js";
import { generateToken, verifyToken, getTokenExpiry } from "./jwt.js";

dotenv.config();

// ==================== 런타임 포트/호스트 설정 ====================
// 정책:
// - 기본 포트 8787 고정 (자동으로 8788로 넘어가지 않음)
// - 필요 시 환경변수 PORT/HOST/API_BASE_URL로 명시적으로 변경
const DEFAULT_PORT = 8787;
const PORT = Number.parseInt(process.env.PORT || "", 10) || DEFAULT_PORT;
const HOST = (process.env.HOST || "0.0.0.0").trim();
const LOCAL_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: true });

// 쿠키 설정
await app.register(cookie, {
  secret: process.env.COOKIE_SECRET || "change_this_cookie_secret_key_to_secure_random_string", // 쿠키 서명용 (선택사항)
  parseOptions: {}, // 쿠키 파싱 옵션
});

// JWT 설정
await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || "change_this_jwt_secret_key_to_secure_random_string"
});

// CORS 설정
const isDevelopment = process.env.NODE_ENV !== 'production';

// 개발 환경 기본 허용 Origin 목록
const defaultDevOrigins = [
  "http://localhost:3000",  // Next.js 홈페이지
  "http://localhost:5173",  // Vite CMS 프론트엔드
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

// 운영 환경 기본 허용 Origin 목록
const defaultProdOrigins = [
  "https://www.godcomfortword.com",
  "https://cms.godcomfortword.com",
];

// 환경변수에서 CORS_ORIGINS를 읽거나 기본값 사용
const getCorsOrigins = () => {
  if (process.env.CORS_ORIGINS) {
    // 환경변수가 설정되어 있으면 사용 (쉼표로 구분)
    return process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  }
  
  // 환경변수가 없으면 환경에 따라 기본값 사용
  return isDevelopment ? defaultDevOrigins : defaultProdOrigins;
};

const allowedOrigins = getCorsOrigins();

await app.register(cors, {
  origin: (origin, cb) => {
    // 개발 환경에서만 상세 로그
    if (isDevelopment) {
      console.log(`🌐 CORS Request from origin: ${origin || '(no origin)'}`);
    }

    // origin이 없으면 (curl/server-to-server/Postman 등) 허용
    if (!origin) {
      cb(null, true);
      return;
    }

    // 허용된 origin이면 통과
    if (allowedOrigins.includes(origin)) {
      cb(null, true);
      return;
    }

    // 허용되지 않은 origin (경고 로그)
    console.warn(`⚠️ CORS blocked: ${origin}`);
    console.warn(`   Allowed origins: ${allowedOrigins.join(", ")}`);
    cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true, // 쿠키/인증 헤더 사용 (withCredentials: true 지원)
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // 허용 HTTP 메서드
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-API-Key",
    "X-Client-Id",
    "Accept",
    "Origin",
    "X-Requested-With",
  ], // 허용 요청 헤더
  exposedHeaders: [
    "Content-Length",
    "X-Total-Count",
    "Authorization",
  ], // 클라이언트에서 접근 가능한 응답 헤더
  preflight: true, // preflight 요청 자동 처리
  optionsSuccessStatus: 204, // OPTIONS 요청 응답 코드
  preflightContinue: false, // preflight 후 다음 핸들러로 전달하지 않음
  maxAge: 86400, // preflight 결과 캐시 시간 (24시간)
});

// 멀티파트 업로드 지원
await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
});

// 정적 파일 서빙 (Admin UI, Creator UI)
await app.register(staticFiles, {
  root: path.join(__dirname, "public"),
  prefix: "/",
  decorateReply: false
});

// 업로드된 썸네일 파일 서빙
await app.register(staticFiles, {
  root: path.join(__dirname, "uploads"),
  prefix: "/uploads",
  decorateReply: false
});

// DB 초기화
initDB();

// Admin 자동 생성 (부트스트랩 키로) - 개발 환경에서만
const bootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY || "change_this";
const existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!existingAdmin && isDevelopment) {
  const adminId = generateId();
  const adminApiKey = generateApiKey();
  const { hash, salt } = hashApiKey(adminApiKey);
  db.prepare(
    "INSERT INTO users (id, name, role, status, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(adminId, "Admin", "admin", "active", hash, salt);
  console.log("=".repeat(60));
  console.log("✅ Admin 자동 생성 완료! (개발 환경)");
  console.log("⚠️  API Key는 별도로 안전하게 관리하세요!");
  console.log("=".repeat(60));
}

// ==================== 헬퍼 함수 ====================

/**
 * Facebook Key 마스킹 함수 (보안)
 * 공개 API에서 facebook_key 원문을 노출하지 않기 위해 사용
 * @param {string|null} key - 원본 Facebook Key
 * @returns {string|null} - 마스킹된 키 (예: "EA...xyz") 또는 null
 */
function maskFacebookKey(key) {
  if (!key || typeof key !== 'string') {
    return null;
  }
  
  if (key.length > 5) {
    return `${key.substring(0, 2)}...${key.substring(key.length - 3)}`;
  } else {
    return "***";
  }
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

    // 간단한 IP 기반 국가 추정 (실제로는 GeoIP 서비스를 사용 권장)
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
  const { site_id, platform, limit = 20, cursor, page = 1, lang } = request.query;

  if (!site_id) {
    return reply.code(400).send({ error: "site_id query parameter is required" });
  }

  // limit 제한: 기본 20, 최대 100
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const currentPage = Math.max(parseInt(page) || 1, 1);

  // 전체 개수 조회
  let countQuery =
    "SELECT COUNT(*) as total FROM videos v WHERE v.site_id = ? AND v.visibility = 'public' AND (v.status IS NULL OR v.status = 'active')";
  const countParams = [site_id];

  if (platform) {
    countQuery += " AND v.platform = ?";
    countParams.push(platform);
  }

  // 언어 필터 추가
  if (lang) {
    countQuery += " AND v.language = ?";
    countParams.push(lang);
  }

  const { total } = db.prepare(countQuery).get(...countParams);

  // 영상 목록 조회
  let query =
    "SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE v.site_id = ? AND v.visibility = 'public' AND (v.status IS NULL OR v.status = 'active')";
  const params = [site_id];

  if (platform) {
    query += " AND v.platform = ?";
    params.push(platform);
  }

  // 언어 필터 추가
  if (lang) {
    query += " AND v.language = ?";
    params.push(lang);
  }

  if (cursor) {
    // cursor는 정렬 기준에 맞춰 조정 (created_at 기준)
    query += " AND v.created_at < ?";
    params.push(cursor);
  }

  // 정렬: 대량 등록 우선 정렬
  // 1순위: batch_created_at DESC (대량 등록 묶음 생성 시간, 없으면 created_at DESC)
  // 2순위: batch_order ASC (묶음 안 순서, 없으면 management_id DESC 또는 created_at DESC)
  // 3순위: created_at DESC (fallback)
  query += " ORDER BY COALESCE(v.batch_created_at, v.created_at) DESC, COALESCE(v.batch_order, 999999) ASC, v.management_id DESC, v.created_at DESC LIMIT ?";
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
      // thumbnail_url 명시적으로 포함 (페이스북 썸네일 포함)
      thumbnail_url: video.thumbnail_url || null,
      thumbnailUrl: video.thumbnail_url || null, // camelCase 호환성
      // status가 없으면 기본값 설정
      status: video.status || 'active',
      // language가 없으면 기본값 설정
      language: video.language || 'en',
      // views, likes, shares가 없으면 기본값 0으로 설정
      views_count: video.views_count ?? 0,
      likes_count: video.likes_count ?? 0,
      shares_count: video.shares_count ?? 0,
      // registeredAt 필드 추가 (created_at을 등록일로 간주)
      registeredAt: video.created_at,
      // managementId 필드 추가 (프론트엔드 호환성)
      managementId: video.management_id,
      // 대량 등록 관련 필드 추가
      batchId: video.batch_id || null,
      batchOrder: video.batch_order || null,
      batchCreatedAt: video.batch_created_at || null,
    };
  });

  // 표준 응답 형식 (요구사항: items, total)
  return {
    items: enhancedVideos,
    total,
  };
});

// 공개 영상 조회수 증가 (익명 사용자 허용)
app.post("/public/videos/:id/view", async (request, reply) => {
  const routeName = "POST /public/videos/:id/view";
  const { id } = request.params;

  try {
    // videoId 검증
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return reply.code(400).send({ 
        error: "Bad Request", 
        message: "videoId 파라미터가 필요합니다.",
      });
    }

    // ID 형식 검증 (숫자, hex 문자열, UUID 모두 허용)
    const trimmedId = id.trim();
    const isNumeric = /^\d+$/.test(trimmedId);
    const isHexString = /^[a-fA-F0-9]+$/.test(trimmedId);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);
    
    if (!isNumeric && !isHexString && !isUuid) {
      return reply.code(400).send({ 
        error: "Bad Request", 
        message: "videoId는 숫자, hex 문자열, 또는 UUID 형식이어야 합니다.",
      });
    }

    // 영상 존재 확인
    const video = db.prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'").get(id);

    if (!video) {
      return reply.code(404).send({ 
        error: "Video not found",
        message: "영상을 찾을 수 없거나 비공개 영상입니다.",
        ok: false
      });
    }

    // 조회수 증가 (atomic increment)
    // 동시 요청에서도 레이스가 나지 않도록 DB에서 직접 +1 처리
    const updateInfo = db
      .prepare(
        "UPDATE videos SET views_count = COALESCE(views_count, 0) + 1 WHERE id = ? AND visibility = 'public'"
      )
      .run(id);

    if (!updateInfo || updateInfo.changes === 0) {
      return reply.code(404).send({ 
        error: "Video not found",
        message: "영상을 찾을 수 없거나 비공개 영상입니다.",
        ok: false
      });
    }

    const updated = db.prepare("SELECT views_count FROM videos WHERE id = ?").get(id);
    const newViewsCount = updated?.views_count ?? 0;

    console.log(`[${routeName}] 조회수 증가: video_id=${id}, viewCount=${newViewsCount}`);

    // 응답 형식: 기존(viewCount) + 표준(views_count/success) 모두 제공 (호환성)
    return {
      success: true,
      views_count: newViewsCount,
      viewCount: newViewsCount,
    };
  } catch (error) {
      console.error(`[${routeName}] 에러:`, error);
    return reply.code(500).send({ 
      error: "Internal Server Error",
      message: "조회수 증가 중 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// 조회수 증가 (별칭): /videos/:id/view  (익명 사용자 허용, public과 동일 로직)
// 요구사항: curl -X POST http://localhost:8787/videos/<id>/view
app.post("/videos/:id/view", async (request, reply) => {
  const routeName = "POST /videos/:id/view";
  const { id } = request.params;

  try {
    // videoId 검증
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return reply.code(400).send({ 
        error: "Bad Request", 
        message: "videoId 파라미터가 필요합니다.",
      });
    }

    // ID 형식 검증 (숫자, hex 문자열, UUID 모두 허용)
    const trimmedId = id.trim();
    const isNumeric = /^\d+$/.test(trimmedId);
    const isHexString = /^[a-fA-F0-9]+$/.test(trimmedId);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);
    
    if (!isNumeric && !isHexString && !isUuid) {
      return reply.code(400).send({ 
        error: "Bad Request", 
        message: "videoId는 숫자, hex 문자열, 또는 UUID 형식이어야 합니다.",
      });
    }

    // 영상 존재 확인 (public만 허용)
    const video = db.prepare("SELECT id FROM videos WHERE id = ? AND visibility = 'public'").get(id);

    if (!video) {
      return reply.code(404).send({ 
        error: "Video not found",
        message: "영상을 찾을 수 없거나 비공개 영상입니다.",
        ok: false
      });
    }

    // 조회수 증가 (atomic increment)
    const updateInfo = db
      .prepare(
        "UPDATE videos SET views_count = COALESCE(views_count, 0) + 1 WHERE id = ? AND visibility = 'public'"
      )
      .run(id);

    if (!updateInfo || updateInfo.changes === 0) {
      return reply.code(404).send({ 
        error: "Video not found",
        message: "영상을 찾을 수 없거나 비공개 영상입니다.",
        ok: false
      });
    }

    const updated = db.prepare("SELECT views_count FROM videos WHERE id = ?").get(id);
    const newViewsCount = updated?.views_count ?? 0;

    console.log(`[${routeName}] 조회수 증가: video_id=${id}, viewCount=${newViewsCount}`);

    return {
      success: true,
      views_count: newViewsCount,
      viewCount: newViewsCount, // 호환성
    };
  } catch (error) {
    console.error(`[${routeName}] 에러:`, error);
    return reply.code(500).send({ 
      error: "Internal Server Error",
      message: "조회수 증가 중 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// 공개 영상 좋아요 토글 (익명 사용자 허용)
// IP + User-Agent 기반 중복 방지 (간단한 방식)
// 헤더 'x-client-key' 지원 (선택사항)
app.post("/public/videos/:id/like", async (request, reply) => {
  const routeName = "POST /public/videos/:id/like";
  
  try {
    // 파라미터 추출 및 검증
    const { id } = request.params;
    
    // 요청 정보 로깅 (디버깅용)
    console.log(`[${routeName}] 요청 수신: videoId=${id}`);
    console.log(`[${routeName}] 요청 헤더:`, {
      'user-agent': request.headers['user-agent'],
      'x-client-key': request.headers['x-client-key'],
      'content-type': request.headers['content-type'],
      ip: request.ip,
    });
    
    // videoId 검증
    if (!id || typeof id !== 'string' || id.trim() === '') {
      console.error(`[${routeName}] 400 에러: videoId가 없거나 잘못됨. id=${id}`);
      return reply.code(400).send({ 
        error: "Bad Request", 
        message: "videoId 파라미터가 필요합니다.",
      });
    }
    
    // ID 형식 검증 (숫자, hex 문자열, UUID 모두 허용)
    const trimmedId = id.trim();
    const isNumeric = /^\d+$/.test(trimmedId);
    const isHexString = /^[a-fA-F0-9]+$/.test(trimmedId);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);
    
    if (!isNumeric && !isHexString && !isUuid) {
      console.error(`[${routeName}] 400 에러: videoId 형식이 잘못됨. id=${id} (숫자, hex 문자열, 또는 UUID 형식이어야 함)`);
      return reply.code(400).send({ 
        error: "Bad Request", 
        message: "videoId는 숫자, hex 문자열, 또는 UUID 형식이어야 합니다.",
      });
    }

    // body는 선택사항이므로 무시 (있어도 문제없음)
    // Fastify는 자동으로 JSON 파싱하지만, 빈 body도 허용됨

    // 영상 존재 확인
    let video;
    try {
      video = db.prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'").get(id);
    } catch (dbErr) {
      console.error(`[${routeName}] DB 쿼리 실패:`, dbErr.message);
      return reply.code(500).send({ 
        error: "Internal Server Error", 
        message: "데이터베이스 오류가 발생했습니다.",
      });
    }

    if (!video) {
      console.warn(`[${routeName}] 404 에러: 영상을 찾을 수 없음. id=${id}`);
      return reply.code(404).send({ 
        error: "Video not found", 
        message: "영상을 찾을 수 없거나 비공개 영상입니다.",
      });
    }

    // 클라이언트 ID 생성 (우선순위: X-Client-Id 헤더 > 쿠키 client_id > 생성 후 쿠키 설정)
    const clientIdHeader = request.headers['x-client-id'];
    let clientId;
    
    if (clientIdHeader && typeof clientIdHeader === 'string' && clientIdHeader.trim()) {
      // 헤더에서 X-Client-Id 사용
      clientId = clientIdHeader.trim().substring(0, 200);
      console.log(`[${routeName}] X-Client-Id 헤더에서 clientId 사용: ${clientId.substring(0, 30)}...`);
    } else if (request.cookies?.client_id) {
      // 쿠키에서 client_id 사용
      clientId = request.cookies.client_id.trim().substring(0, 200);
      console.log(`[${routeName}] 쿠키에서 client_id 사용: ${clientId.substring(0, 30)}...`);
    } else {
      // client_id가 없으면 생성 (UUID 형식)
      clientId = randomUUID();
      console.log(`[${routeName}] 새로운 client_id 생성: ${clientId}`);
      
      // 쿠키에 client_id 설정 (1년 유효)
      reply.setCookie('client_id', clientId, {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1년
        httpOnly: false, // JavaScript에서 접근 가능
        sameSite: 'lax',
        path: '/',
      });
    }

    if (!clientId || clientId.trim() === '') {
      console.error(`[${routeName}] 400 에러: clientId를 생성할 수 없음`);
      return reply.code(400).send({ 
        error: "Bad Request", 
        message: "클라이언트 식별자를 생성할 수 없습니다.",
      });
    }

    // 좋아요 기록 테이블 확인 및 생성 (없으면)
    // 테이블명: video_like_clients (요구사항에 맞게)
    try {
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='video_like_clients'").get();
      if (!tableInfo) {
        db.exec(`
          CREATE TABLE IF NOT EXISTS video_like_clients (
            id TEXT PRIMARY KEY,
            video_id TEXT NOT NULL,
            client_id TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(video_id, client_id)
          )
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_video_like_clients_video_id ON video_like_clients(video_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_video_like_clients_client_id ON video_like_clients(client_id)");
        console.log(`[${routeName}] video_like_clients 테이블 생성됨`);
        
        // 기존 video_likes 테이블이 있으면 마이그레이션 (선택사항)
        try {
          const oldTableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='video_likes'").get();
          if (oldTableInfo) {
            console.log(`[${routeName}] 기존 video_likes 테이블 발견, 데이터 마이그레이션 시도...`);
            db.exec(`
              INSERT OR IGNORE INTO video_like_clients (id, video_id, client_id, created_at)
              SELECT id, video_id, client_key as client_id, created_at FROM video_likes
            `);
            console.log(`[${routeName}] video_likes 데이터를 video_like_clients로 마이그레이션 완료`);
          }
        } catch (migrateErr) {
          console.warn(`[${routeName}] 마이그레이션 실패 (무시):`, migrateErr.message);
        }
      }
    } catch (tableErr) {
      console.error(`[${routeName}] video_like_clients 테이블 확인/생성 실패:`, tableErr.message);
      return reply.code(500).send({ 
        error: "Internal Server Error", 
        message: "데이터베이스 테이블 생성 실패",
      });
    }

    // 기존 좋아요 확인
    let existingLike;
    try {
      existingLike = db.prepare("SELECT * FROM video_like_clients WHERE video_id = ? AND client_id = ?").get(id, clientId);
    } catch (queryErr) {
      console.error(`[${routeName}] 좋아요 조회 실패:`, queryErr.message);
      return reply.code(500).send({ 
        error: "Internal Server Error", 
        message: "좋아요 조회 중 오류가 발생했습니다.",
      });
    }
    
    const isLiked = !!existingLike;

    let newLikesCount;
    let liked;

    try {
      if (isLiked) {
        // 이미 좋아요가 있으면 취소 (unlike) - 삭제
        db.prepare("DELETE FROM video_like_clients WHERE video_id = ? AND client_id = ?").run(id, clientId);
        liked = false;
        console.log(`[${routeName}] 좋아요 취소: video_id=${id}, clientId=${clientId.substring(0, 20)}...`);
      } else {
        // 좋아요 추가 - 삽입
        const likeId = generateId();
        db.prepare("INSERT INTO video_like_clients (id, video_id, client_id) VALUES (?, ?, ?)").run(likeId, id, clientId);
        liked = true;
        console.log(`[${routeName}] 좋아요 추가: video_id=${id}, clientId=${clientId.substring(0, 20)}...`);
      }
      
      // video_like_clients 테이블의 실제 개수로 동기화 (단일 소스 원칙)
      const actualCount = (db.prepare("SELECT COUNT(*) as count FROM video_like_clients WHERE video_id = ?").get(id) || { count: 0 }).count || 0;
      db.prepare("UPDATE videos SET likes_count = ? WHERE id = ?").run(actualCount, id);
      newLikesCount = actualCount;
      
      console.log(`[${routeName}] likes_count 동기화 완료: video_id=${id}, actualCount=${actualCount}`);
    } catch (updateErr) {
      // UNIQUE 제약조건 위반 (중복 요청) 처리
      if (updateErr.message?.includes('UNIQUE constraint')) {
        console.warn(`[${routeName}] 중복 요청 감지 (UNIQUE constraint): videoId=${id}, clientId=${clientId.substring(0, 20)}...`);
        
        // 이미 좋아요가 있는 상태이므로 현재 상태 반환
        const actualCount = (db.prepare("SELECT COUNT(*) as count FROM video_like_clients WHERE video_id = ?").get(id) || { count: 0 }).count || 0;
        db.prepare("UPDATE videos SET likes_count = ? WHERE id = ?").run(actualCount, id);
        
        return {
          liked: true,
          likeCount: actualCount,
        };
      }
      
      console.error(`[${routeName}] 좋아요 업데이트 실패:`, updateErr.message);
      return reply.code(500).send({ 
      error: "Internal Server Error", 
      message: "좋아요 업데이트 중 오류가 발생했습니다.",
      });
    }

    // 응답 형식: { liked: boolean, likeCount: number }
    return {
      liked: liked,
      likeCount: newLikesCount,
    };
  } catch (error) {
    // 예상치 못한 에러 처리
    console.error(`[${routeName}] 예상치 못한 에러:`, error);
    console.error(`[${routeName}] 에러 스택:`, error.stack);
    return reply.code(500).send({ 
      error: "Internal Server Error", 
      message: "서버 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// 공개 영상 좋아요 취소 (별도 엔드포인트, 프론트엔드 호환성)
app.post("/public/videos/:id/unlike", async (request, reply) => {
  const { id } = request.params;
  const routeName = "POST /public/videos/:id/unlike";

  try {
    // videoId 검증
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return reply.code(400).send({ 
        error: "Bad Request", 
        message: "videoId 파라미터가 필요합니다.",
      });
    }

    // 영상 존재 확인
    const video = db.prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'").get(id);

    if (!video) {
      return reply.code(404).send({ 
        error: "Video not found", 
        message: "영상을 찾을 수 없거나 비공개 영상입니다.",
      });
    }

    // 클라이언트 ID 생성 (X-Client-Id 헤더 > 쿠키 client_id)
    const clientIdHeader = request.headers['x-client-id'];
    let clientId;
    
    if (clientIdHeader && typeof clientIdHeader === 'string' && clientIdHeader.trim()) {
      clientId = clientIdHeader.trim().substring(0, 200);
    } else if (request.cookies?.client_id) {
      clientId = request.cookies.client_id.trim().substring(0, 200);
    } else {
      // client_id가 없으면 생성 후 쿠키 설정
      clientId = randomUUID();
      reply.setCookie('client_id', clientId, {
        maxAge: 365 * 24 * 60 * 60 * 1000,
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
      });
    }

    // 기존 좋아요 확인 및 삭제
    const existingLike = db.prepare("SELECT * FROM video_like_clients WHERE video_id = ? AND client_id = ?").get(id, clientId);
    
    if (existingLike) {
      // 좋아요 취소 (삭제)
      db.prepare("DELETE FROM video_like_clients WHERE video_id = ? AND client_id = ?").run(id, clientId);
      
      // video_like_clients 테이블의 실제 개수로 동기화
      const actualCount = (db.prepare("SELECT COUNT(*) as count FROM video_like_clients WHERE video_id = ?").get(id) || { count: 0 }).count || 0;
      db.prepare("UPDATE videos SET likes_count = ? WHERE id = ?").run(actualCount, id);
      
      console.log(`[${routeName}] 좋아요 취소: video_id=${id}, likeCount=${actualCount}`);
      
      return {
        liked: false,
        likeCount: actualCount,
      };
    } else {
      // 이미 좋아요가 없는 상태 (동기화만 수행)
      const actualCount = (db.prepare("SELECT COUNT(*) as count FROM video_like_clients WHERE video_id = ?").get(id) || { count: 0 }).count || 0;
      db.prepare("UPDATE videos SET likes_count = ? WHERE id = ?").run(actualCount, id);
      
      return {
        liked: false,
        likeCount: actualCount,
      };
    }
  } catch (error) {
    console.error(`[${routeName}] 에러:`, error);
    return reply.code(500).send({ 
      error: "Internal Server Error",
      message: "좋아요 취소 중 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// 공개 영상 공유 증가 (익명 사용자 허용)
app.post("/public/videos/:id/share", async (request, reply) => {
  const { id } = request.params;
  const routeName = "POST /public/videos/:id/share";

  try {
    // videoId 검증
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return reply.code(400).send({ 
        error: "Bad Request", 
        message: "videoId 파라미터가 필요합니다.",
      });
    }

    // ID 형식 검증 (숫자, hex 문자열, UUID 모두 허용)
    const trimmedId = id.trim();
    const isNumeric = /^\d+$/.test(trimmedId);
    const isHexString = /^[a-fA-F0-9]+$/.test(trimmedId);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);
    
    if (!isNumeric && !isHexString && !isUuid) {
      return reply.code(400).send({ 
        error: "Bad Request", 
        message: "videoId는 숫자, hex 문자열, 또는 UUID 형식이어야 합니다.",
      });
    }

    // 영상 존재 확인
    const video = db.prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'").get(id);

    if (!video) {
      return reply.code(404).send({ 
        error: "Video not found", 
        message: "영상을 찾을 수 없거나 비공개 영상입니다.",
        ok: false
      });
    }

    // 공유 수 증가 (없으면 0에서 시작)
    const currentShares = video.shares_count ?? 0;
    const newSharesCount = currentShares + 1;
    db.prepare("UPDATE videos SET shares_count = ? WHERE id = ?").run(newSharesCount, id);

    console.log(`[${routeName}] 공유 수 증가: video_id=${id}, shareCount=${newSharesCount}`);

    // 응답 형식: { shareCount: number }
    return {
      shareCount: newSharesCount,
    };
  } catch (err) {
      console.error(`[${routeName}] 공유 수 증가 실패:`, err.message);
    return reply.code(500).send({ 
      error: "Internal Server Error",
      message: "공유 수 증가 중 오류가 발생했습니다.",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

// Facebook oEmbed 조회 (공개 API)
// 서버에서 creator의 facebookKey를 사용하여 oEmbed HTML 가져오기
app.get("/public/facebook/oembed", async (request, reply) => {
  const { url, video_id } = request.query;

  if (!url) {
    return reply.code(400).send({ error: "url query parameter is required" });
  }

  try {
    // video_id가 제공되면 해당 영상의 owner_id로 creator 찾기
    let creatorId = null;
    let facebookKey = null;

    if (video_id) {
      const video = db.prepare("SELECT owner_id FROM videos WHERE id = ?").get(video_id);
      if (video && video.owner_id) {
        creatorId = video.owner_id;
        // creator의 facebookKey 가져오기
        const keyRecord = db
          .prepare(
            "SELECT key_value FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
          )
          .get(creatorId);
        facebookKey = keyRecord?.key_value || null;
      }
    }

    // video_id로 찾지 못했거나 facebookKey가 없으면, 모든 creator 중 첫 번째 facebookKey 사용
    if (!facebookKey) {
      const firstCreatorWithKey = db
        .prepare(
          "SELECT upk.key_value, upk.user_id FROM user_provider_keys upk WHERE upk.provider = 'facebook' AND upk.key_name = 'access_token' LIMIT 1"
        )
        .get();
      if (firstCreatorWithKey) {
        facebookKey = firstCreatorWithKey.key_value;
        creatorId = firstCreatorWithKey.user_id;
      }
    }

    if (!facebookKey) {
      console.warn(`⚠️  GET /public/facebook/oembed: Facebook Access Token을 찾을 수 없음 (url: ${url})`);
      return reply.code(503).send({ 
        error: "Facebook Access Token not available",
        message: "서버에 Facebook Access Token이 설정되지 않았습니다."
      });
    }

    // Facebook oEmbed API 호출
    // Graph API v11.0 사용
    const oembedUrl = `https://graph.facebook.com/v11.0/oembed_video?url=${encodeURIComponent(url)}&access_token=${facebookKey}`;
    
    console.log(`[GET /public/facebook/oembed] Facebook oEmbed 요청 - url: ${url}, creator: ${creatorId || 'unknown'}`);
    
    // AbortController를 사용한 타임아웃 처리
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let response;
    try {
      response = await fetch(oembedUrl, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'CMS-API/1.0'
        }
      });
      clearTimeout(timeoutId);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        console.error(`❌ Facebook oEmbed API 호출 타임아웃 (10초 초과): ${url}`);
        return reply.code(504).send({ 
          error: "Facebook oEmbed API 호출 타임아웃",
          details: "Facebook API 서버 응답이 지연되었습니다."
        });
      }
      throw fetchErr;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Facebook oEmbed API 호출 실패: ${response.status} ${response.statusText}`, errorText);
      return reply.code(response.status === 400 ? 400 : 502).send({ 
        error: "Facebook oEmbed API 호출 실패",
        details: response.status === 400 ? "잘못된 Facebook URL이거나 접근 권한이 없습니다." : "Facebook API 서버 오류"
      });
    }

    const data = await response.json();
    
    // 응답에서 html 추출
    if (data.html) {
      return {
        html: data.html,
        width: data.width || null,
        height: data.height || null,
      };
    }

    // html이 없으면 iframeSrc 생성
    // Facebook 플러그인 URL 생성
    const iframeSrc = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=560`;
    
    return {
      html: `<iframe src="${iframeSrc}" width="560" height="315" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`,
      iframeSrc: iframeSrc,
      width: data.width || 560,
      height: data.height || 315,
    };
  } catch (err) {
    console.error("❌ Facebook oEmbed 조회 오류:", err);
    return reply.code(500).send({ 
      error: "Failed to fetch Facebook oEmbed",
      details: err.message 
    });
  }
});

// 공개 영상 통계 업데이트 (PATCH 방식, 익명 사용자 허용)
// {views_count, likes_count, shares_count} 중 원하는 필드만 업데이트 가능
app.patch("/public/videos/:id", async (request, reply) => {
  const { id } = request.params;
  const { views_count, likes_count, shares_count } = request.body;

  // 영상 존재 확인
  const video = db.prepare("SELECT * FROM videos WHERE id = ? AND visibility = 'public'").get(id);

  if (!video) {
    return reply.code(404).send({ error: "Video not found" });
  }

  // 업데이트할 필드와 값 준비
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

  if (updates.length === 0) {
    return reply.code(400).send({ error: "At least one field (views_count, likes_count, shares_count) is required" });
  }

  // 업데이트 실행
  params.push(id);
  db.prepare(`UPDATE videos SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  const updatedVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
  return {
    success: true,
    views_count: updatedVideo.views_count ?? 0,
    likes_count: updatedVideo.likes_count ?? 0,
    shares_count: updatedVideo.shares_count ?? 0,
  };
});

// 사이트 목록 조회 (공개 API) - 단일 홈페이지 최적화: 항상 "gods" 사이트 반환
app.get("/sites", async (request, reply) => {
  // 단일 홈페이지 최적화: 기본 사이트("gods") 조회
  const defaultSiteId = "gods";
  let defaultSite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
  
  // 기본 사이트가 없으면 생성
  if (!defaultSite) {
    const defaultSiteName = "God's Comfort Word";
    const defaultDomain = "godcomfortword.com";
    const defaultHomepageUrl = "https://www.godcomfortword.com";
    const defaultApiBase = LOCAL_BASE_URL;
    const defaultFacebookKey = null;
    
    try {
      db.prepare(
        "INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(
        defaultSiteId,
        defaultDomain,
        defaultSiteName,
        defaultHomepageUrl,
        defaultApiBase,
        defaultFacebookKey
      );
      defaultSite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
    } catch (err) {
      // 이미 존재하면 다시 조회
      defaultSite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
    }
  }
  
  // 프론트엔드 호환성: 필드명 매핑 (homepage_url -> base_url, api_base -> api_url)
  if (defaultSite) {
    const mappedSite = {
      ...defaultSite,
      base_url: defaultSite.homepage_url,
      api_url: defaultSite.api_base,
      site_id: defaultSite.id, // 프론트엔드 호환성
    };
    return [mappedSite];
  }
  
  return [];
});

// 기본 사이트 조회 (공개 API) - 단일 홈페이지 최적화: 항상 "gods" 사이트 반환
app.get("/sites/default", async (request, reply) => {
  // 단일 홈페이지 최적화: 기본 사이트("gods") 조회
  const defaultSiteId = "gods";
  let site = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
  
  if (!site) {
    // 기본 사이트가 없으면 생성
    const defaultSiteName = "God's Comfort Word";
    const defaultDomain = "godcomfortword.com";
    const defaultHomepageUrl = "https://www.godcomfortword.com";
    const defaultApiBase = LOCAL_BASE_URL;
    const defaultFacebookKey = null;
    
    try {
      db.prepare(
        "INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(
        defaultSiteId,
        defaultDomain,
        defaultSiteName,
        defaultHomepageUrl,
        defaultApiBase,
        defaultFacebookKey
      );
      site = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
    } catch (err) {
      // 이미 존재하면 다시 조회
      site = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
    }
  }
  
  if (!site) {
    return reply.code(404).send({ error: "Default site not found" });
  }
  
  // 프론트엔드 호환성: 필드명 매핑 (homepage_url -> base_url, api_base -> api_url)
  return {
    ...site,
    base_url: site.homepage_url,
    api_url: site.api_base,
    site_id: site.id, // 프론트엔드 호환성
  };
});

// 사이트 생성 (공개 API) - 단일 홈페이지 최적화: 기본 사이트가 없으면 "gods" 생성
app.post("/sites", async (request, reply) => {
  const { domain, name, homepage_url, api_base, base_url, api_url, facebook_key } = request.body;

  // 필드명 매핑 (프론트엔드 호환성)
  const homepageUrl = homepage_url || base_url;
  const apiBase = api_base || api_url;

  if (!name) {
    return reply.code(400).send({ error: "name is required" });
  }

  // 단일 홈페이지 최적화: 기본 사이트("gods")가 없으면 생성, 있으면 업데이트
  const defaultSiteId = "gods";
  const existingDefaultSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(defaultSiteId);

  if (existingDefaultSite) {
    // 기본 사이트가 있으면 업데이트
    const extractedDomain = domain || (homepageUrl ? homepageUrl.replace(/^https?:\/\//, "").split("/")[0] : null);
    
    try {
      db.prepare(
        "UPDATE sites SET name = ?, domain = ?, homepage_url = ?, api_base = ?, facebook_key = ? WHERE id = ?"
      ).run(
        name,
        extractedDomain || existingDefaultSite.domain,
        homepageUrl || existingDefaultSite.homepage_url,
        apiBase || existingDefaultSite.api_base,
        facebook_key !== undefined ? facebook_key : existingDefaultSite.facebook_key,
        defaultSiteId
      );

      const updatedSite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
      // 프론트엔드 호환성: 필드명 매핑
      return {
        ...updatedSite,
        base_url: updatedSite.homepage_url,
        api_url: updatedSite.api_base,
        site_id: updatedSite.id,
      };
    } catch (err) {
      console.error("사이트 업데이트 오류:", err);
      return reply.code(500).send({ error: "Failed to update site" });
    }
  } else {
    // 기본 사이트가 없으면 생성
    const extractedDomain = domain || (homepageUrl ? homepageUrl.replace(/^https?:\/\//, "").split("/")[0] : "godcomfortword.com");
    const defaultHomepageUrl = homepageUrl || "https://www.godcomfortword.com";
    const defaultApiBase = apiBase || LOCAL_BASE_URL;

    try {
      db.prepare(
        "INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(
        defaultSiteId,
        extractedDomain,
        name,
        defaultHomepageUrl,
        defaultApiBase,
        facebook_key || null
      );
      
      const createdSite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
      // 프론트엔드 호환성: 필드명 매핑
      return {
        ...createdSite,
        base_url: createdSite.homepage_url,
        api_url: createdSite.api_base,
        site_id: createdSite.id,
      };
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT") {
        // 이미 존재하면 다시 조회
        const retrySite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
        return retrySite;
      }
      console.error("사이트 생성 오류:", err);
      return reply.code(500).send({ error: "Failed to create site" });
    }
  }
});

// 크리에이터 목록 조회 (공개 API)
app.get("/creators", async (request, reply) => {
  const { site_id } = request.query;

  let query = "SELECT id, site_id, name, email, role, status, created_at FROM users WHERE role = 'creator'";
  const params = [];

  if (site_id) {
    query += " AND site_id = ?";
    params.push(site_id);
  }

  query += " ORDER BY created_at DESC";

  const creators = db.prepare(query).all(...params);
  
  // 각 크리에이터의 Facebook 키 정보 추가 (보안: 마스킹 처리)
  const creatorsWithKeys = creators.map((creator) => {
    const facebookKey = db
      .prepare(
        "SELECT key_value FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
      )
      .get(creator.id);
    
    // 🔒 보안: 공개 API에서는 facebook_key 원문을 노출하지 않음
    return {
      ...creator,
      facebook_key: maskFacebookKey(facebookKey?.key_value), // 마스킹된 키만 반환
    };
  });

  return creatorsWithKeys;
});

// 크리에이터 생성 (공개 API)
app.post("/creators", async (request, reply) => {
  const { name, email, site_domain, facebook_key, site_id } = request.body;

  if (!name) {
    return reply.code(400).send({ error: "name is required" });
  }

  // site_id 결정: 직접 제공되거나 site_domain으로 찾거나 기본 사이트 사용
  let targetSiteId = site_id;
  
  if (!targetSiteId) {
    if (site_domain) {
      // site_domain으로 site 찾기
      const site = db.prepare("SELECT id FROM sites WHERE domain = ? LIMIT 1").get(site_domain);
      if (site) {
        targetSiteId = site.id;
      }
    }
    
    // 여전히 없으면 기본 사이트 사용
    if (!targetSiteId) {
      const defaultSite = db.prepare("SELECT id FROM sites ORDER BY created_at ASC LIMIT 1").get();
      if (defaultSite) {
        targetSiteId = defaultSite.id;
      } else {
        // 기본 사이트도 없으면 생성
        const defaultSiteId = "gods";
        const defaultSiteName = "God's Comfort Word";
        const defaultDomain = "www.godcomfortword.com";
        try {
          db.prepare("INSERT INTO sites (id, domain, name, created_at) VALUES (?, ?, ?, datetime('now'))").run(
            defaultSiteId,
            defaultDomain,
            defaultSiteName
          );
          targetSiteId = defaultSiteId;
        } catch (err) {
          // 이미 존재하면 조회
          const retrySite = db.prepare("SELECT id FROM sites WHERE id = ?").get(defaultSiteId);
          targetSiteId = retrySite?.id || defaultSiteId;
        }
      }
    }
  }

  // site_id 존재 확인
  const site = db.prepare("SELECT * FROM sites WHERE id = ?").get(targetSiteId);
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

  // 크리에이터 생성
  const creatorId = generateId();
  const apiKey = generateApiKey();
  const { hash: apiKeyHash, salt: apiKeySalt } = hashApiKey(apiKey);

  db.prepare(
    "INSERT INTO users (id, site_id, name, email, role, status, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(creatorId, targetSiteId, name, email || null, "creator", "active", apiKeyHash, apiKeySalt);

  // Facebook 키 저장 (제공된 경우)
  if (facebook_key) {
    const keyId = generateId();
    try {
      db.prepare(
        "INSERT INTO user_provider_keys (id, user_id, provider, key_name, key_value) VALUES (?, ?, ?, ?, ?)"
      ).run(keyId, creatorId, "facebook", "access_token", facebook_key);
    } catch (err) {
      console.warn("Facebook 키 저장 실패:", err.message);
      // 키 저장 실패해도 크리에이터는 생성됨
    }
  }

  // 생성된 크리에이터 정보 조회
  const creator = db.prepare("SELECT id, site_id, name, email, role, status, created_at FROM users WHERE id = ?").get(creatorId);
  
  // Facebook 키 정보 추가 (공개 API이므로 마스킹 처리)
  const facebookKey = db
    .prepare(
      "SELECT key_value FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
    )
    .get(creatorId);

  // 🔒 보안: 공개 API에서는 facebook_key 원문을 노출하지 않음
  let maskedFacebookKey = null;
  if (facebookKey?.key_value) {
    const key = facebookKey.key_value;
    if (key.length > 5) {
      maskedFacebookKey = `${key.substring(0, 2)}...${key.substring(key.length - 3)}`;
    } else {
      maskedFacebookKey = "***";
    }
  }

  return {
    ...creator,
    facebook_key: maskedFacebookKey, // 마스킹된 키만 반환
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

  // 비밀번호 확인
  if (!password) {
    return reply.code(400).send({ error: "password is required" });
  }

  // 비밀번호 검증 (password_hash와 salt를 사용)
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

  // 이메일 변경 여부 확인 (선택적으로)
  let updateEmail = email;
  if (new_email && new_email !== email) {
    // 이메일 중복 확인
    const existing = db.prepare("SELECT * FROM users WHERE email = ? AND id != ?").get(new_email, user.id);
    if (existing) {
      return reply.code(409).send({ error: "Email already exists" });
    }
    updateEmail = new_email;
  }

  // 비밀번호 및 이메일 업데이트
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

// 비밀번호 변경 (Public: 로그인 토큰 없이)
// 프론트(5173) 요청 바디 스펙:
// { email, currentPassword, newPassword }
// (호환: { email, current_password, new_password } 도 허용)
console.log("✅ Registered route: POST /auth/change-password-public");
app.post("/auth/change-password-public", async (request, reply) => {
  const body = request.body || {};

  const email = body.email;
  const currentPassword = body.currentPassword ?? body.current_password;
  const newPassword = body.newPassword ?? body.new_password;

  if (!email || !currentPassword || !newPassword) {
    return reply.code(400).send({
      ok: false,
      error: "Bad Request",
      message: "email, currentPassword, newPassword are required",
    });
  }

  if (typeof newPassword !== "string" || newPassword.length < 6) {
    return reply.code(400).send({
      ok: false,
      error: "Bad Request",
      message: "newPassword must be at least 6 characters",
    });
  }

  if (currentPassword === newPassword) {
    return reply.code(400).send({
      ok: false,
      error: "Bad Request",
      message: "newPassword must be different from currentPassword",
    });
  }

  // 이메일로 사용자 조회
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);

  // 보안상 '사용자 없음'과 '비번 틀림'을 동일하게 처리
  if (!user || !user.password_hash) {
    return reply.code(401).send({
      ok: false,
      error: "Unauthorized",
      message: "Invalid email or password",
    });
  }

  // 현재 비밀번호 확인
  // NOTE: 이 프로젝트는 bcrypt가 아니라 db.js의 verifyPassword(hashPassword) 체계를 사용합니다.
  if (!verifyPassword(currentPassword, user.password_hash, user.api_key_salt)) {
    return reply.code(401).send({
      ok: false,
      error: "Unauthorized",
      message: "Invalid email or password",
    });
  }

  // 새 비밀번호 해싱 및 저장
  const { hash, salt } = hashPassword(newPassword);
  db.prepare(
    "UPDATE users SET password_hash = ?, api_key_salt = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(hash, salt, user.id);

  console.log(`✅ 비밀번호 변경(Public): ${user.email}`);
  return { ok: true };
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

// 사이트 생성 (Admin) - 단일 홈페이지 최적화: 기본 사이트("gods") 생성 또는 업데이트
app.post(
  "/admin/sites",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id, name, domain, homepage_url, api_base, base_url, api_url, facebook_key } = request.body;

    // 필드명 매핑 (프론트엔드 호환성)
    const homepageUrl = homepage_url || base_url;
    const apiBase = api_base || api_url;

    if (!name) {
      return reply.code(400).send({ error: "name is required" });
    }

    // 단일 홈페이지 최적화: 기본 사이트("gods") 사용
    const defaultSiteId = id ? String(id) : "gods";
    const existingSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(defaultSiteId);

    if (existingSite) {
      // 기본 사이트가 있으면 업데이트
      const extractedDomain = domain || (homepageUrl ? homepageUrl.replace(/^https?:\/\//, "").split("/")[0] : null);
      
      try {
        db.prepare(
          "UPDATE sites SET name = ?, domain = ?, homepage_url = ?, api_base = ?, facebook_key = ? WHERE id = ?"
        ).run(
          name,
          extractedDomain || existingSite.domain,
          homepageUrl || existingSite.homepage_url,
          apiBase || existingSite.api_base,
          facebook_key !== undefined ? facebook_key : existingSite.facebook_key,
          defaultSiteId
        );

        const updatedSite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
        return updatedSite;
      } catch (err) {
        console.error("사이트 업데이트 오류:", err);
        return reply.code(500).send({ error: "Failed to update site" });
      }
    } else {
      // 기본 사이트가 없으면 생성
      const extractedDomain = domain || (homepageUrl ? homepageUrl.replace(/^https?:\/\//, "").split("/")[0] : "godcomfortword.com");
      const defaultHomepageUrl = homepageUrl || "https://www.godcomfortword.com";
      const defaultApiBase = apiBase || LOCAL_BASE_URL;

      try {
        db.prepare(
          "INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
        ).run(
          defaultSiteId,
          extractedDomain,
          name,
          defaultHomepageUrl,
          defaultApiBase,
          facebook_key || null
        );
        
        const createdSite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
        return createdSite;
      } catch (err) {
        if (err.code === "SQLITE_CONSTRAINT") {
          // 이미 존재하면 다시 조회
          const retrySite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(defaultSiteId);
          return retrySite || reply.code(409).send({ error: "Site ID already exists" });
        }
        console.error("사이트 생성 오류:", err);
        return reply.code(500).send({ error: "Failed to create site" });
      }
    }
  }
);

// 사이트 목록 조회
app.get(
  "/admin/sites",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const sites = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites ORDER BY created_at DESC").all();
    return { sites };
  }
);

// 사이트 수정 (Settings 저장용)
app.put(
  "/admin/sites/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id: siteId } = request.params;
    const { name, domain, homepage_url, api_base, base_url, api_url, facebook_key } = request.body;

    // 필드명 매핑 (프론트엔드 호환성)
    const homepageUrl = homepage_url || base_url;
    const apiBase = api_base || api_url;

    if (!name) {
      return reply.code(400).send({ error: "name is required" });
    }

    // site_id를 문자열로 변환
    const targetSiteId = String(siteId);

    // 사이트 존재 확인
    const existingSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(targetSiteId);
    if (!existingSite) {
      return reply.code(404).send({ error: `Site not found: ${targetSiteId}` });
    }

    // domain 추출 (homepage_url에서)
    let extractedDomain = domain;
    if (!extractedDomain && homepageUrl) {
      const urlMatch = homepageUrl.replace(/^https?:\/\//, "").split("/")[0];
      extractedDomain = urlMatch || null;
    }

    try {
      db.prepare(
        "UPDATE sites SET name = ?, domain = ?, homepage_url = ?, api_base = ?, facebook_key = ? WHERE id = ?"
      ).run(
        name,
        extractedDomain || existingSite.domain,
        homepageUrl || existingSite.homepage_url,
        apiBase || existingSite.api_base,
        facebook_key !== undefined ? facebook_key : existingSite.facebook_key,
        targetSiteId
      );

      const updatedSite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(targetSiteId);
      // 프론트엔드 호환성: 필드명 매핑
      return {
        ...updatedSite,
        base_url: updatedSite.homepage_url,
        api_url: updatedSite.api_base,
        site_id: updatedSite.id,
      };
    } catch (err) {
      console.error("사이트 수정 오류:", err);
      return reply.code(500).send({ error: "Failed to update site" });
    }
  }
);

// 사이트 수정 (공개 API, Settings 저장용)
app.put(
  "/sites/:id",
  async (request, reply) => {
    const { id: siteId } = request.params;
    const { name, domain, homepage_url, api_base, base_url, api_url, facebook_key } = request.body;

    // 필드명 매핑 (프론트엔드 호환성)
    const homepageUrl = homepage_url || base_url;
    const apiBase = api_base || api_url;

    if (!name) {
      return reply.code(400).send({ error: "name is required" });
    }

    // 단일 홈페이지 최적화: 숫자 site_id를 "gods"로 변환
    let targetSiteId = String(siteId);
    if (targetSiteId !== "gods") {
      // 숫자 site_id이거나 다른 값이면 "gods"로 변환
      targetSiteId = "gods";
      console.log(`⚠️  site_id(${siteId})를 "gods"로 변환`);
    }

    // 사이트 존재 확인
    const existingSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(targetSiteId);
    if (!existingSite) {
      return reply.code(404).send({ error: `Site not found: ${targetSiteId}` });
    }

    // domain 추출 (homepage_url에서)
    let extractedDomain = domain;
    if (!extractedDomain && homepageUrl) {
      const urlMatch = homepageUrl.replace(/^https?:\/\//, "").split("/")[0];
      extractedDomain = urlMatch || null;
    }

    try {
      db.prepare(
        "UPDATE sites SET name = ?, domain = ?, homepage_url = ?, api_base = ?, facebook_key = ? WHERE id = ?"
      ).run(
        name,
        extractedDomain || existingSite.domain,
        homepageUrl || existingSite.homepage_url,
        apiBase || existingSite.api_base,
        facebook_key !== undefined ? facebook_key : existingSite.facebook_key,
        targetSiteId
      );

      const updatedSite = db.prepare("SELECT id, domain, name, homepage_url, api_base, facebook_key, created_at FROM sites WHERE id = ?").get(targetSiteId);
      // 프론트엔드 호환성: 필드명 매핑
      return {
        ...updatedSite,
        base_url: updatedSite.homepage_url,
        api_url: updatedSite.api_base,
        site_id: updatedSite.id,
      };
    } catch (err) {
      console.error("사이트 수정 오류:", err);
      return reply.code(500).send({ error: "Failed to update site" });
    }
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

// Creator 목록 조회 (관리자 전용)
app.get(
  "/admin/creators",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { site_id } = request.query;

    let query = "SELECT id, site_id, name, email, role, status, created_at FROM users WHERE role = 'creator'";
    const params = [];

    if (site_id) {
      query += " AND site_id = ?";
      params.push(site_id);
    }

    query += " ORDER BY created_at DESC";

    const creators = db.prepare(query).all(...params);
    
    // 각 크리에이터의 Facebook 키 정보 추가 (관리자 전용이므로 원문 반환)
    const creatorsWithKeys = creators.map((creator) => {
      const facebookKey = db
        .prepare(
          "SELECT key_value FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
        )
        .get(creator.id);
      
      return {
        ...creator,
        facebook_key: facebookKey?.key_value || null, // 관리자 전용이므로 원문 반환
      };
    });
    
    return { creators: creatorsWithKeys };
  }
);

// Creator 정보 수정 (PUT - 전체 업데이트)
app.put(
  "/admin/creators/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;
    const { name, email, site_domain, site_url, facebook_key, status } = request.body;

    // facebook_key validation (제공된 경우)
    if (facebook_key !== undefined && facebook_key !== null) {
      if (typeof facebook_key !== 'string' || facebook_key.trim().length === 0) {
        return reply.code(400).send({ error: "facebook_key must be a non-empty string if provided" });
      }
      // Facebook Access Token 형식 검증 (기본: EA로 시작하는 긴 문자열)
      if (!facebook_key.startsWith('EA') && facebook_key.length < 20) {
        console.warn(`⚠️  PUT /admin/creators/:id: facebook_key 형식이 일반적이지 않음 (길이: ${facebook_key.length})`);
      }
    }

    // Creator 존재 확인
    const creator = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'creator'").get(id);
    if (!creator) {
      return reply.code(404).send({ error: "Creator not found" });
    }

    // 🔒 site_id는 무조건 "gods"로 강제 (단일 사이트 운영)
    const targetSiteId = "gods";
    
    // "gods" 사이트가 존재하는지 확인
    const siteCheck = db.prepare("SELECT * FROM sites WHERE id = ?").get(targetSiteId);
    if (!siteCheck) {
      return reply.code(404).send({ error: `Site '${targetSiteId}' not found in sites table` });
    }

    // users 테이블 업데이트
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }

    if (email !== undefined) {
      // 이메일 중복 확인 (다른 사용자의 이메일인지 확인)
      if (email) {
        const existing = db.prepare("SELECT * FROM users WHERE email = ? AND id != ?").get(email, id);
        if (existing) {
          return reply.code(409).send({ error: "Email already exists" });
        }
      }
      updates.push("email = ?");
      params.push(email || null);
    }

    // site_id를 "gods"로 강제 업데이트 (현재 site_id와 다르면)
    if (creator.site_id !== targetSiteId) {
      updates.push("site_id = ?");
      params.push(targetSiteId);
      console.warn(`⚠️  Creator(${id})의 site_id를 "${creator.site_id}"에서 "${targetSiteId}"로 강제 변경`);
    }

    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(id);

      const stmt = db.prepare(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
      );
      stmt.run(...params);
    }

    // Facebook 키 업데이트/저장
    if (facebook_key !== undefined) {
      if (facebook_key) {
        // 기존 키 확인
        const existingKey = db
          .prepare(
            "SELECT id FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
          )
          .get(id);

        if (existingKey) {
          // 업데이트
          db.prepare(
            "UPDATE user_provider_keys SET key_value = ?, updated_at = datetime('now') WHERE id = ?"
          ).run(facebook_key, existingKey.id);
        } else {
          // 새로 생성
          const keyId = generateId();
          db.prepare(
            "INSERT INTO user_provider_keys (id, user_id, provider, key_name, key_value) VALUES (?, ?, ?, ?, ?)"
          ).run(keyId, id, "facebook", "access_token", facebook_key);
        }
      } else {
        // facebook_key가 null이면 삭제
        db.prepare(
          "DELETE FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token'"
        ).run(id);
      }
    }

    // 업데이트된 Creator 정보 조회
    const updatedCreator = db
      .prepare("SELECT id, site_id, name, email, role, status, created_at FROM users WHERE id = ?")
      .get(id);

    // Facebook 키 정보 추가
    const facebookKey = db
      .prepare(
        "SELECT key_value FROM user_provider_keys WHERE user_id = ? AND provider = 'facebook' AND key_name = 'access_token' LIMIT 1"
      )
      .get(id);

    return {
      ...updatedCreator,
      facebook_key: facebookKey?.key_value || null,
    };
  }
);

// Creator 정보 수정 (PATCH - 부분 업데이트)
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

// Creator API 키 재발급
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
// Admin - Dashboard Summary
app.get(
  "/admin/dashboard/summary",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { site_id } = request.query;

    if (!site_id) {
      return reply.code(400).send({ error: "site_id is required" });
    }

    // 전체 영상 수
    const totalVideos = db.prepare("SELECT COUNT(*) as count FROM videos WHERE site_id = ?").get(site_id);

    // 활성 영상 수
    const activeVideos = db.prepare("SELECT COUNT(*) as count FROM videos WHERE site_id = ? AND status = 'active'").get(site_id);

    // 전체 크리에이터 수
    const totalCreators = db.prepare("SELECT COUNT(*) as count FROM users WHERE site_id = ? AND role = 'creator'").get(site_id);

    // 활성 크리에이터 수
    const activeCreators = db.prepare("SELECT COUNT(*) as count FROM users WHERE site_id = ? AND role = 'creator' AND status = 'active'").get(site_id);

    // 최근 7일 방문자 수
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentVisits = db.prepare(
      "SELECT COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= date(?)"
    ).get(site_id, sevenDaysAgo.toISOString().split('T')[0]);

    // 최근 7일 영상 조회수 합계
    const recentViews = db.prepare(
      "SELECT SUM(views_count) as total FROM videos WHERE site_id = ? AND date(created_at) >= date(?)"
    ).get(site_id, sevenDaysAgo.toISOString().split('T')[0]);

    // 최근 생성된 영상 (최대 5개)
    const recentVideos = db.prepare(
      "SELECT id, title, created_at FROM videos WHERE site_id = ? ORDER BY created_at DESC LIMIT 5"
    ).all(site_id);

    return {
      site_id,
      videos: {
        total: totalVideos.count,
        active: activeVideos.count,
      },
      creators: {
        total: totalCreators.count,
        active: activeCreators.count,
      },
      visits: {
        last_7_days: recentVisits.count,
      },
      views: {
        last_7_days: recentViews.total || 0,
      },
      recent_videos: recentVideos,
    };
  }
);

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
      // 기간으로 날짜 계산
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

    // 전체 방문자 수
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

// Admin - Videos 전체 조회 (페이지네이션 가능)
app.get(
  "/admin/videos",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { site_id, limit = 50, cursor } = request.query;

    let query =
      "SELECT v.*, u.name as owner_name, v.platform as source_type, v.management_id as admin_id FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE 1=1";
    const params = [];

    if (site_id) {
      query += " AND v.site_id = ?";
      params.push(site_id);
    }

    if (cursor) {
      query += " AND v.created_at < ?";
      params.push(cursor);
    }

    // 정렬: 대량 등록 우선 정렬
    // 1순위: batch_created_at DESC (대량 등록 묶음 생성 시간, 없으면 created_at DESC)
    // 2순위: batch_order ASC (묶음 안 순서, 없으면 management_id DESC 또는 created_at DESC)
    // 3순위: created_at DESC (fallback)
    query += " ORDER BY COALESCE(v.batch_created_at, v.created_at) DESC, COALESCE(v.batch_order, 999999) ASC, v.management_id DESC, v.created_at DESC LIMIT ?";
    params.push(parseInt(limit));

    const videos = db.prepare(query).all(...params);

    // camelCase 필드도 추가 (프론트엔드 호환성)
    const videosWithCamelCase = videos.map(video => ({
      ...video,
      sourceType: video.source_type || video.platform,
      adminId: video.admin_id || video.management_id,
      managementId: video.management_id, // 관리번호 필드 명시적 추가
      // 대량 등록 관련 필드 추가
      batchId: video.batch_id || null,
      batchOrder: video.batch_order || null,
      batchCreatedAt: video.batch_created_at || null,
    }));

    return {
      videos: videosWithCamelCase,
      cursor: videos.length > 0 ? videos[videos.length - 1].created_at : null,
    };
  }
);

// Admin - Video 생성
app.post(
  "/admin/videos",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const routeName = "POST /admin/videos";
    const { platform, source_url, title, thumbnail_url, visibility = "public", language = "en", status = "active", site_id, owner_id } = request.body;
    const user = request.user;

    if (!platform || !source_url) {
      return reply.code(400).send({ error: "platform and source_url are required" });
    }

    // 🔒 site_id는 무조건 "gods"로 강제 (단일 사이트 운영)
    const targetSiteId = "gods";
    
    // 프론트엔드가 다른 site_id를 보냈으면 경고 로그
    if (site_id != null && String(site_id) !== "gods") {
      console.warn(`⚠️  [${routeName}] site_id(${site_id}) -> "gods" 강제`);
    } else if (site_id == null) {
      console.log(`⚠️  [${routeName}] site_id 없음 -> "gods" 강제`);
    }
    
    // 저장 직전 sites 테이블에 id="gods"가 존재하는지 확인
    const defaultSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(targetSiteId);
    if (!defaultSite) {
      console.error(`❌ [${routeName}] sites 테이블에 id="gods"가 존재하지 않습니다`);
      return reply.code(500).send({ 
        error: "FOREIGN KEY constraint failed: site_id 'gods' does not exist in sites table",
        details: "Please ensure sites table has a record with id='gods' before creating videos"
      });
    }

    // 🔒 owner_id 검증 및 자동 복구
    let targetOwnerId = owner_id ? String(owner_id) : user.id;
    
    // owner_id가 users 테이블에 존재하는지 확인
    const ownerCheck = db.prepare("SELECT * FROM users WHERE id = ?").get(targetOwnerId);
    if (!ownerCheck) {
      console.warn(`⚠️  [${routeName}] owner_id(${targetOwnerId})가 users 테이블에 없어 가장 오래된 admin/creator 사용`);
      // 가장 오래된 admin 또는 creator 조회
      const defaultOwner = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'creator') ORDER BY created_at ASC LIMIT 1").get();
      if (defaultOwner) {
        targetOwnerId = defaultOwner.id;
        console.log(`   → [${routeName}] 기본 사용자로 변경: ${targetOwnerId}`);
      } else {
        return reply.code(400).send({ 
          error: `Owner ID '${targetOwnerId}' does not exist in users table, and no default user exists`,
          details: "Please ensure at least one user (admin or creator) exists in the users table"
        });
      }
    }

    // Facebook URL 정규화 (선택적, 실패 시 원본 유지)
    let normalizedSourceUrl = source_url;
    if (platform === "facebook") {
      normalizedSourceUrl = normalizeFacebookUrl(source_url);
      if (normalizedSourceUrl !== source_url) {
        console.log(`[${routeName}] Facebook URL 정규화: ${source_url} -> ${normalizedSourceUrl}`);
      }
    }

    // 메타정보 자동 보강 (정규화된 URL 사용)
    const metadata = await enrichMetadata(platform, normalizedSourceUrl, title, thumbnail_url);

    // video_id 추출
    let extractedVideoId = null;
    if (platform === "youtube") {
      extractedVideoId = extractYouTubeVideoId(source_url);
    } else if (platform === "facebook") {
      // 정규화된 URL에서 video_id 추출 시도
      const match = normalizedSourceUrl.match(/\/videos\/(\d+)/) || normalizedSourceUrl.match(/\/reel\/(\d+)/) || normalizedSourceUrl.match(/\/watch\/\?v=(\d+)/);
      extractedVideoId = match ? match[1] : null;
    }

    const videoId = generateId();
    
    // 관리번호 자동 생성 (없으면)
    let managementNo = null;
    try {
      managementNo = generateManagementNo();
      console.log(`[${routeName}] 관리번호 자동 생성: ${managementNo}`);
    } catch (err) {
      console.warn(`[${routeName}] 관리번호 생성 실패, null로 저장:`, err.message);
      // 관리번호 생성 실패해도 영상 생성은 계속 진행
    }
    
    // INSERT 시 FK 제약조건 에러 처리
    try {
      db.prepare(
        "INSERT INTO videos (id, site_id, owner_id, platform, video_id, source_url, title, thumbnail_url, embed_url, language, status, visibility, management_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        videoId,
        targetSiteId,
        targetOwnerId,
        platform,
        extractedVideoId,
        normalizedSourceUrl, // 정규화된 URL 저장
        metadata.title,
        metadata.thumbnail_url,
        metadata.embed_url,
        language,
        status,
        visibility,
        managementNo // 관리번호 추가
      );
    } catch (err) {
      console.error("❌ Video INSERT 실패:", err.message);
      console.error("   site_id:", targetSiteId);
      console.error("   owner_id:", targetOwnerId);
      
      // FK 제약조건 에러인 경우 상세 정보 제공
      if (err.message.includes("FOREIGN KEY constraint failed")) {
        // site_id 확인
        const siteCheck = db.prepare("SELECT id FROM sites WHERE id = ?").get(targetSiteId);
        const ownerCheck = db.prepare("SELECT id FROM users WHERE id = ?").get(targetOwnerId);
        
        if (!siteCheck) {
          return reply.code(400).send({ 
            error: `FOREIGN KEY constraint failed: site_id '${targetSiteId}' does not exist in sites table`,
            details: "Please provide a valid site_id or ensure sites table has at least one record"
          });
        }
        if (!ownerCheck) {
          return reply.code(400).send({ 
            error: `FOREIGN KEY constraint failed: owner_id '${targetOwnerId}' does not exist in users table`,
            details: "Please provide a valid owner_id"
          });
        }
      }
      
      return reply.code(500).send({ error: "Failed to create video", details: err.message });
    }

    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
    return video;
  }
);

// Admin - Video 삭제
app.delete(
  "/admin/videos/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const routeName = "DELETE /admin/videos/:id";
    const { id } = request.params;
    const user = request.user;

    console.log(`[${routeName}] 삭제 요청 - user: ${user.id}, role: ${user.role}, video_id: ${id}`);

    // 영상 존재 확인
    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    if (!video) {
      console.log(`[${routeName}] 영상을 찾을 수 없음: ${id}`);
      return reply.code(404).send({ error: "Video not found" });
    }

    // Admin은 owner_id/site_id와 무관하게 모든 영상 삭제 가능
    const result = db.prepare("DELETE FROM videos WHERE id = ?").run(id);

    if (result.changes === 0) {
      console.error(`[${routeName}] 삭제 실패 (변경된 행 없음): ${id}`);
      return reply.code(500).send({ error: "Delete operation failed" });
    }

    console.log(`[${routeName}] Admin이 영상 삭제 성공: ${id}`);
    return { ok: true, success: true };
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
    const routeName = "PATCH /admin/videos/:id";
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
      // Facebook URL 정규화 (선택적, 실패 시 원본 유지)
      let normalizedSourceUrl = source_url;
      if (existing.platform === "facebook" || (platform !== undefined && platform === "facebook")) {
        normalizedSourceUrl = normalizeFacebookUrl(source_url);
        if (normalizedSourceUrl !== source_url) {
          console.log(`[${routeName}] Facebook URL 정규화: ${source_url} -> ${normalizedSourceUrl}`);
        }
      }
      updates.push("source_url = ?");
      params.push(normalizedSourceUrl);
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
      // 정규화된 URL 사용 (source_url이 변경된 경우)
      const finalSourceUrl = source_url !== undefined 
        ? (existing.platform === "facebook" || (platform !== undefined && platform === "facebook")
            ? normalizeFacebookUrl(source_url)
            : source_url)
        : existing.source_url;
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

      // video_id 추출 및 업데이트 (정규화된 URL 사용)
      let extractedVideoId = null;
      if (finalPlatform === "youtube") {
        extractedVideoId = extractYouTubeVideoId(finalSourceUrl);
      } else if (finalPlatform === "facebook") {
        // 정규화된 URL에서 video_id 추출 시도
        const match = finalSourceUrl.match(/\/videos\/(\d+)/) || finalSourceUrl.match(/\/reel\/(\d+)/) || finalSourceUrl.match(/\/watch\/\?v=(\d+)/);
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

// Admin - Video Counters 업데이트 (별칭: /admin/videos/:id/counters)
app.patch(
  "/admin/videos/:id/counters",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;
    const { views_count, likes_count, shares_count } = request.body;
    const user = request.user;

    // 현재 영상 정보 조회
    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);

    if (!video) {
      return reply.code(404).send({ 
        error: "Video not found",
        message: "영상을 찾을 수 없습니다.",
      });
    }

    // 업데이트할 필드 검증
    if (views_count === undefined && likes_count === undefined && shares_count === undefined) {
      return reply.code(400).send({ 
        error: "Bad Request",
        message: "최소 하나의 카운터 값(views_count, likes_count, shares_count)을 제공해야 합니다.",
      });
    }

    // 변경 로그 기록
    try {
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
    } catch (logErr) {
      console.warn(`[PATCH /admin/videos/:id/counters] 로그 기록 실패 (무시):`, logErr.message);
    }

    // 카운터 업데이트
    const updates = [];
    const params = [];

    if (views_count !== undefined) {
      if (typeof views_count !== 'number' || views_count < 0) {
        return reply.code(400).send({ 
          error: "Bad Request",
          message: "views_count는 0 이상의 숫자여야 합니다.",
        });
      }
      updates.push("views_count = ?");
      params.push(views_count);
    }

    if (likes_count !== undefined) {
      if (typeof likes_count !== 'number' || likes_count < 0) {
        return reply.code(400).send({ 
          error: "Bad Request",
          message: "likes_count는 0 이상의 숫자여야 합니다.",
        });
      }
      updates.push("likes_count = ?");
      params.push(likes_count);
    }

    if (shares_count !== undefined) {
      if (typeof shares_count !== 'number' || shares_count < 0) {
        return reply.code(400).send({ 
          error: "Bad Request",
          message: "shares_count는 0 이상의 숫자여야 합니다.",
        });
      }
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
    
    // 응답 형식: 업데이트된 카운터만 반환
    return {
      success: true,
      videoId: id,
      views_count: updatedVideo.views_count ?? 0,
      likes_count: updatedVideo.likes_count ?? 0,
      shares_count: updatedVideo.shares_count ?? 0,
      updated_at: updatedVideo.stats_updated_at,
      updated_by: updatedVideo.stats_updated_by,
    };
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

    // creator는 자기 site_id에만 접근 가능
    const targetSiteId = site_id || user.site_id;

    if (targetSiteId !== user.site_id) {
      return reply.code(403).send({ error: "Access denied to this site_id" });
    }

    const videos = db
      .prepare(
        "SELECT *, platform as source_type, management_id as admin_id FROM videos WHERE site_id = ? AND owner_id = ? ORDER BY COALESCE(batch_created_at, created_at) DESC, COALESCE(batch_order, 999999) ASC, management_id DESC, created_at DESC"
      )
      .all(targetSiteId, user.id);

    // camelCase 필드도 추가 (프론트엔드 호환성)
    const videosWithCamelCase = videos.map(video => ({
      ...video,
      sourceType: video.source_type || video.platform,
      adminId: video.admin_id || video.management_id,
      managementId: video.management_id, // 관리번호 필드 명시적 추가
      // 대량 등록 관련 필드 추가
      batchId: video.batch_id || null,
      batchOrder: video.batch_order || null,
      batchCreatedAt: video.batch_created_at || null,
    }));

    return { videos: videosWithCamelCase };
  }
);

// 일괄 영상 생성 (bulk - Admin/Creator 모두 사용 가능)
app.post(
  "/videos/bulk",
  { preHandler: [authenticate] },
  async (request, reply) => {
    const routeName = "POST /videos/bulk";
    const { videos: videosToAdd, site_id } = request.body;
    const user = request.user;

    if (!videosToAdd || !Array.isArray(videosToAdd) || videosToAdd.length === 0) {
      return reply.code(400).send({ error: "videos array is required" });
    }

    if (videosToAdd.length > 20) {
      return reply.code(400).send({ error: "Maximum 20 videos per batch" });
    }

    // 🔒 site_id는 무조건 "gods"로 강제 (단일 사이트 운영)
    const siteId = "gods";
    
    // 프론트엔드가 다른 site_id를 보냈으면 경고 로그
    if (site_id != null && String(site_id) !== "gods") {
      console.warn(`⚠️  [${routeName}] site_id(${site_id}) -> "gods" 강제`);
    } else if (site_id == null) {
      console.log(`⚠️  [${routeName}] site_id 없음 -> "gods" 강제`);
    }
    
    // 저장 직전 sites 테이블에 id="gods"가 존재하는지 확인
    const defaultSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(siteId);
    if (!defaultSite) {
      console.error(`❌ [${routeName}] sites 테이블에 id="gods"가 존재하지 않습니다`);
      return reply.code(500).send({ 
        error: "FOREIGN KEY constraint failed: site_id 'gods' does not exist in sites table",
        details: "Please ensure sites table has a record with id='gods' before creating videos"
      });
    }

    // 🔒 owner_id 검증 및 자동 복구
    let targetOwnerId = user.id;
    const ownerCheck = db.prepare("SELECT * FROM users WHERE id = ?").get(targetOwnerId);
    if (!ownerCheck) {
      console.warn(`⚠️  [${routeName}] owner_id(${targetOwnerId})가 users 테이블에 없어 가장 오래된 admin/creator 사용`);
      // 가장 오래된 admin 또는 creator 조회
      const defaultOwner = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'creator') ORDER BY created_at ASC LIMIT 1").get();
      if (defaultOwner) {
        targetOwnerId = defaultOwner.id;
        console.log(`   → [${routeName}] 기본 사용자로 변경: ${targetOwnerId}`);
      } else {
        return reply.code(400).send({ 
          error: `Owner ID '${targetOwnerId}' does not exist in users table, and no default user exists`,
          details: "Please ensure at least one user (admin or creator) exists in the users table"
        });
      }
    }

    // 대량 등록 묶음 정보 생성 (모든 영상이 동일한 batchId와 batchCreatedAt 사용)
    const batchId = generateId();
    const batchCreatedAt = new Date().toISOString();
    console.log(`[${routeName}] 대량 등록 묶음 생성: batchId=${batchId}, batchCreatedAt=${batchCreatedAt}, 영상 개수=${videosToAdd.length}`);

    const results = [];
    const errors = [];

    for (let index = 0; index < videosToAdd.length; index++) {
      const videoData = videosToAdd[index];
      try {
        const { platform, source_url, title, thumbnail_url, visibility = "public", language = "en", status = "active" } = videoData;

        if (!platform || !source_url) {
          errors.push({ source_url, error: "platform and source_url are required" });
          continue;
        }

        // Facebook URL 정규화 (선택적, 실패 시 원본 유지)
        let normalizedSourceUrl = source_url;
        if (platform === "facebook") {
          normalizedSourceUrl = normalizeFacebookUrl(source_url);
          if (normalizedSourceUrl !== source_url) {
            console.log(`[${routeName}] Facebook URL 정규화: ${source_url} -> ${normalizedSourceUrl}`);
          }
        }

        // 메타정보 자동 보강 (정규화된 URL 사용)
        const metadata = await enrichMetadata(platform, normalizedSourceUrl, title, thumbnail_url);

        // video_id 추출 (정규화된 URL 사용)
        let extractedVideoId = null;
        if (platform === "youtube") {
          extractedVideoId = extractYouTubeVideoId(source_url);
        } else if (platform === "facebook") {
          // 정규화된 URL에서 video_id 추출 시도
          const match = normalizedSourceUrl.match(/\/videos\/(\d+)/) || normalizedSourceUrl.match(/\/reel\/(\d+)/) || normalizedSourceUrl.match(/\/watch\/\?v=(\d+)/);
          extractedVideoId = match ? match[1] : null;
        }

        const videoId = generateId();
        
        // 관리번호 자동 생성 (없으면)
        let managementNo = null;
        try {
          managementNo = generateManagementNo();
          console.log(`[${routeName}] 관리번호 자동 생성: ${managementNo}`);
        } catch (err) {
          console.warn(`[${routeName}] 관리번호 생성 실패, null로 저장:`, err.message);
          // 관리번호 생성 실패해도 영상 생성은 계속 진행
        }
        
        // INSERT 시 FK 제약조건 에러 처리
        // batchOrder는 배열 인덱스 + 1 (첫 번째 영상이 1)
        const batchOrder = index + 1;
        try {
          db.prepare(
            "INSERT INTO videos (id, site_id, owner_id, platform, video_id, source_url, title, thumbnail_url, embed_url, language, status, visibility, management_id, batch_id, batch_order, batch_created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).run(
            videoId,
            siteId,
            targetOwnerId,
            platform,
            extractedVideoId,
            normalizedSourceUrl, // 정규화된 URL 저장
            metadata.title,
            metadata.thumbnail_url,
            metadata.embed_url,
            language,
            status,
            visibility,
            managementNo, // 관리번호 추가
            batchId, // 대량 등록 묶음 ID
            batchOrder, // 묶음 안 순서 (1, 2, 3...)
            batchCreatedAt // 묶음 생성 시간
          );

          const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
          results.push(video);
        } catch (err) {
          console.error(`❌ Video INSERT 실패 (bulk):`, err.message);
          console.error(`   source_url: ${source_url}`);
          console.error(`   site_id: ${siteId}`);
          console.error(`   owner_id: ${targetOwnerId}`);
          
          if (err.message.includes("FOREIGN KEY constraint failed")) {
            const siteCheck = db.prepare("SELECT id FROM sites WHERE id = ?").get(siteId);
            const ownerCheck = db.prepare("SELECT id FROM users WHERE id = ?").get(user.id);
            
            let errorMsg = "FOREIGN KEY constraint failed";
            if (!siteCheck) {
              errorMsg += `: site_id '${siteId}' does not exist`;
            }
            if (!ownerCheck) {
              errorMsg += `: owner_id '${user.id}' does not exist`;
            }
            errors.push({ source_url, error: errorMsg });
          } else {
            errors.push({ source_url, error: err.message });
          }
        }
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

// Creator - 일괄 영상 생성 (batch - Creator 전용)
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

    const routeName = "POST /videos/batch";
    
    // 🔒 site_id는 무조건 "gods"로 강제 (단일 사이트 운영)
    const siteId = "gods";
    
    // 프론트엔드가 다른 site_id를 보냈으면 경고 로그
    if (site_id != null && String(site_id) !== "gods") {
      console.warn(`⚠️  [${routeName}] site_id(${site_id}) -> "gods" 강제`);
    } else if (site_id == null) {
      console.log(`⚠️  [${routeName}] site_id 없음 -> "gods" 강제`);
    }
    
    // 저장 직전 sites 테이블에 id="gods"가 존재하는지 확인
    const defaultSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(siteId);
    if (!defaultSite) {
      console.error(`❌ [${routeName}] sites 테이블에 id="gods"가 존재하지 않습니다`);
      return reply.code(500).send({ 
        error: "FOREIGN KEY constraint failed: site_id 'gods' does not exist in sites table",
        details: "Please ensure sites table has a record with id='gods' before creating videos"
      });
    }

    // 🔒 owner_id 검증 및 자동 복구
    let targetOwnerId = user.id;
    const ownerCheck = db.prepare("SELECT * FROM users WHERE id = ?").get(targetOwnerId);
    if (!ownerCheck) {
      console.warn(`⚠️  [${routeName}] owner_id(${targetOwnerId})가 users 테이블에 없어 가장 오래된 admin/creator 사용`);
      // 가장 오래된 admin 또는 creator 조회
      const defaultOwner = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'creator') ORDER BY created_at ASC LIMIT 1").get();
      if (defaultOwner) {
        targetOwnerId = defaultOwner.id;
        console.log(`   → [${routeName}] 기본 사용자로 변경: ${targetOwnerId}`);
      } else {
        return reply.code(400).send({ 
          error: `Owner ID '${targetOwnerId}' does not exist in users table, and no default user exists`,
          details: "Please ensure at least one user (admin or creator) exists in the users table"
        });
      }
    }

    // 대량 등록 묶음 정보 생성 (모든 영상이 동일한 batchId와 batchCreatedAt 사용)
    const batchId = generateId();
    const batchCreatedAt = new Date().toISOString();
    console.log(`[${routeName}] 대량 등록 묶음 생성: batchId=${batchId}, batchCreatedAt=${batchCreatedAt}, 영상 개수=${videosToAdd.length}`);

    const results = [];
    const errors = [];

    for (let index = 0; index < videosToAdd.length; index++) {
      const videoData = videosToAdd[index];
      try {
        const { platform, source_url, title, thumbnail_url, visibility = "public", language = "en", status = "active" } = videoData;

        if (!platform || !source_url) {
          errors.push({ source_url, error: "platform and source_url are required" });
          continue;
        }

        // Facebook URL 정규화 (선택적, 실패 시 원본 유지)
        let normalizedSourceUrl = source_url;
        if (platform === "facebook") {
          normalizedSourceUrl = normalizeFacebookUrl(source_url);
          if (normalizedSourceUrl !== source_url) {
            console.log(`[${routeName}] Facebook URL 정규화: ${source_url} -> ${normalizedSourceUrl}`);
          }
        }

        // 메타정보 자동 보강 (정규화된 URL 사용)
        const metadata = await enrichMetadata(platform, normalizedSourceUrl, title, thumbnail_url);

        // video_id 추출 (정규화된 URL 사용)
        let extractedVideoId = null;
        if (platform === "youtube") {
          extractedVideoId = extractYouTubeVideoId(source_url);
        } else if (platform === "facebook") {
          // 정규화된 URL에서 video_id 추출 시도
          const match = normalizedSourceUrl.match(/\/videos\/(\d+)/) || normalizedSourceUrl.match(/\/reel\/(\d+)/) || normalizedSourceUrl.match(/\/watch\/\?v=(\d+)/);
          extractedVideoId = match ? match[1] : null;
        }

        const videoId = generateId();
        
        // 관리번호 자동 생성 (없으면)
        let managementNo = null;
        try {
          managementNo = generateManagementNo();
          console.log(`[${routeName}] 관리번호 자동 생성: ${managementNo}`);
        } catch (err) {
          console.warn(`[${routeName}] 관리번호 생성 실패, null로 저장:`, err.message);
          // 관리번호 생성 실패해도 영상 생성은 계속 진행
        }
        
        // INSERT 시 FK 제약조건 에러 처리
        // batchOrder는 배열 인덱스 + 1 (첫 번째 영상이 1)
        const batchOrder = index + 1;
        try {
          db.prepare(
            "INSERT INTO videos (id, site_id, owner_id, platform, video_id, source_url, title, thumbnail_url, embed_url, language, status, visibility, management_id, batch_id, batch_order, batch_created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).run(
            videoId,
            siteId,
            targetOwnerId,
            platform,
            extractedVideoId,
            normalizedSourceUrl, // 정규화된 URL 저장
            metadata.title,
            metadata.thumbnail_url,
            metadata.embed_url,
            language,
            status,
            visibility,
            managementNo, // 관리번호 추가
            batchId, // 대량 등록 묶음 ID
            batchOrder, // 묶음 안 순서 (1, 2, 3...)
            batchCreatedAt // 묶음 생성 시간
          );

          const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
          results.push(video);
        } catch (err) {
          console.error(`❌ Video INSERT 실패 (batch):`, err.message);
          console.error(`   source_url: ${source_url}`);
          console.error(`   site_id: ${siteId}`);
          console.error(`   owner_id: ${targetOwnerId}`);
          
          if (err.message.includes("FOREIGN KEY constraint failed")) {
            const siteCheck = db.prepare("SELECT id FROM sites WHERE id = ?").get(siteId);
            const ownerCheck = db.prepare("SELECT id FROM users WHERE id = ?").get(user.id);
            
            let errorMsg = "FOREIGN KEY constraint failed";
            if (!siteCheck) {
              errorMsg += `: site_id '${siteId}' does not exist`;
            }
            if (!ownerCheck) {
              errorMsg += `: owner_id '${user.id}' does not exist`;
            }
            errors.push({ source_url, error: errorMsg });
          } else {
            errors.push({ source_url, error: err.message });
          }
        }
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
    const routeName = "POST /videos";
    const { platform, source_url, title, thumbnail_url, visibility = "public", language = "en", status = "active", site_id } = request.body;
    const user = request.user;

    if (!platform || !source_url) {
      return reply.code(400).send({ error: "platform and source_url are required" });
    }

    // 🔒 site_id는 무조건 "gods"로 강제 (단일 사이트 운영)
    const siteId = "gods";
    
    // 프론트엔드가 다른 site_id를 보냈으면 경고 로그
    if (site_id != null && String(site_id) !== "gods") {
      console.warn(`⚠️  [${routeName}] site_id(${site_id}) -> "gods" 강제`);
    } else if (site_id == null) {
      console.log(`⚠️  [${routeName}] site_id 없음 -> "gods" 강제`);
    }
    
    // 저장 직전 sites 테이블에 id="gods"가 존재하는지 확인
    const defaultSite = db.prepare("SELECT * FROM sites WHERE id = ?").get(siteId);
    if (!defaultSite) {
      console.error(`❌ [${routeName}] sites 테이블에 id="gods"가 존재하지 않습니다`);
      return reply.code(500).send({ 
        error: "FOREIGN KEY constraint failed: site_id 'gods' does not exist in sites table",
        details: "Please ensure sites table has a record with id='gods' before creating videos"
      });
    }

    // 🔒 owner_id 검증 및 자동 복구
    let targetOwnerId = user.id;
    const ownerCheck = db.prepare("SELECT * FROM users WHERE id = ?").get(targetOwnerId);
    if (!ownerCheck) {
      console.warn(`⚠️  [${routeName}] owner_id(${targetOwnerId})가 users 테이블에 없어 가장 오래된 admin/creator 사용`);
      // 가장 오래된 admin 또는 creator 조회
      const defaultOwner = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'creator') ORDER BY created_at ASC LIMIT 1").get();
      if (defaultOwner) {
        targetOwnerId = defaultOwner.id;
        console.log(`   → [${routeName}] 기본 사용자로 변경: ${targetOwnerId}`);
      } else {
        return reply.code(400).send({ 
          error: `Owner ID '${targetOwnerId}' does not exist in users table, and no default user exists`,
          details: "Please ensure at least one user (admin or creator) exists in the users table"
        });
      }
    }

    // Facebook URL 정규화 (선택적, 실패 시 원본 유지)
    let normalizedSourceUrl = source_url;
    if (platform === "facebook") {
      normalizedSourceUrl = normalizeFacebookUrl(source_url);
      if (normalizedSourceUrl !== source_url) {
        console.log(`[${routeName}] Facebook URL 정규화: ${source_url} -> ${normalizedSourceUrl}`);
      }
    }

    // 메타정보 자동 보강 (정규화된 URL 사용)
    const metadata = await enrichMetadata(platform, normalizedSourceUrl, title, thumbnail_url);

    // video_id 추출 (정규화된 URL 사용)
    let extractedVideoId = null;
    if (platform === "youtube") {
      extractedVideoId = extractYouTubeVideoId(source_url);
    } else if (platform === "facebook") {
      // 정규화된 URL에서 video_id 추출 시도
      const match = normalizedSourceUrl.match(/\/videos\/(\d+)/) || normalizedSourceUrl.match(/\/reel\/(\d+)/) || normalizedSourceUrl.match(/\/watch\/\?v=(\d+)/);
      extractedVideoId = match ? match[1] : null;
    }

    const videoId = generateId();
    
    // 관리번호 자동 생성 (없으면)
    let managementNo = null;
    try {
      managementNo = generateManagementNo();
      console.log(`[${routeName}] 관리번호 자동 생성: ${managementNo}`);
    } catch (err) {
      console.warn(`[${routeName}] 관리번호 생성 실패, null로 저장:`, err.message);
      // 관리번호 생성 실패해도 영상 생성은 계속 진행
    }
    
    // INSERT 시 FK 제약조건 에러 처리
    try {
      db.prepare(
        "INSERT INTO videos (id, site_id, owner_id, platform, video_id, source_url, title, thumbnail_url, embed_url, language, status, visibility, management_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        videoId,
        siteId,
        targetOwnerId,
        platform,
        extractedVideoId,
        normalizedSourceUrl, // 정규화된 URL 저장
        metadata.title,
        metadata.thumbnail_url,
        metadata.embed_url,
        language,
        status,
        visibility,
        managementNo // 관리번호 추가
      );
    } catch (err) {
      console.error("❌ Video INSERT 실패:", err.message);
      console.error("   site_id:", siteId);
      console.error("   owner_id:", user.id);
      
      // FK 제약조건 에러인 경우 상세 정보 제공
      if (err.message.includes("FOREIGN KEY constraint failed")) {
        const siteCheck = db.prepare("SELECT id FROM sites WHERE id = ?").get(siteId);
        const ownerCheck = db.prepare("SELECT id FROM users WHERE id = ?").get(targetOwnerId);
        
        if (!siteCheck) {
          return reply.code(400).send({ 
            error: `FOREIGN KEY constraint failed: site_id '${siteId}' does not exist in sites table`,
            details: "Please provide a valid site_id or ensure sites table has at least one record"
          });
        }
        if (!ownerCheck) {
          return reply.code(400).send({ 
            error: `FOREIGN KEY constraint failed: owner_id '${targetOwnerId}' does not exist in users table`,
            details: "Please provide a valid owner_id"
          });
        }
      }
      
      return reply.code(500).send({ error: "Failed to create video", details: err.message });
    }

    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
    return video;
  }
);

// Creator - Video 수정 (PATCH)
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
      // 정규화된 URL 사용 (source_url이 변경된 경우)
      const finalSourceUrl = source_url !== undefined 
        ? (existing.platform === "facebook" || (platform !== undefined && platform === "facebook")
            ? normalizeFacebookUrl(source_url)
            : source_url)
        : existing.source_url;
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

      // video_id 추출 및 업데이트 (정규화된 URL 사용)
      let extractedVideoId = null;
      if (finalPlatform === "youtube") {
        extractedVideoId = extractYouTubeVideoId(finalSourceUrl);
      } else if (finalPlatform === "facebook") {
        // 정규화된 URL에서 video_id 추출 시도
        const match = finalSourceUrl.match(/\/videos\/(\d+)/) || finalSourceUrl.match(/\/reel\/(\d+)/) || finalSourceUrl.match(/\/watch\/\?v=(\d+)/);
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

// Creator/Admin - Video 수정 (PUT - 프론트엔드 호환성)
app.put(
  "/videos/:id",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const routeName = "PUT /videos/:id";
    const { id } = request.params;
    const { platform, source_url, title, thumbnail_url, visibility, language, status } = request.body;
    const user = request.user;

    // Admin은 모든 영상 수정 가능, Creator는 본인 소유만
    let existing;
    if (user.role === "admin") {
      existing = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    } else {
      existing = db.prepare("SELECT * FROM videos WHERE id = ? AND owner_id = ?").get(id, user.id);
    }

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
      // Facebook URL 정규화 (선택적, 실패 시 원본 유지)
      let normalizedSourceUrl = source_url;
      if (existing.platform === "facebook" || (platform !== undefined && platform === "facebook")) {
        normalizedSourceUrl = normalizeFacebookUrl(source_url);
        if (normalizedSourceUrl !== source_url) {
          console.log(`[${routeName}] Facebook URL 정규화: ${source_url} -> ${normalizedSourceUrl}`);
        }
      }
      updates.push("source_url = ?");
      params.push(normalizedSourceUrl);
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
      // 정규화된 URL 사용 (source_url이 변경된 경우)
      const finalSourceUrl = source_url !== undefined 
        ? (existing.platform === "facebook" || (platform !== undefined && platform === "facebook")
            ? normalizeFacebookUrl(source_url)
            : source_url)
        : existing.source_url;
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

      // video_id 추출 및 업데이트 (정규화된 URL 사용)
      let extractedVideoId = null;
      if (finalPlatform === "youtube") {
        extractedVideoId = extractYouTubeVideoId(finalSourceUrl);
      } else if (finalPlatform === "facebook") {
        // 정규화된 URL에서 video_id 추출 시도
        const match = finalSourceUrl.match(/\/videos\/(\d+)/) || finalSourceUrl.match(/\/reel\/(\d+)/) || finalSourceUrl.match(/\/watch\/\?v=(\d+)/);
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

// Admin/Creator - Video 삭제
app.delete(
  "/videos/:id",
  { preHandler: [authenticate] },
  async (request, reply) => {
    const routeName = "DELETE /videos/:id";
    const { id } = request.params;
    const user = request.user;

    console.log(`[${routeName}] 삭제 요청 - user: ${user.id}, role: ${user.role}, video_id: ${id}`);

    // 영상 존재 확인
    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    if (!video) {
      console.log(`[${routeName}] 영상을 찾을 수 없음: ${id}`);
      return reply.code(404).send({ error: "Video not found" });
    }

    // 권한 확인: admin은 모든 영상 삭제 가능, creator는 본인 소유만
    if (user.role === "admin") {
      // Admin: owner_id/site_id와 무관하게 삭제 허용
      const result = db.prepare("DELETE FROM videos WHERE id = ?").run(id);
      if (result.changes === 0) {
        console.error(`[${routeName}] 삭제 실패 (변경된 행 없음): ${id}`);
        return reply.code(500).send({ error: "Delete operation failed" });
      }
      console.log(`[${routeName}] Admin이 영상 삭제 성공: ${id}`);
      return { ok: true, success: true };
    } else {
      // Creator: 본인 소유만 삭제 가능
      if (video.owner_id !== user.id) {
        console.warn(`[${routeName}] Creator(${user.id})가 다른 사용자의 영상(${id}, owner: ${video.owner_id}) 삭제 시도 - 거부`);
        return reply.code(403).send({ error: "Access denied: You can only delete your own videos" });
      }
      const result = db.prepare("DELETE FROM videos WHERE id = ? AND owner_id = ?").run(id, user.id);
      if (result.changes === 0) {
        console.error(`[${routeName}] Creator 삭제 실패 (변경된 행 없음): ${id}`);
        return reply.code(500).send({ error: "Delete operation failed" });
      }
      console.log(`[${routeName}] Creator가 본인 영상 삭제 성공: ${id}`);
      return { ok: true, success: true };
    }
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

// Creator - 썸네일 업로드 (멀티파트 파일 업로드)
app.post(
  "/uploads/thumbnail",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const routeName = "POST /uploads/thumbnail";
    const user = request.user;

    try {
      console.log(`[${routeName}] 썸네일 업로드 요청 - user: ${user.id}, role: ${user.role}`);

      // 멀티파트 데이터 파싱
      const data = await request.file();
      
      if (!data) {
        console.warn(`[${routeName}] 파일이 전송되지 않음`);
        return reply.code(400).send({ error: "No file uploaded" });
      }

      // 파일 확장자 검증 (이미지만 허용)
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const fileExtension = path.extname(data.filename).toLowerCase();
      
      if (!allowedExtensions.includes(fileExtension)) {
        console.warn(`[${routeName}] 허용되지 않은 파일 형식: ${fileExtension}`);
        return reply.code(400).send({ 
          error: "Invalid file type. Allowed: jpg, jpeg, png, gif, webp" 
        });
      }

      // 업로드 디렉토리 확인 및 생성
      const uploadsDir = path.join(__dirname, "uploads", "thumbnails");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log(`[${routeName}] 업로드 디렉토리 생성: ${uploadsDir}`);
      }

      // 고유한 파일명 생성 (타임스탬프 + 랜덤 문자열)
      const timestamp = Date.now();
      const randomStr = generateId().substring(0, 10);
      const filename = `${timestamp}_${randomStr}${fileExtension}`;
      const filepath = path.join(uploadsDir, filename);

      // 파일 저장
      const buffer = await data.toBuffer();
      fs.writeFileSync(filepath, buffer);
      console.log(`[${routeName}] 파일 저장 완료: ${filename}`);

      // URL 생성 (프론트엔드에서 접근 가능한 경로)
      const thumbnailUrl = `/uploads/thumbnails/${filename}`;

      // video_id가 제공되면 해당 영상의 썸네일 업데이트
      // attachFieldsToBody: true 옵션으로 필드가 request.body에 자동 추가됨
      const videoId = request.body?.video_id?.value || null;
      if (videoId) {
        const video = db.prepare("SELECT * FROM videos WHERE id = ? AND owner_id = ?").get(videoId, user.id);
        if (!video) {
          console.warn(`[${routeName}] 영상을 찾을 수 없거나 접근 권한 없음: ${videoId}`);
          // 파일은 이미 저장되었으므로 URL은 반환
        } else {
          db.prepare("UPDATE videos SET thumbnail_url = ?, updated_at = datetime('now') WHERE id = ?").run(thumbnailUrl, videoId);
          console.log(`[${routeName}] 영상 썸네일 업데이트 완료: ${videoId}`);
        }
      }

      return {
        url: thumbnailUrl,
        filename: filename,
        video_id: videoId || null,
      };
    } catch (err) {
      console.error(`[${routeName}] 썸네일 업로드 오류:`, err);
      return reply.code(500).send({ 
        error: "Failed to upload thumbnail",
        details: err.message 
      });
    }
  }
);

// Admin - 썸네일 업로드 (멀티파트 파일 업로드)
app.post(
  "/admin/uploads/thumbnail",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const routeName = "POST /admin/uploads/thumbnail";
    const user = request.user;

    try {
      console.log(`[${routeName}] 썸네일 업로드 요청 - user: ${user.id}, role: ${user.role}`);

      // 멀티파트 데이터 파싱
      const data = await request.file();
      
      if (!data) {
        console.warn(`[${routeName}] 파일이 전송되지 않음`);
        return reply.code(400).send({ error: "No file uploaded" });
      }

      // 파일 확장자 검증 (이미지만 허용)
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const fileExtension = path.extname(data.filename).toLowerCase();
      
      if (!allowedExtensions.includes(fileExtension)) {
        console.warn(`[${routeName}] 허용되지 않은 파일 형식: ${fileExtension}`);
        return reply.code(400).send({ 
          error: "Invalid file type. Allowed: jpg, jpeg, png, gif, webp" 
        });
      }

      // 업로드 디렉토리 확인 및 생성
      const uploadsDir = path.join(__dirname, "uploads", "thumbnails");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log(`[${routeName}] 업로드 디렉토리 생성: ${uploadsDir}`);
      }

      // 고유한 파일명 생성 (타임스탬프 + 랜덤 문자열)
      const timestamp = Date.now();
      const randomStr = generateId().substring(0, 10);
      const filename = `${timestamp}_${randomStr}${fileExtension}`;
      const filepath = path.join(uploadsDir, filename);

      // 파일 저장
      const buffer = await data.toBuffer();
      fs.writeFileSync(filepath, buffer);
      console.log(`[${routeName}] 파일 저장 완료: ${filename}`);

      // URL 생성 (프론트엔드에서 접근 가능한 경로)
      const thumbnailUrl = `/uploads/thumbnails/${filename}`;

      // video_id가 제공되면 해당 영상의 썸네일 업데이트
      // attachFieldsToBody: true 옵션으로 필드가 request.body에 자동 추가됨
      const videoId = request.body?.video_id?.value || null;
      if (videoId) {
        const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
        if (!video) {
          console.warn(`[${routeName}] 영상을 찾을 수 없음: ${videoId}`);
          // 파일은 이미 저장되었으므로 URL은 반환
        } else {
          db.prepare("UPDATE videos SET thumbnail_url = ?, updated_at = datetime('now') WHERE id = ?").run(thumbnailUrl, videoId);
          console.log(`[${routeName}] 영상 썸네일 업데이트 완료: ${videoId}`);
        }
      }

      return {
        url: thumbnailUrl,
        filename: filename,
        video_id: videoId || null,
      };
    } catch (err) {
      console.error(`[${routeName}] 썸네일 업로드 오류:`, err);
      return reply.code(500).send({ 
        error: "Failed to upload thumbnail",
        details: err.message 
      });
    }
  }
);

// 서버 시작 (개발 포트 고정 정책)
// - 기본 포트는 8787
// - 포트가 사용 중이면 자동으로 8788로 변경하지 않고, 종료 + 종료 안내를 출력
async function startServer() {
  console.log("=".repeat(60));
  console.log("🚀 Starting CMS API Server...");
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Requested HOST: ${HOST}`);
  console.log(`   Requested PORT: ${PORT}`);
  console.log("=".repeat(60));

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`✅ Listening (fastify): ${address}`);
    console.log(`🌐 Local API: http://localhost:${PORT}`);
    console.log(`🌐 Local API (IPv4): http://127.0.0.1:${PORT}`);
    console.log(`📊 Admin UI: http://localhost:${PORT}/admin`);
    console.log(`🎨 Creator UI: http://localhost:${PORT}/creator`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
  } catch (err) {
    if (err && err.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use. (EADDRINUSE)`);
      console.error("");
      console.error("Windows에서 점유 프로세스 확인/종료 방법:");
      console.error(`  1) 점유 PID 확인:  netstat -ano | findstr :${PORT}`);
      console.error('  2) 프로세스 이름 확인:  tasklist /FI "PID eq <PID>"');
      console.error("  3) 강제 종료:  taskkill /PID <PID> /F");
      console.error("");
      console.error("다른 포트를 쓰려면(권장X):");
      console.error("  PowerShell:  $env:PORT=8788; npm run dev");
      console.error('  CMD:        set PORT=8788 && npm run dev');
      process.exit(1);
    }

    app.log.error(err);
    process.exit(1);
  }
}

startServer();
