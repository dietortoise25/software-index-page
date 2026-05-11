/**
 * 软件发布站后端服务
 *
 * 路由:
 *   GET  /health                   — 健康检查
 *   POST /api/requirement           — 快速表单提交 (纯文本飞书消息)
 *   POST /api/chat                  — AI 对话 (流式)
 *   POST /api/requirement/generate  — AI 结构化输出 + 飞书卡片
 */

import express from "express"
import { getTenantToken, getUserOpenId, sendFeishuMessage, formatFeishuMessage } from "./lib/feishu.js"
import chatRouter from "./routes/chat.js"
import generateRouter from "./routes/generate-requirement.js"

const PORT = parseInt(process.env.PORT || "8765", 10)

const app = express()
app.use(express.urlencoded({ extended: false }))
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

// AI 对话路由
app.use("/api/chat", chatRouter)

// AI 结构化需求生成 + 飞书卡片
app.use("/api/requirement/generate", generateRouter)

// 快速表单提交（保留原功能）
app.post("/api/requirement", async (req, res) => {
  try {
    const form = req.body as Record<string, string>
    console.log(`[${new Date().toISOString()}] 收到需求:`, JSON.stringify(form).slice(0, 200))

    const token = await getTenantToken()
    const openId = await getUserOpenId(token)

    if (!openId) {
      res.status(500).json({ ok: false, error: "消息发送通道暂不可用，请直接飞书联系 Alan" })
      return
    }

    const text = formatFeishuMessage(form)
    const result = await sendFeishuMessage(token, openId, text)

    console.log(`[${new Date().toISOString()}] 飞书返回:`, JSON.stringify(result).slice(0, 200))

    if (result.code === 0) {
      res.json({ ok: true })
    } else {
      res.status(500).json({ ok: false, error: `消息发送失败: ${result.msg}` })
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] 异常:`, err)
    res.status(500).json({ ok: false, error: "服务内部错误，请稍后重试" })
  }
})

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[${new Date().toISOString()}] 服务启动: 127.0.0.1:${PORT}`)
})
