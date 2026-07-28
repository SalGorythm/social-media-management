import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { SignatureCredit } from "./SignatureCredit.jsx";

/** Minimal chrome for pages readable without signing in (About / license). */
export function PublicLayout() {
  const { token } = useAuth();
  const signedIn = Boolean(token);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link
            to={signedIn ? "/" : "/login"}
            className="font-display font-semibold text-slate-900 dark:text-white tracking-tight"
          >
            Social Content Studio
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {signedIn ? (
              <Link
                to="/"
                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Back to app
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8 max-w-3xl w-full mx-auto">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 dark:border-slate-800 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <SignatureCredit />
        </div>
      </footer>
    </div>
  );
}
