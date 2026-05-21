import { describe, it, expect, beforeAll, afterAll } from "vitest"
import express from "express"
import { toNodeHandler } from "better-auth/node"
import { auth } from "../src/lib/auth"
import { requireAuth } from "../src/lib/auth-middleware"
import http from "node:http"

function request(
  app: express.Express
): (path: string, opts?: { cookie?: string; body?: unknown }) => Promise<{ status: number; body: unknown }> {
  return (path, opts) => {
    return new Promise((resolve, reject) => {
      const url = new URL(path, "http://localhost:19999")
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(opts?.cookie ? { cookie: opts.cookie } : {}),
          },
        },
        (res) => {
          let data = ""
          res.on("data", (chunk) => (data += chunk))
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode || 0, body: JSON.parse(data) })
            } catch {
              resolve({ status: res.statusCode || 0, body: data })
            }
          })
        }
      )
      req.on("error", reject)
      if (opts?.body) req.write(JSON.stringify(opts.body))
      req.end()
    })
  }
}

describe("auth middleware", () => {
  let server: http.Server
  let app: express.Express
  let req: ReturnType<typeof request>

  beforeAll(async () => {
    app = express()
    app.all("/api/auth/*", toNodeHandler(auth))
    app.use(express.json())

    app.post("/api/protected", requireAuth, (_req, res) => {
      res.json({ ok: true, userId: _req.user?.id })
    })

    await new Promise<void>((resolve) => {
      server = app.listen(19999, () => resolve())
    })
    req = request(app)
  })

  afterAll(() => {
    server?.close()
  })

  it("returns 401 when no session cookie and no PIN", async () => {
    const res = await req("/api/protected", { body: {} })
    expect(res.status).toBe(401)
  })

  it("builds toNodeHandler for express integration", () => {
    const handler = toNodeHandler(auth)
    expect(typeof handler).toBe("function")
  })
})
