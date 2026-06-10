import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      dompurify: path.resolve(__dirname, "./server/node_modules/.pnpm/dompurify@3.4.7/node_modules/dompurify/dist/purify.es.mjs"),
    },
  },
  server: {
    proxy: {
      "/api/return-workflow": "http://localhost:3002",
      "/api/agent": "http://localhost:8001",
      // 本地联调:前端用 /api/shopee/sourcing,后端 router 前缀是 /api/sourcing,剥掉 /shopee 段
      "/api/shopee/sourcing": {
        target: "http://localhost:8765",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/shopee\/sourcing/, "/api/sourcing"),
      },
      "/api": "http://localhost:8765",
    },
  },
  optimizeDeps: {
    include: ["dompurify"],
  },
})
