import { tavily } from "@tavily/core"

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || "" })

export interface SearchOptions {
  maxResults?: number
  days?: number
}

export interface SearchResult {
  title: string
  url: string
  content: string
  score: number
}

export async function searchNews(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const { maxResults = 10, days = 1 } = options
  try {
    const response = await tvly.search(query, {
      topic: "news",
      maxResults,
      days,
    })
    return (response.results as SearchResult[]) ?? []
  } catch {
    return []
  }
}
