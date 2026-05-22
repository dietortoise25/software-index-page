import type { Pool } from "pg"
import crypto from "node:crypto"

const JWT_SECRET = process.env.BETTER_AUTH_SECRET || process.env.REVIEW_PIN || "dev-secret"

function sign(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url")
  return `${header}.${body}.${sig}`
}

function decode(token: string): { payload: any; valid: boolean } {
  try {
    const [header, body, sig] = token.split(".")
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url")
    if (sig !== expected) return { payload: null, valid: false }
    return { payload: JSON.parse(Buffer.from(body, "base64url").toString()), valid: true }
  } catch {
    return { payload: null, valid: false }
  }
}

export function createPageAccess(pool: Pool) {
  return {
    async grant(params: {
      userId: string
      pagePath: string
      grantedBy: string
      expiresInHours: number
    }) {
      const expiresAt = new Date(Date.now() + params.expiresInHours * 3600000)
      const token = sign({
        userId: params.userId,
        pagePath: params.pagePath,
        exp: Math.floor(expiresAt.getTime() / 1000),
      })

      await pool.query(
        `INSERT INTO page_access (user_id, page_path, expires_at, token, granted_by) VALUES ($1, $2, $3, $4, $5)`,
        [params.userId, params.pagePath, expiresAt, token, params.grantedBy]
      )

      return { token, expiresAt: expiresAt.toISOString() }
    },

    verify(token: string) {
      const { payload, valid } = decode(token)
      if (!valid || !payload) return null
      if (payload.exp && Date.now() > payload.exp * 1000) return null
      return {
        userId: payload.userId as string,
        pagePath: payload.pagePath as string,
      }
    },

    async listGrants() {
      const result = await pool.query(
        `SELECT id, user_id, page_path, expires_at, granted_by, granted_at FROM page_access ORDER BY granted_at DESC`
      )
      return result.rows
    },
  }
}
