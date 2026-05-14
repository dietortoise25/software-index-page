import axios from "axios"
import { loadConfig } from "./config-store.js"

const AUTH_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
const API_BASE = "https://open.feishu.cn/open-apis/bitable/v1/apps"

let cachedToken = ""
let tokenExpiry = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const cfg = loadConfig()
  const res = await axios.post(AUTH_URL, {
    app_id: cfg.FEISHU_APP_ID,
    app_secret: cfg.FEISHU_APP_SECRET,
  })
  cachedToken = (res.data as { tenant_access_token: string }).tenant_access_token
  tokenExpiry = Date.now() + 7 * 60000 // 提前 3 分钟刷新
  return cachedToken
}

function apiHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

export interface ExistingRecord {
  orderNo: string
  returnNo: string
  recordId: string
}

export async function fetchExistingRecords(tableId: string): Promise<ExistingRecord[]> {
  const cfg = loadConfig()
  const token = await getToken()
  const records: ExistingRecord[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({ page_size: "200" })
    if (pageToken) params.set("page_token", pageToken)
    const url = `${API_BASE}/${cfg.FEISHU_BASE_TOKEN}/tables/${tableId}/records?${params}`
    const res = await axios.get(url, { headers: apiHeaders(token) })
    const data = res.data as {
      code: number
      data?: { has_more?: boolean; page_token?: string; items?: { record_id: string; fields?: Record<string, unknown> }[] }
    }
    for (const item of data.data?.items ?? []) {
      const fields = item.fields ?? {}
      const orderNo = String(fields["订单编号"] ?? "").trim()
      const returnNo = String(fields["序号"] ?? fields["退单编号"] ?? "").trim()
      if (orderNo) records.push({ orderNo, returnNo, recordId: item.record_id! })
    }
    pageToken = data.data?.has_more ? data.data?.page_token : undefined
  } while (pageToken)

  return records
}

export function deduplicate<T extends Record<string, unknown>>(
  newRecords: T[],
  existing: ExistingRecord[],
  orderKey: string,
  returnKey: string,
): T[] {
  const existingSet = new Set(existing.map((e) => `${e.orderNo}||${e.returnNo}`))
  return newRecords.filter((r) => {
    const key = `${String(r[orderKey] ?? "").trim()}||${String(r[returnKey] ?? "").trim()}`
    return !existingSet.has(key)
  })
}

export async function batchInsert(
  tableId: string,
  fieldNames: string[],
  rows: (string | null)[][],
): Promise<string[]> {
  const cfg = loadConfig()
  const token = await getToken()
  const recordIds: string[] = []

  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200)
    const records = batch.map((row) => {
      const fields: Record<string, string> = {}
      fieldNames.forEach((name, idx) => {
        if (row[idx] !== null && row[idx] !== undefined) fields[name] = String(row[idx])
      })
      return { fields }
    })

    const url = `${API_BASE}/${cfg.FEISHU_BASE_TOKEN}/tables/${tableId}/records/batch_create`
    const res = await axios.post(url, { records }, { headers: apiHeaders(token) })
    const data = res.data as { code: number; data?: { records?: { record_id: string }[] } }
    recordIds.push(...(data.data?.records ?? []).map((r) => r.record_id).filter(Boolean))

    if (i + 200 < rows.length) await new Promise((r) => setTimeout(r, 800))
  }

  return recordIds
}

function isVideoUrl(url: string): boolean {
  return url.includes("mime_type=video_mp4") || url.includes("/video/tos/")
}

export async function uploadImageToFeishu(imageUrl: string, token: string): Promise<string | null> {
  if (isVideoUrl(imageUrl)) return null

  // 1. 下载（10s 超时 + AbortController 强制中断）
  let buffer: Buffer, contentType: string
  try {
    const ctrl = new AbortController()
    const dlTimer = setTimeout(() => ctrl.abort(), 10000)
    const dlRes = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
      timeout: 10000,
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    })
    clearTimeout(dlTimer)
    contentType = String(dlRes.headers["content-type"] || "image/jpeg")
    buffer = Buffer.from(dlRes.data)
  } catch (e) {
    const status = (e as { response?: { status: number } })?.response?.status
    console.error(`[image] 下载失败 HTTP${status ?? (e as Error).message?.slice(0,40)} ${imageUrl.slice(0,60)}`)
    return null
  }

  const urlPath = new URL(imageUrl).pathname
  const baseName = urlPath.split("/").pop()?.split("?")[0] || "image.jpg"
  const fileName = baseName.includes(".") ? baseName : `${baseName}.jpg`

  // 2. 上传到飞书 Drive
  const boundary = `----FormBoundary${Date.now().toString(16)}`
  const parts: Buffer[] = []
  const addPart = (name: string, value: string) => {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`))
  }

  const cfg = loadConfig()
  addPart("file_name", fileName)
  addPart("parent_type", "bitable_image")
  addPart("parent_node", cfg.FEISHU_BASE_TOKEN)
  addPart("size", String(buffer.length))

  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`))
  parts.push(buffer)
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`))

  try {
    const ctrl = new AbortController()
    const upTimer = setTimeout(() => ctrl.abort(), 12000)
    const uploadRes = await axios.post("https://open.feishu.cn/open-apis/drive/v1/medias/upload_all", Buffer.concat(parts), {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      timeout: 12000,
      signal: ctrl.signal,
    })
    clearTimeout(upTimer)
    const data = uploadRes.data as { code: number; data?: { file_token?: string } }
    if (data.code !== 0) {
      console.error(`[image] up-fail code=${data.code} msg=${(uploadRes.data as { msg?: string }).msg} ${imageUrl.slice(0,60)}`)
      return null
    }
    return data.data?.file_token ?? null
  } catch (e) {
    const resp = (e as { response?: { status: number; data: unknown } })?.response
    const detail = resp?.data ? JSON.stringify(resp.data).slice(0, 200) : (e as Error).message?.slice(0, 40)
    console.error(`[image] 上传失败 HTTP${resp?.status ?? '?'} ${detail} ${imageUrl.slice(0, 60)}`)
    return null
  }
}

export async function uploadAttachments(
  tableId: string,
  recordIdImageMap: Map<string, string[]>,
): Promise<number> {
  const token = await getToken()
  if (!token) return 0

  let uploaded = 0
  for (const [recordId, urls] of recordIdImageMap) {
    for (const url of urls) {
      if (!url?.startsWith("http") || isVideoUrl(url)) continue
      try {
        const fileToken = await uploadImageToFeishu(url, token)
        if (fileToken) {
          const cfg = loadConfig()
          const apiUrl = `${API_BASE}/${cfg.FEISHU_BASE_TOKEN}/tables/${tableId}/records/${recordId}`
          await axios.put(apiUrl, { fields: { "图片": [{ file_token: fileToken }] } }, { headers: apiHeaders(token) })
          uploaded++
        }
      } catch (e) {
        console.error("上传图片失败:", url, String(e).slice(0, 100))
      }
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  return uploaded
}
