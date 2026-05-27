import { Router } from "express"
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { getModel } from "../config/model.js"
import { optionalAuth } from "../auth/middleware.js"

export const chatRouter = Router()

interface ChatRequest {
  messages: { role: string; content: string }[]
  conversationId?: string
}

function toLangChainMessages(messages: ChatRequest["messages"]) {
  return messages.map((m) => {
    switch (m.role) {
      case "user":
        return new HumanMessage(m.content)
      case "assistant":
        return new AIMessage(m.content)
      case "system":
        return new SystemMessage(m.content)
      default:
        return new HumanMessage(m.content)
    }
  })
}

chatRouter.post("/chat", optionalAuth, async (req, res) => {
  try {
    const { messages } = req.body as ChatRequest

    if (!messages || messages.length === 0) {
      res.status(400).json({ ok: false, error: "消息列表不能为空", code: "VALIDATION_ERROR" })
      return
    }

    const model = getModel()
    const lcMessages = toLangChainMessages(messages)

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")

    const stream = await model.pipe(new StringOutputParser()).stream(lcMessages)

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 服务暂时不可用"
    // If headers already sent, try to write error as SSE
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
      res.end()
    } else {
      res.status(500).json({ ok: false, error: message, code: "INTERNAL_ERROR" })
    }
  }
})
