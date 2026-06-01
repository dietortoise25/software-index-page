import { HumanMessage, SystemMessage } from "@langchain/core/messages"
import { z } from "zod"
import { jsonrepair } from "jsonrepair"
import { getModel } from "../config/model.js"
import { getNewsConfig, type NewsConfig, type NewsSourceOptions } from "../db/queries/news-config.js"

function robustJsonParse(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/)
  let str = match ? match[0] : raw
  try { return JSON.parse(str) } catch {}
  try { return JSON.parse(jsonrepair(str)) } catch {}
  const noFence = str.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "")
  try { return JSON.parse(jsonrepair(noFence)) } catch {}
  throw new Error(`JSON 解析失败，原始内容前200字: ${raw.slice(0, 200)}`)
}

import { createRun, finishRun, updateRun, getLatestRunning } from "../db/queries/news-digest-runs.js"
import { searchNews } from "./tavily.js"
import { getTenantToken, sendFeishuCard } from "./feishu.js"
import { searchJina, readUrl, type SearchResult } from "./jina.js"
import pLimit from "p-limit"

export type StageEvent =
  | { status: "starting" }
  | { status: "generating_topics" }
  | { status: "topics_ready"; topics: string[]; keywords: string[]; thinking: string }
  | { status: "searching"; query: string; source: string }
  | { status: "reading"; source: string; current: number; total: number }
  | { status: "reading_done"; source: string; count: number }
  | { status: "source_error"; source: string; error: string }
  | { status: "search_done"; resultCount: number }
  | { status: "summarizing"; progress: string }
  | { status: "summarize_done"; thinking: string }
  | { status: "building_card" }
  | { status: "sending"; target: string }
  | { status: "done"; cardJson: unknown; msgId?: string; duration: number }
  | { status: "error"; stage: string; error: string }

function makeCardSchema(cardCount: number) {
  return z.object({
    title: z.string().describe("卡片标题"),
    summary: z.string().describe("一句话总体摘要"),
    items: z.array(z.object({
      title: z.string().describe("中文新闻标题"),
      digest: z.string().describe("100字以内中文摘要"),
      url: z.string().url().describe("原文链接"),
      source: z.string().describe("新闻来源"),
      topic: z.string().describe("所属主题标签"),
      reason: z.string().describe("推荐理由，30字以内"),
    })).min(1).max(cardCount).describe(`最重要的新闻，最多${cardCount}条`),
    tags: z.array(z.string()).describe("相关标签"),
  })
}

interface CardData {
  title: string; summary: string
  items: Array<{ title: string; digest: string; url: string; source: string; topic: string; reason: string }>
  tags: string[]
}

function buildFeishuCard(args: CardData) {
  const itemsMd = args.items.map((item, i) =>
    `**${i + 1}. ${item.title}** 🏷${item.topic}\n${item.digest}\n💡 推荐理由：${item.reason}\n[阅读原文](${item.url}) — ${item.source}`,
  ).join("\n\n---\n\n")

  return {
    header: { title: { content: args.title, tag: "plain_text" }, template: "blue" },
    elements: [
      { tag: "div", text: { content: args.summary, tag: "lark_md" } },
      { tag: "hr" },
      { tag: "div", text: { content: itemsMd, tag: "lark_md" } },
      { tag: "hr" },
      { tag: "note", elements: [{ tag: "plain_text", content: args.tags.join(" · ") }] },
    ],
  }
}

export async function runNewsDigest(
  triggerType: "manual" | "cron",
  onStage: (event: StageEvent) => void,
  goal?: string,
  overrideConfig?: NewsConfig,
): Promise<void> {
  const startedAt = Date.now()
  let runId: string | undefined

  try {
    const config = overrideConfig || await getNewsConfig()

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
      const thinkingText = topicContent.slice(0, 500)
      try {
        const generated = robustJsonParse(topicContent) as { topics?: string[]; keywords?: string[] }
        if (generated.topics?.length) config.topics = generated.topics
        if (generated.keywords?.length) config.keywords = generated.keywords
      } catch { /* 解析失败，用已有配置 */ }
      onStage({ status: "topics_ready", topics: config.topics, keywords: config.keywords, thinking: thinkingText })
    }

    const searchTopics = config.topics.length > 0 ? config.topics : ["AI"]
    const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })

    // Step 1: 每个主题 × 每个源并行搜索
    const allResults: Map<string, SearchResult> = new Map()
    const sources = config.sources?.length ? config.sources : ["tavily"]

    async function searchBySource(source: string, query: string): Promise<SearchResult[]> {
      const opts: NewsSourceOptions = config.source_options?.[source] || { search_count: config.search_count }
      const sc = opts.search_count || config.search_count
      onStage({ status: "searching", query: `[${source}] ${query}`, source })

      try {
        switch (source) {
          case "tavily":
            return await searchNews(query, { maxResults: sc, days: 1 })
          case "jina_search":
            return await searchJina(query, sc, { gl: opts.gl, hl: opts.hl })
          case "jina_deep": {
            const searchResults = await searchJina(query, sc, { gl: opts.gl, hl: opts.hl })
            if (searchResults.length === 0) return []
            const readMax = (opts.read_count && opts.read_count < searchResults.length)
              ? opts.read_count : Math.min(searchResults.length, 5)
            const toRead = searchResults.slice(0, readMax)
            const limit = pLimit(5)
            let readDone = 0
            onStage({ status: "reading", source: "jina_deep", current: 0, total: toRead.length })
            const full = await Promise.allSettled(toRead.map(r =>
              limit(async () => {
                const result = await readUrl(r.url)
                readDone++
                onStage({ status: "reading", source: "jina_deep", current: readDone, total: toRead.length })
                return result
              })
            ))
            onStage({ status: "reading_done", source: "jina_deep", count: readDone })
            const merged: SearchResult[] = []
            for (let i = 0; i < full.length; i++) {
              const s = full[i]
              if (s.status === "fulfilled" && s.value) merged.push(s.value)
            }
            return merged
          }
          default:
            return []
        }
      } catch (e) {
        onStage({ status: "source_error", source, error: e instanceof Error ? e.message : String(e) })
        return []
      }
    }

    for (const topic of searchTopics) {
      const query = [topic, ...config.keywords].join(" ")
      const settled = await Promise.allSettled(sources.map(src => searchBySource(src, query)))
      for (const s of settled) {
        if (s.status === "fulfilled") {
          for (const r of s.value) {
            if (!allResults.has(r.url)) allResults.set(r.url, r)
          }
        }
      }
    }

    const rawResults = Array.from(allResults.values())
    onStage({ status: "search_done", resultCount: rawResults.length })
    await updateRun(runId, { search_query: searchTopics.join(", "), result_count: rawResults.length })

    if (rawResults.length === 0) {
      onStage({ status: "error", stage: "searching", error: "未找到相关新闻" })
      await finishRun(runId, "failed", { error: "未找到相关新闻", result_count: 0 })
      return
    }

    const newsText = rawResults.map((r, i) =>
      `${i + 1}. ${r.title}\n   URL: ${r.url}\n   内容: ${r.content?.slice(0, 300) || "无内容"}`
    ).join("\n\n")

    // Step 2: LLM 生成摘要 JSON，解析+校验，失败重试
    onStage({ status: "summarizing", progress: `处理 ${rawResults.length} 条结果` })

    const topicTagList = searchTopics.map(t => `"${t}"`).join(", ")

    const model = getModel({ temperature: 0.3 })
    const response = await model.invoke([
      new SystemMessage(`你是新闻摘要助手。从搜索结果中挑选最重要的新闻（最多${config.card_count}条），输出JSON格式的新闻卡片。
注意：所有内容必须翻译成中文，包括标题、摘要、标签。

每条新闻必须填写：
- source: 新闻的真实来源（如 Reuters、BBC、36氪、TechCrunch 等），不是搜索引擎名
- topic: 该新闻属于哪个主题标签（从以下选择最匹配的：${topicTagList}）
- reason: 推荐理由，30字以内，解释为什么这条新闻对读者有价值

输出格式（严格遵守，只输出JSON，不要其他文字）：
{
  "title": "资讯早报 | ${today}",
  "summary": "一句话总体摘要",
  "items": [
    {"title": "中文新闻标题", "digest": "100字以内中文摘要", "url": "原文URL", "source": "新闻来源名称", "topic": "${searchTopics[0] || "AI"}", "reason": "推荐理由"}
  ],
  "tags": [${topicTagList}]
}`),
      new HumanMessage(`新闻搜索结果（按主题分列）：\n\n${newsText}`),
    ])

    let content = (response.content as string) || ""

    // 解析 + 校验 + 重试（最多2次）
    let cardData: CardData | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const parsed = robustJsonParse(content) as Record<string, unknown>
        if (!Array.isArray(parsed.items) || parsed.items.length === 0) throw new Error("缺少 items 字段或为空")
        if (!Array.isArray(parsed.tags) || parsed.tags.length === 0) throw new Error("缺少 tags 字段或为空")
        cardData = parsed as unknown as CardData
        break
      } catch (e) {
        if (attempt === 1) {
          const errMsg = e instanceof Error ? e.message : String(e)
          onStage({ status: "error", stage: "summarizing", error: errMsg })
          await finishRun(runId, "failed", { error: errMsg, result_count: rawResults.length })
          return
        }
        const retryModel = getModel({ temperature: 0.1 })
        const retryResponse = await retryModel.invoke([
          new SystemMessage(`你之前的输出格式有误，请修正后重新输出（只输出完整JSON，必须包含 items 和 tags 数组字段）。`),
          new HumanMessage(`错误：${(e as Error).message}\n\n之前输出：${content.slice(0, 2000)}\n\n修正后重新输出完整JSON。`),
        ])
        content = (retryResponse.content as string) || ""
      }
    }

    if (!cardData) return

    onStage({ status: "summarize_done", thinking: content.slice(0, 800) })

    // Step 3: 组装并发送飞书卡片
    onStage({ status: "building_card" })
    const card = buildFeishuCard(cardData)

    onStage({ status: "sending", target: `${config.receive_type}:${config.receive_id || "未配置"}` })

    if (!config.receive_id) {
      onStage({ status: "done", cardJson: cardData, duration: (Date.now() - startedAt) / 1000 })
      await finishRun(runId, "success", { summary: cardData, result_count: rawResults.length, card_json: cardData,
        feishu_response: "未配置飞书接收者" as unknown as Record<string, unknown> })
      return
    }

    const token = await getTenantToken()
    const feishuResult = await sendFeishuCard(token, config.receive_id, card, config.receive_type)

    if (feishuResult.code === 0) {
      onStage({ status: "done", cardJson: cardData, msgId: (feishuResult as { data?: { message_id?: string } }).data?.message_id,
        duration: (Date.now() - startedAt) / 1000 })
      await finishRun(runId, "success", { summary: cardData, result_count: rawResults.length, card_json: cardData,
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
