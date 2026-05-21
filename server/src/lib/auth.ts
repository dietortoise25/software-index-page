import { betterAuth } from "better-auth"

const baseURL = process.env.AUTH_BASE_URL || "http://localhost:8765"

export const auth = betterAuth({
  baseURL,
  database: process.env.DATABASE_URL
    ? { provider: "postgresql", url: process.env.DATABASE_URL }
    : undefined,
  emailAndPassword: {
    enabled: true,
  },
})
