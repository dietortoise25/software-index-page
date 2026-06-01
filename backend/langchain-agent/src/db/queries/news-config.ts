import { getSb } from "../pool.js"

export interface NewsSourceOptions {
  search_count: number
  read_count?: number
  gl?: string
  hl?: string
}

export interface NewsConfig {
  topics: string[]
  keywords: string[]
  cron: string
  receive_id: string
  receive_type: "open_id" | "chat_id"
  language: string
  search_count: number
  card_count: number
  mode: "manual" | "ai"
  goal: string
  enabled: boolean
  sources: string[]
  source_options?: Partial<Record<string, NewsSourceOptions>>
}

const defaults: NewsConfig = {
  topics: ["AI", "LLM", "AI Agent"],
  keywords: ["大模型", "智能体"],
  cron: "0 9 * * *",
  receive_id: process.env.FEISHU_ADMIN_OPEN_ID || "",
  receive_type: "open_id",
  language: "zh",
  search_count: 10,
  card_count: 5,
  mode: "ai",
  goal: "",
  enabled: true,
  sources: ["tavily"],
}

export async function getNewsConfig(): Promise<NewsConfig> {
  const sb = getSb()
  const { data, error } = await sb.schema("agent").from("news_config").select("key, value")
  if (error || !data) return { ...defaults }

  const config = { ...defaults }
  for (const row of data) {
    const key = row.key as string
    const val = (row as { key: string; value: unknown }).value
    if (key in defaults && val !== null && val !== undefined) {
      ;(config as Record<string, unknown>)[key] = val
    }
  }
  return config
}

export async function setNewsConfig(key: string, value: unknown): Promise<void> {
  const sb = getSb()
  const { error } = await sb.schema("agent").from("news_config").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  )
  if (error) throw error
}

export async function setAllNewsConfig(config: Partial<NewsConfig>): Promise<void> {
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) await setNewsConfig(key, value)
  }
}
