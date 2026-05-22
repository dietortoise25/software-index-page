import type { Pool } from "pg"

export function createUserQueries(pool: Pool) {
  return {
    async listUsers() {
      const result = await pool.query(
        `SELECT id, email, name, username, role, "createdAt", "updatedAt" FROM "user" ORDER BY "createdAt" DESC`
      )
      return result.rows
    },
    async updateRole(email: string, role: string) {
      const result = await pool.query(
        `UPDATE "user" SET role = $1 WHERE email = $2 RETURNING email, role`,
        [role, email]
      )
      return result.rows[0] || null
    },
  }
}
