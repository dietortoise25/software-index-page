import { BaseListChatMessageHistory } from "@langchain/core/chat_history"
import { HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage } from "@langchain/core/messages"
import { getMessages, addMessage as dbAddMessage, type MessageRow } from "../db/queries/conversations.js"

function dbRowToMessage(row: MessageRow): BaseMessage {
  const content = row.content
  switch (row.role) {
    case "user":
      return new HumanMessage(content)
    case "assistant":
      return new AIMessage(content)
    case "system":
      return new SystemMessage(content)
    case "tool":
      return new ToolMessage(content, "")
    default:
      return new HumanMessage(content)
  }
}

export class PostgresMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain-agent", "memory"]

  constructor(private conversationId: string) {
    super()
  }

  async getMessages(): Promise<BaseMessage[]> {
    const rows = await getMessages(this.conversationId)
    return rows.map(dbRowToMessage)
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const role = message._getType() as MessageRow["role"]
    await dbAddMessage(this.conversationId, role, message.content as string)
  }

  async clear(): Promise<void> {
    // messages are cascade-deleted with conversation, no separate clear needed for now
  }
}
