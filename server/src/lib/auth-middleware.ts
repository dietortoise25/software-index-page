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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  })

  if (session?.user) {
    req.user = {
      id: session.user.id,
      email: session.user.email,
      role: (session.user as any).role,
    }
    return next()
  }

  res.status(401).json({ ok: false, error: "Unauthorized" })
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ ok: false, error: "需要管理员权限" })
  }
  next()
}
