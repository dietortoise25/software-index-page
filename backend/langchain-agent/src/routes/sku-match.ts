import { Router } from "express"
import { getModel } from "../config/model.js"
import { matchSku, skuMatchRequestSchema, skuMatchOverrides } from "../lib/sku-match.js"

export const skuMatchRouter = Router()

skuMatchRouter.post("/sku-match", async (req, res) => {
  const parsed = skuMatchRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || "请求参数无效",
      code: "VALIDATION_ERROR",
    })
    return
  }

  try {
    const model = getModel(skuMatchOverrides())
    const { shopee, candidates } = parsed.data
    const result = await matchSku(model, shopee, candidates)
    res.json({ ok: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "SKU 匹配失败"
    console.error("[agent] sku-match error:", message)
    res.status(500).json({ ok: false, error: "SKU 匹配服务暂时不可用", code: "INTERNAL_ERROR" })
  }
})
