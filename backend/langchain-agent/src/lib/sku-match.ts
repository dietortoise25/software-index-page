/**
 * Step4: 为虾皮货品智能匹配最佳 1688 SKU。
 *
 * LLM 只做"选 SKU"的判断 —— 返回选中的 item_id + sku_id + 理由 + 置信度，不算利润数字
 * （数字由 Python 侧用选中 SKU 真实单价确定性计算）。
 *
 * 喂给 LLM 的只有：虾皮货品名称+类目+价格，单个候选 title + 图文核对得分(image_confidence)
 * + 各 SKU 的 full_spec/单价/库存。富字段（销量/店铺/属性等）一律裁掉，控制 token 与噪声。
 *
 * 单候选设计：每个 1688 候选单独调一次（Python 串行调完取 overall_score 最高），
 * 避免一次塞全部候选+SKU 导致 OpenAI 400/超时。
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
  matched_sku_id: z.union([z.string(), z.number()]).describe("选中候选下具体的 sku_id"),
  confidence: z.number().min(0).max(1).describe("匹配置信度 0~1"),
  reason: z.string().describe("为什么选这个 SKU（规格/名称语义匹配理由）"),
  scores: z.object({
    price: z.number().min(0).max(100).describe("价格竞争力 0-100（单价越低越高分）"),
    semantic_match: z.number().min(0).max(100).describe("名称/规格语义贴合度 0-100"),
    image_match: z.number().min(0).max(100).describe("图文一致性 0-100（参考 image_confidence，不可信时给中性分）"),
    supply: z.number().min(0).max(100).describe("供货能力 0-100（库存 can_book_count 充足度）"),
  }).describe("四维评分"),
  overall_score: z.number().min(0).max(100).describe("综合评分 0-100"),
})

/** sku-match 端点请求体校验：shopee 货品 + 单个候选（含图评分） */
export const skuMatchRequestSchema = z.object({
  shopee: z.object({
    name: z.string().min(1, "shopee.name 不能为空"),
    category: z.string().optional(),
    price_brl: z.number().optional(),
  }),
  candidate: z.object({
    item_id: z.string(),
    title: z.string().optional(),
    image_confidence: z.number().nullable().optional(),
    sku: z.object({ items: z.array(z.record(z.string(), z.unknown())).optional() }).optional(),
  }),
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
  image_confidence?: number | null
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
  image_confidence: number | null
  skus: LeanSku[]
}

export interface MatchInput {
  shopee: ShopeeInput
  candidate: LeanCandidate
}

/** 把完整候选裁成 LLM 该看的精简视图（单候选）；图评分 image_confidence 缺省置 null（中性） */
export function buildMatchInput(shopee: ShopeeInput, candidate: RawCandidate): MatchInput {
  const items = candidate.sku?.items ?? []
  return {
    shopee: { name: shopee.name, category: shopee.category, price_brl: shopee.price_brl },
    candidate: {
      item_id: candidate.item_id,
      title: candidate.title ?? "",
      image_confidence: candidate.image_confidence ?? null,
      skus: items.map((s) => ({
        sku_id: s.sku_id,
        full_spec: String(s.full_spec ?? ""),
        price: String(s.price ?? ""),
        can_book_count: s.can_book_count,
      })),
    },
  }
}

const SYSTEM_PROMPT = `你是跨境选品助手。给定一个虾皮(Shopee)在售货品，和【一个】1688 候选货源（含多个分规格 SKU 及其单价/库存，以及一个图文核对得分 image_confidence），请从这个候选的 SKU 里选出与该虾皮货品最匹配的那一个 SKU。

判断依据（按重要性排序）：
1. 名称/类目/规格(full_spec)语义贴合度 —— 最重要。
2. image_confidence(图文核对得分，0~1)：仅作参考，不能作为唯一依据。该分数普遍偏低且不完全可信——同一款商品在 Shopee 与 1688 的配图可能完全不同。分数高是加分项，分数低不必直接否决；若为 null 表示未核对，按中性对待。
3. 价格竞争力：语义同样贴合时，单价更低更优。
4. 供货能力：库存(can_book_count)更充足更优。

你需要输出：
1. matched_sku_id: 选中的 sku_id（必须来自给定候选，不要编造）
2. confidence: 匹配置信度 0~1
3. reason: 简短推荐理由（1句话）
4. scores: 四维评分（每项 0-100 整数）
   - price: 价格竞争力（越低价越高分）
   - semantic_match: 名称/规格语义贴合度
   - image_match: 图文一致性（参考 image_confidence；不可信或缺失时给中性分约 50）
   - supply: 供货能力（库存充足度）
5. overall_score: 综合评分 0-100（语义贴合权重最高，价格次之；image_match 仅微调，不主导）

只输出一个 JSON 对象，字段为 matched_sku_id、confidence、reason、scores(含 price/semantic_match/image_match/supply)、overall_score。不要输出 JSON 以外的任何文字。不要计算利润。不要编造 sku_id。`

export async function matchSku(
  model: BaseChatModel,
  shopee: ShopeeInput,
  candidate: RawCandidate,
): Promise<SkuMatchResult> {
  const input = buildMatchInput(shopee, candidate)
  // 用 jsonMode(response_format: json_object)而非 functionCalling：
  // 中转(new.sakurapuare.com)/gpt-5.5 不支持强制 tool_choice，functionCalling 会 400。
  // jsonMode 不自动注入 schema，故 SYSTEM_PROMPT 须显式列出输出字段并要求 JSON。
  const structured = model.withStructuredOutput(skuMatchSchema, {
    name: "sku_match",
    method: "jsonMode",
  })
  return (await structured.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(JSON.stringify(input)),
  ])) as SkuMatchResult
}
