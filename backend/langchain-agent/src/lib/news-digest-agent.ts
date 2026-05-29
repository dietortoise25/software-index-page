import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { z } from "zod"
import { getModel } from "../config/model.js"
import { getNewsConfig } from "../db/queries/news-config.js"
import { createRun, finishRun, updateRun, getLatestRunning } from "../db/queries/news-digest-runs.js"
import { searchNews } from "./tavily.js"
import { getTenantToken, sendFeishuCard } from "./feishu.js"

export type StageEvent =
  | { status: "starting" }
  | { status: "generating_topics" }
  | { status: "topics_ready"; topics: string[]; keywords: string[] }
  | { status: "searching"; query: string }
  | { status: "search_done"; resultCount: number }
  | { status: "summarizing"; progress: string }
  | { status: "summarize_done" }
  | { status: "building_card" }
  | { status: "sending"; target: string }
  | { status: "done"; cardJson: unknown; msgId?: string; duration: number }
  | { status: "error"; stage: string; error: string }

const cardSchema = z.object({
  title: z.string().describe("卡片标题"),
  summary: z.string().describe("一句话总体摘要"),
  items: z.array(z.object({
    title: z.string().describe("新闻标题"),
    digest: z.string().describe("100字以内的新闻摘要"),
    url: z.string().url().describe("原文链接"),
    source: z.string().describe("新闻来源"),
  })).min(3).max(5).describe("3-5条最重要的新闻"),
  tags: z.array(z.string()).describe("相关标签"),
})

function buildFeishuCard(args: z.infer<typeof cardSchema>) {
  const itemsMd = args.items.map((item, i) =>
    `**${i + 1}. ${item.title}**\n${item.digest}\n[阅读原文](${item.url}) — ${item.source}`,
  ).join("\n\n---\n\n")

  return {
    header: { title: { content: args.title, tag: "plain_text" }, template: "blue" },
    elements: [
      { tag: "div", text: { content: args.summary, tag: "lark_md" } },
      { tag: "hr" },
      { tag: "div", text: { content: itemsMd, tag: "lark_md" } },
      { tag: "hr" },
      { tag: "note", elements: [{ tag: "plain_text", content: args.tags.join(" · ") + " | Tavily 搜索" }] },
    ],
  }
}

export async function runNewsDigest(
  triggerType: "manual" | "cron",
  onStage: (event: StageEvent) => void,
  goal?: string,
): Promise<void> {
  const startedAt = Date.now()
  let runId: string | undefined

  try {
    const config = await getNewsConfig()

    const existing = await getLatestRunning()
    if (existing) {
      onStage({ status: "error", stage: "starting", error: "上一次流水线尚未完成" })
      return
    }

    const run = await createRun(triggerType)
    runId = run.id
    onStage({ status: "starting" })

    // Step 0 (AI 模式): LLM 生成搜索主题
    if (goal && goal.trim()) {
      onStage({ status: "generating_topics" })

      const topicModel = getModel({ temperature: 0.5 })
      const topicResponse = await topicModel.invoke([
        new SystemMessage(`根据用户目标生成新闻搜索策略。输出JSON格式（只输出JSON，不要其他文字）：
{
  "topics": ["主题1", "主题2", "主题3"],
  "keywords": ["关键词1", "关键词2"]
}
最多5个主题、5个关键词。主题和关键词都必须是中文。`),
        new HumanMessage(`用户目标：${goal.trim()}`),
      ])

      const topicContent = (topicResponse.content as string) || ""
      const topicMatch = topicContent.match(/\{[\s\S]*\}/)
      if (topicMatch) {
        try {
          const generated = JSON.parse(topicMatch[0]) as { topics?: string[]; keywords?: string[] }
          if (generated.topics?.length) config.topics = generated.topics
          if (generated.keywords?.length) config.keywords = generated.keywords
          onStage({ status: "topics_ready", topics: config.topics, keywords: config.keywords })
        } catch {
          // JSON 解析失败，继续用手动配置的主题
          onStage({ status: "topics_ready", topics: config.topics, keywords: config.keywords })
        }
      } else {
        onStage({ status: "topics_ready", topics: config.topics, keywords: config.keywords })
      }
    }

    const searchKeywords = [...config.topics, ...config.keywords].join(" ")
    const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })

    // Step 1: 搜索新闻
    onStage({ status: "searching", query: searchKeywords })
    await updateRun(runId, { search_query: searchKeywords })

    const rawResults = await searchNews(searchKeywords, { maxResults: config.max_results, days: 1 })
    onStage({ status: "search_done", resultCount: rawResults.length })

    if (rawResults.length === 0) {
      onStage({ status: "error", stage: "searching", error: "未找到相关新闻" })
      await finishRun(runId, "failed", { error: "未找到相关新闻", result_count: 0 })
      return
    }

    const newsText = rawResults.map((r, i) =>
      `${i + 1}. ${r.title}\n   URL: ${r.url}\n   内容: ${r.content?.slice(0, 300) || "无内容"}`
    ).join("\n\n")

    // Step 2: LLM 生成摘要 JSON
    onStage({ status: "summarizing", progress: `处理 ${rawResults.length} 条结果` })

    const model = getModel({ temperature: 0.3 })
    const response = await model.invoke([
      new SystemMessage(`你是新闻摘要助手。从搜索结果中挑选3-5条最重要的新闻，输出JSON格式的新闻卡片。
注意：所有内容必须翻译成中文，包括标题、摘要、标签。

输出格式（严格遵守，只输出JSON，不要其他文字）：
{
  "title": "资讯早报 | ${today}",
  "summary": "一句话总体摘要",
  "items": [
    {"title": "中文新闻标题", "digest": "100字以内中文摘要", "url": "原文URL", "source": "Tavily"}
  ],
  "tags": [${config.topics.map(t => `"${t}"`).join(", ")}]
}`),
      new HumanMessage(`新闻搜索结果：\n\n${newsText}`),
    ])

    const content = (response.content as string) || ""
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      onStage({ status: "error", stage: "summarizing", error: "LLM 返回格式异常" })
      await finishRun(runId, "failed", { error: "LLM 返回非JSON格式", result_count: rawResults.length })
      return
    }

    const result = JSON.parse(jsonMatch[0]) as z.infer<typeof cardSchema>
    onStage({ status: "summarize_done" })

    // Step 3: 组装并发送飞书卡片
    onStage({ status: "building_card" })
    const card = buildFeishuCard(result)

    onStage({ status: "sending", target: `${config.receive_type}:${config.receive_id || "未配置"}` })

    if (!config.receive_id) {
      onStage({ status: "done", cardJson: result, duration: (Date.now() - startedAt) / 1000 })
      await finishRun(runId, "success", { summary: result, result_count: rawResults.length, card_json: result,
        feishu_response: "未配置飞书接收者" as unknown as Record<string, unknown> })
      return
    }

    const token = await getTenantToken()
    const feishuResult = await sendFeishuCard(token, config.receive_id, card, config.receive_type)

    if (feishuResult.code === 0) {
      onStage({ status: "done", cardJson: result, msgId: (feishuResult as { data?: { message_id?: string } }).data?.message_id,
        duration: (Date.now() - startedAt) / 1000 })
      await finishRun(runId, "success", { summary: result, result_count: rawResults.length, card_json: result,
        feishu_response: feishuResult as unknown as Record<string, unknown> })
    } else {
      onStage({ status: "error", stage: "sending", error: `飞书返回: code=${feishuResult.code} msg=${feishuResult.msg || ""}` })
      await finishRun(runId, "failed", { error: `飞书 API code=${feishuResult.code}`, result_count: rawResults.length })
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error("[news-digest] 错误:", errMsg)
    onStage({ status: "error", stage: "agent", error: errMsg })
    if (runId) await finishRun(runId, "failed", { error: errMsg })
  }
}
