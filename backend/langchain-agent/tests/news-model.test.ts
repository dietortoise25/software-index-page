import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// 捕获 ChatOpenAI 的构造参数
const ctorArgs: Array<Record<string, unknown>> = []
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: class {
    constructor(args: Record<string, unknown>) {
      ctorArgs.push(args)
    }
  },
}))

const { getNewsModel } = await import("../src/config/model.js")

describe("getNewsModel", () => {
  const ORIGINAL = { ...process.env }

  beforeEach(() => {
    ctorArgs.length = 0
  })

  afterEach(() => {
    process.env = { ...ORIGINAL }
  })

  it("使用新闻专用 env（NEW_API_KEY / NEW_API_URL / NEWS_SUMMARY_MODEL）", () => {
    process.env.NEW_API_KEY = "sk-news-key"
    process.env.NEW_API_URL = "https://new.example.com/v1"
    process.env.NEWS_SUMMARY_MODEL = "gpt-5.5"

    getNewsModel()

    expect(ctorArgs).toHaveLength(1)
    const args = ctorArgs[0]
    expect(args.apiKey).toBe("sk-news-key")
    expect(args.model).toBe("gpt-5.5")
    expect((args.configuration as { baseURL: string }).baseURL).toBe("https://new.example.com/v1")
  })

  it("overrides.temperature 生效，apiKey/baseURL/model 仍来自新闻 env", () => {
    process.env.NEW_API_KEY = "sk-news-key"
    process.env.NEW_API_URL = "https://new.example.com/v1"
    process.env.NEWS_SUMMARY_MODEL = "gpt-5.5"

    getNewsModel({ temperature: 0.3 })

    const args = ctorArgs[0]
    expect(args.temperature).toBe(0.3)
    expect(args.apiKey).toBe("sk-news-key")
    expect(args.model).toBe("gpt-5.5")
  })

  it("新闻 env 缺失时回落到全局 LLM_* 配置", () => {
    delete process.env.NEW_API_KEY
    delete process.env.NEW_API_URL
    delete process.env.NEWS_SUMMARY_MODEL
    process.env.LLM_API_KEY = "sk-global"
    process.env.LLM_BASE_URL = "https://api.deepseek.com"
    process.env.LLM_MODEL = "deepseek-chat"

    getNewsModel()

    const args = ctorArgs[0]
    expect(args.apiKey).toBe("sk-global")
    expect(args.model).toBe("deepseek-chat")
    expect((args.configuration as { baseURL: string }).baseURL).toBe("https://api.deepseek.com")
  })
})
