import { betterAuth } from "better-auth"
import { Pool } from "pg"

const baseURL = process.env.AUTH_BASE_URL || "http://localhost:8765"

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : undefined

export const auth = betterAuth({
  baseURL,
  database: pool,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
})

async function seedAdmin() {
  if (!pool) {
    console.log("[auth] 无 DATABASE_URL，使用内存存储")
    return
  }

  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) {
    console.log("[auth] 未配置 ADMIN_EMAIL/ADMIN_PASSWORD，跳过种子")
    return
  }

  try {
    await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: "Admin",
      },
      headers: new Headers({ "content-type": "application/json" }),
    } as Parameters<typeof auth.api.signUpEmail>[0])
    console.log("[auth] Admin 用户已创建")
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      console.log("[auth] Admin 用户已存在")
    } else {
      console.warn(`[auth] 种子 Admin 失败: ${msg}`)
    }
  }
}

seedAdmin()
