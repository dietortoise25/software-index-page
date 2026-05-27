import { Router } from "express"
import { auth } from "../lib/better-auth.js"

export const devAuthRouter = Router()

if (process.env.AGENT_DEV_MODE === "true") {
  const DEV_EMAIL = "dev@agent.local"
  const DEV_PASSWORD = "devdev"
  const DEV_NAME = "DevUser"

  // 首次访问时自动种子
  let seeded = false
  async function ensureDevUser() {
    if (seeded) return
    try {
      await auth.api.signUpEmail({
        body: { email: DEV_EMAIL, password: DEV_PASSWORD, name: DEV_NAME, username: "dev" },
        headers: new Headers({ "content-type": "application/json" }),
      } as Parameters<typeof auth.api.signUpEmail>[0])
      console.log("[agent] Dev 用户已创建:", DEV_EMAIL)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes("already exists") && !msg.includes("unique") && !msg.includes("duplicate")) {
        console.warn("[agent] Dev 用户创建失败:", msg)
      }
    }
    seeded = true
  }

  devAuthRouter.post("/dev/login", async (_req, res) => {
    try {
      await ensureDevUser()
      const signIn = await auth.api.signInEmail({
        body: { email: DEV_EMAIL, password: DEV_PASSWORD },
        headers: new Headers({ "content-type": "application/json" }),
      } as Parameters<typeof auth.api.signInEmail>[0])

      // better-auth 返回的 response 需要转发 cookie 给客户端
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setCookie = (signIn as any).headers?.get?.("set-cookie") || (signIn as any).response?.headers?.get?.("set-cookie")
      if (setCookie) res.setHeader("Set-Cookie", setCookie)

      res.json({ ok: true, data: { email: DEV_EMAIL, name: DEV_NAME } })
    } catch (err) {
      res.status(500).json({ ok: false, error: "Dev 登录失败", code: "INTERNAL_ERROR" })
    }
  })

  devAuthRouter.get("/dev/status", async (req, res) => {
    try {
      const session = await auth.api.getSession({
        headers: req.headers as any,
      })
      res.json({ ok: true, data: session ? { email: session.user.email, name: session.user.name } : null })
    } catch {
      res.json({ ok: true, data: null })
    }
  })

  console.log("[agent] Dev 登录端点: POST /api/agent/dev/login")
}
