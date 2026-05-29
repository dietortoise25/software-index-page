import { z } from "zod"
import { registerTool } from "../registry.js"
import { searchNews } from "../../lib/tavily.js"

const schema = z.object({
  query: z.string().describe("搜索查询词"),
  maxResults: z.number().optional().describe("返回结果数量，默认10"),
  days: z.number().optional().describe("搜索最近N天的新闻，默认1"),
})

registerTool({
  name: "search_news",
  description: "搜索最新新闻。使用 Tavily 搜索引擎获取指定主题的最新新闻，支持按天数和结果数过滤。",
  schema,
  func: async (args: z.infer<typeof schema>) => {
    const results = await searchNews(args.query, {
      maxResults: args.maxResults ?? 10,
      days: args.days ?? 1,
    })
    if (results.length === 0) return "未找到相关新闻"
    return results.map((r, i) =>
      `${i + 1}. ${r.title}\n   URL: ${r.url}\n   摘要: ${r.content?.slice(0, 200)}`
    ).join("\n\n")
  },
})
