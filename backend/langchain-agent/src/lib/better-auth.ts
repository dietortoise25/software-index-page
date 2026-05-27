import { betterAuth } from "better-auth"
import { username } from "better-auth/plugins"
import { Pool } from "pg"

const baseURL = process.env.AUTH_BASE_URL || "http://localhost:8765"
const isDev = process.env.AGENT_DEV_MODE === "true"

const pool = !isDev && process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : undefined

export const auth = betterAuth({
  baseURL,
  database: pool,
  emailAndPassword: { enabled: true },
  plugins: [username()],
  advanced: { disableCSRFCheck: true },
})

if (isDev && !pool) {
  console.log("[agent] Dev 模式：使用内存存储（无 DATABASE_URL）")
}
