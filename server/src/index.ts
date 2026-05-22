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
import { requireAuth, requireAdmin } from "./lib/auth-middleware.js"
import downloadRouter from "./routes/download.js"
import quickFormRouter from "./routes/quick-form.js"
import feishuAuthRouter from "./routes/feishu-auth.js"
import articlesRouter from "./routes/articles.js"

const PORT = parseInt(process.env.PORT || "8765", 10)

// 审查 PIN 强制设置
if (!process.env.REVIEW_PIN) {
  console.error("[启动失败] 环境变量 REVIEW_PIN 未设置。请设置一个 4-6 位数字 PIN。")
  process.exit(1)
}

const app = express()

// CORS — 必须在所有路由之前
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", _req.headers.origin || "*")
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (_req.method === "OPTIONS") {
    res.status(204).end()
    return
  }
  next()
})

app.use(express.urlencoded({ extended: false }))

// 飞书 OAuth — 必须比 /api/auth/* 更早注册
app.use("/api/auth/feishu", feishuAuthRouter)

// 访客注册 — 必须在 Better Auth handler 之前
app.post("/api/auth/sign-up/visitor", async (req, res) => {
  try {
    const { username, password } = (req.body || {}) as Record<string, unknown>
    if (!username || !password) { res.status(400).json({ ok: false, error: "缺少参数" }); return }

    const email = `${username}@visitor.user`
    const internalRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: username, username }),
    })

    if (!internalRes.ok) {
      const err = await internalRes.json() as any
      res.status(internalRes.status).json(err)
      return
    }

    const data = await internalRes.json()
    const { Pool: PgPool } = await import("pg")
    const p = new PgPool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await p.query(`UPDATE "user" SET role = 'visitor' WHERE email = $1`, [email])
    p.end()

    res.json(data)
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message })
  }
})

// Better Auth handler — 必须在 express.json() 之前
app.all("/api/auth/*", toNodeHandler(auth))

app.use(express.json({ limit: "100kb" }))

// 健康检查
app.get("/health", (_req, res) => res.json({ ok: true }))

// 路由挂载
app.use("/api", downloadRouter)
app.use("/api/chat", requireAuth, chatRouter)
app.use("/api/requirement/generate", requireAuth, generateRouter)
app.use("/api/requirement", quickFormRouter)
app.use("/api/feishu", approvalRouter)
app.use("/api/articles", articlesRouter)

// === 受保护路由（需要认证） ===
app.use("/api/requirements", requireAuth, requirementsRouter)
app.use("/api/internal", requireAuth, requireAdmin, internalRouter)
app.use("/api/internal", requireAuth, requireAdmin, approvalRouter)

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
