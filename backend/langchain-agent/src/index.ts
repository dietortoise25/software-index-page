import express from "express"
import { healthRouter } from "./routes/health.js"
import { chatRouter } from "./routes/chat.js"

const app = express()
const PORT = parseInt(process.env.AGENT_PORT || "8001", 10)

app.use(express.json())

// Routes
app.use("/api/agent", healthRouter)
app.use("/api/agent", chatRouter)

app.listen(PORT, () => {
  console.log(`[agent] Agent 运行时平台已启动 → http://localhost:${PORT}`)
  console.log(`[agent] 健康检查: http://localhost:${PORT}/api/agent/health`)
  console.log(`[agent] 对话 API: POST http://localhost:${PORT}/api/agent/chat`)
})
