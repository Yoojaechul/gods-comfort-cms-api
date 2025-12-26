import { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "../styles/dashboard-layout.css";

interface CreatorDashboardLayoutProps {
  children?: ReactNode;
}

export default function CreatorDashboardLayout({ children }: CreatorDashboardLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleChangePasswordClick = () => {
    const email = user?.email || "";
    if (email) {
      navigate(`/change-password?email=${encodeURIComponent(email)}`);
    } else {
      navigate("/change-password");
    }
  };

  // 크리에이터 메뉴: My Videos
  const menuItems = [
    { path: "/creator/my-videos", label: "My Videos", icon: "🎬" },
  ];

  const getPageTitle = () => {
    const currentItem = menuItems.find((item) => item.path === location.pathname);
    if (currentItem) {
      return currentItem.label;
    }
    return "My Videos";
  };

  const getUserInitials = () => {
    if (user?.name) {
      return user.name.charAt(0).toUpperCase();
    }
    return "C";
  };

  return (
    <div className="dashboard-layout">
      {/* 왼쪽 사이드바 */}
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-logo">CMS CREATOR</div>
        <nav className="dashboard-menu">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `dashboard-menu-item ${isActive ? "active" : ""}`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          {/* 비밀번호 변경 메뉴 (creator role일 때 항상 표시) */}
          {user?.role === "creator" && (
            <button
              onClick={handleChangePasswordClick}
              className={`dashboard-menu-item ${location.pathname === "/change-password" ? "active" : ""}`}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontSize: "14px",
                color: "inherit",
              }}
            >
              <span>🔒</span>
              <span>비밀번호 변경</span>
            </button>
          )}
        </nav>
      </aside>

      {/* 오른쪽 콘텐츠 영역 */}
      <main className="dashboard-main">
        {/* 상단바 */}
        <div className="dashboard-topbar">
          <h1 className="dashboard-topbar-title">{getPageTitle()}</h1>
          <div className="dashboard-user-info">
            <div className="dashboard-user-details">
              <p className="dashboard-user-name">{user?.name || "Creator"}</p>
              <p className="dashboard-user-role">크리에이터</p>
            </div>
            <div className="dashboard-user-avatar">{getUserInitials()}</div>
            <button
              onClick={logout}
              style={{
                padding: "8px 16px",
                background: "none",
                border: "1px solid #ddd",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                color: "#666",
                marginLeft: "8px",
              }}
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        {children || <Outlet />}
      </main>
    </div>
  );
}























