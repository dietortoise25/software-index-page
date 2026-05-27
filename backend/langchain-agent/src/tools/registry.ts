import { z } from "zod"

export type DangerLevel = "read" | "write"

export interface ToolConfig {
  name: string
  description: string
  schema: z.ZodType
  dangerLevel?: DangerLevel
  rateLimit?: { maxCalls: number; window: number }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  func: (args: any) => Promise<string>
}

export interface RegisteredTool {
  name: string
  description: string
  schema: z.ZodType
  dangerLevel: DangerLevel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  func: (args: any) => Promise<string>
}

const toolRegistry = new Map<string, RegisteredTool>()

export function registerTool(tool: ToolConfig): void {
  if (toolRegistry.has(tool.name)) {
    throw new Error(`工具 "${tool.name}" 已注册`)
  }

  toolRegistry.set(tool.name, {
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    dangerLevel: tool.dangerLevel || "read",
    func: tool.func,
  })

  console.log(`[agent] 工具已注册: ${tool.name} (${tool.dangerLevel || "read"})`)
}

export function getTool(name: string): RegisteredTool | undefined {
  return toolRegistry.get(name)
}

export function listTools(): RegisteredTool[] {
  return Array.from(toolRegistry.values())
}
