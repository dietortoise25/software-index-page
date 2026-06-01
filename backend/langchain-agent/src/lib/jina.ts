export interface SearchResult {
  title: string
  url: string
  content: string
}

const JINA_KEY = process.env.JINA_API_KEY || ""

function hasKey(): boolean {
  if (!JINA_KEY) {
    console.warn("[jina] JINA_API_KEY 未配置，跳过 Jina 源")
    return false
  }
  return true
}

export async function searchJina(query: string, maxResults = 10): Promise<SearchResult[]> {
  if (!hasKey()) return []

  try {
    const url = `https://s.jina.ai/?q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${JINA_KEY}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.warn(`[jina] search 返回 ${res.status}`)
      return []
    }
    const text = await res.text()
    return parseJinaResults(text).slice(0, maxResults)
  } catch (e) {
    console.warn("[jina] search 异常:", e instanceof Error ? e.message : String(e))
    return []
  }
}

export async function readUrl(url: string): Promise<SearchResult | null> {
  if (!hasKey()) return null

  try {
    const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        Authorization: `Bearer ${JINA_KEY}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) {
      console.warn(`[jina] readUrl 返回 ${res.status}: ${url}`)
      return null
    }
    const json = await res.json() as { data?: { title?: string; url?: string; content?: string } }
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
  // Jina Search 返回 LLM-friendly markdown 格式，按标题+URL+内容解析
  const blocks = text.split(/\n(?=Title:|###\s)/)
  for (const block of blocks) {
    const titleMatch = block.match(/(?:Title:|###)\s*(.+)/)
    const urlMatch = block.match(/URL(?: Source)?:\s*(https?:\/\/\S+)/)
    const content = block.replace(/^(?:Title:|###)\s*.+\n?/m, "").replace(/^URL(?: Source)?:\s*https?:\/\/\S+\n?/m, "").trim()
    if (titleMatch && urlMatch) {
      results.push({ title: titleMatch[1].trim(), url: urlMatch[1].trim(), content: content.slice(0, 500) })
    }
  }
  // fallback: 尝试按 URL 行提取
  if (results.length === 0) {
    const urlMatches = text.matchAll(/https?:\/\/\S+/g)
    for (const m of urlMatches) {
      results.push({ title: "", url: m[0], content: "" })
    }
  }
  return results
}
