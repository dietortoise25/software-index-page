import { Router } from "express"
import { Pool } from "pg"
import { createPageAccess } from "../lib/page-access.js"

const router = Router()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

const { verify } = createPageAccess(pool)

router.post("/verify-guest", (req, res) => {
  const { token } = req.body || {}
  if (!token || typeof token !== "string") {
    res.status(400).json({ ok: false, error: "缺少 token" })
    return
  }

  const payload = verify(token)
  if (!payload) {
    res.status(401).json({ ok: false, error: "token 无效或已过期" })
    return
  }

  res.json({ ok: true, valid: true, pagePath: payload.pagePath })
})

export default router
