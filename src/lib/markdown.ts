import { marked } from "marked"
import type { Article } from "@/types/article"

interface Frontmatter {
  id: string
  title: string
  summary: string
  date: string
  author?: string
  tags?: string[]
}

/**
 * 解析 markdown 文件的 YAML frontmatter（--- 包裹部分）
 * 返回 frontmatter 数据和正文 markdown 内容
 */
function parseFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    throw new Error("Frontmatter not found. Expected --- at the start of the file.")
  }

  const metaLines = match[1].split(/\r?\n/)
  const meta = {} as Record<string, unknown>

  for (const line of metaLines) {
    const kv = line.match(/^(\w+):\s*(.*)/)
    if (!kv) continue
    const key = kv[1]
    let value: unknown = kv[2].trim()

    // 解析 YAML 数组 [a, b, c]
    if (value && typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    }
    // 解析 YAML 字符串引号
    else if (typeof value === "string" && (value.startsWith('"') || value.startsWith("'"))) {
      value = value.slice(1, -1)
    }

    meta[key] = value
  }

  return {
    meta: meta as unknown as Frontmatter,
    body: match[2].trim(),
  }
}

/**
 * 将 posts/*.md 原始内容转为 Article 对象
 */
export function markdownToArticle(raw: string): Article {
  const { meta, body } = parseFrontmatter(raw)
  const html = marked.parse(body, { async: false }) as string

  return {
    id: meta.id,
    title: meta.title,
    summary: meta.summary,
    date: meta.date,
    author: meta.author,
    tags: meta.tags,
    content: html,
  }
}
