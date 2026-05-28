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
      "/api": "http://localhost:3001",
    },
  },
  optimizeDeps: {
    include: ["dompurify"],
  },
})
