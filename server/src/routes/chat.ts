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
            system: INTERVIEW_SYSTEM_PROMPT,
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
