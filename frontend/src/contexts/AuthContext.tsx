import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiPost } from "../lib/apiClient";

type Role = "admin" | "creator" | string;

export type AuthUser = {
  email?: string;
  role?: Role;
  [key: string]: any;
};

type LoginResponse = {
  user?: AuthUser;
  token?: string;
  accessToken?: string;
  jwt?: string;
  data?: {
    user?: AuthUser;
    token?: string;
    accessToken?: string;
    jwt?: string;
  };
  [key: string]: any;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; user?: AuthUser; error?: string }>;
  logout: () => void;
  refreshFromStorage: () => void;
};

const STORAGE_TOKEN_KEY = "cms_token";
const STORAGE_USER_KEY = "cms_user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function pickToken(data: LoginResponse): string | null {
  const token =
    data?.token ||
    data?.accessToken ||
    data?.jwt ||
    data?.data?.token ||
    data?.data?.accessToken ||
    data?.data?.jwt;

  return typeof token === "string" && token.trim().length > 0 ? token : null;
}

function pickUser(data: LoginResponse): AuthUser | null {
  const user = data?.user || data?.data?.user;
  return user && typeof user === "object" ? (user as AuthUser) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshFromStorage = () => {
    const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const savedUser = safeJsonParse<AuthUser>(localStorage.getItem(STORAGE_USER_KEY));

    const ok = !!(savedToken && savedToken.trim().length > 0);
    setIsAuthenticated(ok);
    setToken(ok ? savedToken : null);
    setUser(savedUser ?? null);
    setLoading(false);
    setError(null);
  };

  useEffect(() => {
    refreshFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = (await apiPost("/auth/login", { email, password })) as LoginResponse;

      const nextToken = pickToken(data);
      const nextUser = pickUser(data);

      // ✅ JWT 형식 검사/디코딩 없음 (dummy-token도 OK)
      if (!nextToken) {
        const msg = "유효한 JWT 토큰을 받지 못했습니다.";
        setIsAuthenticated(false);
        setToken(null);
        setUser(null);
        setError(msg);
        setLoading(false);
        return { ok: false, error: msg };
      }

      localStorage.setItem(STORAGE_TOKEN_KEY, nextToken);

      if (nextUser) {
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
      } else {
        localStorage.removeItem(STORAGE_USER_KEY);
      }

      setIsAuthenticated(true);
      setToken(nextToken);
      setUser(nextUser ?? null);
      setLoading(false);
      setError(null);

      return { ok: true, user: nextUser ?? null };
    } catch (e: any) {
      const msg =
        typeof e?.message === "string" && e.message.trim().length > 0
          ? e.message
          : "로그인 중 오류가 발생했습니다.";

      setIsAuthenticated(false);
      setToken(null);
      setUser(null);
      setError(msg);
      setLoading(false);

      return { ok: false, error: msg };
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);

    setIsAuthenticated(false);
    setToken(null);
    setUser(null);
    setError(null);
    setLoading(false);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      token,
      user,
      loading,
      error,
      login,
      logout,
      refreshFromStorage,
    }),
    [isAuthenticated, token, user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
