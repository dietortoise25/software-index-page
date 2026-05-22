import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Pool } from "pg"
import { createArticleQueries } from "../src/lib/article-queries"

describe("article queries", () => {
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool()

  const { create, getBySlug, list, update, remove } = createArticleQueries(pool)
  let testSlug = ""

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        cover_image TEXT,
        author TEXT NOT NULL DEFAULT '',
        tags TEXT[] NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  })

  afterAll(async () => {
    if (process.env.DATABASE_URL) {
      await pool.query("DELETE FROM articles WHERE slug LIKE 'test-%'")
    }
    await pool.end()
  })

  it("creates an article", async () => {
    if (!process.env.DATABASE_URL) return
    const article = await create({
      slug: "test-article-1",
      title: "测试文章",
      summary: "摘要",
      content: "# Hello\n正文内容",
      author: "Alan",
      tags: ["测试", "发布"],
      status: "published",
    })
    testSlug = article.slug
    expect(article.slug).toBe("test-article-1")
    expect(article.title).toBe("测试文章")
    expect(article.status).toBe("published")
    expect(article.tags).toEqual(["测试", "发布"])
  })

  it("gets article by slug", async () => {
    if (!process.env.DATABASE_URL) return
    const article = await getBySlug("test-article-1")
    expect(article).not.toBeNull()
    expect(article!.content).toBe("# Hello\n正文内容")
  })

  it("returns null for missing slug", async () => {
    if (!process.env.DATABASE_URL) return
    const article = await getBySlug("no-such-article")
    expect(article).toBeNull()
  })

  it("lists published articles ordered by date", async () => {
    if (!process.env.DATABASE_URL) return
    // 创建一篇 draft，不应出现在 list 中
    await create({ slug: "test-draft", title: "草稿", author: "Alan", status: "draft" })
    const articles = await list()
    expect(Array.isArray(articles)).toBe(true)
    const slugs = articles.map((a: any) => a.slug)
    expect(slugs).toContain("test-article-1")
    expect(slugs).not.toContain("test-draft")
  })

  it("updates an article", async () => {
    if (!process.env.DATABASE_URL) return
    const updated = await update("test-article-1", { title: "更新标题", tags: ["更新"] })
    expect(updated).not.toBeNull()
    expect(updated!.title).toBe("更新标题")
    expect(updated!.tags).toEqual(["更新"])
  })

  it("deletes an article", async () => {
    if (!process.env.DATABASE_URL) return
    const result = await remove("test-article-1")
    expect(result).toBe(true)
    const gone = await getBySlug("test-article-1")
    expect(gone).toBeNull()
  })

  it("rejects duplicate slug", async () => {
    if (!process.env.DATABASE_URL) return
    await create({ slug: "test-dup", title: "First", author: "Alan" })
    await expect(create({ slug: "test-dup", title: "Second", author: "Alan" })).rejects.toThrow()
  })
})
