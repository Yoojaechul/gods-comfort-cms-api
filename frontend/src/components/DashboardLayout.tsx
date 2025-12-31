import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "creator";
}

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin";
  const basePath = role === "admin" ? "/admin" : "/creator";

  const menuItems = [
    { path: basePath, label: "Dashboard", icon: "📊" },
    { path: `${basePath}/videos`, label: "Videos", icon: "🎬" },
    ...(isAdmin
      ? [
          { path: "/admin/analytics", label: "Analytics", icon: "📈" },
        ]
      : []),
    { path: `${basePath}/facebook-keys`, label: "Facebook Keys", icon: "🔑" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">CMS Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {role === "admin" ? "관리자" : "크리에이터"}
          </p>
        </div>
        <nav className="p-4">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                location.pathname === item.path
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="ml-64">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isAdmin && location.pathname.startsWith("/admin") && (
              <button
                onClick={() => navigate("/creator")}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                크리에이터 화면으로 보기
              </button>
            )}
            {isAdmin && location.pathname.startsWith("/creator") && (
              <button
                onClick={() => navigate("/admin")}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                관리자 화면으로 돌아가기
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">
                {user?.role === "admin" ? "관리자" : "크리에이터"}
              </p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}




































































































