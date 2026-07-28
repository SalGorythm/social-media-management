import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { setStoredPersonaId } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

export function LoginPage() {
  const { token, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && token) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await login(email, password);
      if (data.activePersonaId) setStoredPersonaId(data.activePersonaId);
      toast.success("Signed in");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">Sign in</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Use your studio account to load your personas and posts from SQLite.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          No account?{" "}
          <Link to="/signup" className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
