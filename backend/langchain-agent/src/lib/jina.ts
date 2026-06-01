import https from "https"
import { SocksProxyAgent } from "socks-proxy-agent"

export interface SearchResult {
  title: string
  url: string
  content: string
}

const JINA_KEY = process.env.JINA_API_KEY || ""
const JINA_PROXY = process.env.JINA_PROXY || ""

const proxyAgent = JINA_PROXY ? new SocksProxyAgent(JINA_PROXY) : undefined

export interface JinaSearchOptions {
  gl?: string
  hl?: string
}

function hasKey(): boolean {
  if (!JINA_KEY) {
    console.warn("[jina] JINA_API_KEY 未配置，跳过 Jina 源")
    return false
  }
  return true
}

function httpGet(url: string, extraHeaders?: Record<string, string>, timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Authorization: `Bearer ${JINA_KEY}` }
    if (extraHeaders) Object.assign(headers, extraHeaders)
    const req = https.get(url, { agent: proxyAgent, headers, timeout }, (res) => {
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      let body = ""
      res.on("data", (chunk: Buffer) => { body += chunk.toString() })
      res.on("end", () => resolve(body))
    })
    req.on("error", reject)
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")) })
  })
}

function httpGetJson(url: string, timeout = 20000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      agent: proxyAgent,
      headers: {
        Authorization: `Bearer ${JINA_KEY}`,
        Accept: "application/json",
      },
      timeout,
    }, (res) => {
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      let body = ""
      res.on("data", (chunk: Buffer) => { body += chunk.toString() })
      res.on("end", () => {
        try { resolve(JSON.parse(body)) }
        catch { reject(new Error("JSON parse failed")) }
      })
    })
    req.on("error", reject)
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")) })
  })
}

export async function searchJina(query: string, maxResults = 10, opts?: JinaSearchOptions): Promise<SearchResult[]> {
  if (!hasKey()) return []

  try {
    const params = new URLSearchParams()
    params.set("q", query)
    if (opts?.gl) params.set("gl", opts.gl)
    if (opts?.hl) params.set("hl", opts.hl)
    const extraHeaders: Record<string, string> = { "X-Engine": "direct" }
    const text = await httpGet(`https://s.jina.ai/?${params.toString()}`, extraHeaders)
    return parseJinaResults(text).slice(0, maxResults)
  } catch (e) {
    console.warn("[jina] search 异常:", e instanceof Error ? e.message : String(e))
    return []
  }
}

export async function readUrl(url: string): Promise<SearchResult | null> {
  if (!hasKey()) return null

  try {
    const json = await httpGetJson(`https://r.jina.ai/${encodeURIComponent(url)}`) as {
      data?: { title?: string; url?: string; content?: string }
    }
    const d = json.data
    if (!d?.content) return null
    return { title: d.title || "", url: d.url || url, content: d.content }
  } catch (e) {
    console.warn("[jina] readUrl 异常:", e instanceof Error ? e.message : String(e))
    return null
  }
}

function parseJinaResults(text: string): SearchResult[] {
  const results: SearchResult[] = []
  const blocks = text.split(/\n(?=Title:|###\s)/)
  for (const block of blocks) {
    const titleMatch = block.match(/(?:Title:|###)\s*(.+)/)
    const urlMatch = block.match(/URL(?: Source)?:\s*(https?:\/\/\S+)/)
    const content = block
      .replace(/^(?:Title:|###)\s*.+\n?/m, "")
      .replace(/^URL(?: Source)?:\s*https?:\/\/\S+\n?/m, "")
      .trim()
    if (titleMatch && urlMatch) {
      results.push({ title: titleMatch[1].trim(), url: urlMatch[1].trim(), content: content.slice(0, 500) })
    }
  }
  if (results.length === 0) {
    for (const m of text.matchAll(/https?:\/\/\S+/g)) {
      results.push({ title: "", url: m[0], content: "" })
    }
  }
  return results
}
