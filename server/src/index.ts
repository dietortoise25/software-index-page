/**
 * 需求提交中继服务 — 接收前端表单，转发为飞书消息
 *
 * 路由:
 *   POST /api/requirement — 接收需求表单，发送飞书消息
 *   GET  /health            — 健康检查
 */

import express from "express"

const PORT = parseInt(process.env.PORT || "8765", 10)
const FEISHU_APP_ID = "cli_a9646f769479dbd4"
const FEISHU_APP_SECRET =
  process.env.FEISHU_APP_SECRET || "NQomqTYaZHapPxb3uDf6HbantJLyOLwQ"
const TARGET_USER = "Alan"

// ── 飞书 API 工具 ──

interface TokenCache {
  token: string
  expire: number
}

let tokenCache: TokenCache | null = null

async function getTenantToken(): Promise<string> {
  if (tokenCache && tokenCache.expire > Date.now() + 60_000) {
    return tokenCache.token
  }
  const resp = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
    },
  )
  const data = (await resp.json()) as { tenant_access_token: string; expire: number }
  tokenCache = {
    token: data.tenant_access_token,
    expire: Date.now() + (data.expire || 7200) * 1000,
  }
  return tokenCache.token
}

async function getUserOpenId(token: string): Promise<string | null> {
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/contact/v3/users?page_size=5&name=${TARGET_USER}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  )
  const data = (await resp.json()) as {
    data?: { items?: Array<{ name?: string; open_id: string }> }
  }
  const users = data.data?.items || []
  for (const u of users) {
    // u.name may be undefined (飞书 API 可能不返回 name 字段)
    if (u.name === TARGET_USER || u.name == null) return u.open_id
  }
  return null
}

async function sendFeishuMessage(token: string, openId: string, text: string) {
  const resp = await fetch(
    "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receive_id: openId,
        msg_type: "text",
        content: JSON.stringify({ text }),
      }),
    },
  )
  return (await resp.json()) as { code: number; msg?: string }
}

// ── 格式化消息 ──

const typeLabel: Record<string, string> = {
  "new-tool": "新工具开发",
  improvement: "功能改进",
  bugfix: "Bug 修复",
  automation: "自动化流程",
  other: "其他",
}
const priLabel: Record<string, string> = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
}

function formatFeishuMessage(form: Record<string, string>): string {
  return [
    "📋 收到新的需求提交",
    `需求类型：${typeLabel[form.type] || form.type}`,
    `优先级：${priLabel[form.priority] || form.priority}`,
    `标题：${form.title}`,
    `部门：${form.department || "未填写"}`,
    `期望完成：${form.expectedDate || "未填写"}`,
    `联系方式：${form.contact || "未填写"}`,
    `详细描述：`,
    form.description || "",
  ].join("\n")
}

// ── Express 应用 ──

const app = express()
app.use(express.urlencoded({ extended: false }))

// CORS
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (_req.method === "OPTIONS") {
    res.status(204).end()
    return
  }
  next()
})

// 健康检查
app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

// 需求提交
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
  console.log(`[${new Date().toISOString()}] 中继服务启动: 127.0.0.1:${PORT}`)
})
