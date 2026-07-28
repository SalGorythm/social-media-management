const PERSONA_STORAGE_KEY = "studio-persona-id";
const TOKEN_STORAGE_KEY = "studio-auth-token";

export function getStoredPersonaId() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PERSONA_STORAGE_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function setStoredPersonaId(id) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PERSONA_STORAGE_KEY, String(id));
}

export function clearStoredPersonaId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PERSONA_STORAGE_KEY);
}

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function clearStoredToken() {
  setStoredToken(null);
}

export async function api(path, options = {}) {
  const { json, skipPersonaHeader, skipAuth, ...init } = options;
  const headers = { ...init.headers };
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  }
  const isPublicAuthRoute =
    path.startsWith("/api/auth") && path !== "/api/auth/me";
  const needsAuth = !skipAuth && !isPublicAuthRoute;
  if (needsAuth) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const attachPersona =
    !skipPersonaHeader && !path.startsWith("/api/personas") && !path.startsWith("/api/auth");
  if (attachPersona) {
    const pid = getStoredPersonaId();
    if (pid) headers["X-Persona-Id"] = String(pid);
  }
  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (res.status === 401 && needsAuth) {
    clearStoredToken();
    clearStoredPersonaId();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("studio:unauthorized"));
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
