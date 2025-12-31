import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change_this_jwt_secret_key_to_secure_random_string";
const JWT_EXPIRES_IN = "3h"; // 3시간

// JWT 토큰 생성
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      site_id: user.site_id,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// JWT 토큰 검증
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    // JWT_SECRET 불일치 가능성 로깅
    if (err.name === 'JsonWebTokenError') {
      console.warn(`[verifyToken] JWT 검증 실패 - ${err.message}`);
      if (err.message.includes('secret') || err.message.includes('signature')) {
        console.error(`[verifyToken] ⚠️  JWT_SECRET 불일치 가능성 - 토큰 서명 검증 실패`);
        console.error(`[verifyToken] 현재 JWT_SECRET: ${JWT_SECRET ? JWT_SECRET.substring(0, 10) + '...' : 'undefined'}`);
      }
    } else if (err.name === 'TokenExpiredError') {
      console.warn(`[verifyToken] 토큰 만료 - ${err.message}`);
    } else if (err.name === 'NotBeforeError') {
      console.warn(`[verifyToken] 토큰이 아직 유효하지 않음 - ${err.message}`);
    } else {
      console.warn(`[verifyToken] 토큰 검증 오류 - ${err.name}: ${err.message}`);
    }
    return null;
  }
}

// JWT 토큰에서 만료 시간 가져오기
export function getTokenExpiry(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded.exp * 1000; // 밀리초로 변환
  } catch {
    return null;
  }
}












































































































