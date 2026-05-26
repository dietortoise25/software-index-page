/**
 * 快速需求提交 — 来自首页快速表单
 * 写入审查面板 JSON + 发送飞书纯文本通知
 */
import { Router } from "express"

const SITE_BASE_URL = `http://${process.env.SERVER_IP || "42.193.170.109"}`
import { getTenantToken, getUserOpenId, sendFeishuMessage, formatFeishuMessage } from "../lib/feishu.js"
import { addRequirement } from "../lib/storage.js"

const router = Router()

router.post("/", async (req, res) => {
  try {
    const form = req.body as Record<string, string>
    console.log(`[${new Date().toISOString()}] 收到需求:`, JSON.stringify(form).slice(0, 200))

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

    const token = await getTenantToken()
    const openId = await getUserOpenId(token)

    if (!openId) {
      res.status(500).json({ ok: false, error: "消息发送通道暂不可用，请直接飞书联系 Alan" })
      return
    }

    const text = formatFeishuMessage(form) + "\n🔗 前往审查：${SITE_BASE_URL}/dashboard/review"
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

export default router
