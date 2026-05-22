import { Router } from "express"
import { Pool } from "pg"
import { createArticleQueries } from "../lib/article-queries.js"

const router = Router()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const { list, getBySlug } = createArticleQueries(pool)

// 公开：已发布文章列表
router.get("/", async (_req, res) => {
  try {
    const data = await list()
    res.json({ ok: true, data })
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message })
  }
})

// 公开：单篇文章
router.get("/:slug", async (req, res) => {
  try {
    const article = await getBySlug(req.params.slug)
    if (!article) { res.status(404).json({ ok: false, error: "文章不存在" }); return }
    res.json({ ok: true, data: article })
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message })
  }
})

export default router
