import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { usePersona } from "../context/PersonaContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Button, Select } from "./ui.jsx";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/review", label: "Review queue" },
  { to: "/posted", label: "Posted" },
  { to: "/calendar", label: "Calendar" },
  { to: "/accounts", label: "Accounts" },
  { to: "/personas", label: "Personas" },
  { to: "/settings/ai", label: "AI settings" },
  { to: "/guide", label: "Guide" },
];

export function Layout() {
  const { theme, setTheme, toggle } = useTheme();
  const { personaId, personas, switchPersona, activePersona } = usePersona();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur md:w-56 shrink-0">
        <div className="p-4 md:p-6 flex md:flex-col gap-4 items-center md:items-stretch justify-between">
          <div>
            <p className="font-display font-semibold text-lg tracking-tight text-slate-900 dark:text-white">
              Social Content Studio
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 hidden md:block">
              Queue → review → post
            </p>
            <div className="mt-3 hidden md:block">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Persona
              </label>
              <Select
                value={personaId}
                onChange={(e) => switchPersona(Number(e.target.value))}
                className="mt-1 text-xs py-1.5"
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              {activePersona?.description ? (
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{activePersona.description}</p>
              ) : null}
            </div>
          </div>
          <nav className="flex md:flex-col gap-1 overflow-x-auto max-w-[60vw] md:max-w-none">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  clsx(
                    "px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="md:hidden w-full max-w-[60vw]">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Persona
            </label>
            <Select
              value={personaId}
              onChange={(e) => switchPersona(Number(e.target.value))}
              className="mt-1 text-xs py-1.5"
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {user?.email ? (
              <span
                className="hidden md:inline text-[10px] text-slate-500 max-w-[120px] truncate"
                title={user.email}
              >
                {user.email}
              </span>
            ) : null}
            <Button size="sm" variant="secondary" onClick={logout}>
              Log out
            </Button>
            <label className="sr-only" htmlFor="theme-select">
              Theme
            </label>
            <Select
              id="theme-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-auto text-xs py-1.5"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
            <Button size="sm" variant="secondary" onClick={toggle} title="Toggle light/dark">
              Toggle
            </Button>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
