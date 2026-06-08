import { describe, it, expect, vi } from "vitest"
import { buildMatchInput, skuMatchSchema, matchSku, skuMatchOverrides, skuMatchRequestSchema } from "../src/lib/sku-match.js"

const shopee = { name: "红色连衣裙 夏季", category: "女装>连衣裙", price_brl: 39.9 }

const candidates = [
  {
    item_id: "AAA",
    title: "夏季连衣裙厂家直供",
    // 这些是富字段，LLM 不该看到，buildMatchInput 应裁掉
    sales: "1000", shop_name: "某工厂", core_attributes: [{ label: "材质", value: "棉" }],
    sku: {
      items: [
        { sku_id: 1, full_spec: "红 / M", price: "20.00", can_book_count: 100 },
        { sku_id: 2, full_spec: "红 / L", price: "10.00", can_book_count: 50 },
      ],
    },
  },
  {
    item_id: "BBB",
    title: "无关蓝裙",
    sku: { items: [{ sku_id: 3, full_spec: "蓝 / M", price: "8.00", can_book_count: 20 }] },
  },
]

describe("buildMatchInput", () => {
  it("只保留名称+类目+价格 和 候选 title + SKU 价表，裁掉富字段", () => {
    const input = buildMatchInput(shopee, candidates)
    expect(input.shopee).toEqual({ name: "红色连衣裙 夏季", category: "女装>连衣裙", price_brl: 39.9 })
    expect(input.candidates).toHaveLength(2)
    const a = input.candidates[0]
    expect(a.item_id).toBe("AAA")
    expect(a.title).toBe("夏季连衣裙厂家直供")
    // 富字段被裁掉
    expect(a).not.toHaveProperty("sales")
    expect(a).not.toHaveProperty("shop_name")
    expect(a).not.toHaveProperty("core_attributes")
    // SKU 只留 sku_id/full_spec/price/can_book_count
    expect(a.skus).toEqual([
      { sku_id: 1, full_spec: "红 / M", price: "20.00", can_book_count: 100 },
      { sku_id: 2, full_spec: "红 / L", price: "10.00", can_book_count: 50 },
    ])
  })

  it("跳过没有 SKU 的候选(无价可选，喂给 LLM 无意义)", () => {
    const input = buildMatchInput(shopee, [
      { item_id: "X", title: "无SKU", sku: { items: [] } },
      candidates[1],
    ])
    expect(input.candidates).toHaveLength(1)
    expect(input.candidates[0].item_id).toBe("BBB")
  })
})

describe("skuMatchSchema", () => {
  it("校验合法的 LLM 输出", () => {
    const ok = skuMatchSchema.safeParse({
      matched_item_id: "AAA", matched_sku_id: 1, confidence: 0.9, reason: "规格贴合",
    })
    expect(ok.success).toBe(true)
  })

  it("拒绝缺字段的输出", () => {
    const bad = skuMatchSchema.safeParse({ matched_item_id: "AAA" })
    expect(bad.success).toBe(false)
  })
})

describe("matchSku", () => {
  it("用 withStructuredOutput 调模型并返回结构化结果", async () => {
    const invoke = vi.fn().mockResolvedValue({
      matched_item_id: "AAA", matched_sku_id: 2, confidence: 0.85, reason: "红/L 价低规格贴合",
    })
    const fakeModel = { withStructuredOutput: vi.fn().mockReturnValue({ invoke }) }

    const result = await matchSku(fakeModel as any, shopee, candidates)

    expect(fakeModel.withStructuredOutput).toHaveBeenCalledOnce()
    expect(result.matched_item_id).toBe("AAA")
    expect(result.matched_sku_id).toBe(2)
    expect(result.confidence).toBe(0.85)
  })
})

describe("skuMatchOverrides", () => {
  it("从独立 env(SKU_MATCH_*)读配置，不碰 DeepSeek 的 LLM_*", () => {
    const env = {
      SKU_MATCH_API_KEY: "sk-match-key",
      SKU_MATCH_MODEL: "gpt-4o-mini",
      SKU_MATCH_BASE_URL: "https://api.openai.com/v1",
      LLM_API_KEY: "deepseek-key-should-not-leak",
    }
    const ov = skuMatchOverrides(env)
    expect(ov.apiKey).toBe("sk-match-key")
    expect(ov.model).toBe("gpt-4o-mini")
    expect(ov.baseURL).toBe("https://api.openai.com/v1")
    // 绝不回退到 DeepSeek 的 key
    expect(ov.apiKey).not.toBe("deepseek-key-should-not-leak")
  })

  it("model/baseURL 缺省时给 OpenAI 默认值", () => {
    const ov = skuMatchOverrides({ SKU_MATCH_API_KEY: "k" })
    expect(ov.model).toBe("gpt-4o-mini")
    expect(ov.baseURL).toBe("https://api.openai.com/v1")
  })
})

describe("skuMatchRequestSchema", () => {
  it("接受合法请求体(shopee + candidates)", () => {
    const ok = skuMatchRequestSchema.safeParse({
      shopee: { name: "裙", category: "女装", price_brl: 39.9 },
      candidates: [{ item_id: "AAA", title: "x", sku: { items: [{ sku_id: 1, full_spec: "红/M", price: "10" }] } }],
    })
    expect(ok.success).toBe(true)
  })

  it("拒绝缺 shopee.name 的请求", () => {
    const bad = skuMatchRequestSchema.safeParse({ shopee: {}, candidates: [] })
    expect(bad.success).toBe(false)
  })

  it("拒绝候选为空数组", () => {
    const bad = skuMatchRequestSchema.safeParse({ shopee: { name: "x" }, candidates: [] })
    expect(bad.success).toBe(false)
  })
})
