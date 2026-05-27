import { BaseMemory } from "@langchain/core/memory"
import { type InputValues, type OutputValues } from "@langchain/core/memory"
import { getUserMemories } from "../db/queries/user-memory.js"

export class PostgresUserMemory extends BaseMemory {
  private memories: Map<string, Record<string, unknown>> = new Map()
  private loaded = false

  constructor(private userId?: string) {
    super()
  }

  setUser(userId: string) {
    this.userId = userId
    this.loaded = false
  }

  private async ensureLoaded() {
    if (this.loaded || !this.userId) return
    const rows = await getUserMemories(this.userId)
    for (const row of rows) {
      this.memories.set(row.memory_key, row.memory_value)
    }
    this.loaded = true
  }

  get memoryKeys(): string[] {
    return ["user_memory_context"]
  }

  async loadMemoryVariables(_values: InputValues): Promise<Record<string, unknown>> {
    await this.ensureLoaded()
    if (this.memories.size === 0) {
      return { user_memory_context: "" }
    }

    const entries: string[] = []
    for (const [key, value] of this.memories) {
      entries.push(`- ${key}: ${JSON.stringify(value)}`)
    }

    return {
      user_memory_context: `[用户记忆]\n${entries.join("\n")}`,
    }
  }

  async saveContext(_inputValues: InputValues, _outputValues: OutputValues): Promise<void> {
    // 记忆的写入由 Agent 工具显式调用 upsertUserMemory
    // 此处不自动保存对话内容到用户记忆
  }
}
