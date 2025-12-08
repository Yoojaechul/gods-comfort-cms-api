import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import staticFiles from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import db, { initDB, hashApiKey, generateApiKey, generateId, hashPassword, verifyPassword } from "./db.js";
import { getUserByApiKey, authenticate, requireAdmin, requireCreator } from "./auth.js";
import { enrichMetadata, extractYouTubeVideoId } from "./metadata.js";
import { generateToken, verifyToken, getTokenExpiry } from "./jwt.js";

dotenv.config();

// 환경 변수 설정
const CMS_SITE_NAME = process.env.CMS_SITE_NAME || 'GodsComfortWord';
const CMS_SITE_BASE_URL = process.env.CMS_SITE_BASE_URL || 'http://localhost:3000';
const CMS_SITE_API_URL = process.env.CMS_SITE_API_URL || CMS_SITE_BASE_URL;
const CMS_SITE_ACCESS_KEY = process.env.CMS_SITE_ACCESS_KEY;

if (!CMS_SITE_ACCESS_KEY) {
  console.warn("⚠️  CMS_SITE_ACCESS_KEY가 설정되지 않았습니다. 프로덕션 환경에서는 반드시 설정하세요.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: true });

// JWT 설정
await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || "change_this_jwt_secret_key_to_secure_random_string"
});

// CORS 설정
const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];
if (CMS_SITE_BASE_URL && CMS_SITE_BASE_URL.startsWith('http')) {
  allowedOrigins.push(CMS_SITE_BASE_URL);
}
// CMS 도메인도 추가 (예: https://cms.godscomfortword.com)
if (process.env.CMS_DOMAIN && process.env.CMS_DOMAIN.startsWith('http')) {
  allowedOrigins.push(process.env.CMS_DOMAIN);
}
// 운영 도메인 추가 (gods-comfort-word 홈페이지)
if (process.env.PRODUCTION_DOMAIN && process.env.PRODUCTION_DOMAIN.startsWith('http')) {
  allowedOrigins.push(process.env.PRODUCTION_DOMAIN);
}
// 기본 운영 도메인 (하드코딩)
allowedOrigins.push('https://www.godscomfortword.com');

await app.register(cors, {
  origin: allowedOrigins,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  credentials: true,
});

// Multipart 설정 (파일 업로드용)
await app.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 최대 10MB
  },
});

// 업로드 디렉토리 설정
const uploadsDir = path.join(__dirname, "uploads");
const thumbnailsDir = path.join(uploadsDir, "thumbnails");

// 디렉토리 생성
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
  console.log("✅ Created thumbnails upload directory:", thumbnailsDir);
}

// 정적 파일 서빙 (Admin UI, Creator UI)
await app.register(staticFiles, {
  root: path.join(__dirname, "public"),
  prefix: "/",
  decorateReply: false
});

// 업로드 파일 정적 서빙 (/uploads 경로)
await app.register(staticFiles, {
  root: path.join(__dirname, "uploads"),
  prefix: "/uploads/",
  decorateReply: false,
});

// DB 초기화 (MongoDB는 옵셔널)
try {
  await initDB();
  console.log("✅ Database initialization completed");
} catch (error) {
  console.error("⚠️  Database initialization warning:", error.message);
  console.log("📝 Continuing with SQLite only mode...");
}

// sites 테이블 생성 (새 스키마)
try {
  const sitesTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sites'")
    .get();

  if (!sitesTableExists) {
    db.exec(`
      CREATE TABLE sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_url TEXT,
        access_key TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ sites 테이블 생성 완료");
  } else {
    // 기존 테이블이 있으면 새 컬럼 추가 시도 (마이그레이션)
    try {
      db.exec("ALTER TABLE sites ADD COLUMN base_url TEXT");
    } catch (e) {
      // 컬럼이 이미 존재하면 무시
    }
    try {
      db.exec("ALTER TABLE sites ADD COLUMN api_url TEXT");
    } catch (e) {
      // 컬럼이 이미 존재하면 무시
    }
    try {
      db.exec("ALTER TABLE sites ADD COLUMN access_key TEXT");
    } catch (e) {
      // 컬럼이 이미 존재하면 무시
    }
    try {
      db.exec("ALTER TABLE sites ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");
    } catch (e) {
      // 컬럼이 이미 존재하면 무시
    }
    try {
      db.exec("ALTER TABLE sites ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
    } catch (e) {
      // 컬럼이 이미 존재하면 무시
    }
  }

  // 활성 사이트 확인 및 초기 데이터 삽입
  const activeSite = db.prepare("SELECT * FROM sites WHERE is_active = 1 LIMIT 1").get();
  if (!activeSite) {
    db.prepare(
      "INSERT INTO sites (name, base_url, api_url, access_key, is_active) VALUES (?, ?, ?, ?, ?)"
    ).run(
      CMS_SITE_NAME,
      CMS_SITE_BASE_URL,
      CMS_SITE_API_URL,
      CMS_SITE_ACCESS_KEY || null,
      1
    );
    console.log(`✅ 초기 사이트 설정 완료: ${CMS_SITE_NAME} (${CMS_SITE_BASE_URL})`);
  }
} catch (error) {
  console.error("⚠️  sites 테이블 초기화 오류:", error.message);
}

// users 테이블에 필요한 컬럼 추가 (마이그레이션)
try {
  const usersTableInfo = db.prepare("PRAGMA table_info('users')").all();
  const usersColumns = usersTableInfo.map((col) => col.name);
  
  // facebook_key 컬럼 추가
  if (!usersColumns.includes("facebook_key")) {
    try {
      db.exec("ALTER TABLE users ADD COLUMN facebook_key TEXT");
      console.log("✅ users 테이블에 facebook_key 컬럼 추가 완료");
    } catch (e) {
      if (!e.message.includes("duplicate column")) {
        console.error("⚠️  users 테이블 facebook_key 컬럼 추가 오류:", e.message);
      }
    }
  }
  
  // updated_at 컬럼 추가
  if (!usersColumns.includes("updated_at")) {
    try {
      db.exec("ALTER TABLE users ADD COLUMN updated_at TEXT");
      console.log("✅ users 테이블에 updated_at 컬럼 추가 완료");
    } catch (e) {
      if (!e.message.includes("duplicate column")) {
        console.error("⚠️  users 테이블 updated_at 컬럼 추가 오류:", e.message);
      }
    }
  }
} catch (error) {
  console.error("⚠️  users 테이블 마이그레이션 오류:", error.message);
}

// creators 테이블 생성 (새 스키마)
try {
  const creatorsTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='creators'")
    .get();

  if (!creatorsTableExists) {
    db.exec(`
      CREATE TABLE creators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        site_url TEXT,
        facebook_key TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      )
    `);
    console.log("✅ creators 테이블 생성 완료");
  } else {
    // 기존 테이블이 있으면 새 컬럼 추가 시도 (마이그레이션)
    const creatorsTableInfo = db.prepare("PRAGMA table_info('creators')").all();
    const creatorsColumns = creatorsTableInfo.map((col) => col.name);
    
    // site_url 컬럼 추가
    if (!creatorsColumns.includes("site_url")) {
      try {
        db.exec("ALTER TABLE creators ADD COLUMN site_url TEXT");
        console.log("✅ creators 테이블에 site_url 컬럼 추가 완료");
      } catch (e) {
        if (!e.message.includes("duplicate column")) {
          console.error("⚠️  creators 테이블 site_url 컬럼 추가 오류:", e.message);
        }
      }
    }
    
    // facebook_key 컬럼 추가
    if (!creatorsColumns.includes("facebook_key")) {
      try {
        db.exec("ALTER TABLE creators ADD COLUMN facebook_key TEXT");
        console.log("✅ creators 테이블에 facebook_key 컬럼 추가 완료");
      } catch (e) {
        if (!e.message.includes("duplicate column")) {
          console.error("⚠️  creators 테이블 facebook_key 컬럼 추가 오류:", e.message);
        }
      }
    }
    
    // updated_at 컬럼 추가
    if (!creatorsColumns.includes("updated_at")) {
      try {
        db.exec("ALTER TABLE creators ADD COLUMN updated_at TEXT");
        console.log("✅ creators 테이블에 updated_at 컬럼 추가 완료");
      } catch (e) {
        if (!e.message.includes("duplicate column")) {
          console.error("⚠️  creators 테이블 updated_at 컬럼 추가 오류:", e.message);
        }
      }
    }
  }
} catch (error) {
  console.error("⚠️  creators 테이블 초기화 오류:", error.message);
}

// videos 테이블 마이그레이션 (video_code, description 컬럼 추가)
try {
  const videosTableInfo = db.prepare("PRAGMA table_info('videos')").all();
  const videosColumns = videosTableInfo.map((col) => col.name);
  
  // video_code 컬럼 추가
  if (!videosColumns.includes("video_code")) {
    try {
      db.exec("ALTER TABLE videos ADD COLUMN video_code TEXT");
      console.log("✅ videos 테이블에 video_code 컬럼 추가 완료");
    } catch (e) {
      if (!e.message.includes("duplicate column")) {
        console.error("⚠️  videos 테이블 video_code 컬럼 추가 오류:", e.message);
      }
    }
  }
  
  // description 컬럼 추가 (Admin 비디오 CRUD에서 사용)
  if (!videosColumns.includes("description")) {
    try {
      db.exec("ALTER TABLE videos ADD COLUMN description TEXT DEFAULT ''");
      console.log("✅ videos 테이블에 description 컬럼 추가 완료");
    } catch (e) {
      if (!e.message.includes("duplicate column")) {
        console.error("⚠️  videos 테이블 description 컬럼 추가 오류:", e.message);
      }
    }
  }
  
  // management_id 컬럼 추가 (영상 관리번호)
  if (!videosColumns.includes("management_id")) {
    try {
      db.exec("ALTER TABLE videos ADD COLUMN management_id TEXT");
      console.log("✅ videos 테이블에 management_id 컬럼 추가 완료");
    } catch (e) {
      if (!e.message.includes("duplicate column")) {
        console.error("⚠️  videos 테이블 management_id 컬럼 추가 오류:", e.message);
      }
    }
  }
  
  // created_at 컬럼 추가 (등록 날짜)
  if (!videosColumns.includes("created_at")) {
    try {
      db.exec("ALTER TABLE videos ADD COLUMN created_at TEXT DEFAULT (datetime('now'))");
      console.log("✅ videos 테이블에 created_at 컬럼 추가 완료");
    } catch (e) {
      if (!e.message.includes("duplicate column")) {
        console.error("⚠️  videos 테이블 created_at 컬럼 추가 오류:", e.message);
      }
    }
  }
  
  // 기존 영상 중 created_at이 NULL인 것들을 현재 날짜로 채우기
  try {
    const updateResult = db.prepare(
      "UPDATE videos SET created_at = datetime('now') WHERE created_at IS NULL"
    ).run();
    if (updateResult.changes > 0) {
      console.log(`✅ 기존 영상 ${updateResult.changes}개의 created_at 값을 현재 날짜로 업데이트 완료`);
    }
  } catch (e) {
    console.error("⚠️  기존 영상 created_at 업데이트 오류:", e.message);
  }
} catch (error) {
  console.error("⚠️  videos 테이블 마이그레이션 오류:", error.message);
}

// video_interactions 테이블 생성 (영상 상호작용 추적용)
try {
  const interactionsTableExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='video_interactions'")
    .get();

  if (!interactionsTableExists) {
    db.exec(`
      CREATE TABLE video_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL,
        client_key TEXT NOT NULL,
        liked INTEGER DEFAULT 0,
        shared INTEGER DEFAULT 0,
        viewed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(video_id, client_key)
      )
    `);
    console.log("✅ video_interactions 테이블 생성 완료");
  } else {
    // 기존 테이블이 있으면 컬럼 존재 여부 확인 및 추가 (마이그레이션)
    const interactionsTableInfo = db.prepare("PRAGMA table_info('video_interactions')").all();
    const interactionsColumns = interactionsTableInfo.map((col) => col.name);
    
    // UNIQUE 제약조건이 없으면 추가 (SQLite는 ALTER TABLE로 UNIQUE 추가가 어려우므로 스킵)
    // 필요시 테이블 재생성 로직을 별도로 구현할 수 있음
  }
} catch (error) {
  console.error("⚠️  video_interactions 테이블 초기화 오류:", error.message);
}

// 사이트 로더 유틸리티 함수
function getActiveSite() {
  return db.prepare("SELECT * FROM sites WHERE is_active = 1 LIMIT 1").get();
}

// 영상 관리번호 자동 생성 함수 (YYMMDD-XXX 형식)
function generateManagementId(createdAt = null) {
  // createdAt이 제공되면 사용, 없으면 현재 시간 사용
  const date = createdAt ? new Date(createdAt) : new Date();
  
  // YYMMDD 형식으로 날짜 코드 생성
  const year = date.getFullYear().toString().slice(-2); // 뒤 2자리
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // 01-12
  const day = date.getDate().toString().padStart(2, '0'); // 01-31
  const dateCode = `${year}${month}${day}`;
  
  // 해당 날짜의 영상 개수 카운트 (management_id가 dateCode로 시작하는 것)
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD 형식
  const countResult = db.prepare(
    "SELECT COUNT(*) as count FROM videos WHERE DATE(created_at) = DATE(?) AND management_id IS NOT NULL AND management_id LIKE ?"
  ).get(dateStr, `${dateCode}-%`);
  
  const count = countResult.count || 0;
  const sequence = (count + 1).toString().padStart(3, '0'); // 001, 002, 003...
  
  return `${dateCode}-${sequence}`;
}

// 클라이언트 식별 헬퍼 함수 (x-client-key 또는 IP+User-Agent 기반)
function getClientKey(request) {
  // 우선순위 1: x-client-key 헤더
  const clientKeyHeader = request.headers["x-client-key"] || request.headers["X-Client-Key"];
  if (clientKeyHeader) {
    return clientKeyHeader;
  }
  
  // 우선순위 2: IP + User-Agent 조합
  const ip = request.ip || request.socket?.remoteAddress || "unknown";
  const userAgent = request.headers["user-agent"] || "";
  return `${ip}:${userAgent}`;
}

// 영상 display 값 계산 헬퍼 함수
function computeVideoDisplayMetrics(video) {
  // 실제 DB 컬럼명: views_actual, likes_actual, shares_actual
  // 호환성을 위해 view_count_real도 확인 (마이그레이션 중일 수 있음)
  const viewCountReal = video.views_actual ?? video.view_count_real ?? 0;
  const likeCountReal = video.likes_actual ?? video.like_count_real ?? 0;
  const shareCountReal = video.shares_actual ?? video.share_count_real ?? 0;
  const viewOffset = video.view_offset || 0;
  const likeOffset = video.like_offset || 0;
  const shareOffset = video.share_offset || 0;

  return {
    viewCountReal,
    likeCountReal,
    shareCountReal,
    viewDisplay: viewCountReal + viewOffset,
    likeDisplay: likeCountReal + likeOffset,
    shareDisplay: shareCountReal + shareOffset,
  };
}

// 영상 응답 포맷팅 헬퍼 함수
function formatVideoResponse(video) {
  const metrics = computeVideoDisplayMetrics(video);
  
  return {
    id: video.id,
    managementId: video.management_id || null, // 영상 관리번호 추가
    video_code: video.video_code || null,
    title: video.title || null,
    description: video.description || null,
    creatorName: video.owner_name || null,
    sourceType: video.platform || video.source_type || null,
    sourceUrl: video.source_url || null,
    thumbnailUrl: video.thumbnail_url || null,
    // Raw 통계 필드 (DB 원본 값) - 실제 컬럼명 사용
    view_count_real: video.views_actual ?? video.view_count_real ?? 0,
    like_count_real: video.likes_actual ?? video.like_count_real ?? 0,
    share_count_real: video.shares_actual ?? video.share_count_real ?? 0,
    view_offset: video.view_offset || 0,
    like_offset: video.like_offset || 0,
    share_offset: video.share_offset || 0,
    // 계산된 표시값 (camelCase)
    viewCountReal: metrics.viewCountReal,
    likeCountReal: metrics.likeCountReal,
    shareCountReal: metrics.shareCountReal,
    viewDisplay: metrics.viewDisplay,
    likeDisplay: metrics.likeDisplay,
    shareDisplay: metrics.shareDisplay,
    viewCount: metrics.viewDisplay,
    likeCount: metrics.likeDisplay,
    shareCount: metrics.shareDisplay,
    // 호환용 옛 필드 (gods-comfort-word 프론트엔드용)
    views_display: metrics.viewDisplay,
    likes_display: metrics.likeDisplay,
    shares_display: metrics.shareDisplay,
    createdAt: video.created_at || null,
    updatedAt: video.updated_at || null,
    // 기존 필드들도 포함
    site_id: video.site_id,
    owner_id: video.owner_id,
    language: video.language,
    visibility: video.visibility,
    status: video.status,
  };
}

// Admin 테스트 사용자 (consulting_manager@naver.com)
const testAdminEmail = "consulting_manager@naver.com";
const testAdminPassword = "123456";
const existingTestAdmin = db.prepare("SELECT * FROM users WHERE email = ?").get(testAdminEmail);

if (!existingTestAdmin) {
  const adminId = generateId();
  const adminApiKey = generateApiKey();
  const { hash: apiKeyHash, salt: apiKeySalt } = hashApiKey(adminApiKey);
  const { hash: passwordHash, salt: passwordSalt } = hashPassword(testAdminPassword);
  
  db.prepare(
    "INSERT INTO users (id, name, email, role, status, password_hash, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(adminId, "Admin", testAdminEmail, "admin", "active", passwordHash, apiKeyHash, apiKeySalt);
  
  console.log("✅ 테스트 Admin 사용자 생성 완료!");
  console.log(`이메일: ${testAdminEmail}`);
  console.log(`비밀번호: ${testAdminPassword}`);
} else {
  // 기존 사용자가 있으면 비밀번호 업데이트
  const { hash: passwordHash, salt: passwordSalt } = hashPassword(testAdminPassword);
  db.prepare(
    "UPDATE users SET password_hash = ?, api_key_salt = ?, status = 'active', role = 'admin' WHERE email = ?"
  ).run(passwordHash, passwordSalt, testAdminEmail);
  console.log(`✅ 테스트 Admin 사용자 비밀번호 업데이트 완료: ${testAdminEmail}`);
}

// Creator 테스트 사용자 (j1d1y1@naver.com)
const testCreatorEmail = "j1d1y1@naver.com";
const testCreatorPassword = "123456";
const existingTestCreator = db.prepare("SELECT * FROM users WHERE email = ?").get(testCreatorEmail);

if (!existingTestCreator) {
  const creatorId = generateId();
  const creatorApiKey = generateApiKey();
  const { hash: apiKeyHash, salt: apiKeySalt } = hashApiKey(creatorApiKey);
  const { hash: passwordHash, salt: passwordSalt } = hashPassword(testCreatorPassword);
  
  db.prepare(
    "INSERT INTO users (id, site_id, name, email, role, status, password_hash, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(creatorId, "gods", "Creator", testCreatorEmail, "creator", "active", passwordHash, apiKeyHash, apiKeySalt);
  
  console.log("✅ 테스트 Creator 사용자 생성 완료!");
  console.log(`이메일: ${testCreatorEmail}`);
  console.log(`비밀번호: ${testCreatorPassword}`);
} else {
  // 기존 사용자가 있으면 비밀번호 업데이트
  const { hash: passwordHash, salt: passwordSalt } = hashPassword(testCreatorPassword);
  db.prepare(
    "UPDATE users SET password_hash = ?, api_key_salt = ?, status = 'active', role = 'creator', site_id = 'gods' WHERE email = ?"
  ).run(passwordHash, passwordSalt, testCreatorEmail);
  console.log(`✅ 테스트 Creator 사용자 비밀번호 업데이트 완료: ${testCreatorEmail}`);
}

// ==================== 공용 엔드포인트 ====================

// Health check
app.get("/health", async (request, reply) => {
  return { ok: true, time: new Date().toISOString() };
});

// 방문자 로깅은 아래에 새로 구현됨 (analytics 테이블 지원)

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

  // formatVideoResponse를 사용하여 응답 형식 통일
  const formattedItems = enhancedVideos.map(formatVideoResponse);

  // 표준 응답 형식 (items, total, page, page_size)
  return {
    items: formattedItems,
    total,
    page: currentPage,
    page_size: safeLimit,
    cursor: videos.length > 0 ? videos[videos.length - 1].created_at : null,
  };
});

// ==================== 공개 API (좋아요/공유/조회수) ====================

// 영상 좋아요 토글 (delta 기반 + 중복 방지)
app.post("/videos/:id/like", async (request, reply) => {
  const { id } = request.params;
  const { delta } = request.body || {};
  
  // delta 기본값: +1 (없으면 증가)
  const deltaValue = delta !== undefined ? Number(delta) : 1;
  
  // 클라이언트 식별
  const clientKey = getClientKey(request);
  
  // 디버그 로그 추가
  console.log(`[CMS] POST /videos/${id}/like - 요청 수신`, {
    id,
    delta: deltaValue,
    client: clientKey.substring(0, 20) + '...',
    updateColumns: ['likes_actual', 'likes_display']
  });

  try {
    // 영상 존재 확인
    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    
    if (!video) {
      console.log(`[CMS] POST /videos/${id}/like - 영상을 찾을 수 없음`);
      return reply.code(404).send({ 
        success: false,
        message: "Video not found" 
      });
    }

    // delta가 0이면 현재 값 반환
    if (deltaValue === 0) {
      const currentVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
      return {
        success: true,
        id: currentVideo.id,
        view_real: currentVideo.views_actual || 0,
        view_display: currentVideo.views_display || 0,
        like_real: currentVideo.likes_actual || 0,
        like_display: currentVideo.likes_display || 0,
        share_real: currentVideo.shares_actual || 0,
        share_display: currentVideo.shares_display || 0,
      };
    }

    // video_interactions에서 기존 상호작용 조회
    let interaction = db.prepare(
      "SELECT * FROM video_interactions WHERE video_id = ? AND client_key = ?"
    ).get(id, clientKey);

    // row가 없으면 기본값 liked=0, shared=0, viewed=0으로 간주
    const currentLiked = interaction?.liked || 0;

    if (deltaValue > 0) {
      // 좋아요 ON 요청
      if (currentLiked === 1) {
        // 이미 좋아요 상태면 아무 것도 하지 않고 현재 통계 반환 (중복 방지)
        const currentVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
        return {
          success: true,
          id: currentVideo.id,
          view_real: currentVideo.views_actual || 0,
          view_display: currentVideo.views_display || 0,
          like_real: currentVideo.likes_actual || 0,
          like_display: currentVideo.likes_display || 0,
          share_real: currentVideo.shares_actual || 0,
          share_display: currentVideo.shares_display || 0,
        };
      }

      // 좋아요 증가 (delta 반영)
      db.prepare(
        "UPDATE videos SET likes_actual = MAX(0, COALESCE(likes_actual, 0) + ?), likes_display = MAX(0, COALESCE(likes_display, 0) + ?), updated_at = datetime('now') WHERE id = ?"
      ).run(deltaValue, deltaValue, id);

      // video_interactions 업데이트 또는 삽입
      if (interaction) {
        db.prepare(
          "UPDATE video_interactions SET liked = 1, updated_at = datetime('now') WHERE video_id = ? AND client_key = ?"
        ).run(id, clientKey);
      } else {
        db.prepare(
          "INSERT INTO video_interactions (video_id, client_key, liked, shared, viewed) VALUES (?, ?, 1, 0, 0)"
        ).run(id, clientKey);
      }
    } else {
      // 좋아요 OFF 요청 (delta < 0)
      if (!interaction || currentLiked === 0) {
        // 이미 OFF 상태면 아무 것도 하지 않고 현재 값 반환
        const currentVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
        return {
          success: true,
          id: currentVideo.id,
          view_real: currentVideo.views_actual || 0,
          view_display: currentVideo.views_display || 0,
          like_real: currentVideo.likes_actual || 0,
          like_display: currentVideo.likes_display || 0,
          share_real: currentVideo.shares_actual || 0,
          share_display: currentVideo.shares_display || 0,
        };
      }

      // 좋아요 감소 (0 미만 방지, delta 반영)
      const absDelta = Math.abs(deltaValue);
      db.prepare(
        "UPDATE videos SET likes_actual = MAX(0, COALESCE(likes_actual, 0) - ?), likes_display = MAX(0, COALESCE(likes_display, 0) - ?), updated_at = datetime('now') WHERE id = ?"
      ).run(absDelta, absDelta, id);

      // video_interactions 업데이트
      db.prepare(
        "UPDATE video_interactions SET liked = 0, updated_at = datetime('now') WHERE video_id = ? AND client_key = ?"
      ).run(id, clientKey);
    }

    // 업데이트된 영상 정보 조회
    const updatedVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);

    console.log(`[CMS] POST /videos/${id}/like - 성공: likes_actual=${updatedVideo.likes_actual || 0}, likes_display=${updatedVideo.likes_display || 0}`);

    return {
      success: true,
      id: updatedVideo.id,
      view_real: updatedVideo.views_actual || 0,
      view_display: updatedVideo.views_display || 0,
      like_real: updatedVideo.likes_actual || 0,
      like_display: updatedVideo.likes_display || 0,
      share_real: updatedVideo.shares_actual || 0,
      share_display: updatedVideo.shares_display || 0,
    };
  } catch (err) {
    console.error(`[CMS] POST /videos/${id}/like - 오류:`, err);
    return reply.code(500).send({ 
      success: false,
      message: "Internal server error" 
    });
  }
});

// 영상 공유 토글 (delta 기반 + 중복 방지)
app.post("/videos/:id/share", async (request, reply) => {
  const { id } = request.params;
  const { delta } = request.body || {};
  
  // delta 기본값: +1 (없으면 증가)
  const deltaValue = delta !== undefined ? Number(delta) : 1;
  
  // 클라이언트 식별
  const clientKey = getClientKey(request);
  
  // 디버그 로그 추가
  console.log(`[CMS] POST /videos/${id}/share - 요청 수신`, {
    id,
    delta: deltaValue,
    client: clientKey.substring(0, 20) + '...',
    updateColumns: ['shares_actual', 'shares_display']
  });

  try {
    // 영상 존재 확인
    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    
    if (!video) {
      console.log(`[CMS] POST /videos/${id}/share - 영상을 찾을 수 없음`);
      return reply.code(404).send({ 
        success: false,
        message: "Video not found" 
      });
    }

    // delta가 0이면 현재 값 반환
    if (deltaValue === 0) {
      const currentVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
      return {
        success: true,
        id: currentVideo.id,
        view_real: currentVideo.views_actual || 0,
        view_display: currentVideo.views_display || 0,
        like_real: currentVideo.likes_actual || 0,
        like_display: currentVideo.likes_display || 0,
        share_real: currentVideo.shares_actual || 0,
        share_display: currentVideo.shares_display || 0,
      };
    }

    // video_interactions에서 기존 상호작용 조회
    let interaction = db.prepare(
      "SELECT * FROM video_interactions WHERE video_id = ? AND client_key = ?"
    ).get(id, clientKey);

    // row가 없으면 기본값 liked=0, shared=0, viewed=0으로 간주
    const currentShared = interaction?.shared || 0;

    if (deltaValue > 0) {
      // 공유 ON 요청
      if (currentShared === 1) {
        // 이미 공유 상태면 아무 것도 하지 않고 현재 통계 반환 (중복 방지)
        const currentVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
        return {
          success: true,
          id: currentVideo.id,
          view_real: currentVideo.views_actual || 0,
          view_display: currentVideo.views_display || 0,
          like_real: currentVideo.likes_actual || 0,
          like_display: currentVideo.likes_display || 0,
          share_real: currentVideo.shares_actual || 0,
          share_display: currentVideo.shares_display || 0,
        };
      }

      // 공유 증가 (delta 반영)
      db.prepare(
        "UPDATE videos SET shares_actual = MAX(0, COALESCE(shares_actual, 0) + ?), shares_display = MAX(0, COALESCE(shares_display, 0) + ?), updated_at = datetime('now') WHERE id = ?"
      ).run(deltaValue, deltaValue, id);

      // video_interactions 업데이트 또는 삽입
      if (interaction) {
        db.prepare(
          "UPDATE video_interactions SET shared = 1, updated_at = datetime('now') WHERE video_id = ? AND client_key = ?"
        ).run(id, clientKey);
      } else {
        db.prepare(
          "INSERT INTO video_interactions (video_id, client_key, liked, shared, viewed) VALUES (?, ?, 0, 1, 0)"
        ).run(id, clientKey);
      }
    } else {
      // 공유 OFF 요청 (delta < 0)
      if (!interaction || currentShared === 0) {
        // 이미 OFF 상태면 아무 것도 하지 않고 현재 값 반환
        const currentVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
        return {
          success: true,
          id: currentVideo.id,
          view_real: currentVideo.views_actual || 0,
          view_display: currentVideo.views_display || 0,
          like_real: currentVideo.likes_actual || 0,
          like_display: currentVideo.likes_display || 0,
          share_real: currentVideo.shares_actual || 0,
          share_display: currentVideo.shares_display || 0,
        };
      }

      // 공유 감소 (0 미만 방지, delta 반영)
      const absDelta = Math.abs(deltaValue);
      db.prepare(
        "UPDATE videos SET shares_actual = MAX(0, COALESCE(shares_actual, 0) - ?), shares_display = MAX(0, COALESCE(shares_display, 0) - ?), updated_at = datetime('now') WHERE id = ?"
      ).run(absDelta, absDelta, id);

      // video_interactions 업데이트
      db.prepare(
        "UPDATE video_interactions SET shared = 0, updated_at = datetime('now') WHERE video_id = ? AND client_key = ?"
      ).run(id, clientKey);
    }

    // 업데이트된 영상 정보 조회
    const updatedVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);

    console.log(`[CMS] POST /videos/${id}/share - 성공: shares_actual=${updatedVideo.shares_actual || 0}, shares_display=${updatedVideo.shares_display || 0}`);

    return {
      success: true,
      id: updatedVideo.id,
      view_real: updatedVideo.views_actual || 0,
      view_display: updatedVideo.views_display || 0,
      like_real: updatedVideo.likes_actual || 0,
      like_display: updatedVideo.likes_display || 0,
      share_real: updatedVideo.shares_actual || 0,
      share_display: updatedVideo.shares_display || 0,
    };
  } catch (err) {
    console.error(`[CMS] POST /videos/${id}/share - 오류:`, err);
    return reply.code(500).send({ 
      success: false,
      message: "Internal server error" 
    });
  }
});

// 영상 조회수 증가 (1회 제한, 같은 client는 1회만 인정)
app.post("/videos/:id/view", async (request, reply) => {
  const { id } = request.params;
  const { delta } = request.body || {};
  
  // delta 기본값: +1 (없으면 증가, 하지만 거의 항상 1로 취급)
  const deltaValue = delta !== undefined ? Number(delta) : 1;
  
  // 클라이언트 식별
  const clientKey = getClientKey(request);
  
  // 디버그 로그 추가
  console.log(`[CMS] POST /videos/${id}/view - 요청 수신`, {
    id,
    delta: deltaValue,
    client: clientKey.substring(0, 20) + '...',
    updateColumns: ['views_actual', 'views_display']
  });

  try {
    // 영상 존재 확인
    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    
    if (!video) {
      console.log(`[CMS] POST /videos/${id}/view - 영상을 찾을 수 없음`);
      return reply.code(404).send({ 
        success: false,
        message: "Video not found" 
      });
    }

    // delta가 0이면 현재 값 반환
    if (deltaValue === 0) {
      const currentVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
      return {
        success: true,
        id: currentVideo.id,
        view_real: currentVideo.views_actual || 0,
        view_display: currentVideo.views_display || 0,
        like_real: currentVideo.likes_actual || 0,
        like_display: currentVideo.likes_display || 0,
        share_real: currentVideo.shares_actual || 0,
        share_display: currentVideo.shares_display || 0,
      };
    }

    // video_interactions에서 기존 상호작용 조회
    let interaction = db.prepare(
      "SELECT * FROM video_interactions WHERE video_id = ? AND client_key = ?"
    ).get(id, clientKey);

    // row가 없거나 viewed=0이면 조회수 증가 (delta 반영)
    if (!interaction || interaction.viewed === 0) {
      // views_actual과 views_display를 delta만큼 증가
      db.prepare(
        "UPDATE videos SET views_actual = MAX(0, COALESCE(views_actual, 0) + ?), views_display = MAX(0, COALESCE(views_display, 0) + ?), updated_at = datetime('now') WHERE id = ?"
      ).run(deltaValue, deltaValue, id);

      // video_interactions 업데이트 또는 삽입
      if (interaction) {
        // 기존 row가 있으면 viewed만 업데이트
        db.prepare(
          "UPDATE video_interactions SET viewed = 1, updated_at = datetime('now') WHERE video_id = ? AND client_key = ?"
        ).run(id, clientKey);
      } else {
        // 새 row 삽입
        db.prepare(
          "INSERT INTO video_interactions (video_id, client_key, liked, shared, viewed) VALUES (?, ?, 0, 0, 1)"
        ).run(id, clientKey);
      }
    } else {
      // 이미 viewed=1이면 조회수 증가시키지 않고 현재 통계값 반환 (중복 방지)
      console.log(`[CMS] POST /videos/${id}/view - 이미 조회한 클라이언트, 조회수 증가 없음`);
    }

    // 업데이트된 영상 정보 조회
    const updatedVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);

    console.log(`[CMS] POST /videos/${id}/view - 성공: views_actual=${updatedVideo.views_actual || 0}, views_display=${updatedVideo.views_display || 0}`);

    return {
      success: true,
      id: updatedVideo.id,
      view_real: updatedVideo.views_actual || 0,
      view_display: updatedVideo.views_display || 0,
      like_real: updatedVideo.likes_actual || 0,
      like_display: updatedVideo.likes_display || 0,
      share_real: updatedVideo.shares_actual || 0,
      share_display: updatedVideo.shares_display || 0,
    };
  } catch (err) {
    console.error(`[CMS] POST /videos/${id}/view - 오류:`, err);
    return reply.code(500).send({ 
      success: false,
      message: "Internal server error" 
    });
  }
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

// 현재 사용자 정보 (프론트엔드용)
app.get("/auth/me", { preHandler: authenticate }, async (request, reply) => {
  try {
    const user = request.user;
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.name || user.email,
        role: user.role,
      },
    };
  } catch (err) {
    console.error("auth/me error", err);
    return reply.code(401).send({
      success: false,
      message: "인증이 필요합니다.",
    });
  }
});

// 이메일/비밀번호 로그인
app.post("/auth/login", async (request, reply) => {
  const { email, password } = request.body;

  if (!email) {
    return reply.code(400).send({ error: "email is required" });
  }

  // 비밀번호 필수
  if (!password) {
    return reply.code(400).send({ error: "password is required" });
  }

  // 이메일로 사용자 조회
  let user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);

  // DB에 사용자가 없으면 하드코딩된 테스트 사용자 확인 (fallback)
  if (!user) {
    const testUsers = {
      "consulting_manager@naver.com": {
        id: "test-admin-id",
        name: "Admin",
        email: "consulting_manager@naver.com",
        role: "admin",
        site_id: null,
        password: "123456"
      },
      "j1d1y1@naver.com": {
        id: "test-creator-id",
        name: "Creator",
        email: "j1d1y1@naver.com",
        role: "creator",
        site_id: "gods",
        password: "123456"
      }
    };

    const testUser = testUsers[email];
    if (testUser && testUser.password === password) {
      // 테스트 사용자로 인증 성공 - DB에 저장
      const userId = generateId();
      const apiKey = generateApiKey();
      const { hash: apiKeyHash, salt: apiKeySalt } = hashApiKey(apiKey);
      const { hash: passwordHash, salt: passwordSalt } = hashPassword(password);
      
      db.prepare(
        "INSERT INTO users (id, site_id, name, email, role, status, password_hash, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        userId,
        testUser.site_id,
        testUser.name,
        testUser.email,
        testUser.role,
        "active",
        passwordHash,
        apiKeyHash,
        apiKeySalt
      );

      user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    } else {
      return reply.code(401).send({ error: "Invalid email or password" });
    }
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
app.post("/auth/change-password", async (request, reply) => {
  const { email, currentPassword, newPassword } = request.body;

  // 필수 필드 확인
  if (!email) {
    return reply.code(400).send({ success: false, message: "이메일을 입력해주세요." });
  }

  if (!currentPassword) {
    return reply.code(400).send({ success: false, message: "현재 비밀번호를 입력해주세요." });
  }

  if (!newPassword) {
    return reply.code(400).send({ success: false, message: "새 비밀번호를 입력해주세요." });
  }

  // 이메일로 사용자 조회
  let user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);

  // DB에 사용자가 없으면 하드코딩된 테스트 사용자 확인 (fallback)
  if (!user) {
    const testUsers = {
      "consulting_manager@naver.com": {
        id: "test-admin-id",
        name: "Admin",
        email: "consulting_manager@naver.com",
        role: "admin",
        site_id: null,
        password: "123456"
      },
      "j1d1y1@naver.com": {
        id: "test-creator-id",
        name: "Creator",
        email: "j1d1y1@naver.com",
        role: "creator",
        site_id: "gods",
        password: "123456"
      }
    };

    const testUser = testUsers[email];
    if (testUser && testUser.password === currentPassword) {
      // 테스트 사용자로 인증 성공 - DB에 저장하고 비밀번호 변경
      const userId = generateId();
      const apiKey = generateApiKey();
      const { hash: apiKeyHash, salt: apiKeySalt } = hashApiKey(apiKey);
      const { hash: passwordHash, salt: passwordSalt } = hashPassword(newPassword);
      
      db.prepare(
        "INSERT INTO users (id, site_id, name, email, role, status, password_hash, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        userId,
        testUser.site_id,
        testUser.name,
        testUser.email,
        testUser.role,
        "active",
        passwordHash,
        apiKeyHash,
        apiKeySalt
      );

      console.log(`✅ 비밀번호 변경: ${email} (테스트 사용자 -> DB 저장)`);
      return reply.code(200).send({ success: true, message: "비밀번호가 변경되었습니다." });
    } else {
      return reply.code(400).send({ success: false, message: "존재하지 않는 계정입니다." });
    }
  }

  // 비밀번호가 설정되지 않은 경우
  if (!user.password_hash) {
    return reply.code(400).send({ success: false, message: "비밀번호가 설정되지 않은 계정입니다. 최초 비밀번호 설정을 사용해주세요." });
  }

  // 현재 비밀번호 확인
  if (!verifyPassword(currentPassword, user.password_hash, user.api_key_salt)) {
    return reply.code(400).send({ success: false, message: "현재 비밀번호가 올바르지 않습니다." });
  }

  // 새 비밀번호 해싱
  const { hash, salt } = hashPassword(newPassword);

  // 비밀번호 업데이트
  db.prepare(
    "UPDATE users SET password_hash = ?, api_key_salt = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(hash, salt, user.id);

  console.log(`✅ 비밀번호 변경: ${user.email}`);

  return reply.code(200).send({ success: true, message: "비밀번호가 변경되었습니다." });
});

// 공개 비밀번호 변경 (인증 불필요)
app.post("/auth/change-password-public", async (request, reply) => {
  try {
    const { email, currentPassword, newPassword } = request.body;

    if (!email) {
      return reply.code(400).send({ success: false, message: "이메일을 입력해주세요." });
    }

    if (!currentPassword) {
      return reply.code(400).send({ success: false, message: "현재 비밀번호를 입력해주세요." });
    }

    if (!newPassword) {
      return reply.code(400).send({ success: false, message: "새 비밀번호를 입력해주세요." });
    }

    // 이메일로 사용자 조회 (로그인 엔드포인트와 동일한 로직)
    let user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(email);

    // DB에 사용자가 없으면 하드코딩된 테스트 사용자 확인 (fallback) - 로그인과 동일
    if (!user) {
      const testUsers = {
        "consulting_manager@naver.com": {
          id: "test-admin-id",
          name: "Admin",
          email: "consulting_manager@naver.com",
          role: "admin",
          site_id: null,
          password: "123456"
        },
        "j1d1y1@naver.com": {
          id: "test-creator-id",
          name: "Creator",
          email: "j1d1y1@naver.com",
          role: "creator",
          site_id: "gods",
          password: "123456"
        }
      };

      const testUser = testUsers[email];
      if (testUser && testUser.password === currentPassword) {
        // 테스트 사용자로 인증 성공 - DB에 저장하고 새 비밀번호로 설정
        const userId = generateId();
        const apiKey = generateApiKey();
        const { hash: apiKeyHash, salt: apiKeySalt } = hashApiKey(apiKey);
        const { hash: passwordHash, salt: passwordSalt } = hashPassword(newPassword);
        
        db.prepare(
          "INSERT INTO users (id, site_id, name, email, role, status, password_hash, api_key_hash, api_key_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          userId,
          testUser.site_id,
          testUser.name,
          testUser.email,
          testUser.role,
          "active",
          passwordHash,
          apiKeyHash,
          apiKeySalt
        );

        console.log(`✅ 비밀번호 변경 (public): ${email} (테스트 사용자 -> DB 저장)`);
        return reply.code(200).send({ success: true, message: "비밀번호가 변경되었습니다." });
      } else {
        return reply.code(400).send({ success: false, message: "존재하지 않는 계정입니다." });
      }
    }

    // 비밀번호가 설정되지 않은 경우 (최초 로그인) - 로그인과 동일한 체크
    if (!user.password_hash) {
      return reply.code(400).send({ success: false, message: "비밀번호가 설정되지 않은 계정입니다. 최초 비밀번호 설정을 사용해주세요." });
    }

    // 비밀번호 검증 (password_hash를 salt로 사용) - 로그인과 동일한 검증
    if (!verifyPassword(currentPassword, user.password_hash, user.api_key_salt)) {
      return reply.code(400).send({ success: false, message: "현재 비밀번호가 올바르지 않습니다." });
    }

    // 새 비밀번호 해싱 (로그인과 동일한 해싱 함수 사용)
    const { hash, salt } = hashPassword(newPassword);

    // 비밀번호 업데이트 (로그인에서 사용하는 동일한 DB 저장소)
    db.prepare(
      "UPDATE users SET password_hash = ?, api_key_salt = ? WHERE id = ?"
    ).run(hash, salt, user.id);

    console.log(`✅ 비밀번호 변경 (public): ${user.email}`);

    return reply.code(200).send({ success: true, message: "비밀번호가 변경되었습니다." });
  } catch (err) {
    console.error("change-password-public error", err);
    return reply.code(500).send({ success: false, message: "서버 오류가 발생했습니다." });
  }
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

// 활성 사이트 정보 조회 (access_key 제외)
app.get(
  "/admin/site",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const site = getActiveSite();
    if (!site) {
      return reply.code(404).send({ error: "활성 사이트를 찾을 수 없습니다." });
    }
    return {
      name: site.name,
      base_url: site.base_url,
      api_url: site.api_url,
    };
  }
);

// Creator 생성
app.post(
  "/admin/creators",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    try {
      const { site_url, name, email, facebook_key } = request.body;

      if (!name) {
        return reply.code(400).send({ 
          success: false, 
          message: "name is required" 
        });
      }

      // 이메일 중복 확인
      if (email) {
        const existing = db.prepare("SELECT * FROM creators WHERE email = ?").get(email);
        if (existing) {
          return reply.code(409).send({ 
            success: false, 
            message: "Email already exists" 
          });
        }
      }

      // INSERT 실행
      const result = db.prepare(
        "INSERT INTO creators (name, email, site_url, facebook_key, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', datetime('now'), datetime('now'))"
      ).run(
        name, 
        email || null, 
        site_url || null,
        facebook_key || null
      );

      const creator = db.prepare("SELECT * FROM creators WHERE id = ?").get(result.lastInsertRowid);

      return reply.code(201).send({
        success: true,
        data: creator
      });
    } catch (err) {
      console.error("❌ POST /admin/creators 오류:", err);
      console.error("   요청 body:", request.body);
      console.error("   스택:", err.stack);
      return reply.code(500).send({ 
        success: false, 
        message: err.message || "크리에이터 생성에 실패했습니다." 
      });
    }
  }
);

// Creator 목록 조회
app.get(
  "/admin/creators",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    try {
      const { site_url } = request.query;

      let query = "SELECT id, name, email, site_url, facebook_key, status, created_at, updated_at FROM creators";
      const params = [];
      const conditions = [];

      if (site_url) {
        conditions.push("site_url = ?");
        params.push(site_url);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " ORDER BY created_at DESC";

      const creators = db.prepare(query).all(...params);
      return reply.send({
        success: true,
        data: { creators }
      });
    } catch (err) {
      console.error("❌ GET /admin/creators 오류:", err);
      console.error("   스택:", err.stack);
      return reply.code(500).send({ 
        success: false, 
        message: err.message || "크리에이터 목록을 불러오는데 실패했습니다." 
      });
    }
  }
);

// Creator 정보 수정
app.put(
  "/admin/creators/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    try {
      const { id } = request.params;
      const { status, name, facebook_key, email, site_url } = request.body;

      // Creator 존재 확인
      const existing = db.prepare("SELECT * FROM creators WHERE id = ?").get(id);
      if (!existing) {
        return reply.code(404).send({ 
          success: false, 
          message: "Creator not found" 
        });
      }

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

      if (email !== undefined) {
        // 이메일 중복 확인 (다른 사용자가 사용 중인지)
        if (email) {
          const emailUser = db.prepare("SELECT * FROM creators WHERE email = ? AND id != ?").get(email, id);
          if (emailUser) {
            return reply.code(409).send({ 
              success: false, 
              message: "Email already exists" 
            });
          }
        }
        updates.push("email = ?");
        params.push(email || null);
      }

      if (site_url !== undefined) {
        updates.push("site_url = ?");
        params.push(site_url || null);
      }

      if (facebook_key !== undefined) {
        updates.push("facebook_key = ?");
        params.push(facebook_key || null);
      }

      if (updates.length === 0) {
        return reply.code(400).send({ 
          success: false, 
          message: "No fields to update" 
        });
      }

      // updated_at 업데이트
      updates.push("updated_at = datetime('now')");
      params.push(id);

      const stmt = db.prepare(
        `UPDATE creators SET ${updates.join(", ")} WHERE id = ?`
      );
      const result = stmt.run(...params);

      if (result.changes === 0) {
        return reply.code(404).send({ 
          success: false, 
          message: "Creator not found" 
        });
      }

      const creator = db
        .prepare("SELECT id, name, email, site_url, facebook_key, status, created_at, updated_at FROM creators WHERE id = ?")
        .get(id);

      return reply.send({
        success: true,
        data: creator
      });
    } catch (err) {
      console.error("❌ PUT /admin/creators/:id 오류:", err);
      console.error("   요청 params:", request.params);
      console.error("   요청 body:", request.body);
      console.error("   스택:", err.stack);
      return reply.code(500).send({ 
        success: false, 
        message: err.message || "크리에이터 수정에 실패했습니다." 
      });
    }
  }
);

// Creator 삭제
app.delete(
  "/admin/creators/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    try {
      const { id } = request.params;

      // Creator 존재 확인
      const creator = db
        .prepare("SELECT * FROM creators WHERE id = ?")
        .get(id);

      if (!creator) {
        return reply.code(404).send({ 
          success: false, 
          message: "Creator not found" 
        });
      }

      // DELETE 실행
      const result = db.prepare("DELETE FROM creators WHERE id = ?").run(id);

      if (result.changes === 0) {
        return reply.code(404).send({ 
          success: false, 
          message: "Creator not found" 
        });
      }

      return reply.send({
        success: true,
        message: "Creator deleted successfully"
      });
    } catch (err) {
      console.error("❌ DELETE /admin/creators/:id 오류:", err);
      console.error("   요청 params:", request.params);
      console.error("   스택:", err.stack);
      return reply.code(500).send({ 
        success: false, 
        message: err.message || "크리에이터 삭제에 실패했습니다." 
      });
    }
  }
);

// Creator 키 재발급
app.post(
  "/admin/creators/:id/rotate-key",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    try {
      const { id } = request.params;

      const creator = db
        .prepare("SELECT * FROM users WHERE id = ? AND role = 'creator'")
        .get(id);

      if (!creator) {
        return reply.code(404).send({ 
          success: false, 
          message: "Creator not found" 
        });
      }

      const apiKey = generateApiKey();
      const { hash, salt } = hashApiKey(apiKey);

      db.prepare("UPDATE users SET api_key_hash = ?, api_key_salt = ?, updated_at = datetime('now') WHERE id = ?").run(
        hash,
        salt,
        id
      );

      return reply.send({
        success: true,
        data: {
          id: creator.id,
          api_key: apiKey, // 평문 키는 재발급 시 1회만 반환
        }
      });
    } catch (err) {
      console.error("❌ POST /admin/creators/:id/rotate-key 오류:", err);
      console.error("   요청 params:", request.params);
      console.error("   스택:", err.stack);
      return reply.code(500).send({ 
        success: false, 
        message: err.message || "API 키 재발급에 실패했습니다." 
      });
    }
  }
);

// 방문자 통계 로깅 (public/log-visit에서 analytics 테이블에도 기록)
app.post("/public/log-visit", async (request, reply) => {
  const { site_id, language, country } = request.body;
  
  if (!site_id) {
    return reply.code(400).send({ error: "site_id is required" });
  }

  try {
    const visitId = generateId();
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const userAgent = request.headers['user-agent'] || '';
    const visitDate = new Date().toISOString().split('T')[0];
    const visitLanguage = language || 'ko';
    const visitCountry = country || 'KR';

    // visits 테이블에 기록 (기존)
    db.prepare(
      "INSERT INTO visits (id, site_id, ip_address, country_code, country_name, language, page_url, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(visitId, site_id, ipAddress, visitCountry, visitCountry, visitLanguage, '/', userAgent);

    // analytics 테이블에 집계 (date, language, country별로 visitors 증가)
    const existing = db.prepare(
      "SELECT * FROM analytics WHERE date = ? AND language = ? AND country = ?"
    ).get(visitDate, visitLanguage, visitCountry);

    if (existing) {
      db.prepare(
        "UPDATE analytics SET visitors = visitors + 1, updated_at = datetime('now') WHERE id = ?"
      ).run(existing.id);
    } else {
      const analyticsId = generateId();
      db.prepare(
        "INSERT INTO analytics (id, date, language, country, visitors) VALUES (?, ?, ?, ?, 1)"
      ).run(analyticsId, visitDate, visitLanguage, visitCountry);
    }

    return { success: true, id: visitId };
  } catch (err) {
    console.error("방문자 로깅 오류:", err);
    return reply.code(500).send({ error: "Failed to log visit" });
  }
});

// Admin - 방문자 통계
app.get(
  "/admin/analytics",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { period = 'week', start_date, end_date } = request.query;

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
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarter':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'half':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      startDateStr = startDate.toISOString().split('T')[0];
      endDateStr = now.toISOString().split('T')[0];
    }

    // 총 방문자 수
    const totalVisits = db.prepare(
      "SELECT SUM(visitors) as total FROM analytics WHERE date >= ? AND date <= ?"
    ).get(startDateStr, endDateStr);

    // 언어별 통계 (비율 포함)
    const byLanguage = db.prepare(
      "SELECT language, SUM(visitors) as count FROM analytics WHERE date >= ? AND date <= ? GROUP BY language ORDER BY count DESC"
    ).all(startDateStr, endDateStr);

    const totalVisitors = totalVisits.total || 0;
    const languageStats = byLanguage.map((item) => ({
      language: item.language,
      visitors: item.count,
      percentage: totalVisitors > 0 ? ((item.count / totalVisitors) * 100).toFixed(2) : 0,
    }));

    // 국가별 통계 (비율 포함)
    const byCountry = db.prepare(
      "SELECT country, SUM(visitors) as count FROM analytics WHERE date >= ? AND date <= ? GROUP BY country ORDER BY count DESC"
    ).all(startDateStr, endDateStr);

    const countryStats = byCountry.map((item) => ({
      country: item.country,
      visitors: item.count,
      percentage: totalVisitors > 0 ? ((item.count / totalVisitors) * 100).toFixed(2) : 0,
    }));

    return {
      period,
      start_date: startDateStr,
      end_date: endDateStr,
      total_visitors: totalVisitors,
      by_language: languageStats,
      by_country: countryStats,
    };
  }
);

// Admin - Dashboard Summary
app.get(
  "/admin/dashboard/summary",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    try {
      // 전체 영상 수 (삭제되지 않은 영상)
      const totalVideosResult = db.prepare("SELECT COUNT(*) as count FROM videos").get();
      const totalVideos = totalVideosResult.count || 0;

      // 활성 크리에이터 수
      const totalCreatorsResult = db.prepare(
        "SELECT COUNT(*) as count FROM users WHERE role = 'creator' AND status = 'active'"
      ).get();
      const totalCreators = totalCreatorsResult.count || 0;

      // 오늘 업로드된 영상 수 (로컬 시간 기준)
      const today = new Date().toISOString().split('T')[0];
      const todayVideosResult = db.prepare(
        "SELECT COUNT(*) as count FROM videos WHERE DATE(created_at) = ?"
      ).get(today);
      const todayVideos = todayVideosResult.count || 0;

      // 최근 5개 영상
      const recentVideos = db.prepare(
        `SELECT v.id, v.title, u.name as creatorName, v.created_at as createdAt
         FROM videos v
         LEFT JOIN users u ON v.owner_id = u.id
         ORDER BY v.created_at DESC
         LIMIT 5`
      ).all();

      return {
        totalVideos,
        totalCreators,
        todayVideos,
        recentVideos: recentVideos.map((video) => ({
          id: video.id,
          title: video.title || "제목 없음",
          creatorName: video.creatorName || "알 수 없음",
          createdAt: video.createdAt,
        })),
      };
    } catch (err) {
      console.error("Dashboard summary 오류:", err);
      return reply.code(500).send({ error: "Failed to fetch dashboard summary" });
    }
  }
);

// Admin - Videos 전체 조회 (관리자는 모든 영상 조회 가능)
app.get(
  "/admin/videos",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    try {
      const { 
        status,           // 'all'일 경우 IFNULL(is_deleted, 0)=0 조건만 적용
        search,           // 검색어 (제목/설명/크리에이터) - 하위 호환성 유지
        q,                // 강화된 검색어 (title, description, creator_name, management_no, created_at)
        creator,          // 크리에이터 필터
        startDate,        // 시작 날짜 필터
        endDate           // 종료 날짜 필터
      } = request.query;

      // 기본 쿼리: 관리자는 모든 영상 조회 (site_id 필터 제거)
      let query =
        "SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE 1=1";
      const params = [];

      // status=all 일 경우 삭제 필터링 (is_deleted 컬럼이 없으므로 조건 제거)
      // 필요시 status 컬럼을 사용하여 필터링 가능

      // 강화된 검색어 필터 (q 파라미터 우선, 없으면 search 파라미터 사용)
      const searchQuery = q || search;
      if (searchQuery && searchQuery.trim() !== '') {
        const searchTerm = `%${searchQuery.trim()}%`;
        // title, description, creator_name, management_no, created_at에서 검색
        query += " AND (v.title LIKE ? OR v.description LIKE ? OR u.name LIKE ? OR v.management_id LIKE ? OR v.created_at LIKE ?)";
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // 크리에이터 필터 (값이 비어있지 않을 때만 적용)
      if (creator && creator.trim() !== '') {
        query += " AND (v.owner_id = ? OR u.name = ?)";
        params.push(creator.trim(), creator.trim());
      }

      // 날짜 필터 (startDate가 비어있지 않을 때만 적용)
      if (startDate && startDate.trim() !== '') {
        query += " AND DATE(v.created_at) >= DATE(?)";
        params.push(startDate.trim());
      }

      // 날짜 필터 (endDate가 비어있지 않을 때만 적용)
      if (endDate && endDate.trim() !== '') {
        query += " AND DATE(v.created_at) <= DATE(?)";
        params.push(endDate.trim());
      }

      // 항상 created_at DESC로 정렬
      query += " ORDER BY v.created_at DESC";

      const videos = db.prepare(query).all(...params);

      // display 값 계산하여 응답 포맷팅
      const formattedVideos = videos.map(formatVideoResponse);

      // 항상 배열 형태로 결과 반환 (대시보드와 동일한 리스트)
      return reply.send({
        success: true,
        data: formattedVideos
      });
    } catch (err) {
      console.error("❌ GET /admin/videos 오류:", err);
      console.error("   요청 query:", request.query);
      console.error("   스택:", err.stack);
      return reply.code(500).send({
        success: false,
        message: err.message || "Failed to fetch videos"
      });
    }
  }
);

// Admin - Video 단일 조회
app.get(
  "/admin/videos/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;

    const video = db
      .prepare("SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE v.id = ?")
      .get(id);

    if (!video) {
      return reply.code(404).send({ 
        success: false,
        message: "Video not found" 
      });
    }

    return reply.send({
      success: true,
      data: formatVideoResponse(video)
    });
  }
);

// Admin - Video 생성
app.post(
  "/admin/videos",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const {
      title,
      description,
      creatorName,
      sourceType,
      sourceUrl,
      thumbnailUrl,
      viewReal,
      likeReal,
      shareReal,
      viewDisplay,
      likeDisplay,
      shareDisplay,
    } = request.body;

    // 필수 필드 검증
    if (!title || !sourceType || !sourceUrl) {
      return reply.code(400).send({ 
        success: false,
        message: "title, sourceType, and sourceUrl are required" 
      });
    }

    // sourceType 검증: 'youtube', 'facebook', 'file' 허용
    const allowedSourceTypes = ['youtube', 'facebook', 'file'];
    if (!allowedSourceTypes.includes(sourceType)) {
      return reply.code(400).send({ 
        success: false,
        message: `sourceType must be one of: ${allowedSourceTypes.join(', ')}` 
      });
    }

    try {
      const videoId = generateId();
      const activeSite = getActiveSite();
      const siteId = activeSite ? activeSite.id : null;

      // Real 값 설정
      const viewCountReal = viewReal ?? 0;
      const likeCountReal = likeReal ?? 0;
      const shareCountReal = shareReal ?? 0;

      // Display 값이 제공되면 offset 계산, 아니면 offset = 0
      const viewOffset = viewDisplay !== undefined ? viewDisplay - viewCountReal : 0;
      const likeOffset = likeDisplay !== undefined ? likeDisplay - likeCountReal : 0;
      const shareOffset = shareDisplay !== undefined ? shareDisplay - shareCountReal : 0;

      // creatorName으로 owner_id 찾기 (또는 기본값 사용)
      let ownerId = null;
      if (creatorName) {
        const creator = db.prepare("SELECT id FROM users WHERE name = ? LIMIT 1").get(creatorName);
        if (creator) {
          ownerId = creator.id;
        }
      }

      // Facebook 썸네일 자동 가져오기 (sourceType이 facebook이고 thumbnailUrl이 없을 때)
      let finalThumbnailUrl = thumbnailUrl;
      if (sourceType === 'facebook' && !finalThumbnailUrl) {
        const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || null;
        if (facebookAccessToken) {
          try {
            const { fetchFacebookThumbnail } = await import("./metadata.js");
            const fetchedThumbnail = await fetchFacebookThumbnail(sourceUrl, facebookAccessToken);
            if (fetchedThumbnail) {
              finalThumbnailUrl = fetchedThumbnail;
              console.log(`✅ Facebook 썸네일 자동 가져오기 성공: ${finalThumbnailUrl}`);
            }
          } catch (err) {
            console.warn("⚠️ Facebook 썸네일 가져오기 실패:", err.message);
          }
        } else {
          console.warn("⚠️ FACEBOOK_ACCESS_TOKEN 환경 변수가 설정되지 않았습니다.");
        }
      }

      // 영상 관리번호 자동 생성
      const managementId = generateManagementId();

      // INSERT 쿼리 (description 필드 포함, null/undefined는 빈 문자열로 normalize)
      db.prepare(
        `INSERT INTO videos (
          id, site_id, owner_id, platform, source_url, title, description,
          thumbnail_url, view_count_real, like_count_real, share_count_real,
          view_offset, like_offset, share_offset, management_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).run(
        videoId,
        siteId,
        ownerId,
        sourceType,
        sourceUrl,
        title,
        description || '', // null/undefined는 빈 문자열로 저장
        finalThumbnailUrl || null,
        viewCountReal,
        likeCountReal,
        shareCountReal,
        viewOffset,
        likeOffset,
        shareOffset,
        managementId
      );

      // video_code 생성 및 업데이트
      const videoCode = ownerId ? `${ownerId}-${videoId}` : `unknown-${videoId}`;
      db.prepare("UPDATE videos SET video_code = ? WHERE id = ?").run(videoCode, videoId);

      // 생성된 영상 조회
      const createdVideo = db
        .prepare("SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE v.id = ?")
        .get(videoId);

      return reply.code(201).send(formatVideoResponse(createdVideo));
    } catch (err) {
      console.error("❌ POST /admin/videos 오류:", err);
      console.error("   요청 body:", request.body);
      console.error("   스택:", err.stack);
      return reply.code(500).send({ 
        success: false,
        message: err.message || "Failed to create video" 
      });
    }
  }
);

// Admin - Video 수정
app.put(
  "/admin/videos/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;
    const {
      title,
      description,
      creatorName,
      sourceType,
      sourceUrl,
      thumbnailUrl,
      viewReal,
      likeReal,
      shareReal,
      viewDisplay,
      likeDisplay,
      shareDisplay,
      // 프론트엔드에서 보낼 수 있는 다른 필드명 지원
      viewCount,
      likeCount,
      shareCount,
    } = request.body;

    // 영상 존재 확인
    const existing = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    if (!existing) {
      return reply.code(404).send({ 
        success: false,
        message: "Video not found" 
      });
    }

    try {
      const updates = [];
      const params = [];

      // 기본 필드 업데이트
      if (title !== undefined) {
        updates.push("title = ?");
        params.push(title);
      }
      // description 업데이트 (null/undefined는 빈 문자열로 normalize)
      if (description !== undefined) {
        updates.push("description = ?");
        params.push(description || ''); // null/undefined는 빈 문자열로 저장
      }
      // sourceType 업데이트 시 검증: 'youtube', 'facebook', 'file' 허용
      if (sourceType !== undefined) {
        const allowedSourceTypes = ['youtube', 'facebook', 'file'];
        if (!allowedSourceTypes.includes(sourceType)) {
          return reply.code(400).send({ 
            success: false,
            message: `sourceType must be one of: ${allowedSourceTypes.join(', ')}` 
          });
        }
        updates.push("platform = ?");
        params.push(sourceType);
      }
      if (sourceUrl !== undefined) {
        updates.push("source_url = ?");
        params.push(sourceUrl);
      }
      // Facebook 썸네일 자동 가져오기 (sourceType이 facebook이고 thumbnailUrl이 없을 때)
      let finalThumbnailUrl = thumbnailUrl;
      const currentSourceType = sourceType !== undefined ? sourceType : existing.platform;
      
      // Facebook 영상이고 썸네일이 없는 경우 자동으로 가져오기
      // 조건:
      // 1. sourceType이 'facebook'이어야 함
      // 2. 요청에서 thumbnailUrl을 명시적으로 보내지 않았거나 비어 있는 경우
      // 3. 기존 DB에 저장된 thumbnailUrl도 비어 있을 때
      if (currentSourceType === 'facebook') {
        const requestThumbnailEmpty = thumbnailUrl === undefined || !thumbnailUrl || thumbnailUrl === '';
        const existingThumbnailEmpty = !existing.thumbnail_url || existing.thumbnail_url === '';
        
        // 요청에서 썸네일을 보내지 않았거나 비어 있고, 기존 DB에도 썸네일이 없는 경우
        if (requestThumbnailEmpty && existingThumbnailEmpty) {
          const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || null;
          if (facebookAccessToken) {
            try {
              const { fetchFacebookThumbnail } = await import("./metadata.js");
              const sourceUrlToUse = sourceUrl !== undefined ? sourceUrl : existing.source_url;
              if (sourceUrlToUse) {
                console.log(`🔄 Facebook 썸네일 자동 가져오기 시도: ${sourceUrlToUse}`);
                const fetchedThumbnail = await fetchFacebookThumbnail(sourceUrlToUse, facebookAccessToken);
                if (fetchedThumbnail) {
                  finalThumbnailUrl = fetchedThumbnail;
                  console.log(`✅ Facebook 썸네일 자동 가져오기 성공: ${finalThumbnailUrl}`);
                } else {
                  console.warn(`⚠️ Facebook 썸네일을 가져올 수 없습니다.`);
                }
              }
            } catch (err) {
              console.warn("⚠️ Facebook 썸네일 가져오기 실패:", err.message);
            }
          } else {
            console.warn("⚠️ FACEBOOK_ACCESS_TOKEN 환경 변수가 설정되지 않았습니다.");
          }
        } else if (requestThumbnailEmpty && !existingThumbnailEmpty) {
          // 요청에서 썸네일을 보내지 않았지만 기존 DB에 썸네일이 있는 경우, 기존 값 유지
          finalThumbnailUrl = existing.thumbnail_url;
          console.log(`ℹ️ 기존 썸네일 유지: ${finalThumbnailUrl}`);
        }
      }

      if (thumbnailUrl !== undefined || finalThumbnailUrl !== thumbnailUrl) {
        updates.push("thumbnail_url = ?");
        params.push(finalThumbnailUrl || null);
      }

      // creatorName으로 owner_id 업데이트
      let newOwnerId = existing.owner_id;
      if (creatorName !== undefined) {
        let ownerId = null;
        if (creatorName) {
          const creator = db.prepare("SELECT id FROM users WHERE name = ? LIMIT 1").get(creatorName);
          if (creator) {
            ownerId = creator.id;
          }
        }
        newOwnerId = ownerId;
        updates.push("owner_id = ?");
        params.push(ownerId);
      }

      // Real 값 업데이트 (viewReal 또는 viewCount 지원)
      const finalViewReal = viewReal !== undefined ? viewReal : (viewCount !== undefined ? viewCount : undefined);
      const finalLikeReal = likeReal !== undefined ? likeReal : (likeCount !== undefined ? likeCount : undefined);
      const finalShareReal = shareReal !== undefined ? shareReal : (shareCount !== undefined ? shareCount : undefined);
      
      // 업데이트 전 값 로그
      console.log("📊 영상 통계 업데이트 요청:");
      console.log(`   기존 값 - view: ${existing.view_count_real || 0}, like: ${existing.like_count_real || 0}, share: ${existing.share_count_real || 0}`);
      console.log(`   요청 값 - viewReal: ${viewReal}, viewCount: ${viewCount}, likeReal: ${likeReal}, likeCount: ${likeCount}, shareReal: ${shareReal}, shareCount: ${shareCount}`);
      console.log(`   최종 값 - view: ${finalViewReal}, like: ${finalLikeReal}, share: ${finalShareReal}`);
      
      if (finalViewReal !== undefined) {
        updates.push("view_count_real = ?");
        params.push(finalViewReal);
        console.log(`   ✅ view_count_real 업데이트 예정: ${finalViewReal}`);
      }
      if (finalLikeReal !== undefined) {
        updates.push("like_count_real = ?");
        params.push(finalLikeReal);
        console.log(`   ✅ like_count_real 업데이트 예정: ${finalLikeReal}`);
      }
      if (finalShareReal !== undefined) {
        updates.push("share_count_real = ?");
        params.push(finalShareReal);
        console.log(`   ✅ share_count_real 업데이트 예정: ${finalShareReal}`);
      }

      // Display 값이 제공되면 offset 재계산
      const currentViewReal = finalViewReal !== undefined ? finalViewReal : (existing.view_count_real || 0);
      const currentLikeReal = finalLikeReal !== undefined ? finalLikeReal : (existing.like_count_real || 0);
      const currentShareReal = finalShareReal !== undefined ? finalShareReal : (existing.share_count_real || 0);

      if (viewDisplay !== undefined) {
        updates.push("view_offset = ?");
        params.push(viewDisplay - currentViewReal);
      }
      if (likeDisplay !== undefined) {
        updates.push("like_offset = ?");
        params.push(likeDisplay - currentLikeReal);
      }
      if (shareDisplay !== undefined) {
        updates.push("share_offset = ?");
        params.push(shareDisplay - currentShareReal);
      }

      if (updates.length === 0) {
        return reply.code(400).send({ 
          success: false,
          message: "No fields to update" 
        });
      }

      // updated_at 업데이트
      updates.push("updated_at = datetime('now')");
      params.push(id);

      // UPDATE 실행
      console.log(`🔄 UPDATE 쿼리 실행: UPDATE videos SET ${updates.join(", ")} WHERE id = ?`);
      console.log(`   파라미터:`, params);
      const updateResult = db.prepare(`UPDATE videos SET ${updates.join(", ")} WHERE id = ?`).run(...params);
      console.log(`   ✅ 업데이트 완료: ${updateResult.changes}개 행 변경됨`);

      // owner_id가 변경되었으면 video_code 업데이트
      if (creatorName !== undefined) {
        const videoCode = newOwnerId ? `${newOwnerId}-${id}` : `unknown-${id}`;
        db.prepare("UPDATE videos SET video_code = ? WHERE id = ?").run(videoCode, id);
      }

      // 업데이트된 영상 조회
      const updatedVideo = db
        .prepare("SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE v.id = ?")
        .get(id);

      // 업데이트 후 값 확인 로그
      console.log("📊 영상 통계 업데이트 완료:");
      console.log(`   업데이트 후 - view_count_real: ${updatedVideo.view_count_real || 0}, like_count_real: ${updatedVideo.like_count_real || 0}, share_count_real: ${updatedVideo.share_count_real || 0}`);

      return reply.send(formatVideoResponse(updatedVideo));
    } catch (err) {
      console.error("❌ PUT /admin/videos/:id 오류:", err);
      console.error("   요청 params:", request.params);
      console.error("   요청 body:", request.body);
      console.error("   스택:", err.stack);
      return reply.code(500).send({ 
        success: false,
        message: err.message || "Failed to update video" 
      });
    }
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
      return reply.code(404).send({ 
        success: false, 
        message: "Video not found" 
      });
    }

    return reply.send({ 
      success: true,
      message: "Video deleted successfully"
    });
  }
);

// Admin - 대량 Upsert (최대 20개)
app.post(
  "/admin/videos/bulk-upsert",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { videos } = request.body;

    if (!videos || !Array.isArray(videos)) {
      return reply.code(400).send({ 
        success: false,
        message: "videos array is required" 
      });
    }

    if (videos.length === 0) {
      return reply.code(400).send({ 
        success: false,
        message: "videos array cannot be empty" 
      });
    }

    if (videos.length > 20) {
      return reply.code(400).send({ 
        success: false,
        message: "한 번에 최대 20개까지만 처리할 수 있습니다." 
      });
    }

    try {
      const activeSite = getActiveSite();
      const siteId = activeSite ? activeSite.id : null;
      const upsertedVideos = [];

      for (const videoData of videos) {
        const {
          id,
          title,
          description,
          creatorName,
          sourceType,
          sourceUrl,
          thumbnailUrl,
          viewReal,
          likeReal,
          shareReal,
          viewDisplay,
          likeDisplay,
          shareDisplay,
        } = videoData;

        // 필수 필드 검증
        if (!title || !sourceType || !sourceUrl) {
          upsertedVideos.push({
            id: id || null,
            success: false,
            error: "title, sourceType, and sourceUrl are required",
          });
          continue;
        }

        // sourceType 검증: 'youtube', 'facebook', 'file' 허용
        const allowedSourceTypes = ['youtube', 'facebook', 'file'];
        if (!allowedSourceTypes.includes(sourceType)) {
          upsertedVideos.push({
            id: id || null,
            success: false,
            error: `sourceType must be one of: ${allowedSourceTypes.join(', ')}`,
          });
          continue;
        }

        // creatorName으로 owner_id 찾기
        let ownerId = null;
        if (creatorName) {
          const creator = db.prepare("SELECT id FROM users WHERE name = ? LIMIT 1").get(creatorName);
          if (creator) {
            ownerId = creator.id;
          }
        }

        // Real 값 설정
        const viewCountReal = viewReal ?? 0;
        const likeCountReal = likeReal ?? 0;
        const shareCountReal = shareReal ?? 0;

        // Display 값이 제공되면 offset 계산, 아니면 offset = 0
        const viewOffset = viewDisplay !== undefined ? viewDisplay - viewCountReal : 0;
        const likeOffset = likeDisplay !== undefined ? likeDisplay - likeCountReal : 0;
        const shareOffset = shareDisplay !== undefined ? shareDisplay - shareCountReal : 0;

        if (id) {
          // UPDATE: 기존 영상 수정
          const existing = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
          if (!existing) {
            upsertedVideos.push({
              id,
              success: false,
              error: "Video not found",
            });
            continue;
          }

          const updates = [];
          const params = [];

          updates.push("title = ?");
          params.push(title);
          // description 업데이트 (null/undefined는 빈 문자열로 normalize)
          updates.push("description = ?");
          params.push(description || ''); // null/undefined는 빈 문자열로 저장
          updates.push("platform = ?");
          params.push(sourceType);
          updates.push("source_url = ?");
          params.push(sourceUrl);
          
          // Facebook 썸네일 자동 가져오기 (sourceType이 facebook이고 thumbnailUrl이 없을 때)
          let finalThumbnailUrl = thumbnailUrl;
          if (sourceType === 'facebook') {
            const requestThumbnailEmpty = !finalThumbnailUrl || finalThumbnailUrl === '';
            const existingThumbnailEmpty = !existing.thumbnail_url || existing.thumbnail_url === '';
            
            // 요청에서 썸네일을 보내지 않았거나 비어 있고, 기존 DB에도 썸네일이 없는 경우
            if (requestThumbnailEmpty && existingThumbnailEmpty) {
              const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || null;
              if (facebookAccessToken) {
                try {
                  const { fetchFacebookThumbnail } = await import("./metadata.js");
                  const sourceUrlToUse = sourceUrl || existing.source_url;
                  if (sourceUrlToUse) {
                    console.log(`🔄 [Bulk] Facebook 썸네일 자동 가져오기 시도: ${sourceUrlToUse}`);
                    const fetchedThumbnail = await fetchFacebookThumbnail(sourceUrlToUse, facebookAccessToken);
                    if (fetchedThumbnail) {
                      finalThumbnailUrl = fetchedThumbnail;
                      console.log(`✅ [Bulk] Facebook 썸네일 자동 가져오기 성공: ${finalThumbnailUrl}`);
                    }
                  }
                } catch (err) {
                  console.warn(`⚠️ [Bulk] Facebook 썸네일 가져오기 실패:`, err.message);
                }
              }
            } else if (requestThumbnailEmpty && !existingThumbnailEmpty) {
              // 요청에서 썸네일을 보내지 않았지만 기존 DB에 썸네일이 있는 경우, 기존 값 유지
              finalThumbnailUrl = existing.thumbnail_url;
            }
          }
          
          updates.push("thumbnail_url = ?");
          params.push(finalThumbnailUrl || null);
          updates.push("owner_id = ?");
          params.push(ownerId);
          updates.push("view_count_real = ?");
          params.push(viewCountReal);
          updates.push("like_count_real = ?");
          params.push(likeCountReal);
          updates.push("share_count_real = ?");
          params.push(shareCountReal);
          updates.push("view_offset = ?");
          params.push(viewOffset);
          updates.push("like_offset = ?");
          params.push(likeOffset);
          updates.push("share_offset = ?");
          params.push(shareOffset);
          updates.push("updated_at = datetime('now')");
          params.push(id);

          db.prepare(`UPDATE videos SET ${updates.join(", ")} WHERE id = ?`).run(...params);

          const updatedVideo = db
            .prepare("SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE v.id = ?")
            .get(id);

          upsertedVideos.push(formatVideoResponse(updatedVideo));
        } else {
          // INSERT: 새 영상 생성
          const videoId = generateId();
          
          // 영상 관리번호 자동 생성
          const managementId = generateManagementId();

          // Facebook 썸네일 자동 가져오기 (sourceType이 facebook이고 thumbnailUrl이 없을 때)
          let finalThumbnailUrl = thumbnailUrl;
          if (sourceType === 'facebook' && !finalThumbnailUrl) {
            const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || null;
            if (facebookAccessToken) {
              try {
                const { fetchFacebookThumbnail } = await import("./metadata.js");
                if (sourceUrl) {
                  console.log(`🔄 [Bulk] Facebook 썸네일 자동 가져오기 시도: ${sourceUrl}`);
                  const fetchedThumbnail = await fetchFacebookThumbnail(sourceUrl, facebookAccessToken);
                  if (fetchedThumbnail) {
                    finalThumbnailUrl = fetchedThumbnail;
                    console.log(`✅ [Bulk] Facebook 썸네일 자동 가져오기 성공: ${finalThumbnailUrl}`);
                  }
                }
              } catch (err) {
                console.warn(`⚠️ [Bulk] Facebook 썸네일 가져오기 실패:`, err.message);
              }
            }
          }

          // INSERT 쿼리 (description 필드 포함, null/undefined는 빈 문자열로 normalize)
          db.prepare(
            `INSERT INTO videos (
              id, site_id, owner_id, platform, source_url, title, description,
              thumbnail_url, view_count_real, like_count_real, share_count_real,
              view_offset, like_offset, share_offset, management_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
          ).run(
            videoId,
            siteId,
            ownerId,
            sourceType,
            sourceUrl,
            title,
            description || '', // null/undefined는 빈 문자열로 저장
            finalThumbnailUrl || null,
            viewCountReal,
            likeCountReal,
            shareCountReal,
            viewOffset,
            likeOffset,
            shareOffset,
            managementId
          );

          // video_code 생성 및 업데이트
          const videoCode = ownerId ? `${ownerId}-${videoId}` : `unknown-${videoId}`;
          db.prepare("UPDATE videos SET video_code = ? WHERE id = ?").run(videoCode, videoId);

          const createdVideo = db
            .prepare("SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE v.id = ?")
            .get(videoId);

          upsertedVideos.push(formatVideoResponse(createdVideo));
        }
      }

      return reply.send({ 
        success: true,
        data: { videos: upsertedVideos },
        summary: {
          total: videos.length,
          created: upsertedVideos.filter(v => v.id && !videos.find(vd => vd.id === v.id)).length,
          updated: upsertedVideos.filter(v => v.id && videos.find(vd => vd.id === v.id)).length,
          failed: upsertedVideos.filter(v => !v.success || v.error).length
        }
      });
    } catch (err) {
      console.error("대량 Upsert 오류:", err);
      return reply.code(500).send({ 
        success: false,
        message: err.message || "Bulk upsert failed" 
      });
    }
  }
);

// Admin - 대량 삭제 (최대 20개)
app.post(
  "/admin/videos/bulk-delete",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { ids } = request.body;

    if (!ids || !Array.isArray(ids)) {
      return reply.code(400).send({ 
        success: false,
        message: "ids array is required" 
      });
    }

    if (ids.length === 0) {
      return reply.code(400).send({ 
        success: false,
        message: "ids array cannot be empty" 
      });
    }

    if (ids.length > 20) {
      return reply.code(400).send({ 
        success: false,
        message: "한 번에 최대 20개까지만 처리할 수 있습니다." 
      });
    }

    try {
      const placeholders = ids.map(() => "?").join(",");
      const result = db.prepare(
        `DELETE FROM videos WHERE id IN (${placeholders})`
      ).run(...ids);

      return reply.send({
        success: true,
        deleted: result.changes,
        message: `${result.changes}개의 영상이 삭제되었습니다.`
      });
    } catch (err) {
      console.error("대량 삭제 오류:", err);
      return reply.code(500).send({ 
        success: false,
        message: err.message || "Bulk delete failed" 
      });
    }
  }
);

// Admin - 일괄 삭제 (기존 엔드포인트, 호환성 유지)
app.post(
  "/admin/videos/batch-delete",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { video_ids } = request.body;

    if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
      return reply.code(400).send({ 
        success: false,
        message: "video_ids array is required" 
      });
    }

    try {
      const placeholders = video_ids.map(() => "?").join(",");
      const result = db.prepare(
        `DELETE FROM videos WHERE id IN (${placeholders})`
      ).run(...video_ids);

      return reply.send({
        success: true,
        deleted_count: result.changes,
        message: `${result.changes}개의 영상이 삭제되었습니다.`
      });
    } catch (err) {
      console.error("일괄 삭제 오류:", err);
      return reply.code(500).send({ 
        success: false,
        message: err.message || "Batch delete failed" 
      });
    }
  }
);

// 비디오 메타데이터 추출 API (공개 엔드포인트, 인증 불필요)
app.post(
  "/videos/metadata",
  async (request, reply) => {
    try {
      const { source_type, source_url } = request.body;

      // 입력 검증
      if (!source_url || typeof source_url !== "string" || source_url.trim() === "") {
        return reply.code(400).send({
          success: false,
          message: "source_url is required and must be a non-empty string"
        });
      }

      if (!source_type || !["youtube", "facebook"].includes(source_type)) {
        return reply.code(400).send({
          success: false,
          message: "source_type must be 'youtube' or 'facebook'"
        });
      }

      if (source_type === "youtube") {
        // YouTube URL 검증
        try {
          const urlObj = new URL(source_url);
          const hostname = urlObj.hostname.toLowerCase();
          
          if (!hostname.includes("youtube.com") && !hostname.includes("youtu.be")) {
            return reply.code(400).send({
              success: false,
              message: "Invalid YouTube URL. Must be from youtube.com or youtu.be"
            });
          }
        } catch (urlErr) {
          return reply.code(400).send({
            success: false,
            message: "Invalid URL format"
          });
        }

        // YouTube oEmbed API 호출
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(source_url)}&format=json`;
          const fetch = (await import("node-fetch")).default;
          const response = await fetch(oembedUrl, { timeout: 5000 });
          
          if (response.ok) {
            const data = await response.json();
            const videoId = extractYouTubeVideoId(source_url);
            const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
            
            return reply.send({
              success: true,
              title: data.title || null,
              description: null, // oEmbed는 description을 제공하지 않음
              thumbnail_url: thumbnailUrl || data.thumbnail_url || null
            });
          } else {
            return reply.send({
              success: false,
              message: "YouTube 메타데이터를 가져올 수 없습니다. URL을 확인해주세요."
            });
          }
        } catch (fetchErr) {
          console.error("YouTube oEmbed fetch error:", fetchErr);
          return reply.send({
            success: false,
            message: "YouTube 메타데이터 자동 추출 준비 중"
          });
        }
      } else if (source_type === "facebook") {
        // Facebook 메타데이터 추출 (기본값 반환, 에러 없이 저장 가능하도록)
        // Access Token이 없어도 기본값으로 처리하여 저장 가능하게 함
        return reply.send({
          success: true,
          title: null, // 사용자가 입력한 제목 사용
          description: null,
          thumbnail_url: null, // 사용자가 입력한 썸네일 또는 기본값 사용
          message: "Facebook 메타데이터는 수동으로 입력해주세요. (Access Token 필요)"
        });
      }
    } catch (err) {
      console.error("❌ POST /videos/metadata 오류:", err);
      console.error("   요청 body:", request.body);
      console.error("   스택:", err.stack);
      return reply.code(500).send({
        success: false,
        message: err.message || "메타데이터 추출에 실패했습니다."
      });
    }
  }
);

// Admin - 일괄 수정
app.patch(
  "/admin/videos/batch-update",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { video_ids, updates } = request.body;

    if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
      return reply.code(400).send({ error: "video_ids array is required" });
    }

    if (!updates || typeof updates !== "object") {
      return reply.code(400).send({ error: "updates object is required" });
    }

    try {
      const allowedFields = ["language", "status", "visibility", "viewsDisplay", "likesDisplay", "sharesDisplay"];
      const updateFields = [];
      const params = [];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          if (field === "viewsDisplay" || field === "likesDisplay" || field === "sharesDisplay") {
            const dbField = field.replace(/([A-Z])/g, "_$1").toLowerCase();
            updateFields.push(`${dbField} = ?`);
            params.push(updates[field]);
          } else {
            updateFields.push(`${field} = ?`);
            params.push(updates[field]);
          }
        }
      }

      if (updateFields.length === 0) {
        return reply.code(400).send({ error: "No valid fields to update" });
      }

      updateFields.push("updated_at = datetime('now')");

      const placeholders = video_ids.map(() => "?").join(",");
      const result = db.prepare(
        `UPDATE videos SET ${updateFields.join(", ")} WHERE id IN (${placeholders})`
      ).run(...params, ...video_ids);

      return {
        success: true,
        updated_count: result.changes,
      };
    } catch (err) {
      console.error("일괄 수정 오류:", err);
      return reply.code(500).send({ error: "Batch update failed" });
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

// Admin - Video Display Stats 수정 (관리자만 가능)
app.patch(
  "/admin/videos/:id/stats",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;
    const { viewsDisplay, likesDisplay, sharesDisplay } = request.body;
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
      video.views_display || 0,
      viewsDisplay !== undefined ? viewsDisplay : video.views_display || 0,
      video.likes_display || 0,
      likesDisplay !== undefined ? likesDisplay : video.likes_display || 0,
      video.shares_display || 0,
      sharesDisplay !== undefined ? sharesDisplay : video.shares_display || 0
    );

    // Display Stats 업데이트
    const updates = [];
    const params = [];

    if (viewsDisplay !== undefined) {
      updates.push("views_display = ?");
      params.push(viewsDisplay);
    }

    if (likesDisplay !== undefined) {
      updates.push("likes_display = ?");
      params.push(likesDisplay);
    }

    if (sharesDisplay !== undefined) {
      updates.push("shares_display = ?");
      params.push(sharesDisplay);
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

// Admin - Display 수치를 Actual 수치로 재설정
app.post(
  "/admin/videos/:id/stats/reset-to-actual",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;
    const user = request.user;

    // 현재 영상 정보 조회
    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);

    if (!video) {
      return reply.code(404).send({ error: "Video not found" });
    }

    // Display = Actual로 설정
    db.prepare(
      "UPDATE videos SET views_display = views_actual, likes_display = likes_actual, shares_display = shares_actual, stats_updated_at = datetime('now'), stats_updated_by = ? WHERE id = ?"
    ).run(user.id, id);

    // 변경 로그 기록
    const logId = generateId();
    db.prepare(
      "INSERT INTO stats_adjustments (id, video_id, admin_id, old_views, new_views, old_likes, new_likes, old_shares, new_shares) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      logId,
      id,
      user.id,
      video.views_display || 0,
      video.views_actual || 0,
      video.likes_display || 0,
      video.likes_actual || 0,
      video.shares_display || 0,
      video.shares_actual || 0
    );

    const updatedVideo = db.prepare("SELECT * FROM videos WHERE id = ?").get(id);
    return updatedVideo;
  }
);

// ==================== Creator 전용 엔드포인트 ====================

// Creator/Admin - Videos 조회 (검색 및 필터 지원)
app.get(
  "/videos",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    try {
      const { 
        site_id,
        q,                // 강화된 검색어 (title, description, creator_name, management_no, created_at)
        search,           // 하위 호환성을 위한 검색어
        startDate,        // 시작 날짜 필터
        endDate           // 종료 날짜 필터
      } = request.query;
      
      const user = request.user;
      
      console.log("[CMS] GET /videos 요청 수신:", {
        userId: user.id,
        role: user.role,
        site_id,
        q,
        search,
        startDate,
        endDate
      });

      // 기본 쿼리: owner_name을 포함하여 조회
      let query = "SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE 1=1";
      const params = [];

      // 삭제되지 않은 영상만 조회 (is_deleted 컬럼이 없으므로 조건 제거)
      // 필요시 status 컬럼을 사용하여 필터링 가능

      // Admin은 모든 영상 조회 가능, Creator는 자신의 영상만
      if (user.role !== "admin") {
        // Creator는 자기 site_id와 owner_id로만 조회
        query += " AND v.site_id = ? AND v.owner_id = ?";
        params.push(user.site_id, user.id);
      } else {
        // Admin은 site_id 필터 가능 (선택사항)
        if (site_id && site_id.trim() !== '') {
          query += " AND v.site_id = ?";
          params.push(site_id.trim());
        }
      }

      // 강화된 검색어 필터 (q 파라미터 우선, 없으면 search 파라미터 사용)
      const searchQuery = q || search;
      if (searchQuery && searchQuery.trim() !== '') {
        const searchTerm = `%${searchQuery.trim()}%`;
        // title, description, creator_name, management_no, created_at에서 검색
        query += " AND (v.title LIKE ? OR v.description LIKE ? OR u.name LIKE ? OR v.management_id LIKE ? OR v.created_at LIKE ?)";
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // 날짜 필터 (startDate가 비어있지 않을 때만 적용)
      if (startDate && startDate.trim() !== '') {
        query += " AND DATE(v.created_at) >= DATE(?)";
        params.push(startDate.trim());
      }

      // 날짜 필터 (endDate가 비어있지 않을 때만 적용)
      if (endDate && endDate.trim() !== '') {
        query += " AND DATE(v.created_at) <= DATE(?)";
        params.push(endDate.trim());
      }

      // 항상 created_at DESC로 정렬 (created_at이 없으면 id DESC)
      query += " ORDER BY COALESCE(v.created_at, v.id) DESC";

      console.log("[CMS] GET /videos SQL 쿼리:", query);
      console.log("[CMS] GET /videos 파라미터:", params);

      const videos = db.prepare(query).all(...params);
      
      console.log(`[CMS] GET /videos 조회 결과: ${videos.length}개 영상`);

      // display 값 계산하여 응답 포맷팅
      const formattedVideos = videos.map(formatVideoResponse);

      // 프론트엔드 호환성을 위해 items 배열로 반환
      return reply.send({
        items: formattedVideos
      });
    } catch (err) {
      console.error("❌ GET /videos 오류:", err);
      console.error("   요청 query:", request.query);
      console.error("   스택:", err.stack);
      return reply.code(500).send({
        success: false,
        message: err.message || "Failed to fetch videos"
      });
    }
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

    for (let i = 0; i < videosToAdd.length; i++) {
      const videoData = videosToAdd[i];
      try {
        const { 
          videoType, 
          title, 
          description,
          language = "en",
          youtubeId,
          facebookUrl
        } = videoData;

        // videoType 필수: 'youtube', 'facebook', 'file' 허용
        const allowedVideoTypes = ['youtube', 'facebook', 'file'];
        if (!videoType || !allowedVideoTypes.includes(videoType)) {
          errors.push({ index: i, error: `videoType must be one of: ${allowedVideoTypes.join(', ')}` });
          continue;
        }

        // videoType에 맞는 필드 확인
        let finalYoutubeId = null;
        let finalFacebookUrl = null;
        
        if (videoType === "youtube") {
          if (!youtubeId) {
            errors.push({ index: i, error: "youtubeId is required for youtube videoType" });
            continue;
          }
          finalYoutubeId = youtubeId;
        } else if (videoType === "facebook") {
          if (!facebookUrl) {
            errors.push({ index: i, error: "facebookUrl is required for facebook videoType" });
            continue;
          }
          finalFacebookUrl = facebookUrl;
        } else if (videoType === "file") {
          // file 타입은 source_url이 직접 제공되어야 함
          // 검증은 나중에 처리
        }

        // 필수 필드 확인
        if (!title) {
          errors.push({ index: i, error: "title is required" });
          continue;
        }

        // 메타정보 자동 보강
        const sourceUrl = videoType === "youtube" 
          ? `https://www.youtube.com/watch?v=${finalYoutubeId}`
          : finalFacebookUrl;
        
        // Facebook 썸네일 자동 가져오기
        let finalThumbnailUrl = null;
        if (videoType === 'facebook') {
          const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || null;
          if (facebookAccessToken) {
            try {
              const { fetchFacebookThumbnail } = await import("./metadata.js");
              const fetchedThumbnail = await fetchFacebookThumbnail(sourceUrl, facebookAccessToken);
              if (fetchedThumbnail) {
                finalThumbnailUrl = fetchedThumbnail;
              }
            } catch (err) {
              console.warn(`⚠️ Facebook 썸네일 가져오기 실패 (인덱스 ${i}):`, err.message);
            }
          }
        }
        
        const metadata = await enrichMetadata(videoType, sourceUrl, title, finalThumbnailUrl, process.env.FACEBOOK_ACCESS_TOKEN || null);

        const videoId = generateId();
        db.prepare(
          "INSERT INTO videos (id, site_id, owner_id, creator_id, platform, video_type, video_id, youtube_id, facebook_url, source_url, title, description, thumbnail_url, embed_url, language, status, visibility, views_actual, views_display, likes_actual, likes_display, shares_actual, shares_display) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0)"
        ).run(
          videoId,
          siteId,
          user.id,
          user.id,
          videoType,
          videoType,
          finalYoutubeId || finalFacebookUrl?.match(/\/videos\/(\d+)/)?.[1] || null,
          finalYoutubeId,
          finalFacebookUrl,
          sourceUrl,
          title,
          description || null,
          metadata.thumbnail_url || finalThumbnailUrl || null,
          metadata.embed_url,
          language,
          "active",
          "public"
        );

        const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
        results.push({ index: i, success: true, video });
      } catch (err) {
        errors.push({ index: i, error: err.message });
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
    const { 
      platform, 
      source_url, 
      title, 
      description,
      thumbnail_url, 
      visibility = "public", 
      language = "en", 
      status = "active", 
      site_id,
      videoType,
      youtubeId,
      facebookUrl
    } = request.body;
    const user = request.user;

    // videoType 또는 platform 사용 (videoType 우선)
    const finalVideoType = videoType || platform;
    const allowedVideoTypes = ['youtube', 'facebook', 'file'];
    if (!finalVideoType || !allowedVideoTypes.includes(finalVideoType)) {
      return reply.code(400).send({ 
        success: false,
        message: `videoType must be one of: ${allowedVideoTypes.join(', ')}` 
      });
    }

    // videoType에 맞는 필드 확인
    let finalYoutubeId = null;
    let finalFacebookUrl = null;
    
    if (finalVideoType === "youtube") {
      if (youtubeId) {
        finalYoutubeId = youtubeId;
      } else if (source_url) {
        finalYoutubeId = extractYouTubeVideoId(source_url);
      }
      if (!finalYoutubeId) {
        return reply.code(400).send({ 
          success: false,
          message: "youtubeId or valid YouTube URL is required for youtube videoType" 
        });
      }
    } else if (finalVideoType === "facebook") {
      if (facebookUrl) {
        finalFacebookUrl = facebookUrl;
      } else if (source_url) {
        finalFacebookUrl = source_url;
      }
      if (!finalFacebookUrl) {
        return reply.code(400).send({ 
          success: false,
          message: "facebookUrl or source_url is required for facebook videoType" 
        });
      }
    } else if (finalVideoType === "file") {
      // file 타입은 source_url이 직접 제공되어야 함
      if (!source_url) {
        return reply.code(400).send({ 
          success: false,
          message: "source_url is required for file videoType" 
        });
      }
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
    const finalSourceUrl = finalVideoType === "youtube" 
      ? `https://www.youtube.com/watch?v=${finalYoutubeId}`
      : finalFacebookUrl;
    const metadata = await enrichMetadata(finalVideoType, finalSourceUrl, title, thumbnail_url);

    const videoId = generateId();
    db.prepare(
      "INSERT INTO videos (id, site_id, owner_id, creator_id, platform, video_type, video_id, youtube_id, facebook_url, source_url, title, description, thumbnail_url, embed_url, language, status, visibility, views_actual, views_display, likes_actual, likes_display, shares_actual, shares_display, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, datetime('now'), datetime('now'))"
    ).run(
      videoId,
      siteId,
      user.id,
      user.id,
      finalVideoType,
      finalVideoType,
      finalYoutubeId || finalFacebookUrl?.match(/\/videos\/(\d+)/)?.[1] || null,
      finalYoutubeId,
      finalFacebookUrl,
      finalSourceUrl,
      metadata.title || title,
      description || null,
      metadata.thumbnail_url || finalThumbnailUrl || null,
      metadata.embed_url,
      language,
      status,
      visibility
    );

    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId);
    return video;
  }
);

// Creator/Admin - Video 대량 생성
app.post(
  "/videos/bulk",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    console.log("[CMS] POST /videos/bulk 요청 수신");
    
    try {
      // body가 배열인지 확인
      const rows = Array.isArray(request.body) ? request.body : [];
      
      if (rows.length === 0) {
        return reply.code(400).send({ 
          success: false,
          message: "빈 목록입니다. 최소 1개 이상의 영상이 필요합니다." 
        });
      }

      const user = request.user;
      
      // Admin은 site_id를 지정 가능, Creator는 자기 site_id로 강제
      let siteId;
      if (user.role === "admin") {
        // Admin: body에서 site_id 받기 (없으면 기본값 사용)
        siteId = request.body.site_id || getActiveSite()?.id || null;
        if (!siteId) {
          return reply.code(400).send({ 
            success: false,
            message: "Admin must provide site_id" 
          });
        }
      } else {
        // Creator: 자기 site_id 사용
        siteId = user.site_id;
        if (!siteId) {
          return reply.code(400).send({ 
            success: false,
            message: "Creator must have a site_id" 
          });
        }
      }

      const results = [];
      const errors = [];
      
      // 각 row를 순회하면서 처리
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          // sourceUrl이 비어있거나 공백이면 skip
          if (!row.sourceUrl || !row.sourceUrl.trim()) {
            console.log(`[CMS] POST /videos/bulk - 인덱스 ${i}: sourceUrl이 비어있어 건너뜀`);
            continue;
          }

          // 필드 매핑 (프론트엔드 필드명 → DB 필드명)
          const sourceUrl = row.sourceUrl.trim();
          const sourceType = row.sourceType || row.videoType || 'file';
          const title = (row.title && row.title.trim()) || 'Untitled Video';
          const thumbnailUrl = row.thumbnailUrl ? row.thumbnailUrl.trim() : null;

          // sourceType 검증
          const allowedSourceTypes = ['youtube', 'facebook', 'file'];
          if (!allowedSourceTypes.includes(sourceType)) {
            errors.push({
              index: i,
              error: `sourceType must be one of: ${allowedSourceTypes.join(', ')}`
            });
            continue;
          }

          // Facebook 썸네일 자동 가져오기
          let finalThumbnailUrl = thumbnailUrl;
          if (sourceType === 'facebook' && !finalThumbnailUrl) {
            const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || null;
            if (facebookAccessToken) {
              try {
                const { fetchFacebookThumbnail } = await import("./metadata.js");
                const fetchedThumbnail = await fetchFacebookThumbnail(sourceUrl, facebookAccessToken);
                if (fetchedThumbnail) {
                  finalThumbnailUrl = fetchedThumbnail;
                  console.log(`✅ Facebook 썸네일 자동 가져오기 성공: ${finalThumbnailUrl}`);
                }
              } catch (err) {
                console.warn(`⚠️ Facebook 썸네일 가져오기 실패 (인덱스 ${i}):`, err.message);
              }
            }
          }

          // YouTube 썸네일 자동 생성
          if (sourceType === 'youtube' && !finalThumbnailUrl) {
            const youtubeId = extractYouTubeVideoId(sourceUrl);
            if (youtubeId) {
              finalThumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
            }
          }

          // 영상 관리번호 자동 생성
          const managementId = generateManagementId();

          // videoId 생성
          const videoId = generateId();

          // INSERT 쿼리 실행
          db.prepare(
            `INSERT INTO videos (
              id, site_id, owner_id, platform, source_url, title, description,
              thumbnail_url, view_count_real, like_count_real, share_count_real,
              view_offset, like_offset, share_offset, management_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
          ).run(
            videoId,
            siteId,
            user.id, // owner_id는 로그인한 사용자로 설정
            sourceType,
            sourceUrl,
            title,
            '', // description은 빈 문자열
            finalThumbnailUrl || null,
            0, // view_count_real
            0, // like_count_real
            0, // share_count_real
            0, // view_offset
            0, // like_offset
            0, // share_offset
            managementId
          );

          // video_code 생성 및 업데이트
          const videoCode = `${user.id}-${videoId}`;
          db.prepare("UPDATE videos SET video_code = ? WHERE id = ?").run(videoCode, videoId);

          // 생성된 영상 조회
          const createdVideo = db
            .prepare("SELECT v.*, u.name as owner_name FROM videos v LEFT JOIN users u ON v.owner_id = u.id WHERE v.id = ?")
            .get(videoId);

          results.push(formatVideoResponse(createdVideo));
          
          console.log(`[CMS] POST /videos/bulk - 인덱스 ${i}: 영상 생성 성공 (ID: ${videoId})`);
        } catch (err) {
          console.error(`[CMS] POST /videos/bulk - 인덱스 ${i} 오류:`, err);
          errors.push({
            index: i,
            error: err.message || '알 수 없는 오류'
          });
        }
      }

      console.log(`[CMS] POST /videos/bulk 완료 - 성공: ${results.length}, 실패: ${errors.length}`);

      return reply.code(201).send({
        success: true,
        count: results.length,
        failed: errors.length,
        items: results,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (err) {
      console.error("❌ POST /videos/bulk 오류:", err);
      console.error("   요청 body:", request.body);
      console.error("   스택:", err.stack);
      return reply.code(500).send({ 
        success: false,
        message: err.message || "bulk 저장 중 오류가 발생했습니다." 
      });
    }
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

// Creator - 일괄 수정 (본인 영상만)
app.patch(
  "/videos/batch-update",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { video_ids, updates } = request.body;
    const user = request.user;

    if (!video_ids || !Array.isArray(video_ids) || video_ids.length === 0) {
      return reply.code(400).send({ error: "video_ids array is required" });
    }

    if (!updates || typeof updates !== "object") {
      return reply.code(400).send({ error: "updates object is required" });
    }

    try {
      // Creator는 Display 수치 수정 불가, 다른 필드만 수정 가능
      const allowedFields = ["language", "status", "visibility"];
      const updateFields = [];
      const params = [];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateFields.push(`${field} = ?`);
          params.push(updates[field]);
        }
      }

      if (updateFields.length === 0) {
        return reply.code(400).send({ error: "No valid fields to update" });
      }

      updateFields.push("updated_at = datetime('now')");

      let updatedCount = 0;
      // Creator: 본인 영상만 수정
      for (const videoId of video_ids) {
        const result = db
          .prepare(`UPDATE videos SET ${updateFields.join(", ")} WHERE id = ? AND owner_id = ?`)
          .run(...params, videoId, user.id);
        updatedCount += result.changes;
      }

      return {
        success: true,
        updated_count: updatedCount,
      };
    } catch (err) {
      console.error("일괄 수정 오류:", err);
      return reply.code(500).send({ error: "Batch update failed" });
    }
  }
);

// Creator - Facebook Key 조회 (본인 것만)
app.get(
  "/my/facebook-keys",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const user = request.user;

    const keys = db
      .prepare("SELECT * FROM facebook_keys WHERE creator_id = ? ORDER BY created_at DESC")
      .all(user.id);

    // 민감한 정보 마스킹 (보안)
    const maskedKeys = keys.map((key) => ({
      ...key,
      facebook_access_token: key.facebook_access_token 
        ? `${key.facebook_access_token.substring(0, 8)}...${key.facebook_access_token.substring(key.facebook_access_token.length - 4)}`
        : null,
    }));

    return { keys: maskedKeys };
  }
);

// Admin - Facebook Key 조회 (모든 크리에이터)
app.get(
  "/admin/facebook-keys",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { creator_id } = request.query;

    let query = "SELECT fk.*, u.name as creator_name, u.email as creator_email FROM facebook_keys fk LEFT JOIN users u ON fk.creator_id = u.id";
    const params = [];

    if (creator_id) {
      query += " WHERE fk.creator_id = ?";
      params.push(creator_id);
    }

    query += " ORDER BY fk.created_at DESC";

    const keys = db.prepare(query).all(...params);

    // 민감한 정보 마스킹
    const maskedKeys = keys.map((key) => ({
      ...key,
      facebook_access_token: key.facebook_access_token 
        ? `${key.facebook_access_token.substring(0, 8)}...${key.facebook_access_token.substring(key.facebook_access_token.length - 4)}`
        : null,
    }));

    return { keys: maskedKeys };
  }
);

// Creator - Facebook Key 저장/수정 (upsert)
app.put(
  "/my/facebook-keys",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { facebookAccessToken, pageId, userId, appId, note } = request.body;
    const user = request.user;

    if (!facebookAccessToken) {
      return reply.code(400).send({ error: "facebookAccessToken is required" });
    }

    // 기존 키 확인
    const existing = db
      .prepare("SELECT * FROM facebook_keys WHERE creator_id = ?")
      .get(user.id);

    if (existing) {
      // 업데이트
      db.prepare(
        "UPDATE facebook_keys SET facebook_access_token = ?, page_id = ?, user_id = ?, app_id = ?, note = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(facebookAccessToken, pageId || null, userId || null, appId || null, note || null, existing.id);
      const updated = db.prepare("SELECT * FROM facebook_keys WHERE id = ?").get(existing.id);
      return updated;
    } else {
      // 생성
      const keyId = generateId();
      db.prepare(
        "INSERT INTO facebook_keys (id, creator_id, facebook_access_token, page_id, user_id, app_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(keyId, user.id, facebookAccessToken, pageId || null, userId || null, appId || null, note || null);
      const created = db.prepare("SELECT * FROM facebook_keys WHERE id = ?").get(keyId);
      return created;
    }
  }
);

// Admin - Facebook Key 저장/수정 (크리에이터 대신)
app.put(
  "/admin/facebook-keys/:creator_id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { creator_id } = request.params;
    const { facebookAccessToken, pageId, userId, appId, note } = request.body;

    if (!facebookAccessToken) {
      return reply.code(400).send({ error: "facebookAccessToken is required" });
    }

    // 크리에이터 존재 확인
    const creator = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'creator'").get(creator_id);
    if (!creator) {
      return reply.code(404).send({ error: "Creator not found" });
    }

    // 기존 키 확인
    const existing = db
      .prepare("SELECT * FROM facebook_keys WHERE creator_id = ?")
      .get(creator_id);

    if (existing) {
      // 업데이트
      db.prepare(
        "UPDATE facebook_keys SET facebook_access_token = ?, page_id = ?, user_id = ?, app_id = ?, note = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(facebookAccessToken, pageId || null, userId || null, appId || null, note || null, existing.id);
      const updated = db.prepare("SELECT * FROM facebook_keys WHERE id = ?").get(existing.id);
      return updated;
    } else {
      // 생성
      const keyId = generateId();
      db.prepare(
        "INSERT INTO facebook_keys (id, creator_id, facebook_access_token, page_id, user_id, app_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(keyId, creator_id, facebookAccessToken, pageId || null, userId || null, appId || null, note || null);
      const created = db.prepare("SELECT * FROM facebook_keys WHERE id = ?").get(keyId);
      return created;
    }
  }
);

// Creator - Facebook Key 삭제
app.delete(
  "/my/facebook-keys/:id",
  { preHandler: [authenticate, requireCreator] },
  async (request, reply) => {
    const { id } = request.params;
    const user = request.user;

    // 본인 소유 확인
    const result = db
      .prepare("DELETE FROM facebook_keys WHERE id = ? AND creator_id = ?")
      .run(id, user.id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Key not found or access denied" });
    }

    return { success: true };
  }
);

// Admin - Facebook Key 삭제
app.delete(
  "/admin/facebook-keys/:id",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    const { id } = request.params;

    const result = db.prepare("DELETE FROM facebook_keys WHERE id = ?").run(id);

    if (result.changes === 0) {
      return reply.code(404).send({ error: "Key not found" });
    }

    return { success: true };
  }
);

// Admin - 썸네일 업로드
app.post(
  "/admin/uploads/thumbnail",
  { preHandler: [authenticate, requireAdmin] },
  async (request, reply) => {
    try {
      const file = await request.file();

      if (!file) {
        return reply.code(400).send({
          success: false,
          message: "파일이 제공되지 않았습니다.",
        });
      }

      // 파일 필드명 확인
      if (file.fieldname !== "file") {
        return reply.code(400).send({
          success: false,
          message: "파일 필드명이 올바르지 않습니다.",
        });
      }

      // 이미지 파일 타입 검증
      if (!file.mimetype || !file.mimetype.startsWith("image/")) {
        return reply.code(400).send({
          success: false,
          message: "이미지 파일만 업로드할 수 있습니다.",
        });
      }

      // 파일 확장자 추출
      const originalFilename = file.filename || "upload";
      const ext = path.extname(originalFilename).toLowerCase() || 
                  (file.mimetype === "image/jpeg" ? ".jpg" :
                   file.mimetype === "image/png" ? ".png" :
                   file.mimetype === "image/webp" ? ".webp" : ".jpg");

      // 고유 파일명 생성 (Date.now() + 랜덤 문자열 + 확장자)
      const randomStr = Math.random().toString(36).substring(2, 15);
      const filename = `${Date.now()}_${randomStr}${ext}`;
      const filepath = path.join(thumbnailsDir, filename);

      // 파일 저장
      const buffer = await file.toBuffer();
      fs.writeFileSync(filepath, buffer);

      // 공개 URL 생성
      const baseUrl = `${request.protocol}://${request.headers.host}`;
      const publicUrl = `${baseUrl}/uploads/thumbnails/${filename}`;

      console.log(`✅ Thumbnail uploaded: ${filename} -> ${publicUrl}`);

      return reply.send({
        success: true,
        url: publicUrl,
      });
    } catch (error) {
      console.error("❌ Thumbnail upload error:", error);
      return reply.code(500).send({
        success: false,
        message: "썸네일 업로드에 실패했습니다.",
      });
    }
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
