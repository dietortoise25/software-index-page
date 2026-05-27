import { Router } from "express"
import { z } from "zod"
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { getModel } from "../config/model.js"
import { optionalAuth } from "../auth/middleware.js"
import { AgentLogHandler } from "../lib/callbacks.js"

export const chatRouter = Router()

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system", "tool"]),
    content: z.string(),
  })).min(1, "消息列表不能为空").max(100, "消息数量超出限制"),
  conversationId: z.string().uuid().optional(),
})

function toLangChainMessages(messages: z.infer<typeof chatRequestSchema>["messages"]) {
  return messages.map((m) => {
    switch (m.role) {
      case "user":   return new HumanMessage(m.content)
      case "assistant": return new AIMessage(m.content)
      case "system": return new SystemMessage(m.content)
      case "tool":   return new ToolMessage(m.content, "")
      default:       return new HumanMessage(m.content)
    }
  })
}

chatRouter.post("/chat", optionalAuth, async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || "请求参数无效",
      code: "VALIDATION_ERROR",
    })
    return
  }

  try {
    const { messages } = parsed.data
    const model = getModel()
    let lcMessages = toLangChainMessages(messages)

    // TODO: 工具调用预检 — 本地 deepseek-chat 验证通过，但生产 deepseek-v4-flash
    // 启用 thinking 模式导致 reasoning_content 需要跨轮传递。待调研方案：
    // 1. 关闭生产模型 thinking 模式
    // 2. 或使用单次 stream + tool_calls 解析代替 pre-flight invoke
    // 工具注册、绑定、get_current_time 均已就绪，仅 chat 路由暂不激活

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")

    const logHandler = new AgentLogHandler()
    const stream = await model
      .pipe(new StringOutputParser())
      .stream(lcMessages, { callbacks: [logHandler] })

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  } catch (error) {
    console.error("[agent] chat error:", error instanceof Error ? error.message : error)
    const message = error instanceof Error ? error.message : "AI 服务暂时不可用"
    const safeMessage = message.includes("API key") || message.includes("Connection")
      ? "AI 服务暂时不可用"
      : message
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: safeMessage })}\n\n`)
      res.end()
    } else {
      res.status(500).json({ ok: false, error: safeMessage, code: "INTERNAL_ERROR" })
    }
  }
})
