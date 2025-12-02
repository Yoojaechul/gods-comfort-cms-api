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
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
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

