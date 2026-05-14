import axios from "axios"
import { loadConfig } from "./config-store.js"
import type { Platform } from "./normalize.js"

const AUTH_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
const API_BASE = "https://open.feishu.cn/open-apis/bitable/v1/apps"

export interface StoreMapping {
  rawShop: string
  platform: Platform
  operator: string
  standardName: string
}

async function getToken(): Promise<string> {
  const cfg = loadConfig()
  const res = await axios.post(AUTH_URL, {
    app_id: cfg.FEISHU_APP_ID,
    app_secret: cfg.FEISHU_APP_SECRET,
  })
  return (res.data as { tenant_access_token: string }).tenant_access_token
}

export async function fetchStoreMap(): Promise<StoreMapping[]> {
  const cfg = loadConfig()
  const token = await getToken()
  const result: StoreMapping[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({ page_size: "200" })
    if (pageToken) params.set("page_token", pageToken)
    const url = `${API_BASE}/${cfg.FEISHU_BASE_TOKEN}/tables/${cfg.TABLE_STORE_MAP}/records?${params}`
    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = res.data as {
        code: number
        data?: { has_more?: boolean; page_token?: string; items?: { fields?: Record<string, unknown> }[] }
      }
      if (data.code !== 0) {
        throw new Error(`Bitable API error: code=${data.code}`)
      }
      for (const item of data.data?.items ?? []) {
        const fields = item.fields ?? {}
        result.push({
          rawShop: String(fields["原始店铺名"] ?? "").trim(),
          platform: (fields["平台"] as string[])?.[0] === "TikTok" ? "tiktok" : "shopee",
          operator: String(fields["运营者"] ?? "").trim(),
          standardName: String(fields["标准店铺名"] ?? "").trim(),
        })
      }
      pageToken = data.data?.has_more ? data.data?.page_token : undefined
    } catch (e: unknown) {
      const axiosErr = e as { response?: { status: number; data: unknown } }
      const detail = axiosErr.response?.data
        ? JSON.stringify(axiosErr.response.data)
        : (e as Error).message
      throw new Error(`[store-map] ${url}\n→ ${detail}`)
    }
  } while (pageToken)

  return result
}

export function lookupStore(
  rawShop: string,
  platform: Platform,
  storeMap: StoreMapping[],
): { standardName: string; operator: string } {
  const normalized = rawShop.trim()
  const match = storeMap.find((m) => m.rawShop === normalized && m.platform === platform)
  return {
    standardName: match?.standardName || normalized,
    operator: match?.operator || "",
  }
}
