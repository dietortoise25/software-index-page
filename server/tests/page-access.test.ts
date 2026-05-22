import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Pool } from "pg"
// 模块还不存在
import { createPageAccess } from "../src/lib/page-access"

describe("page access", () => {
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool()

  const access = createPageAccess(pool)

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return
    await pool.query(`
      CREATE TABLE IF NOT EXISTS page_access (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        page_path TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        token TEXT NOT NULL UNIQUE,
        granted_by TEXT NOT NULL,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  })

  afterAll(async () => {
    if (process.env.DATABASE_URL) {
      await pool.query("DELETE FROM page_access WHERE user_id = 'test-user'")
    }
    await pool.end()
  })

  it("generates a JWT token for page access", async () => {
    if (!process.env.DATABASE_URL) return

    const result = await access.grant({
      userId: "test-user",
      pagePath: "/dashboard",
      grantedBy: "admin@leverage.works",
      expiresInHours: 24,
    })

    expect(result).toHaveProperty("token")
    expect(typeof result.token).toBe("string")
    expect(result.token.split(".").length).toBe(3) // JWT 三段
  })

  it("stores the grant in page_access table", async () => {
    if (!process.env.DATABASE_URL) return

    const result = await access.grant({
      userId: "test-user",
      pagePath: "/catalog",
      grantedBy: "admin@leverage.works",
      expiresInHours: 1,
    })

    const rows = await pool.query(
      "SELECT * FROM page_access WHERE token = $1",
      [result.token]
    )
    expect(rows.rows.length).toBe(1)
    expect(rows.rows[0].page_path).toBe("/catalog")
    expect(rows.rows[0].granted_by).toBe("admin@leverage.works")
  })

  it("verifies a valid token returns page access info", async () => {
    if (!process.env.DATABASE_URL) return

    const { token } = await access.grant({
      userId: "test-user",
      pagePath: "/review",
      grantedBy: "admin@leverage.works",
      expiresInHours: 24,
    })

    const verified = access.verify(token)
    expect(verified).not.toBeNull()
    expect(verified!.pagePath).toBe("/review")
    expect(verified!.userId).toBe("test-user")
  })

  it("returns null for invalid token", () => {
    const verified = access.verify("invalid.token.here")
    expect(verified).toBeNull()
  })

  it("lists grants for admin", async () => {
    if (!process.env.DATABASE_URL) return

    const grants = await access.listGrants()
    expect(Array.isArray(grants)).toBe(true)
    expect(grants.length).toBeGreaterThan(0)
    expect(grants[0]).toHaveProperty("page_path")
    expect(grants[0]).toHaveProperty("expires_at")
  })
})
