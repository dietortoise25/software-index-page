import { describe, it, expect, vi } from "vitest"
import { buildMatchInput, skuMatchSchema, matchSku, skuMatchOverrides, skuMatchRequestSchema } from "../src/lib/sku-match.js"

const shopee = { name: "红色连衣裙 夏季", category: "女装>连衣裙", price_brl: 39.9 }

// 单候选设计：一次只评一个 1688 候选（含图评分）
const candidate = {
  item_id: "AAA",
  title: "夏季连衣裙厂家直供",
  image_confidence: 0.82,
  // 富字段，LLM 不该看到，buildMatchInput 应裁掉
  sales: "1000", shop_name: "某工厂", core_attributes: [{ label: "材质", value: "棉" }],
  sku: {
    items: [
      { sku_id: 1, full_spec: "红 / M", price: "20.00", can_book_count: 100 },
      { sku_id: 2, full_spec: "红 / L", price: "10.00", can_book_count: 50 },
    ],
  },
}

describe("buildMatchInput", () => {
  it("只保留名称+类目+价格 和 单候选 title + image_confidence + SKU 价表，裁掉富字段", () => {
    const input = buildMatchInput(shopee, candidate)
    expect(input.shopee).toEqual({ name: "红色连衣裙 夏季", category: "女装>连衣裙", price_brl: 39.9 })
    const a = input.candidate
    expect(a.item_id).toBe("AAA")
    expect(a.title).toBe("夏季连衣裙厂家直供")
    expect(a.image_confidence).toBe(0.82)
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

  it("image_confidence 缺省时为 null(中性，不惩罚)", () => {
    const input = buildMatchInput(shopee, { item_id: "B", sku: { items: [{ sku_id: 3, price: "8" }] } })
    expect(input.candidate.image_confidence).toBeNull()
  })
})

describe("skuMatchSchema", () => {
  it("不含 matched_item_id(Python 回填)；scores 为 price/semantic_match/image_match/supply 四维", () => {
    const shape = skuMatchSchema.shape
    expect("matched_item_id" in shape).toBe(false)
    expect("matched_sku_id" in shape).toBe(true)
    expect("overall_score" in shape).toBe(true)
    const scoresShape = (shape.scores as unknown as { shape: Record<string, unknown> }).shape
    expect(Object.keys(scoresShape).sort()).toEqual(
      ["image_match", "price", "semantic_match", "supply"],
    )
  })

  it("校验合法的 LLM 输出", () => {
    const ok = skuMatchSchema.safeParse({
      matched_sku_id: 1, confidence: 0.9, reason: "规格贴合",
      scores: { price: 80, semantic_match: 90, image_match: 70, supply: 60 },
      overall_score: 85,
    })
    expect(ok.success).toBe(true)
  })

  it("拒绝缺字段的输出", () => {
    const bad = skuMatchSchema.safeParse({ matched_sku_id: 1 })
    expect(bad.success).toBe(false)
  })
})

describe("matchSku", () => {
  it("用 withStructuredOutput 调模型并返回结构化结果(单候选)", async () => {
    const invoke = vi.fn().mockResolvedValue({
      matched_sku_id: 2, confidence: 0.85, reason: "红/L 价低规格贴合",
      scores: { price: 90, semantic_match: 88, image_match: 80, supply: 70 },
      overall_score: 86,
    })
    const fakeModel = { withStructuredOutput: vi.fn().mockReturnValue({ invoke }) }

    const result = await matchSku(fakeModel as any, shopee, candidate)

    expect(fakeModel.withStructuredOutput).toHaveBeenCalledOnce()
    expect(result.matched_sku_id).toBe(2)
    expect(result.confidence).toBe(0.85)
    expect(result.overall_score).toBe(86)
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
    expect(ov.apiKey).not.toBe("deepseek-key-should-not-leak")
  })

  it("model/baseURL 缺省时给 OpenAI 默认值", () => {
    const ov = skuMatchOverrides({ SKU_MATCH_API_KEY: "k" })
    expect(ov.model).toBe("gpt-4o-mini")
    expect(ov.baseURL).toBe("https://api.openai.com/v1")
  })
})

describe("skuMatchRequestSchema (单候选)", () => {
  it("接受合法请求体(shopee + 单 candidate + image_confidence)", () => {
    const ok = skuMatchRequestSchema.safeParse({
      shopee: { name: "裙", category: "女装", price_brl: 39.9 },
      candidate: { item_id: "AAA", title: "x", image_confidence: 0.7, sku: { items: [{ sku_id: 1, full_spec: "红/M", price: "10" }] } },
    })
    expect(ok.success).toBe(true)
  })

  it("image_confidence 允许为 null", () => {
    const ok = skuMatchRequestSchema.safeParse({
      shopee: { name: "裙" },
      candidate: { item_id: "A", image_confidence: null, sku: { items: [{ sku_id: 1, price: "5" }] } },
    })
    expect(ok.success).toBe(true)
  })

  it("拒绝缺 shopee.name 的请求", () => {
    const bad = skuMatchRequestSchema.safeParse({ shopee: {}, candidate: { item_id: "A" } })
    expect(bad.success).toBe(false)
  })

  it("拒绝旧的 candidates 数组结构(无 candidate 字段)", () => {
    const bad = skuMatchRequestSchema.safeParse({ shopee: { name: "x" }, candidates: [{ item_id: "A" }] })
    expect(bad.success).toBe(false)
  })
})
