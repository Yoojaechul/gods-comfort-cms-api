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

// ?몄쬆 誘몃뱾?⑥뼱 (API Key ?먮뒗 JWT ?좏겙)
export async function authenticate(request, reply) {
  // 1. JWT ?좏겙 ?뺤씤 (Bearer ?좏겙)
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (decoded) {
      // ?좏겙?먯꽌 ?ъ슜???뺣낫 議고쉶
      const user = db.prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(decoded.id);
      if (user) {
        request.user = user;
        return;
      }
    }
  }

  // 2. API Key ?뺤씤 (x-api-key ?ㅻ뜑)
  const apiKey = request.headers["x-api-key"];
  if (apiKey) {
    const user = getUserByApiKey(apiKey);
    if (user) {
      request.user = user;
      return;
    }
  }

  // ?몄쬆 ?ㅽ뙣
  return reply.code(401).send({ 
    error: "Authentication required",
    message: "?몄쬆???꾩슂?⑸땲?? 濡쒓렇?명빐二쇱꽭??"
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

