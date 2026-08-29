import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 仓库名，自定义域名时可改回 '/'
  base: process.env.GITHUB_PAGES_BASE || '/exam-prep/',
  plugins: [react()],
  build: {
    // 由脚本自行清理 dist，避免触发系统回收站工具导致的超时
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
