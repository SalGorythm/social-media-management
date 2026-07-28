import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Prefer process.env from run.py, then Vite-loaded env, then default FastAPI port
  const backendUrl =
    process.env.VITE_BACKEND_URL ||
    env.VITE_BACKEND_URL ||
    "http://127.0.0.1:8000";
  const frontendPort = Number(
    process.env.FRONTEND_PORT || env.FRONTEND_PORT || 5173
  );

  return {
    plugins: [react()],
    server: {
      host: process.env.FRONTEND_HOST || "127.0.0.1",
      port: frontendPort,
      strictPort: true,
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
