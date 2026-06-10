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

// 超过此时长仍为 running 的记录视为僵尸（进程重启/并发遗留）。
// 真实流水线耗时约 2-3 分钟，30 分钟给足冗余且远超正常上限。
export const STALE_RUN_MS = 30 * 60 * 1000

// 纯函数：判定一条 running 记录是否已成僵尸。用 > 而非 >=，避免边界误杀。
export function isRunStale(startedAt: string, now: number = Date.now()): boolean {
  return now - new Date(startedAt).getTime() > STALE_RUN_MS
}

// 仅返回「未陈旧」的 running 记录作为阻塞依据；僵尸记录不再永久挡住后续运行。
export async function getLatestRunning(): Promise<NewsDigestRun | null> {
  const sb = getSb()
  const { data, error } = await sb.schema("agent").from("news_digest_runs")
    .select("*").eq("status", "running").order("started_at", { ascending: false }).limit(1)
  if (error || !data?.length) return null
  const latest = data[0] as NewsDigestRun
  if (isRunStale(latest.started_at)) return null
  return latest
}

// 启动时清扫：把陈旧 running 记录标记为 failed，使每次部署重启自愈孤儿记录。
export async function failStaleRuns(): Promise<number> {
  const sb = getSb()
  const cutoff = new Date(Date.now() - STALE_RUN_MS).toISOString()
  const { data, error } = await sb.schema("agent").from("news_digest_runs")
    .update({ status: "failed", finished_at: new Date().toISOString(), error: "启动清扫：进程重启遗留的僵尸 running 记录" })
    .eq("status", "running").lt("started_at", cutoff).select("id")
  if (error) {
    console.error("[agent] 清扫僵尸 running 记录失败:", error.message)
    return 0
  }
  return data?.length ?? 0
}
