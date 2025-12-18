import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { apiGet, apiPost } from "../lib/apiClient";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "creator";
  site_id?: string;
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

  // Single initialization useEffect that runs ONLY once
  useEffect(() => {
    // site_id 기본값 설정 (단일 사이트 CMS이므로 항상 "gods")
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

    // 저장된 사용자 정보가 있으면 먼저 복원 (빠른 UI 렌더링)
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (e) {
        console.warn("Failed to parse stored user:", e);
      }
    }

    // 백엔드에서 사용자 정보 확인 (/me 엔드포인트 호출)
    (async () => {
      try {
        const data = await apiGet<{ user?: any }>("/me", { auth: true });
        const userData = data.user || data;
        
        if (userData && userData.id) {
          const user: User = {
            id: userData.id || userData.sub,
            name: userData.name || userData.username,
            email: userData.email || `${userData.username || ""}@example.com`,
            role: userData.role,
            site_id: userData.site_id || null,
          };
          setUser(user);
          // 사용자 정보를 localStorage에 저장
          localStorage.setItem("cms_user", JSON.stringify(user));
        }
      } catch (e) {
        // 에러 처리
        const error = e as Error & { status?: number; isNetworkError?: boolean };
        const status = error.status;
        
        // 네트워크 에러 또는 인증 에러 시 로그인 상태 정리
        if (error.isNetworkError || status === 0 || status === 401 || status === 403) {
          console.error("인증 실패 또는 백엔드 연결 실패:", error.message);
          // 로그인 상태를 완전히 정리하여 무한 로딩 방지
          setUser(null);
          setToken(null);
          localStorage.removeItem("cms_token");
          localStorage.removeItem("cms_user");
        } else {
          // 404 또는 기타 에러는 "엔드포인트 없음"으로 간주
          // 네트워크가 정상이지만 엔드포인트가 없는 경우에만 로그인 상태 유지
          console.warn("Failed to fetch user from /me:", error.message);
          // 저장된 사용자 정보가 있으면 유지, 없으면 로그아웃
          if (!storedUser) {
            setUser(null);
            setToken(null);
            localStorage.removeItem("cms_token");
            localStorage.removeItem("cms_user");
          }
        }
      } finally {
        // 무한 로딩 방지를 위해 항상 loading을 false로 설정
        setLoading(false);
      }
    })();
  }, []); // IMPORTANT: empty dependency array

  const login = async (username: string, password: string): Promise<User> => {
    const data = await apiPost<{ token?: string; accessToken?: string; user: any }>(
      "/auth/login",
      { email: username, password }
    );
    
    const accessToken = data.token ?? data.accessToken;
    const userData = data.user;

    if (!accessToken) {
      throw new Error("토큰을 받지 못했습니다.");
    }

    if (!userData || !userData.role) {
      throw new Error("사용자 정보를 받지 못했습니다.");
    }

    const user: User = {
      id: userData.id || userData.sub,
      name: userData.name || userData.username,
      email: userData.email || `${userData.username || ""}@example.com`,
      role: userData.role,
      site_id: userData.site_id || null,
    };

    setToken(accessToken);
    setUser(user);
    localStorage.setItem("cms_token", accessToken);
    // 사용자 정보도 localStorage에 저장 (새로고침 시 복원용)
    localStorage.setItem("cms_user", JSON.stringify(user));

    return user;
  };

  const loginWithoutRedirect = async (username: string, password: string): Promise<void> => {
    await login(username, password);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("cms_token");
    localStorage.removeItem("cms_user");
  };

  // Context value should be memoized
  const value = useMemo(
    () => ({ user, token, loading, login, loginWithoutRedirect, logout }),
    [user, token, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}








































