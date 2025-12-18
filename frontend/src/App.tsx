import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminVideosPage from "./pages/AdminVideosPage";
import AdminCreatorsPage from "./pages/AdminCreatorsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import FacebookKeysPage from "./pages/FacebookKeysPage";
import CreatorMyVideosPage from "./pages/CreatorMyVideosPage";
import AdminDashboardLayout from "./components/AdminDashboardLayout";
import CreatorDashboardLayout from "./components/CreatorDashboardLayout";

function ProtectedRoute({
  children,
  roles,
}: {
  children: JSX.Element;
  roles?: string[];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 권한 체크: roles가 지정된 경우 해당 역할만 허용
  if (roles && !roles.includes(user.role)) {
    // 권한이 없으면 role에 맞는 기본 페이지로 리다이렉트
    if (user.role === "admin") {
      return <Navigate to="/admin/videos" replace />;
    } else if (user.role === "creator") {
      return <Navigate to="/creator/my-videos" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin/*"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminDashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="videos" element={<AdminVideosPage />} />
        <Route path="creators" element={<AdminCreatorsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      <Route
        path="/creator/*"
        element={
          <ProtectedRoute roles={["creator"]}>
            <CreatorDashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="my-videos" element={<CreatorMyVideosPage />} />
        <Route index element={<Navigate to="/creator/my-videos" replace />} />
        <Route path="facebook-keys" element={<FacebookKeysPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
