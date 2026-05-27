import { Pool } from "pg"
import fs from "fs"
import path from "path"

async function migrate() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error("DATABASE_URL 未设置")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

  try {
    const sql = fs.readFileSync(
      path.resolve(import.meta.dirname, "001-agent-schema.sql"),
      "utf-8"
    )

    console.log("[migrate] 执行 001-agent-schema.sql ...")
    await pool.query(sql)
    console.log("[migrate] Migration 完成")

    // 验证
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'agent' ORDER BY table_name
    `)
    console.log("[migrate] agent schema 表:", tables.rows.map(r => r.table_name).join(", "))
  } catch (err) {
    console.error("[migrate] 失败:", err instanceof Error ? err.message : err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
