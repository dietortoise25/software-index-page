import { getSb } from "../pool.js"
import type { NewsConfig } from "./news-config.js"

export interface NewsConfigRow {
  id: string
  user_id: string
  name: string
  config: NewsConfig
  created_at: string
  updated_at: string
}

export async function listConfigs(userId: string): Promise<NewsConfigRow[]> {
  const sb = getSb()
  const { data, error } = await sb.schema("agent").from("news_configs")
    .select("*").eq("user_id", userId).order("created_at", { ascending: true })
  if (error) return []
  return (data || []) as NewsConfigRow[]
}

export async function createConfig(userId: string, name: string, config: NewsConfig): Promise<NewsConfigRow> {
  const sb = getSb()
  const { count } = await sb.schema("agent").from("news_configs")
    .select("*", { count: "exact", head: true }).eq("user_id", userId)
  if (count && count >= 10) throw new Error("最多保存 10 条配置")

  const { data, error } = await sb.schema("agent").from("news_configs").insert({
    user_id: userId, name, config,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select("*").single()
  if (error) throw error
  return data as NewsConfigRow
}

export async function updateConfig(id: string, userId: string, updates: { name?: string; config?: NewsConfig }): Promise<NewsConfigRow> {
  const sb = getSb()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.name !== undefined) patch.name = updates.name
  if (updates.config !== undefined) patch.config = updates.config
  const { data, error } = await sb.schema("agent").from("news_configs").update(patch)
    .eq("id", id).eq("user_id", userId).select("*").single()
  if (error) throw error
  return data as NewsConfigRow
}

export async function deleteConfig(id: string, userId: string): Promise<void> {
  const sb = getSb()
  const { error } = await sb.schema("agent").from("news_configs").delete()
    .eq("id", id).eq("user_id", userId)
  if (error) throw error
}

export async function listAllConfigs(): Promise<NewsConfigRow[]> {
  const sb = getSb()
  const { data, error } = await sb.schema("agent").from("news_configs")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) {
    console.error("[news-configs] listAllConfigs 查询失败:", error.message)
    return []
  }
  return (data || []) as NewsConfigRow[]
}
