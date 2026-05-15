/**
 * 软件发布站后端服务
 */
import express from "express"
import { getTenantToken, getUserOpenId, sendFeishuMessage, formatFeishuMessage } from "./lib/feishu.js"
import { isRateLimited } from "./lib/rate-limit.js"
import { addRequirement } from "./lib/storage.js"
import chatRouter from "./routes/chat.js"
import generateRouter from "./routes/generate-requirement.js"
import calendarRouter from "./routes/calendar.js"
import requirementsRouter from "./routes/requirements.js"
import internalRouter from "./routes/internal.js"

const PORT = parseInt(process.env.PORT || "8765", 10)

// 审查 PIN 强制设置
const REVIEW_PIN = process.env.REVIEW_PIN
if (!REVIEW_PIN) {
  console.error("[启动失败] 环境变量 REVIEW_PIN 未设置。请设置一个 4-6 位数字 PIN。")
  process.exit(1)
}

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

// 日历排期路由
app.use("/api/calendar", calendarRouter)

// 需求管理路由（提交 + 审批）
app.use("/api/requirements", requirementsRouter)

// 内部管理路由（运营人员/分组/店铺绑定）
app.use("/api/internal", internalRouter)

// PIN 验证（带限流）
app.post("/api/verify-pin", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown"
  if (isRateLimited(`pin:${ip}`, 5, 60_000)) {
    res.status(429).json({ ok: false, error: "尝试次数过多，请 1 分钟后重试" })
    return
  }

  const { pin } = (req.body || {}) as Record<string, unknown>
  if (String(pin) === REVIEW_PIN) {
    res.json({ ok: true })
  } else {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
  }
})

// 快速表单提交
app.post("/api/requirement", async (req, res) => {
  try {
    const form = req.body as Record<string, string>
    console.log(`[${new Date().toISOString()}] 收到需求:`, JSON.stringify(form).slice(0, 200))

    // 写入审查面板 JSON
    const typeLabels: Record<string, string> = {
      "new-tool": "新工具开发", improvement: "功能改进",
      bugfix: "Bug 修复", automation: "自动化流程", other: "其他",
    }
    const priLabels: Record<string, string> = {
      urgent: "紧急", high: "高", medium: "中", low: "低",
    }
    addRequirement({
      id: `req_${Date.now()}`,
      status: "pending",
      requirement: {
        title: form.title || "未命名需求",
        type: (form.type as "new-tool") || "other",
        priority: (form.priority as "high") || "medium",
        problem: form.description || "",
        context: `部门: ${form.department || "未填写"}`,
        constraints: `期望完成: ${form.expectedDate || "未填写"}`,
        expectedOutcome: `联系方式: ${form.contact || "未填写"}`,
        department: "",
        contact: "",
        expectedDate: "",
      },
      schedule: null,
      submitter: form.contact || "匿名",
      submittedAt: new Date().toISOString(),
    })

    // 发送飞书通知
    const token = await getTenantToken()
    const openId = await getUserOpenId(token)

    if (!openId) {
      res.status(500).json({ ok: false, error: "消息发送通道暂不可用，请直接飞书联系 Alan" })
      return
    }

    const text = formatFeishuMessage(form) + "\n🔗 前往审查：http://42.193.170.109/review"
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
