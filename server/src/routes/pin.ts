/**
 * PIN 验证路由 — 带限流保护
 */
import { Router } from "express"
import { isRateLimited } from "../lib/rate-limit.js"

const router = Router()
const REVIEW_PIN = process.env.REVIEW_PIN!

router.post("/verify-pin", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown"
  if (isRateLimited(`pin:${ip}`, 5, 60_000)) {
    res.status(429).json({ ok: false, error: "尝试次数过多，请 1 分钟后重试" })
    return
  }

  const { pin } = (req.body || {}) as Record<string, unknown>
  if (String(pin) === REVIEW_PIN) {
    res.json({ ok: true })
  } else {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
  }
})

export default router
