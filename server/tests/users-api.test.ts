import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Pool } from "pg"
// 这个模块还不存在 — TDD RED phase
import { createUserQueries } from "../src/lib/user-queries"

describe("user queries", () => {
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool()

  const { listUsers, updateRole } = createUserQueries(pool)

  afterAll(async () => {
    await pool.end()
  })

  it("listUsers returns an array of users", async () => {
    if (!process.env.DATABASE_URL) return
    const users = await listUsers()
    expect(Array.isArray(users)).toBe(true)
  })

  it("listUsers items include email and role", async () => {
    if (!process.env.DATABASE_URL) return
    const users = await listUsers()
    if (users.length > 0) {
      expect(users[0]).toHaveProperty("email")
      expect(users[0]).toHaveProperty("role")
    }
  })

  it("updateRole returns updated user on success", async () => {
    if (!process.env.DATABASE_URL) return
    const r = await updateRole("admin@leverage.works", "admin")
    expect(r).not.toBeNull()
    expect(r?.role).toBe("admin")
  })

  it("updateRole returns null for unknown email", async () => {
    if (!process.env.DATABASE_URL) return
    const r = await updateRole("no-such-user@example.com", "admin")
    expect(r).toBeNull()
  })
})
