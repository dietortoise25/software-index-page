import { describe, it, expect } from "vitest"
import { sanitizeHtml } from "./sanitize"

describe("sanitizeHtml", () => {
  it("保留安全的 HTML 标签", () => {
    const input = "<p>Hello <strong>World</strong></p>"
    expect(sanitizeHtml(input)).toBe(input)
  })

  it("保留安全链接", () => {
    const input = '<a href="https://example.com" target="_blank">link</a>'
    expect(sanitizeHtml(input)).toBe(input)
  })

  it("移除 <script> 标签", () => {
    const input = "<p>text</p><script>alert(1)</script>"
    const result = sanitizeHtml(input)
    expect(result).not.toContain("<script>")
    expect(result).toContain("<p>text</p>")
  })

  it("移除 onerror 事件处理器", () => {
    const input = '<img src="x" onerror="alert(1)">'
    const result = sanitizeHtml(input)
    expect(result).toContain('src="x"')
    expect(result).not.toContain("onerror")
  })

  it("移除 onclick 事件处理器", () => {
    const input = '<div onclick="evil()">click</div>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain("onclick")
  })

  it("移除 javascript: URL", () => {
    const input = '<a href="javascript:alert(1)">click</a>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain("javascript:")
  })

  it("纯文本输入正常通过", () => {
    const input = "hello world"
    expect(sanitizeHtml(input)).toBe(input)
  })

  it("处理空字符串", () => {
    expect(sanitizeHtml("")).toBe("")
  })

  it("保留 Markdown 渲染后的常见标签", () => {
    const input = "<h1>Title</h1><p>para</p><ul><li>item</li></ul><code>fn()</code>"
    expect(sanitizeHtml(input)).toBe(input)
  })
})
