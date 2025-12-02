import db, { verifyApiKey } from "./db.js";
import { verifyToken } from "./jwt.js";

// API Key로 사용자 조회
export function getUserByApiKey(apiKey) {
  if (!apiKey) return null;

  const users = db
    .prepare("SELECT * FROM users WHERE status = 'active'")
    .all();

  for (const user of users) {
    if (verifyApiKey(apiKey, user.api_key_hash, user.api_key_salt)) {
      return user;
    }
  }

  return null;
}

// 인증 미들웨어 (API Key 또는 JWT 토큰)
export async function authenticate(request, reply) {
  // 1. JWT 토큰 확인 (Bearer 토큰)
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (decoded) {
      // 토큰에서 사용자 정보 조회
      const user = db.prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(decoded.id);
      if (user) {
        request.user = user;
        return;
      }
    }
  }

  // 2. API Key 확인 (x-api-key 헤더)
  const apiKey = request.headers["x-api-key"];
  if (apiKey) {
    const user = getUserByApiKey(apiKey);
    if (user) {
      request.user = user;
      return;
    }
  }

  // 인증 실패
  return reply.code(401).send({ 
    error: "Authentication required",
    message: "인증이 필요합니다. 로그인해주세요."
  });
}

// Admin 권한 체크
export async function requireAdmin(request, reply) {
  if (request.user.role !== "admin") {
    return reply.code(403).send({ 
      error: "Access denied",
      message: "관리자 권한이 필요합니다."
    });
  }
}

// Creator 권한 체크 (Admin도 허용)
export async function requireCreator(request, reply) {
  if (request.user.role !== "creator" && request.user.role !== "admin") {
    return reply.code(403).send({ error: "Creator or Admin access required" });
  }
}


  if (request.user.role !== "creator" && request.user.role !== "admin") {
    return reply.code(403).send({ error: "Creator or Admin access required" });
  }
}

