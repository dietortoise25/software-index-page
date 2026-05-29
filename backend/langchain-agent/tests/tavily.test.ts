import { describe, it, expect, vi } from "vitest"

// Mock @tavily/core before importing the module under test
const mockSearch = vi.fn()
vi.mock("@tavily/core", () => ({
  tavily: () => ({ search: mockSearch }),
}))

// Dynamic import so mock takes effect
const { searchNews } = await import("../src/lib/tavily.js")

describe("searchNews", () => {
  it("calls Tavily search with topic=news and correct options", async () => {
    mockSearch.mockResolvedValueOnce({
      results: [
        { title: "Test News", url: "https://example.com", content: "News content", score: 0.9 },
      ],
    })

    const results = await searchNews("AI agents", { maxResults: 5, days: 7 })

    expect(mockSearch).toHaveBeenCalledTimes(1)
    expect(mockSearch).toHaveBeenCalledWith("AI agents", {
      topic: "news",
      maxResults: 5,
      days: 7,
    })
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe("Test News")
    expect(results[0].url).toBe("https://example.com")
  })

  it("uses default options when none provided", async () => {
    mockSearch.mockResolvedValueOnce({ results: [] })

    await searchNews("AI")

    expect(mockSearch).toHaveBeenCalledWith("AI", {
      topic: "news",
      maxResults: 10,
      days: 1,
    })
  })

  it("returns empty array on API error", async () => {
    mockSearch.mockRejectedValueOnce(new Error("API Error"))

    const results = await searchNews("AI")

    expect(results).toEqual([])
  })
})
