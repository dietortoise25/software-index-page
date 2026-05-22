import type { Pool } from "pg"

interface ArticleInput {
  slug: string
  title: string
  summary?: string
  content?: string
  cover_image?: string
  author?: string
  tags?: string[]
  status?: string
}

interface ArticleUpdate {
  title?: string
  summary?: string
  content?: string
  cover_image?: string
  author?: string
  tags?: string[]
  status?: string
}

export function createArticleQueries(pool: Pool) {
  return {
    async create(input: ArticleInput) {
      const result = await pool.query(
        `INSERT INTO articles (slug, title, summary, content, cover_image, author, tags, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          input.slug, input.title, input.summary || "", input.content || "",
          input.cover_image || null, input.author || "", input.tags || [],
          input.status || "draft",
        ]
      )
      return result.rows[0]
    },

    async getBySlug(slug: string) {
      const result = await pool.query("SELECT * FROM articles WHERE slug = $1", [slug])
      return result.rows[0] || null
    },

    async list() {
      const result = await pool.query(
        `SELECT * FROM articles WHERE status = 'published' ORDER BY created_at DESC`
      )
      return result.rows
    },

    async listAll() {
      const result = await pool.query(
        `SELECT * FROM articles ORDER BY created_at DESC`
      )
      return result.rows
    },

    async update(slug: string, input: ArticleUpdate) {
      const setClauses: string[] = []
      const values: any[] = []
      let i = 1

      for (const [key, val] of Object.entries(input)) {
        if (val !== undefined) {
          setClauses.push(`${key} = $${i}`)
          values.push(val)
          i++
        }
      }
      if (setClauses.length === 0) return null

      setClauses.push(`updated_at = NOW()`)
      values.push(slug)

      const result = await pool.query(
        `UPDATE articles SET ${setClauses.join(", ")} WHERE slug = $${i} RETURNING *`,
        values
      )
      return result.rows[0] || null
    },

    async remove(slug: string) {
      const result = await pool.query("DELETE FROM articles WHERE slug = $1", [slug])
      return (result.rowCount || 0) > 0
    },
  }
}
