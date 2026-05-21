/**
 * PIN 保护下载路由
 */
import { Router } from "express"
import { isRateLimited } from "../lib/rate-limit.js"
import path from "path"
import fs from "fs"

const router = Router()
const REVIEW_PIN = process.env.REVIEW_PIN!
const DOWNLOADS_DIR = "/var/www/software-index/downloads"

router.post("/verify-download", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown"
  if (isRateLimited(`dld:${ip}`, 5, 60_000)) {
    res.status(429).json({ ok: false, error: "尝试次数过多，请 1 分钟后重试" })
    return
  }

  const { pin, file } = (req.body || {}) as Record<string, unknown>
  if (String(pin) !== REVIEW_PIN) {
    res.status(403).json({ ok: false, error: "PIN 码错误" })
    return
  }

  const safeName = path.basename(String(file || ""))
  const filePath = path.join(DOWNLOADS_DIR, safeName)

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ ok: false, error: "文件不存在" })
    return
  }

  res.download(filePath, safeName)
})

export default router
