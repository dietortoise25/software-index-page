import "dotenv/config"
import express from "express"
import cors from "cors"
import { healthRouter } from "./routes/health.js"
import { chatRouter } from "./routes/chat.js"
import { conversationsRouter } from "./routes/conversations.js"
import { newsConfigRouter } from "./routes/news-config.js"
import { newsConfigsRouter } from "./routes/news-configs.js"
import { newsDigestRouter } from "./routes/news-digest.js"
import { startCron } from "./lib/cron-scheduler.js"
import { ensureTables } from "./db/setup.js"

// 注册内置工具（side-effect import）
import "./tools/built-in/get-current-time.js"
import "./tools/built-in/search-news.js"
import "./tools/built-in/send-feishu-card.js"

const app = express()
const PORT = parseInt(process.env.AGENT_PORT || "8001", 10)

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
}))
app.use(express.json())

// Routes
app.use("/api/agent", healthRouter)
app.use("/api/agent", chatRouter)
app.use("/api/agent", conversationsRouter)
app.use("/api/agent", newsConfigRouter)
app.use("/api/agent", newsConfigsRouter)
app.use("/api/agent", newsDigestRouter)

app.listen(PORT, async () => {
  console.log(`[agent] Agent 运行时平台已启动 → http://localhost:${PORT}`)
  console.log(`[agent] LLM: ${process.env.LLM_MODEL || "未配置"} | API Key: ${process.env.LLM_API_KEY ? "已加载" : "缺失"}`)
  console.log(`[agent] DB: ${process.env.DATABASE_URL ? "已配置" : "未配置"}`)
  console.log(`[agent] 健康检查: http://localhost:${PORT}/api/agent/health`)
  console.log(`[agent] 对话 API: POST http://localhost:${PORT}/api/agent/chat`)
  console.log(`[agent] 新闻配置 API: GET/PUT http://localhost:${PORT}/api/agent/news-config`)
  console.log(`[agent] 新闻汇集 API: POST http://localhost:${PORT}/api/agent/news-digest/run`)
  await ensureTables()
  startCron()
})
