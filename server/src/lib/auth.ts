import { betterAuth } from "better-auth"
import { getMigrations } from "better-auth/db/migration"
import { username } from "better-auth/plugins"
import { Pool } from "pg"

const baseURL = process.env.AUTH_BASE_URL || "http://localhost:8765"

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : undefined

export const auth = betterAuth({
  baseURL,
  database: pool,
  emailAndPassword: { enabled: true },
  plugins: [username()],
  advanced: {
    disableCSRFCheck: true,
  },
  session: {
    additionalFields: {
      role: {
        type: "string" as const,
        required: false,
        defaultValue: "user",
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string" as const,
        required: false,
        defaultValue: "user",
      },
      username: {
        type: "string" as const,
        required: false,
      },
    },
  },
})

async function migrateAndSeed() {
  if (!pool) {
    console.log("[auth] 无 DATABASE_URL，使用内存存储")
    return
  }

  try {
    const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options)
    const total = toBeCreated.length + toBeAdded.length
    if (total > 0) {
      console.log(`[auth] 建表迁移: ${total} 项`)
      await runMigrations()
      console.log("[auth] 迁移完成")
    }
  } catch (e) {
    console.warn("[auth] 迁移失败:", (e as Error).message)
  }

  // 创建 page_access 表（如果不存在）
  if (pool) {
    try {
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
    } catch { /* 忽略 */ }
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@leverage.works"
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    console.log("[auth] 未配置 ADMIN_PASSWORD，跳过种子")
    return
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: "Admin",
        username: "admin",
      },
      headers: new Headers({ "content-type": "application/json" }),
    } as Parameters<typeof auth.api.signUpEmail>[0])
    console.log("[auth] Admin 用户已创建")
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("unique")) {
      console.log("[auth] Admin 用户已存在")
    } else {
      console.warn(`[auth] 种子 Admin 失败: ${msg}`)
    }
  }

  // 确保 admin 账号有 admin 角色
  if (pool) {
    try {
      await pool.query(`UPDATE "user" SET role = 'admin' WHERE email = $1`, [adminEmail])
    } catch { /* role 列可能还不存在 */ }
  }
}

setTimeout(migrateAndSeed, 500)
