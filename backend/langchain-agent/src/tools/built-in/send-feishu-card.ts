import { z } from "zod"
import { registerTool } from "../registry.js"
import { getTenantToken, sendFeishuCard } from "../../lib/feishu.js"
import { getNewsConfig } from "../../db/queries/news-config.js"

const cardItemSchema = z.object({
  title: z.string().describe("新闻标题"),
  digest: z.string().describe("100字以内的新闻摘要"),
  url: z.string().url().describe("原文链接"),
  source: z.string().describe("新闻来源，如 Tavily、TechCrunch"),
})

const schema = z.object({
  title: z.string().describe("卡片标题，格式如「AI 早报 | 5月29日」"),
  summary: z.string().describe("一句话总体摘要，显示在卡片头部"),
  items: z.array(cardItemSchema).min(1).max(10).describe("新闻条目列表，1-10条"),
  tags: z.array(z.string()).describe("相关标签，如 ['AI', 'LLM']"),
})

function buildCard(args: z.infer<typeof schema>) {
  const itemsMd = args.items.map((item, i) =>
    `**${i + 1}. ${item.title}**\n${item.digest}\n[阅读原文](${item.url}) — ${item.source}`,
  ).join("\n\n---\n\n")

  return {
    header: {
      title: { content: args.title, tag: "plain_text" },
      template: "blue",
    },
    elements: [
      { tag: "div", text: { content: args.summary, tag: "lark_md" } },
      { tag: "hr" },
      { tag: "div", text: { content: itemsMd, tag: "lark_md" } },
      { tag: "hr" },
      {
        tag: "note",
        elements: [{ tag: "plain_text", content: args.tags.join(" · ") + " | Tavily 搜索" }],
      },
    ],
  }
}

registerTool({
  name: "send_feishu_card",
  description: "发送格式化的新闻摘要卡片到飞书群或私聊。调用前确保已完成新闻搜索和摘要。",
  schema,
  func: async (args: z.infer<typeof schema>) => {
    const config = await getNewsConfig()
    const receiveId = config.receive_id
    const receiveType = config.receive_type

    if (!receiveId) return "未配置飞书接收者，请在配置页面设置 receive_id"

    const token = await getTenantToken()
    const card = buildCard(args)
    const result = await sendFeishuCard(token, receiveId, card, receiveType)

    if (result.code === 0) {
      return `飞书卡片发送成功，消息 ID: ${(result as { data?: { message_id?: string } }).data?.message_id || "unknown"}`
    }
    return `飞书卡片发送失败: ${result.msg || "未知错误"}`
  },
})
