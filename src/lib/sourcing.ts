/**
 * 选品比价工具 — SSE 客户端 + 配置 API
 *
 * 用法:
 *   import { analyzeStream, fetchConfig, saveConfig } from "@/lib/sourcing"
 *   for await (const ev of analyzeStream(formData)) { ... }
 */

export interface ProviderInfo {
  companyName?: string
  factoryUrl?: string
  memberId?: string
  loginId?: string
  isLowRespRate?: boolean
  providerTags?: { tagCode: string; tagName: string; tagStyle: string }[]
}

export interface PurchaseInfo {
  code: string
  label: string
  value: string
  originValue?: number
}

export interface Candidate {
  title: string
  item_id: string
  price_cny: string
  link: string
  detail_url: string
  image_url: string
  sales: string
  sales_num: number
  shop_name: string
  shop_url: string
  shop_member_id: string
  shop_login_id: string
  shop_low_resp: boolean
  min_order: string
  offer_tags: string[]
  purchase_tags: string[]
  purchase_infos: PurchaseInfo[]
  ai_attentions: string[]
  core_attributes: { label: string; value: string }[]
  sales_infos: { code: string; label: string; value: string; originValue?: number }[]
  ship_infos: { code: string; label: string; value: string }[]
  large_image_base_infos: { code: string; label: string; value: string; originValue?: number }[]
  large_image_extra_infos: { code: string; label: string; value: string; originValue?: number }[]
  provider_tags: { tagCode: string; tagName: string; tagStyle: string }[]
  provider_services: { code: string; label: string; value: string; originValue?: number }[]
  provider_custom_tags: string[]
}

export interface SourcingRow {
  product_id: string
  product_name: string
  data_source: string
  category_path: string
  shopee_price_brl: string
  image_url: string
  shopee_monthly_sales: string
  best_1688: Candidate | null
  candidates: Candidate[]
  shopee_price_num: number | null
  has_1688_data: boolean
  cost_cny: number | null
  cost_brl: number | null
  freight_brl: number
  clearance_brl: number
  other_brl: number
  total_cost_brl: number | null
  margin_brl: number | null
  margin_rate: number | null
  recommendation: "推荐" | "可考虑" | "预警" | "待补全"
}

export interface SourcingSummary {
  total_products: number
  with_1688_data: number
  recommended: number
  consider: number
  warning: number
  incomplete: number
}

export interface SourcingConfig {
  api: Record<string, string>
  search: { max_concurrency: number; page_size: number; same_style_only: boolean }
  cost: { cny_per_brl: number; freight_brl: number; clearance_brl: number; other_brl: number }
  thresholds: { target_margin_rate: number; high_margin_rate: number }
  limits: { max_file_size_mb: number }
  columns: Record<string, string>
}

export interface SseEvent {
  event: string
  data: any
}

const BASE = "/api/shopee/sourcing"

export async function* analyzeStream(
  formData: FormData,
): AsyncGenerator<SseEvent, void, undefined> {
  const res = await fetch(`${BASE}/analyze-stream`, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error("不支持流式响应")

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() || ""

    for (const part of parts) {
      const lines = part.split("\n")
      let event = ""
      let data = ""

      for (const line of lines) {
        if (line.startsWith("event: ")) event = line.slice(7)
        else if (line.startsWith("data: ")) data = line.slice(6)
      }

      if (data) {
        try {
          yield { event, data: JSON.parse(data) }
        } catch {
          // skip unparseable frames
        }
      }
    }
  }
}

export async function fetchConfig(): Promise<SourcingConfig> {
  const res = await fetch(`${BASE}/config`)
  if (!res.ok) throw new Error("加载配置失败")
  const json = await res.json()
  return json.config
}

export async function saveConfig(config: Partial<SourcingConfig>): Promise<void> {
  const res = await fetch(`${BASE}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "保存失败" }))
    throw new Error(err.detail || "保存失败")
  }
}
