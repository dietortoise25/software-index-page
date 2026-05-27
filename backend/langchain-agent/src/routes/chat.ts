import { Router } from "express"
import { z } from "zod"
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { getModel } from "../config/model.js"
import { optionalAuth } from "../auth/middleware.js"
import { AgentLogHandler } from "../lib/callbacks.js"
import { listTools, type RegisteredTool } from "../tools/registry.js"
import { createConversation, addMessage, updateConversationTimestamp } from "../db/queries/conversations.js"
import { upsertUserMemory } from "../db/queries/user-memory.js"

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

function toLangChainTool(t: RegisteredTool) {
  return new DynamicStructuredTool({
    name: t.name,
    description: t.description,
    schema: t.schema,
    func: t.func,
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
    let lcMessages = toLangChainMessages(messages)

    // 元数据收集
    const meta = {
      toolCalls: [] as string[],
      tokens: { prompt: 0, completion: 0, total: 0 },
      thinkingEnabled: true,
    }

    // 工具调用预检
    const tools = listTools()
    if (tools.length > 0) {
      const langChainTools = tools.map(toLangChainTool)
      const modelWithTools = getModel()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bound = (modelWithTools as any).bindTools(langChainTools)

      const toolCheck = await bound.invoke(lcMessages, {
        callbacks: [new AgentLogHandler()],
      })

      const toolCalls = (toolCheck as AIMessage).tool_calls
      if (toolCalls && toolCalls.length > 0) {
        meta.toolCalls = toolCalls.map(tc => tc.name)
        lcMessages.push(toolCheck)
        for (const tc of toolCalls) {
          const tool = tools.find(t => t.name === tc.name)
          if (tool) {
            try {
              const result = await tool.func(tc.args)
              lcMessages.push(new ToolMessage(result, tc.id!))
            } catch (e) {
              lcMessages.push(new ToolMessage(
                `工具执行错误: ${e instanceof Error ? e.message : String(e)}`,
                tc.id!
              ))
            }
          }
        }
      }
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")

    // 立即推送 thinking 状态
    res.write(`data: ${JSON.stringify({ status: "thinking" })}\n\n`)

    const logHandler = new AgentLogHandler()
    const streamModel = getModel()
    const stream = await streamModel
      .pipe(new StringOutputParser())
      .stream(lcMessages, { callbacks: [logHandler] })

    let fullResponse = ""
    for await (const chunk of stream) {
      fullResponse += chunk
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
    }

    // 持久化 + 元数据
    if (req.user) {
      const userId = req.user.id
      const convId = parsed.data.conversationId || (await createConversation(userId, messages[0]?.content?.slice(0, 30) || "新对话")).id
      await addMessage(convId, "user", messages[messages.length - 1]!.content)
      await addMessage(convId, "assistant", fullResponse)
      await updateConversationTimestamp(convId)

      // 用户记忆提取
      try {
        const extractModel = getModel({ temperature: 0.3 })
        const memoryCheck = await extractModel.invoke([
          new SystemMessage("从用户消息中提取值得记住的信息（角色、偏好、习惯等），输出 JSON：{ \"key\": \"value\" }。如果没什么值得记的，输出 {}。只输出JSON，不要其他文字。"),
          new HumanMessage(messages[messages.length - 1]!.content),
        ])
        const text = (memoryCheck as AIMessage).content as string
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const extracted = JSON.parse(jsonMatch[0])
          for (const [key, value] of Object.entries(extracted)) {
            if (typeof value === "string" && value.length > 0 && value.length < 500) {
              await upsertUserMemory(userId, key, { value })
            }
          }
        }
      } catch { /* 记忆提取失败不影响对话 */ }

      res.write(`data: ${JSON.stringify({ done: true, conversationId: convId, meta })}\n\n`)
    } else {
      res.write(`data: ${JSON.stringify({ done: true, meta })}\n\n`)
    }
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
