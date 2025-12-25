import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";

import LoginPage from "./pages/LoginPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";

// Admin
import AdminDashboardLayout from "./components/AdminDashboardLayout";
import AdminVideosPage from "./pages/AdminVideosPage";

// Creator
import CreatorDashboardLayout from "./components/CreatorDashboardLayout";
import CreatorMyVideosPage from "./pages/CreatorMyVideosPage";

/* =========================
   보호 라우트 컴포넌트
========================= */

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RequireRole({
  role,
  children,
}: {
  role: "admin" | "creator";
  children: JSX.Element;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  if (!user || user.role !== role) {
    // 잘못된 역할 접근 시 로그인 페이지로 리다이렉트
    return <Navigate to="/login" replace />;
  }

  return children;
}

/* =========================
   앱 라우팅
========================= */

export default function App() {
  return (
    <Routes>
      {/* 로그인 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      {/* ===== Admin ===== */}
      <Route
        path="/admin/*"
        element={
          <RequireAuth>
            <RequireRole role="admin">
            <AdminDashboardLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<Navigate to="videos" replace />} />
        <Route path="videos" element={<AdminVideosPage />} />
      </Route>

      {/* ===== Creator ===== */}
      <Route
        path="/creator/*"
        element={
          <RequireAuth>
            <RequireRole role="creator">
            <CreatorDashboardLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route path="my-videos" element={<CreatorMyVideosPage />} />
        <Route path="" element={<Navigate to="my-videos" replace />} />
      </Route>

      {/* 기본 경로 */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
