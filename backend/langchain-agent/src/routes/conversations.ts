import { Router } from "express"
import { requireAuth } from "../auth/middleware.js"
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  getMessages,
} from "../db/queries/conversations.js"

export const conversationsRouter = Router()

// 所有会话路由需要登录
conversationsRouter.use(requireAuth)

// GET /api/agent/conversations
conversationsRouter.get("/conversations", async (req, res) => {
  try {
    const list = await listConversations(req.user!.id)
    res.json({ ok: true, data: list })
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取会话列表失败"
    res.status(500).json({ ok: false, error: message, code: "INTERNAL_ERROR" })
  }
})

// POST /api/agent/conversations
conversationsRouter.post("/conversations", async (req, res) => {
  try {
    const { title, agentType } = req.body as { title?: string; agentType?: string }
    const conv = await createConversation(req.user!.id, title, agentType)
    res.status(201).json({ ok: true, data: conv })
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建会话失败"
    res.status(500).json({ ok: false, error: message, code: "INTERNAL_ERROR" })
  }
})

// GET /api/agent/conversations/:id
conversationsRouter.get("/conversations/:id", async (req, res) => {
  try {
    const conv = await getConversation(req.params.id!, req.user!.id)
    if (!conv) {
      res.status(404).json({ ok: false, error: "会话不存在", code: "NOT_FOUND" })
      return
    }
    const messages = await getMessages(req.params.id!)
    res.json({ ok: true, data: { ...conv, messages } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取会话详情失败"
    res.status(500).json({ ok: false, error: message, code: "INTERNAL_ERROR" })
  }
})

// DELETE /api/agent/conversations/:id
conversationsRouter.delete("/conversations/:id", async (req, res) => {
  try {
    const conv = await getConversation(req.params.id!, req.user!.id)
    if (!conv) {
      res.status(404).json({ ok: false, error: "会话不存在", code: "NOT_FOUND" })
      return
    }
    await deleteConversation(req.params.id!, req.user!.id)
    res.json({ ok: true, data: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除会话失败"
    res.status(500).json({ ok: false, error: message, code: "INTERNAL_ERROR" })
  }
})
