import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { apiGet, apiPost } from "../lib/apiClient";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "creator";
  site_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  loginWithoutRedirect: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedSiteId = localStorage.getItem("site_id");
    if (!storedSiteId) {
      localStorage.setItem("site_id", "gods");
      console.log("site_id 기본값 'gods' 설정됨");
    }

    const storedToken = localStorage.getItem("cms_token");
    const storedUser = localStorage.getItem("cms_user");

    if (!storedToken) {
      setLoading(false);
      return;
    }

    setToken(storedToken);

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // ignore
      }
    }

    (async () => {
      try {
        // ✅ 백엔드에 /me 가 실제로 있으면 정상 동작
        const data = await apiGet<{ user?: any }>("/me", { auth: true });
        const userData = data.user || data;

        if (userData) {
          const nextUser: User = {
            id: userData.id || userData.sub || "unknown",
            name: userData.name || userData.username || "User",
            email: userData.email || userData.username || "unknown@example.com",
            role: userData.role,
            site_id: userData.site_id ?? null,
          };

          setUser(nextUser);
          localStorage.setItem("cms_user", JSON.stringify(nextUser));
          localStorage.setItem("cms_user_role", nextUser.role);
        }
      } catch (e) {
        const error = e as Error & { status?: number };
        const status = error.status;

        if (status === 401 || status === 403) {
          setUser(null);
          setToken(null);
          localStorage.removeItem("cms_token");
          localStorage.removeItem("cms_user");
          localStorage.removeItem("cms_user_role");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    const data = await apiPost<{ token?: string; accessToken?: string; user: any }>(
      "/auth/login",
      { email: username, password },
      { auth: false } // ✅ 로그인 요청은 토큰 없이
    );

    const accessToken = data.token ?? data.accessToken;
    const userData = data.user;

    if (!accessToken) throw new Error("토큰을 받지 못했습니다.");
    if (!userData || !userData.role) throw new Error("사용자 정보를 받지 못했습니다.");

    const nextUser: User = {
      id: userData.id || userData.sub || "unknown",
      name: userData.name || userData.username || "User",
      email: userData.email || userData.username || username,
      role: userData.role,
      site_id: userData.site_id ?? null,
    };

    setToken(accessToken);
    setUser(nextUser);

    localStorage.setItem("cms_token", accessToken);
    localStorage.setItem("cms_user", JSON.stringify(nextUser));
    localStorage.setItem("cms_user_role", nextUser.role);

    return nextUser;
  };

  const loginWithoutRedirect = async (username: string, password: string) => {
    await login(username, password);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("cms_token");
    localStorage.removeItem("cms_user");
    localStorage.removeItem("cms_user_role");
  };

  const value = useMemo(
    () => ({ user, token, loading, login, loginWithoutRedirect, logout }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
