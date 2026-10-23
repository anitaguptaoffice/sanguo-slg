import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    fs: { allow: [path.resolve(__dirname, "..")] },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
