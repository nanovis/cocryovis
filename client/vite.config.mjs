import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { DEFAULT_URL } from "./src/Constants.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  const proxyTarget = env.VITE_API_URL || DEFAULT_URL;

  return {
    plugins: [react()],
    build: {
      outDir: "build",
    },
    server: {
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
        "/logs": {
          target: proxyTarget,
          changeOrigin: true,
        },
        "/ws": {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
