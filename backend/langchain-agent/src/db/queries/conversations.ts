import { query } from "../client.js"

export interface ConversationRow {
  id: string
  user_id: string
  title: string
  agent_type: string
  created_at: string
  updated_at: string
}

export interface MessageRow {
  id: string
  conversation_id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  tool_calls: unknown
  created_at: string
}

export async function createConversation(userId: string, title?: string, agentType = "default") {
  const result = await query(
    `INSERT INTO agent.conversations (user_id, title, agent_type) VALUES ($1, $2, $3) RETURNING *`,
    [userId, title || "新对话", agentType]
  )
  return result.rows[0] as ConversationRow
}

export async function listConversations(userId: string) {
  const result = await query(
    `SELECT * FROM agent.conversations WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId]
  )
  return result.rows as ConversationRow[]
}

export async function getConversation(conversationId: string, userId: string) {
  const result = await query(
    `SELECT * FROM agent.conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  )
  return (result.rows[0] as ConversationRow) || null
}

export async function deleteConversation(conversationId: string, userId: string) {
  await query(
    `DELETE FROM agent.conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  )
}

export async function getMessages(conversationId: string) {
  const result = await query(
    `SELECT * FROM agent.messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId]
  )
  return result.rows as MessageRow[]
}

export async function addMessage(
  conversationId: string,
  role: MessageRow["role"],
  content: string,
  toolCalls?: unknown
) {
  const result = await query(
    `INSERT INTO agent.messages (conversation_id, role, content, tool_calls) VALUES ($1, $2, $3, $4) RETURNING *`,
    [conversationId, role, content, toolCalls ? JSON.stringify(toolCalls) : null]
  )
  return result.rows[0] as MessageRow
}

export async function updateConversationTimestamp(conversationId: string) {
  await query(
    `UPDATE agent.conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId]
  )
}
