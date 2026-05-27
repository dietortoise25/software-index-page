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

const DEV_USER = {
  id: "dev-user",
  email: "dev@local",
  name: "Dev",
  role: "admin",
}

function isDev(req: Request) {
  return process.env.AGENT_DEV_MODE === "true" || req.headers["x-dev-mode"] === "true"
}

async function getSessionUser(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })
    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email,
        name: (session.user as Record<string, unknown>).name as string || session.user.email,
        role: (session.user as Record<string, unknown>).role as string,
      }
    }
  } catch { /* session validation failed */ }
  return null
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (isDev(req)) {
    req.user = DEV_USER
    return next()
  }

  const user = await getSessionUser(req)
  if (user) {
    req.user = user
    return next()
  }

  res.status(401).json({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" })
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  if (isDev(req)) {
    req.user = DEV_USER
    return next()
  }

  const user = await getSessionUser(req)
  if (user) req.user = user
  next()
}
