import { NavLink, Outlet, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "../styles/admin-layout.css";

export default function AdminDashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // creator가 admin 레이아웃에 접근하는 것을 차단
  // ProtectedRoute를 통과했지만, 추가 안전장치로 role 재확인
  if (user && user.role !== "admin") {
    // creator는 admin 페이지 접근 불가, creator 페이지로 강제 이동
    return <Navigate to="/creator/my-videos" replace />;
  }

  const menuItems = [
    { path: "/admin/dashboard", label: "Dashboard", icon: "📊" },
    { path: "/admin/videos", label: "Videos", icon: "🎬" },
    { path: "/admin/creators", label: "Creators", icon: "👥" },
    { path: "/admin/users", label: "Users", icon: "👤" },
    { path: "/admin/settings", label: "Settings", icon: "⚙️" },
  ];

  const getPageTitle = () => {
    const currentItem = menuItems.find((item) => item.path === location.pathname);
    if (currentItem) {
      return currentItem.label;
    }
    return "대시보드";
  };

  const getUserInitials = () => {
    if (user?.name) {
      return user.name.charAt(0).toUpperCase();
    }
    return "A";
  };

  return (
    <div className="admin-layout">
      {/* 왼쪽 사이드바 */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">CMS ADMIN</div>
        <nav className="admin-menu">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin/dashboard"}
              className={({ isActive }) =>
                `admin-menu-item ${isActive ? "active" : ""}`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 오른쪽 콘텐츠 영역 */}
      <main className="admin-main">
        <div className="admin-content-wrapper">
          {/* 상단바 */}
          <header className="admin-topbar">
            <h1 className="admin-topbar-title">{getPageTitle()}</h1>
            <div className="admin-user-info">
              <div className="admin-user-details">
                <p className="admin-user-name">{user?.name || "Admin"}</p>
                <p className="admin-user-role">관리자</p>
              </div>
              <div className="admin-user-avatar">{getUserInitials()}</div>
              <button onClick={logout} className="admin-logout-button">
                로그아웃
              </button>
            </div>
          </header>

          {/* 메인 콘텐츠 영역 */}
          <section className="admin-content">
            <div className="admin-content-card">
              <Outlet />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
