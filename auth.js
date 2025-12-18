import db, { verifyApiKey } from "./db.js";
import { verifyToken } from "./jwt.js";

// API Key濡??ъ슜??議고쉶
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
  let token = null;
  let tokenSource = null;

  // 1. JWT 토큰 추출 (Authorization Bearer 헤더)
  // Fastify는 헤더를 소문자로 정규화하지만, 대소문자 무시 처리
  const authHeader = request.headers.authorization || request.headers.Authorization;
  if (authHeader) {
    // "Bearer <token>" 형식 처리 (대소문자 무시, 공백 처리)
    const bearerMatch = authHeader.match(/^[Bb]earer\s+(.+)$/);
    if (bearerMatch) {
      token = bearerMatch[1].trim();
      tokenSource = "Authorization Bearer";
    }
  }

  // 2. JWT 토큰 추출 (쿠키)
  if (!token && request.cookies) {
    // 일반적인 쿠키 이름들 시도
    token = request.cookies.token || 
            request.cookies.accessToken || 
            request.cookies.jwt || 
            request.cookies.authToken;
    if (token) {
      tokenSource = "Cookie";
    }
  }

  // 3. JWT 토큰 검증 및 사용자 조회
  if (token) {
    try {
      const decoded = verifyToken(token);
      
      if (decoded && decoded.id) {
        // 토큰에서 사용자 정보 조회
        const user = db.prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(decoded.id);
        if (user) {
          request.user = user;
          // 디버깅용 로그 (프로덕션에서는 제거 가능)
          if (process.env.NODE_ENV === 'development') {
            console.log(`[authenticate] 인증 성공 - user: ${user.id}, role: ${user.role}, source: ${tokenSource}`);
          }
          return;
        } else {
          console.warn(`[authenticate] 토큰은 유효하지만 사용자를 찾을 수 없음 - decoded.id: ${decoded.id}, source: ${tokenSource}`);
        }
      } else {
        console.warn(`[authenticate] 토큰 검증 실패 - decoded가 null이거나 id가 없음, source: ${tokenSource}`);
      }
    } catch (err) {
      console.warn(`[authenticate] 토큰 검증 중 오류 - source: ${tokenSource}, error: ${err.message}`);
      // JWT_SECRET 불일치 가능성 로그
      if (err.message && err.message.includes('secret')) {
        console.error(`[authenticate] ⚠️  JWT_SECRET 불일치 가능성 - 토큰 검증 실패 (secret 관련 오류)`);
      }
    }
  }

  // 4. API Key 인증 (x-api-key 헤더)
  const apiKey = request.headers["x-api-key"] || request.headers["X-API-Key"];
  if (apiKey) {
    const user = getUserByApiKey(apiKey);
    if (user) {
      request.user = user;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[authenticate] API Key 인증 성공 - user: ${user.id}, role: ${user.role}`);
      }
      return;
    }
  }

  // 인증 실패
  console.warn(`[authenticate] 인증 실패 - Authorization: ${authHeader ? 'present' : 'missing'}, Cookie: ${request.cookies ? 'present' : 'missing'}, API Key: ${apiKey ? 'present' : 'missing'}`);
  return reply.code(401).send({ 
    error: "Authentication required",
    message: "인증이 필요합니다. 로그인해주세요."
  });
}

// Admin 沅뚰븳 泥댄겕
export async function requireAdmin(request, reply) {
  if (request.user.role !== "admin") {
    return reply.code(403).send({ 
      error: "Access denied",
      message: "愿由ъ옄 沅뚰븳???꾩슂?⑸땲??"
    });
  }
}

// Creator 沅뚰븳 泥댄겕 (Admin???덉슜)
export async function requireCreator(request, reply) {
  if (request.user.role !== "creator" && request.user.role !== "admin") {
    return reply.code(403).send({ error: "Creator or Admin access required" });
  }
}

