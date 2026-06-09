/**
 * Step4: 为虾皮货品智能匹配最佳 1688 SKU。
 *
 * LLM 只做"选 SKU"的判断 —— 返回选中的 item_id + sku_id + 理由 + 置信度，不算利润数字
 * （数字由 Python 侧用选中 SKU 真实单价确定性计算）。
 *
 * 喂给 LLM 的只有：虾皮货品名称+类目+价格，候选 title + 各 SKU 的 full_spec/单价/库存。
 * 富字段（销量/店铺/属性等）一律裁掉，控制 token 与噪声。
 */
import { z } from "zod"
import { SystemMessage, HumanMessage } from "@langchain/core/messages"
import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import type { ModelOverrides } from "../config/model.js"

/** step4 用独立 env，不复用 DeepSeek 的 LLM_*；缺省给 OpenAI 默认值 */
export function skuMatchOverrides(env: Record<string, string | undefined> = process.env): ModelOverrides {
  return {
    apiKey: env.SKU_MATCH_API_KEY || "",
    model: env.SKU_MATCH_MODEL || "gpt-4o-mini",
    baseURL: env.SKU_MATCH_BASE_URL || "https://api.openai.com/v1",
  }
}

export const skuMatchSchema = z.object({
  matched_item_id: z.string().describe("选中的 1688 候选 item_id"),
  matched_sku_id: z.union([z.string(), z.number()]).describe("选中候选下具体的 sku_id"),
  confidence: z.number().min(0).max(1).describe("匹配置信度 0~1"),
  reason: z.string().describe("为什么选这个 SKU（规格/名称语义匹配理由）"),
  scores: z.object({
    price: z.number().min(0).max(100).describe("价格竞争力 0-100"),
    image_match: z.number().min(0).max(100).describe("图文匹配度 0-100"),
    shop_credit: z.number().min(0).max(100).describe("店铺信誉 0-100"),
    sales: z.number().min(0).max(100).describe("销量热度 0-100"),
  }).describe("四维评分"),
  overall_score: z.number().min(0).max(100).describe("综合评分 0-100"),
})

/** sku-match 端点请求体校验：shopee 货品 + 至少一个候选 */
export const skuMatchRequestSchema = z.object({
  shopee: z.object({
    name: z.string().min(1, "shopee.name 不能为空"),
    category: z.string().optional(),
    price_brl: z.number().optional(),
  }),
  candidates: z.array(z.object({
    item_id: z.string(),
    title: z.string().optional(),
    sku: z.object({ items: z.array(z.record(z.string(), z.unknown())).optional() }).optional(),
  })).min(1, "candidates 不能为空"),
})

export type SkuMatchResult = z.infer<typeof skuMatchSchema>

export interface ShopeeInput {
  name: string
  category?: string
  price_brl?: number
}

interface RawCandidate {
  item_id: string
  title?: string
  sku?: { items?: Array<Record<string, unknown>> }
}

interface LeanSku {
  sku_id: unknown
  full_spec: string
  price: string
  can_book_count: unknown
}

interface LeanCandidate {
  item_id: string
  title: string
  skus: LeanSku[]
}

export interface MatchInput {
  shopee: ShopeeInput
  candidates: LeanCandidate[]
}

/** 把完整候选裁成 LLM 该看的精简视图；跳过没有 SKU 的候选（无价可选） */
export function buildMatchInput(shopee: ShopeeInput, candidates: RawCandidate[]): MatchInput {
  const lean: LeanCandidate[] = []
  for (const c of candidates) {
    const items = c.sku?.items ?? []
    if (items.length === 0) continue
    lean.push({
      item_id: c.item_id,
      title: c.title ?? "",
      skus: items.map((s) => ({
        sku_id: s.sku_id,
        full_spec: String(s.full_spec ?? ""),
        price: String(s.price ?? ""),
        can_book_count: s.can_book_count,
      })),
    })
  }
  return {
    shopee: { name: shopee.name, category: shopee.category, price_brl: shopee.price_brl },
    candidates: lean,
  }
}

const SYSTEM_PROMPT = `你是跨境选品助手。给定一个虾皮(Shopee)在售货品，和若干 1688 候选货源（每个候选含多个分规格 SKU 及其单价/库存），请选出与该虾皮货品最匹配的那一个 SKU。

判断依据：货品名称/类目语义、规格(full_spec)贴合度。在语义同样贴合时，优先单价更低、库存(can_book_count)充足的 SKU。

你需要输出：
1. 选中的 item_id 和 sku_id
2. confidence: 匹配置信度 0~1
3. reason: 简短推荐理由（1句话）
4. scores: 四维评分（每项 0-100 整数）
   - price: 价格竞争力（越低价越高分）
   - image_match: 图文匹配度（商品名称/规格语义相似度）
   - shop_credit: 店铺信誉（根据候选标题和店铺名判断）
   - sales: 销量热度（根据库存充足度和候选排名判断）
5. overall_score: 综合评分 0-100（加权汇总，价格和图文匹配度权重更高）

必须从给定候选里选，不要编造 id。不要计算利润。`

export async function matchSku(
  model: BaseChatModel,
  shopee: ShopeeInput,
  candidates: RawCandidate[],
): Promise<SkuMatchResult> {
  const input = buildMatchInput(shopee, candidates)
  const structured = model.withStructuredOutput(skuMatchSchema, {
    name: "sku_match",
    method: "functionCalling",
    strict: true,
  })
  return (await structured.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(JSON.stringify(input)),
  ])) as SkuMatchResult
}
