import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Pool } from "pg"
import { seedArticles } from "../src/lib/seed-articles"

describe("seed articles", () => {
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool()

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
        cover_image TEXT, author TEXT NOT NULL DEFAULT '', tags TEXT[] NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  })

  afterAll(async () => {
    await pool.end()
  })

  it("seeds articles without error", async () => {
    if (!process.env.DATABASE_URL) return
    const count = await seedArticles(pool)
    expect(typeof count).toBe("number")
    expect(count).toBeGreaterThan(0)
  })

  it("seeds are idempotent (no duplicate error on re-run)", async () => {
    if (!process.env.DATABASE_URL) return
    const count1 = await seedArticles(pool)
    const count2 = await seedArticles(pool)
    expect(count2).toBe(count1)
  })

  it("seeded articles are published", async () => {
    if (!process.env.DATABASE_URL) return
    const r = await pool.query("SELECT slug, status FROM articles WHERE slug IN ('welcome', 'erp-data-hub-v2') ORDER BY slug")
    expect(r.rows.length).toBeGreaterThanOrEqual(2)
    r.rows.forEach((row: any) => expect(row.status).toBe("published"))
  })
})
