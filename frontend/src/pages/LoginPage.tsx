import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CMS_API_BASE } from "../config";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // 로그인 성공 시 확인된 사용자 정보 (role이 admin 또는 creator인 경우에만 저장)
  const [knownUserRole, setKnownUserRole] = useState<{ email: string; role: string } | null>(null);

  const msg = localError || error;
  
  // 비밀번호 변경 링크 표시 조건:
  // 1. 이메일이 입력되어 있어야 함
  // 2. 현재 로그인된 사용자이거나, 이전에 로그인 성공한 이메일과 일치해야 함
  // 3. role이 admin 또는 creator여야 함
  const shouldShowChangePasswordLink = useMemo(() => {
    const emailExists = email.trim().length > 0;
    if (!emailExists) return false;
    
    const inputEmail = email.toLowerCase().trim();
    
    // 현재 로그인된 사용자 확인
    if (user && user.email) {
      const userEmail = user.email.toLowerCase().trim();
      if (userEmail === inputEmail) {
        const role = user.role;
        if (role === "admin" || role === "creator") {
          return true;
        }
      }
    }
    
    // 이전에 로그인 성공한 사용자 정보 확인 (같은 세션 내에서)
    if (knownUserRole && knownUserRole.email.toLowerCase().trim() === inputEmail) {
      const role = knownUserRole.role;
      if (role === "admin" || role === "creator") {
        return true;
      }
    }
    
    return false;
  }, [email, user, knownUserRole]);

  const apiLabel = useMemo(() => {
    // 화면 하단에 "NestJS API: ..." 표시용 (원래 디자인 요소)
    // CMS_API_BASE가 없으면 현재 도메인 기준으로 적당히 표시
    return CMS_API_BASE || "API";
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError("이메일과 비밀번호를 올바르게 입력해주세요.");
      return;
    }

    const result = await login(email.trim(), password);

    if (!result.ok) {
      setLocalError(result.error || "로그인에 실패했습니다.");
      // 로그인 실패 시 알려진 사용자 정보 초기화
      setKnownUserRole(null);
      return;
    }

    // ✅ role은 login 응답의 user.role만 사용 (추가 role 확인 API 호출 금지)
    const role = result.user?.role;
    if (!role) {
      setLocalError("사용자 역할을 확인할 수 없습니다.");
      setKnownUserRole(null);
      return;
    }

    // 로그인 성공 시 role이 admin 또는 creator인 경우 정보 저장 (비밀번호 변경 링크 표시용)
    // 이는 로그인 성공 후 다른 페이지로 이동하므로 실제로는 사용되지 않지만,
    // 같은 세션에서 다시 로그인 페이지로 돌아왔을 때를 대비
    if (result.user && (role === "admin" || role === "creator")) {
      setKnownUserRole({ email: email.trim(), role });
    } else {
      setKnownUserRole(null);
    }

    // 로그인 성공 시 해당 역할에 맞는 페이지로 이동
    if (role === "admin") {
      navigate("/admin/videos", { replace: true });
      return;
    }
    if (role === "creator") {
      navigate("/creator/my-videos", { replace: true });
      return;
    }

    navigate("/", { replace: true });
  };

  const handleChangePasswordClick = () => {
    // 입력된 이메일을 사용하여 비밀번호 변경 페이지로 이동
    // 권한 체크는 백엔드에서 처리
    const emailToUse = email.trim();
    if (!emailToUse) {
      setLocalError("이메일을 먼저 입력해주세요.");
      return;
    }
    
    const encodedEmail = encodeURIComponent(emailToUse);
    navigate(`/change-password?email=${encodedEmail}`);
  };
  
  // 이메일 변경 핸들러
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // 이메일 변경 시 에러 초기화 (알려진 사용자 정보는 유지 - 같은 세션 내에서 유용)
    if (localError) setLocalError(null);
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.titleRow}>
            <span style={styles.lock}>🔐</span>
            <h1 style={styles.title}>CMS 로그인</h1>
          </div>
          <p style={styles.subtitle}>관리자 또는 크리에이터 계정으로 로그인하세요</p>
        </div>

        <form onSubmit={onSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              // ✅ placeholder는 비워서 "음영 글자" 방지
              placeholder=""
              autoComplete="username"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>비밀번호</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=""
                autoComplete="current-password"
                style={styles.passwordInput}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
              >
                {showPassword ? "숨기기" : "표시"}
              </button>
            </div>
            {shouldShowChangePasswordLink && (
              <button
                type="button"
                onClick={handleChangePasswordClick}
                style={styles.changePasswordLink}
              >
                비밀번호 변경
              </button>
            )}
          </div>

          {msg ? <div style={styles.alert}>{msg}</div> : null}

          <button type="submit" disabled={loading} style={styles.loginBtn}>
            {loading ? "로그인 중..." : "로그인"}
          </button>

          <div style={styles.apiBadge}>
            <span style={styles.apiBadgeLabel}>NestJS API:</span>{" "}
            <span style={styles.apiBadgeValue}>{apiLabel}</span>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 16,
    // ✅ 원래 느낌: 보라/파랑 그라데이션
    background: "linear-gradient(135deg, #5B7CFA 0%, #6A42C2 100%)",
  },

  card: {
    width: 520,
    maxWidth: "100%",
    background: "#ffffff",
    borderRadius: 22,
    boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
    padding: "34px 34px 26px",
  },

  header: {
    textAlign: "center",
    marginBottom: 22,
  },

  titleRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  lock: {
    fontSize: 22,
  },

  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: "-0.5px",
    color: "#0f172a",
  },

  subtitle: {
    margin: 0,
    fontSize: 15,
    color: "#475569",
    fontWeight: 600,
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  label: {
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
    textAlign: "left",
  },

  input: {
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 16px",
    fontSize: 16,
    outline: "none",
    background: "#ffffff", // ✅ 음영 제거
    // ✅ autofill 스타일 제거 (shadow/blue tint 방지)
    WebkitBoxShadow: "0 0 0 1000px #ffffff inset",
    boxShadow: "0 0 0 1000px #ffffff inset",
    WebkitTextFillColor: "#0f172a",
  },

  passwordWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },

  passwordInput: {
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 70px 0 16px",
    fontSize: 16,
    outline: "none",
    background: "#ffffff",
    width: "100%",
    // ✅ autofill 스타일 제거 (shadow/blue tint 방지)
    WebkitBoxShadow: "0 0 0 1000px #ffffff inset",
    boxShadow: "0 0 0 1000px #ffffff inset",
    WebkitTextFillColor: "#0f172a",
  },

  passwordToggle: {
    position: "absolute",
    right: 12,
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 8,
    transition: "color 0.2s",
  },

  changePasswordLink: {
    marginTop: 8,
    background: "none",
    border: "none",
    color: "#2563eb",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
    padding: 0,
    textDecoration: "underline",
  },

  alert: {
    borderRadius: 14,
    padding: "14px 16px",
    background: "#fee2e2",
    color: "#b91c1c",
    fontWeight: 800,
    fontSize: 14,
    lineHeight: 1.35,
    border: "1px solid #fecaca",
    marginTop: 4,
  },

  loginBtn: {
    height: 54,
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(90deg, #5B7CFA 0%, #6A42C2 100%)",
    color: "#ffffff",
    fontSize: 17,
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 4,
  },

  apiBadge: {
    marginTop: 14,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    padding: "12px 14px",
    textAlign: "center",
    background: "#f8fafc",
    color: "#334155",
    fontWeight: 800,
  },

  apiBadgeLabel: {
    color: "#334155",
    fontWeight: 900,
  },

  apiBadgeValue: {
    color: "#2563eb",
    fontWeight: 900,
  },
};
