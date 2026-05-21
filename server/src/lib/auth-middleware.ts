import type { Request, Response, NextFunction } from "express"
import { fromNodeHeaders } from "better-auth/node"
import { auth } from "./auth.js"

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string; role?: string }
    }
  }
}

/**
 * 认证中间件：优先读 Session Cookie，fallback 到旧 PIN 码
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 1. 尝试 Better Auth session cookie
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  })

  if (session?.user) {
    req.user = { id: session.user.id, email: session.user.email }
    return next()
  }

  // 2. Fallback: 旧 PIN 码验证
  const pin =
    (req.body as Record<string, unknown>)?.pin ||
    (req.query as Record<string, string>)?.pin

  if (pin && String(pin) === process.env.REVIEW_PIN) {
    req.user = { id: "admin:pin", role: "admin" }
    return next()
  }

  res.status(401).json({ ok: false, error: "Unauthorized" })
}
