import type { Request, Response, NextFunction } from "express"
import { fromNodeHeaders } from "better-auth/node"
import { auth } from "../lib/better-auth.js"

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string; name?: string; role?: string }
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })
    if (session?.user) {
      req.user = {
        id: session.user.id,
        email: session.user.email,
        name: (session.user as Record<string, unknown>).name as string || session.user.email,
        role: (session.user as Record<string, unknown>).role as string,
      }
      return next()
    }
  } catch { /* session validation failed */ }

  res.status(401).json({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" })
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })
    if (session?.user) {
      req.user = {
        id: session.user.id,
        email: session.user.email,
        name: (session.user as Record<string, unknown>).name as string || session.user.email,
        role: (session.user as Record<string, unknown>).role as string,
      }
    }
  } catch { /* not authenticated, continue anyway */ }
  next()
}
