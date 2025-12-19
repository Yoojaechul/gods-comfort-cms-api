import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiPost } from "../lib/apiClient";
import "../styles/login.css";

export default function LoginPage() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  
  // 비밀번호 변경 상태
  const [changeId, setChangeId] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSuccess, setChangePasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect once based on role
  useEffect(() => {
    if (user) {
      if (user.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else if (user.role === "creator") {
        navigate("/creator/my-videos", { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loggedInUser = await login(id, password);

      if (loggedInUser.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else if (loggedInUser.role === "creator") {
        navigate("/creator/my-videos", { replace: true });
      } else {
        // role이 없거나 예상치 못한 경우
        setError("사용자 역할을 확인할 수 없습니다.");
      }
    } catch (err: any) {
      setError(err.message || "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeClick = () => {
    setShowChangePassword(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError("");
    setChangePasswordSuccess("");

    // 유효성 검사
    if (!changeId || !currentPassword || !newPassword || !confirmPassword) {
      setChangePasswordError("모든 필드를 입력해주세요.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
      return;
    }

    if (newPassword.length < 6) {
      setChangePasswordError("새 비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setChangingPassword(true);

    try {
      await apiPost(
        "/auth/change-password-public",
        {
          email: changeId,
          currentPassword,
          newPassword,
        },
        { auth: false }
      );

      setChangePasswordSuccess("비밀번호가 변경되었습니다.");
      // 성공 후 폼 초기화 및 패널 닫기
      setTimeout(() => {
        setChangeId("");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowChangePassword(false);
        setChangePasswordSuccess("");
      }, 2000);
    } catch (err: any) {
      setChangePasswordError(err.message || "비밀번호 변경에 실패했습니다.");
    } finally {
      setChangingPassword(false);
    }
  };


  return (
    <div className="login-root">
      <div className="login-card">
        <h1 className="login-title">로그인하세요</h1>
        
        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        {!showChangePassword ? (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label className="login-label">아이디</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="login-input"
                required
              />
            </div>

            <div className="login-field">
              <label className="login-label">비밀번호</label>
              <div className="login-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input login-input-with-button"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle-inside"
                >
                  {showPassword ? "숨기기" : "표시"}
                </button>
              </div>
              <button
                type="button"
                onClick={handlePasswordChangeClick}
                className="login-change-password-link"
              >
                비밀번호 수정
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-submit"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>
        ) : (
          <div className="login-change-password-panel">
            <div className="login-change-password-header">
              <h2 className="login-change-password-title">비밀번호 변경</h2>
              <button
                type="button"
                onClick={() => {
                  setShowChangePassword(false);
                  setChangeId("");
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setChangePasswordError("");
                  setChangePasswordSuccess("");
                  setShowCurrentPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="login-close-button"
              >
                ×
              </button>
            </div>

            {(changePasswordSuccess || changePasswordError) && (
              <div className={changePasswordSuccess ? "login-success" : "login-error"}>
                {changePasswordSuccess || changePasswordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="login-form">
              <div className="login-field">
                <label className="login-label">아이디</label>
                <input
                  type="text"
                  value={changeId}
                  onChange={(e) => setChangeId(e.target.value)}
                  className="login-input"
                  required
                />
              </div>

              <div className="login-field">
                <label className="login-label">현재 비밀번호</label>
                <div className="login-input-wrapper">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="login-input login-input-with-button"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="login-password-toggle-inside"
                  >
                    {showCurrentPassword ? "숨기기" : "표시"}
                  </button>
                </div>
              </div>

              <div className="login-field">
                <label className="login-label">새 비밀번호</label>
                <div className="login-input-wrapper">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="login-input login-input-with-button"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="login-password-toggle-inside"
                  >
                    {showNewPassword ? "숨기기" : "표시"}
                  </button>
                </div>
              </div>

              <div className="login-field">
                <label className="login-label">새 비밀번호 확인</label>
                <div className="login-input-wrapper">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="login-input login-input-with-button"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="login-password-toggle-inside"
                  >
                    {showConfirmPassword ? "숨기기" : "표시"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="login-submit"
              >
                {changingPassword ? "변경 중..." : "비밀번호 변경"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowChangePassword(false);
                  setChangeId("");
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setChangePasswordError("");
                  setChangePasswordSuccess("");
                  setShowCurrentPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                }}
                className="login-cancel-button"
              >
                취소
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}




































