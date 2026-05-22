/**
 * POST /api/chat — AI 流式对话
 */
import { Router } from "express"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { streamText, createUIMessageStream, pipeUIMessageStreamToResponse } from "ai"
import { INTERVIEW_SYSTEM_PROMPT } from "../lib/interview-prompt.js"

const router = Router()

const MODEL_NAME = "deepseek-v4-pro"

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseURL: process.env.DEEPSEEK_API_URL_OpenAI || "https://api.deepseek.com",
})

function buildSystemPrompt(user: { name?: string; email?: string; role?: string }) {
  let context = ""
  if (user.role === "visitor") {
    context = `当前用户：${user.name || user.email || "访客"}，角色：访客。该用户只能咨询通用问题，无权提交需求。可建议其联系管理员升级权限。`
  } else if (user.role === "admin") {
    context = `当前用户：${user.name || user.email || "管理员"}，角色：管理员（最高权限）。可处理所有操作。`
  } else {
    context = `当前用户：${user.name || user.email || "内部用户"}，角色：内部用户。可提交需求、查看工单状态。`
  }
  return `${INTERVIEW_SYSTEM_PROMPT}\n\n[用户上下文]\n${context}`
}

router.post("/", async (req, res) => {
  try {
    const raw = req.body as { messages?: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }> }

    if (!raw.messages || !Array.isArray(raw.messages)) {
      res.status(400).json({ ok: false, error: "缺少 messages 参数" })
      return
    }

    const messages = raw.messages.slice(-20).map((m) => {
      if (m.content) return { role: m.role as "user" | "assistant", content: m.content }
      const text = (m.parts || []).filter((p) => p.type === "text").map((p) => p.text || "").join("")
      return { role: m.role as "user" | "assistant", content: text }
    })

    const user = (req as any).user || {}
    const systemPrompt = buildSystemPrompt(user)

    pipeUIMessageStreamToResponse({
      response: res,
      stream: createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: "start" })
          writer.write({
            type: "data-custom",
            data: { model: MODEL_NAME },
          })

          const result = streamText({
            model: deepseek(MODEL_NAME),
            system: systemPrompt,
            messages,
            maxOutputTokens: 4096,
            temperature: 0.7,
          })

          writer.merge(result.toUIMessageStream({ sendStart: false }))
        },
      }),
    })
  } catch (err) {
    console.error("[chat error]", err)
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: "AI 服务暂时不可用" })
    }
  }
})

export default router
