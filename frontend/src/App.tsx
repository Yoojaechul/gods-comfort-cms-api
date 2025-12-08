import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import CreatorDashboard from "./pages/CreatorDashboard";
import VideosPage from "./pages/VideosPage";
import AdminVideosPage from "./pages/AdminVideosPage";
import AdminCreatorsPage from "./pages/AdminCreatorsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import FacebookKeysPage from "./pages/FacebookKeysPage";
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

  if (roles && !roles.includes(user.role)) {
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
        <Route index element={<AdminDashboard />} />
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
        <Route index element={<CreatorDashboard />} />
        <Route path="videos" element={<VideosPage />} />
        <Route path="upload" element={<div className="dashboard-card"><h2 className="dashboard-card-title">Upload</h2><p>Upload 페이지 (구현 예정)</p></div>} />
        <Route path="drafts" element={<div className="dashboard-card"><h2 className="dashboard-card-title">Drafts</h2><p>Drafts 페이지 (구현 예정)</p></div>} />
        <Route path="analytics" element={<div className="dashboard-card"><h2 className="dashboard-card-title">Analytics</h2><p>Analytics 페이지 (구현 예정)</p></div>} />
        <Route path="profile" element={<div className="dashboard-card"><h2 className="dashboard-card-title">Profile</h2><p>Profile 페이지 (구현 예정)</p></div>} />
        <Route path="facebook-keys" element={<FacebookKeysPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
