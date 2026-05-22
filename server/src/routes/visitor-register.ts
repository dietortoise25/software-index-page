import { Router } from "express"

const router = Router()

router.post("/sign-up/visitor", async (req, res) => {
  try {
    const { username, password } = (req.body || {}) as Record<string, unknown>
    if (!username || !password) { res.status(400).json({ ok: false, error: "缺少参数" }); return }

    const email = `${username}@visitor.user`
    const PORT = process.env.PORT || "8765"
    const internalRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: username, username }),
    })

    if (!internalRes.ok) {
      const err = await internalRes.json() as any
      res.status(internalRes.status).json(err)
      return
    }

    const data = await internalRes.json()
    const { Pool: PgPool } = await import("pg")
    const p = new PgPool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await p.query(`UPDATE "user" SET role = 'visitor' WHERE email = $1`, [email])
    p.end()

    res.json(data)
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message })
  }
})

export default router
