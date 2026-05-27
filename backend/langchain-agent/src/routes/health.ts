import { Router } from "express"

export const healthRouter = Router()

healthRouter.get("/health", (_req, res) => {
  res.json({ ok: true, data: { status: "healthy", uptime: process.uptime() } })
})
// 2026年05月27日 14:40:06
