const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");
const { randomBytes, scryptSync } = require("crypto");
const fs = require("fs");
const jwt = require("jsonwebtoken");

// Firebase Admin 초기화
admin.initializeApp();

// Express 앱 생성
const app = express();

// CORS 설정
const allowedOrigins = [
  "https://cms.godcomfortword.com",
  "https://gods-comfort-word-cms.web.app",
  "https://gods-comfort-word-cms.firebaseapp.com",
  "https://www.godcomfortword.com",
  "https://godcomfortword.com",
  "http://localhost:5173",
  "http://localhost:3000",
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

// ==================== DB 연결 ====================

// DB 경로 결정 (환경변수 또는 기본값)
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "cms.db");

// DB 초기화
let db;
try {
  // DB 파일이 존재하는지 확인
  if (fs.existsSync(dbPath)) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    console.log(`✅ SQLite DB 연결 성공: ${dbPath}`);
  } else {
    console.error(`❌ DB 파일을 찾을 수 없음: ${dbPath}`);
    // DB가 없어도 서버는 시작되지만, DB 관련 엔드포인트는 에러 반환
  }
} catch (error) {
  console.error("❌ DB 연결 실패:", error);
  // DB 연결 실패해도 서버는 시작
}

// ==================== 헬퍼 함수 ====================

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  try {
    const testHash = scryptSync(password, salt || "", 64).toString("hex");
    return testHash === hash;
  } catch (error) {
    console.error("비밀번호 검증 에러:", error);
    return false;
  }
}

function findUserByEmail(email) {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

function updateUserPassword(userId, passwordHash, salt) {
  if (!db) {
    throw new Error("Database not initialized");
  }
  try {
    // updated_at 컬럼 존재 여부 확인
    const tableInfo = db.prepare("PRAGMA table_info('users')").all();
    const hasUpdatedAt = tableInfo.some((col) => col.name === "updated_at");

    if (hasUpdatedAt) {
      db.prepare(
        "UPDATE users SET password_hash = ?, api_key_salt = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(passwordHash, salt, userId);
    } else {
      db.prepare(
        "UPDATE users SET password_hash = ?, api_key_salt = ? WHERE id = ?"
      ).run(passwordHash, salt, userId);
    }
  } catch (error) {
    console.error("비밀번호 업데이트 에러:", error);
    throw error;
  }
}

// ==================== 라우트 ====================

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, db: db ? "connected" : "disconnected" });
});

// POST /auth/login
app.post("/auth/login", (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({
        error: "Database not available",
        message: "데이터베이스 연결을 사용할 수 없습니다.",
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Bad Request",
        message: "이메일과 비밀번호를 입력해주세요.",
      });
    }

    // 사용자 조회
    const user = findUserByEmail(email.toLowerCase().trim());

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    // 비밀번호 확인
    if (!user.password_hash) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "비밀번호가 설정되지 않은 계정입니다.",
      });
    }

    const isValid = verifyPassword(
      password,
      user.password_hash,
      user.api_key_salt || ""
    );

    if (!isValid) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    // JWT 토큰 생성
    const JWT_SECRET = process.env.JWT_SECRET || "change_this_jwt_secret_key_to_secure_random_string";
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        site_id: user.site_id,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        site_id: user.site_id,
      },
    });
  } catch (error) {
    console.error("로그인 에러:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "로그인 중 오류가 발생했습니다.",
    });
  }
});

// POST /auth/check-email
app.post("/auth/check-email", (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({
        error: "Database not available",
        message: "데이터베이스 연결을 사용할 수 없습니다.",
      });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Bad Request",
        message: "이메일을 입력해주세요.",
      });
    }

    const user = findUserByEmail(email.toLowerCase().trim());

    if (!user) {
      return res.json({ exists: false });
    }

    return res.json({
      exists: true,
      role: user.role,
    });
  } catch (error) {
    console.error("이메일 확인 에러:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "이메일 확인 중 오류가 발생했습니다.",
    });
  }
});

// POST /auth/change-password
app.post("/auth/change-password", (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({
        ok: false,
        message: "데이터베이스 연결을 사용할 수 없습니다.",
      });
    }

    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
      return res.status(200).json({
        ok: false,
        message: "이메일, 현재 비밀번호, 새 비밀번호를 모두 입력해주세요.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(200).json({
        ok: false,
        message: "새 비밀번호는 최소 8자 이상이어야 합니다.",
      });
    }

    // 사용자 조회
    const user = findUserByEmail(email.toLowerCase().trim());

    if (!user) {
      return res.status(200).json({
        ok: false,
        message: "사용자를 찾을 수 없습니다.",
      });
    }

    // 역할 체크: admin 또는 creator만 가능
    if (user.role !== "admin" && user.role !== "creator") {
      return res.status(403).json({
        statusCode: 403,
        error: "FORBIDDEN",
        message: "비밀번호 변경은 관리자 또는 크리에이터 계정만 가능합니다.",
      });
    }

    // 비밀번호가 설정되지 않은 경우
    if (!user.password_hash) {
      return res.status(200).json({
        ok: false,
        message: "비밀번호가 설정되지 않은 계정입니다. 최초 비밀번호 설정을 사용해주세요.",
      });
    }

    // 현재 비밀번호 확인
    const isValid = verifyPassword(
      currentPassword,
      user.password_hash,
      user.api_key_salt || ""
    );

    if (!isValid) {
      return res.status(200).json({
        ok: false,
        message: "현재 비밀번호가 올바르지 않습니다.",
      });
    }

    // 새 비밀번호 해싱
    const { hash, salt } = hashPassword(newPassword);

    // 비밀번호 업데이트
    updateUserPassword(user.id, hash, salt);

    console.log(`✅ 비밀번호 변경 완료: ${user.email}`);

    return res.status(200).json({
      ok: true,
    });
  } catch (error) {
    console.error("비밀번호 변경 에러:", error);
    return res.status(200).json({
      ok: false,
      message: "비밀번호 변경 중 오류가 발생했습니다. 관리자에게 문의하세요.",
    });
  }
});

// GET /creator/videos
app.get("/creator/videos", (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({
        error: "Database not available",
        message: "데이터베이스 연결을 사용할 수 없습니다.",
      });
    }

    // JWT 토큰 검증
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "인증 토큰이 필요합니다.",
      });
    }

    const token = authHeader.substring(7); // "Bearer " 제거
    const JWT_SECRET = process.env.JWT_SECRET || "change_this_jwt_secret_key_to_secure_random_string";

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "유효하지 않은 토큰입니다.",
      });
    }

    // 사용자 ID로 영상 조회 (owner_id 또는 site_id 기반)
    const userId = decoded.id;
    const siteId = req.query.site_id || decoded.site_id || "";

    // owner_id와 site_id 모두 사용하여 영상 조회
    const videos = db
      .prepare(
        "SELECT * FROM videos WHERE owner_id = ? AND site_id = ? ORDER BY created_at DESC"
      )
      .all(userId, siteId);

    return res.json({ videos: videos || [] });
  } catch (error) {
    console.error("영상 조회 에러:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "영상 조회 중 오류가 발생했습니다.",
    });
  }
});

// 404 핸들러 (JSON 반환)
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// 에러 핸들러 (JSON 반환)
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    statusCode: err.status || 500,
  });
});

// Firebase Functions로 내보내기
exports.api = functions.https.onRequest(app);
