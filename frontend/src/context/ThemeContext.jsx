import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

const STORAGE_KEY = "social-content-studio-theme";

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === "undefined") return "system";
    return localStorage.getItem(STORAGE_KEY) || "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const resolved = theme === "system" ? (mq.matches ? "dark" : "light") : theme;
      root.classList.toggle("dark", resolved === "dark");
    };

    apply();
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  const setTheme = (next) => setThemeState(next);
  const toggle = () => {
    setThemeState((t) => {
      if (t === "light") return "dark";
      if (t === "dark") return "light";
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark";
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
