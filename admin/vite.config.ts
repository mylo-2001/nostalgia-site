import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* Relative base so Express can serve the built admin under any ADMIN_UI_PATH
   without rebuilding when the secret path changes. In dev, Vite still proxies
   /api to Express on :8000. */
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
