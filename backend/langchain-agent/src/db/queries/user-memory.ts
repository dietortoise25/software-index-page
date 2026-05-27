import { query } from "../client.js"

export interface UserMemoryRow {
  id: string
  user_id: string
  memory_key: string
  memory_value: Record<string, unknown>
  updated_at: string
}

export async function getUserMemories(userId: string): Promise<UserMemoryRow[]> {
  const result = await query(
    `SELECT * FROM agent.user_memory WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId]
  )
  return result.rows as UserMemoryRow[]
}

export async function upsertUserMemory(
  userId: string,
  memoryKey: string,
  memoryValue: Record<string, unknown>
): Promise<UserMemoryRow> {
  const result = await query(
    `INSERT INTO agent.user_memory (user_id, memory_key, memory_value, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, memory_key)
     DO UPDATE SET memory_value = $3, updated_at = NOW()
     RETURNING *`,
    [userId, memoryKey, JSON.stringify(memoryValue)]
  )
  return result.rows[0] as UserMemoryRow
}

export async function deleteUserMemory(userId: string, memoryKey: string): Promise<void> {
  await query(
    `DELETE FROM agent.user_memory WHERE user_id = $1 AND memory_key = $2`,
    [userId, memoryKey]
  )
}
