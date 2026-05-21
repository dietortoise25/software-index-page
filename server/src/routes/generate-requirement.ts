/**
 * POST /api/requirement/generate — 从对话提取结构化需求 + 发送飞书卡片
 */
import { Router } from "express"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { generateObject } from "ai"
import { requirementSchema } from "../schemas/requirement.js"
import { EXTRACTION_PROMPT } from "../lib/interview-prompt.js"
import { getTenantToken, getUserOpenId, sendFeishuCard } from "../lib/feishu.js"
import { buildRequirementsCard } from "../lib/feishu-card.js"
import type { ScheduleProposal } from "../lib/schedule-prompt.js"

const router = Router()

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseURL: process.env.DEEPSEEK_API_URL_OpenAI || "https://api.deepseek.com",
})

router.post("/", async (req, res) => {
  try {
    const { messages, edited, schedule } = req.body as {
      messages?: Array<{ role: string; content: string }>
      edited?: Record<string, unknown>
      schedule?: ScheduleProposal
    }

    let structured: Record<string, unknown>

    if (edited) {
      // 用户在前端编辑过，验证并直接使用
      structured = requirementSchema.parse(edited)
    } else if (messages) {
      // 从对话中提取
      const result = await generateObject({
        model: deepseek("deepseek-v4-pro"),
        system: EXTRACTION_PROMPT,
        messages: messages.slice(-20).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        schema: requirementSchema,
        temperature: 0.3,
      })
      structured = result.object as unknown as Record<string, unknown>
    } else {
      res.status(400).json({ ok: false, error: "缺少 messages 或 edited 参数" })
      return
    }

    // 发送飞书卡片
    const token = await getTenantToken()
    const openId = await getUserOpenId(token)

    if (!openId) {
      res.status(500).json({ ok: false, error: "消息发送通道暂不可用" })
      return
    }

    const card = buildRequirementsCard(structured as Parameters<typeof buildRequirementsCard>[0], schedule)
    const feishuResult = await sendFeishuCard(token, openId, card)

    console.log(`[generate] 飞书结果: code=${feishuResult.code}`)

    if (feishuResult.code === 0) {
      res.json({ ok: true, requirement: structured })
    } else {
      res.status(500).json({ ok: false, error: `飞书发送失败: ${feishuResult.msg}` })
    }
  } catch (err) {
    console.error("[generate error]", err)
    res.status(500).json({ ok: false, error: "生成需求文档失败，请重试" })
  }
})

export default router
