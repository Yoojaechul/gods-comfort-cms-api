import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { CMS_API_BASE } from "../config";

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
    const storedToken = localStorage.getItem("cms_token");
    if (!storedToken) {
      setLoading(false);
      return;
    }

    setToken(storedToken);

    // call /auth/me once to fetch user
    (async () => {
      try {
        const res = await fetch(`${CMS_API_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!res.ok) {
          setUser(null);
          setToken(null);
          localStorage.removeItem("cms_token");
        } else {
          const data = await res.json();
          const userData = data.user || data;
          setUser({
            id: userData.id || userData.sub,
            name: userData.name || userData.username,
            email: userData.email || `${userData.username || ""}@example.com`,
            role: userData.role,
            site_id: userData.site_id || null,
          });
        }
      } catch (e) {
        console.error("Failed to fetch user:", e);
        setUser(null);
        setToken(null);
        localStorage.removeItem("cms_token");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // IMPORTANT: empty dependency array

  const login = async (username: string, password: string): Promise<User> => {
    const res = await fetch(`${CMS_API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: username, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || error.error || "Login failed");
    }

    const data = await res.json();
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

    return user;
  };

  const loginWithoutRedirect = async (username: string, password: string): Promise<void> => {
    await login(username, password);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("cms_token");
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



































