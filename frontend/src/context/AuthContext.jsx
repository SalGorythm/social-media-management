import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  clearStoredPersonaId,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [token, setTokenState] = useState(() => getStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!getStoredToken());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getStoredToken()) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await api("/api/auth/me");
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) {
          clearStoredToken();
          setTokenState(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setTokenState(null);
      setUser(null);
      navigate("/login", { replace: true });
    };
    window.addEventListener("studio:unauthorized", onUnauthorized);
    return () => window.removeEventListener("studio:unauthorized", onUnauthorized);
  }, [navigate]);

  const login = useCallback(async (email, password) => {
    const data = await api("/api/auth/login", {
      method: "POST",
      json: { email, password },
      skipAuth: true,
    });
    setStoredToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    return data;
  }, []);

  const signup = useCallback(async (email, password) => {
    const data = await api("/api/auth/signup", {
      method: "POST",
      json: { email, password },
      skipAuth: true,
    });
    setStoredToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    clearStoredPersonaId();
    setTokenState(null);
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      signup,
      logout,
    }),
    [token, user, loading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
