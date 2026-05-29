import { getSb } from "../pool.js"

export interface NewsDigestRun {
  id: string
  status: "pending" | "running" | "success" | "failed"
  trigger_type: "manual" | "cron"
  search_query?: string
  result_count?: number
  summary?: unknown
  card_json?: unknown
  feishu_response?: unknown
  error?: string
  started_at: string
  finished_at?: string
}

export async function createRun(triggerType: "manual" | "cron"): Promise<NewsDigestRun> {
  const sb = getSb()
  const { data, error } = await sb.schema("agent").from("news_digest_runs").insert({
    trigger_type: triggerType,
    status: "running",
    started_at: new Date().toISOString(),
  }).select("*").single()
  if (error) throw error
  return data as NewsDigestRun
}

export async function updateRun(id: string, updates: Partial<NewsDigestRun>): Promise<void> {
  const sb = getSb()
  await sb.schema("agent").from("news_digest_runs").update(updates).eq("id", id)
}

export async function finishRun(id: string, status: "success" | "failed", extra: Partial<NewsDigestRun> = {}): Promise<void> {
  await updateRun(id, { ...extra, status, finished_at: new Date().toISOString() })
}

export async function listRuns(limit = 20): Promise<NewsDigestRun[]> {
  const sb = getSb()
  const { data, error } = await sb.schema("agent").from("news_digest_runs")
    .select("*").order("started_at", { ascending: false }).limit(limit)
  if (error) return []
  return (data || []) as NewsDigestRun[]
}

export async function getRun(id: string): Promise<NewsDigestRun | null> {
  const sb = getSb()
  const { data, error } = await sb.schema("agent").from("news_digest_runs")
    .select("*").eq("id", id).single()
  if (error) return null
  return data as NewsDigestRun
}

export async function getLatestRunning(): Promise<NewsDigestRun | null> {
  const sb = getSb()
  const { data, error } = await sb.schema("agent").from("news_digest_runs")
    .select("*").eq("status", "running").order("started_at", { ascending: false }).limit(1)
  if (error || !data?.length) return null
  return data[0] as NewsDigestRun
}
