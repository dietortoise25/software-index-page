import { BaseCallbackHandler } from "@langchain/core/callbacks/base"
import type { Serialized } from "@langchain/core/load/serializable"

export class AgentLogHandler extends BaseCallbackHandler {
  name = "AgentLogHandler"
  lastTokenUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } = {}

  async handleLLMStart(_llm: Serialized, prompts: string[], _runId: string) {
    const totalLen = prompts.reduce((sum, p) => sum + p.length, 0)
    console.log(`[LLM] → ${_llm.name || "model"} 开始，prompt 总长: ${totalLen}`)
  }

  async handleLLMEnd(output: { llmOutput?: { tokenUsage?: Record<string, unknown> } }, _runId: string) {
    const usage = output.llmOutput?.tokenUsage as Record<string, number> | undefined
    if (usage) {
      this.lastTokenUsage = {
        promptTokens: usage.promptTokens as number,
        completionTokens: usage.completionTokens as number,
        totalTokens: usage.totalTokens as number,
      }
      console.log(`[LLM] ← 完成，tokens:`, usage)
    } else {
      console.log(`[LLM] ← 完成`)
    }
  }

  async handleLLMError(err: Error, _runId: string) {
    console.error(`[LLM] ✗ 错误: ${err.message}`)
  }

  async handleToolStart(tool: Serialized, input: string, _runId: string) {
    const preview = input.length > 200 ? input.slice(0, 200) + "..." : input
    console.log(`[TOOL] → ${tool.name}(${preview})`)
  }

  async handleToolEnd(output: string, _runId: string) {
    const preview = output.length > 200 ? output.slice(0, 200) + "..." : output
    console.log(`[TOOL] ← ${preview}`)
  }

  async handleToolError(err: Error, _runId: string) {
    console.error(`[TOOL] ✗ ${err.message}`)
  }

  async handleChainError(err: Error, _runId: string) {
    console.error(`[CHAIN] ✗ ${err.message}`)
  }
}
