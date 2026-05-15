import { createClient, SupabaseClient } from "@supabase/supabase-js"
import ws from "ws"

if (!(globalThis as Record<string, unknown>).WebSocket) {
  (globalThis as Record<string, unknown>).WebSocket = ws
}

let supabase: SupabaseClient | null = null

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export function initSupabase({ url, anonKey }: SupabaseConfig): SupabaseClient {
  supabase = createClient(url, anonKey)
  return supabase
}

export function getSupabase(): SupabaseClient {
  if (!supabase) throw new Error("Supabase 未初始化，请先调用 initSupabase()")
  return supabase
}

export async function upsertRecord(table: string, record: Record<string, unknown>, conflictKey?: string): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from(table).upsert(record, { onConflict: conflictKey })
  if (error) throw new Error(`[${table}] upsert 失败: ${error.message}`)
}

export async function upsertBatch(table: string, records: Record<string, unknown>[], conflictKey?: string): Promise<number> {
  if (!records.length) return 0
  const sb = getSupabase()
  const { error, count } = await sb
    .from(table)
    .upsert(records, { onConflict: conflictKey, ignoreDuplicates: false })
  if (error) throw new Error(`[${table}] 批量 upsert 失败: ${error.message}`)
  return count ?? records.length
}

export async function getLastSyncAt(module: string): Promise<string | null> {
  const sb = getSupabase()
  const { data } = await sb
    .from("sync_logs")
    .select("finished_at")
    .eq("module", module)
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1)
  return (data?.[0]?.finished_at as string) || null
}

export async function logSync(
  module: string,
  source: string,
  status: string,
  count: number,
  errorMsg: string | null = null,
): Promise<void> {
  const sb = getSupabase()
  await sb.from("sync_logs").insert({
    module,
    source,
    status,
    records_count: count,
    error_message: errorMsg,
    started_at: new Date().toISOString(),
    finished_at: status !== "running" ? new Date().toISOString() : null,
  })
}
