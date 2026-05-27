import { betterAuth } from "better-auth"
import { Pool } from "pg"

const baseURL = process.env.AUTH_BASE_URL || "http://localhost:8765"

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : undefined

export const auth = betterAuth({
  baseURL,
  database: pool,
  advanced: { disableCSRFCheck: true },
})
