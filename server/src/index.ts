/**
 * 软件发布站后端服务
 */
import express from "express"
import { toNodeHandler } from "better-auth/node"
import { auth } from "./lib/auth.js"
import chatRouter from "./routes/chat.js"
import generateRouter from "./routes/generate-requirement.js"
import calendarRouter from "./routes/calendar.js"
import requirementsRouter from "./routes/requirements.js"
import internalRouter from "./routes/internal.js"
import approvalRouter from "./routes/approval.js"
import pinRouter from "./routes/pin.js"
import downloadRouter from "./routes/download.js"
import quickFormRouter from "./routes/quick-form.js"

const PORT = parseInt(process.env.PORT || "8765", 10)

// 审查 PIN 强制设置
if (!process.env.REVIEW_PIN) {
  console.error("[启动失败] 环境变量 REVIEW_PIN 未设置。请设置一个 4-6 位数字 PIN。")
  process.exit(1)
}

const app = express()
app.use(express.urlencoded({ extended: false }))

// Better Auth handler — 必须在 express.json() 之前
app.all("/api/auth/*", toNodeHandler(auth))

app.use(express.json({ limit: "100kb" }))

// CORS
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (_req.method === "OPTIONS") {
    res.status(204).end()
    return
  }
  next()
})

// 健康检查
app.get("/health", (_req, res) => res.json({ ok: true }))

// 路由挂载
app.use("/api", pinRouter)
app.use("/api", downloadRouter)
app.use("/api/chat", chatRouter)
app.use("/api/requirement/generate", generateRouter)
app.use("/api/requirement", quickFormRouter)
app.use("/api/requirements", requirementsRouter)
app.use("/api/internal", internalRouter)
app.use("/api/internal", approvalRouter)
app.use("/api/feishu", approvalRouter)

// 全局错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[unhandled] ${err.message}`, err.stack)
  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: "服务器内部错误" })
  }
})

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[${new Date().toISOString()}] 服务启动: 127.0.0.1:${PORT}`)
})
