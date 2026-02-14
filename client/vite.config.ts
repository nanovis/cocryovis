import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { DEFAULT_URL } from "./src/constants";
import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import svgr from "vite-plugin-svgr";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  const proxyTarget = env.VITE_API_URL || DEFAULT_URL;

  return {
    plugins: [react(), tsconfigPaths(), svgr()],
    build: {
      outDir: "build",
    },
    resolve: {
      alias: {
        "#schemas": path.resolve(__dirname, "../schemas/src"),
      },
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
