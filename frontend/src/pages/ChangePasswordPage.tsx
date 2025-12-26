import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiPost } from "../lib/apiClient";
import { useAuth } from "../contexts/AuthContext";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // email 파라미터 안정적 처리: query parameter 우선, 없으면 AuthContext의 user.email 사용
  const emailFromQuery = searchParams.get("email")?.trim() || "";
  const emailFromUser = user?.email?.trim() || "";
  const email = emailFromQuery || emailFromUser;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!currentPassword.trim()) {
      setError("현재 비밀번호를 입력해주세요.");
      return;
    }

    if (!newPassword.trim()) {
      setError("새 비밀번호를 입력해주세요.");
      return;
    }

    if (newPassword.length < 8) {
      setError("새 비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("현재 비밀번호와 새 비밀번호가 동일합니다.");
      return;
    }

    setLoading(true);

    try {
      // email이 필수 (query parameter에서 가져옴)
      if (!email) {
        setError("이메일 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      // 비밀번호 변경 요청 (email + currentPassword + newPassword)
      // 반드시 /auth/change-password 엔드포인트로 요청 (프론트 라우팅 /change-password와 구분)
      const payload = {
        email: email.trim(),
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      };
      
      const result = await apiPost("/auth/change-password", payload);
      
      // API 응답이 { ok: false, message } 형식일 수 있음
      if (result && result.ok === false) {
        throw new Error(result.message || "비밀번호 변경에 실패했습니다.");
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
    } catch (e: any) {
      // API 에러 메시지는 apiClient.ts에서 이미 처리되어 전달됨
      // apiClient.ts에서 상태 코드별 사용자 친화적인 메시지와 console.error 출력이 처리됨
      const errorMessage = e?.message || "비밀번호 변경에 실패했습니다.";
      
      // 401 에러인 경우 로그인 페이지로 리다이렉트
      const status = e?.status;
      if (status === 401) {
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 2000);
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>비밀번호 변경</h1>
        </div>

        {success ? (
          <div style={styles.successBox}>
            <p style={styles.successText}>비밀번호가 성공적으로 변경되었습니다.</p>
            <p style={styles.successSubtext}>로그인 페이지로 이동합니다...</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={styles.form}>
            {email && (
              <div style={styles.field}>
                <label style={styles.label}>이메일</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  style={styles.inputReadOnly}
                />
              </div>
            )}
            <div style={styles.field}>
              <label style={styles.label}>현재 비밀번호</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder=""
                  autoComplete="current-password"
                  style={styles.passwordInput}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={styles.passwordToggle}
                >
                  {showCurrentPassword ? "숨기기" : "표시"}
                </button>
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>새 비밀번호</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder=""
                  autoComplete="new-password"
                  style={styles.passwordInput}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={styles.passwordToggle}
                >
                  {showNewPassword ? "숨기기" : "표시"}
                </button>
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>새 비밀번호 확인</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder=""
                  autoComplete="new-password"
                  style={styles.passwordInput}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.passwordToggle}
                >
                  {showConfirmPassword ? "숨기기" : "표시"}
                </button>
              </div>
            </div>

            {error ? <div style={styles.alert}>{error}</div> : null}

            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? "변경 중..." : "비밀번호 변경"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              style={styles.cancelBtn}
            >
              취소
            </button>
          </form>
        )}
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

  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: "-0.5px",
    color: "#0f172a",
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

  inputReadOnly: {
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 16px",
    fontSize: 16,
    outline: "none",
    background: "#f1f5f9",
    color: "#64748b",
    cursor: "not-allowed",
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

  successBox: {
    borderRadius: 14,
    padding: "24px 20px",
    background: "#dcfce7",
    border: "1px solid #86efac",
    textAlign: "center",
  },

  successText: {
    margin: "0 0 8px 0",
    color: "#166534",
    fontWeight: 800,
    fontSize: 16,
  },

  successSubtext: {
    margin: 0,
    color: "#15803d",
    fontWeight: 600,
    fontSize: 14,
  },

  submitBtn: {
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

  cancelBtn: {
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#64748b",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },
};

