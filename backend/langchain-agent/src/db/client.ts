import { Pool } from "pg"

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : undefined

export function getPool(): Pool {
  if (!pool) {
    throw new Error("DATABASE_URL 未配置，数据库不可用")
  }
  return pool
}

export async function query(text: string, params?: unknown[]) {
  return getPool().query(text, params)
}
