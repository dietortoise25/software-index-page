import { z } from "zod"
import { registerTool } from "../registry.js"

const schema = z.object({
  timezone: z.string().optional().describe("时区，默认 Asia/Shanghai"),
})

registerTool({
  name: "get_current_time",
  description: "获取当前日期和时间，返回 ISO 格式的时间字符串",
  schema,
  func: async (args: z.infer<typeof schema>) => {
    const now = new Date()
    return `当前时间（${args.timezone || "Asia/Shanghai"}）: ${now.toISOString()}`
  },
})
