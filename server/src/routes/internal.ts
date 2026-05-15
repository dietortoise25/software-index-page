import { Router, Request, Response } from "express"
import { createClient } from "@supabase/supabase-js"

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || "",
)

// TODO: 后续上 JWT 鉴权，当前测试阶段跳过 PIN 校验

// ─────────── 分组 ───────────

router.get("/groups", async (_req, res) => {
  const { data, error } = await supabase
    .schema("internal").from("operator_groups")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }

  // 统计每个分组下的店铺数
  const { data: bindings } = await supabase
    .schema("internal").from("shop_operators")
    .select("group_id")
  const counts: Record<string, number> = {}
  for (const b of (bindings || [])) {
    if (b.group_id) counts[String(b.group_id)] = (counts[String(b.group_id)] || 0) + 1
  }

  const result = (data || []).map((g: Record<string, unknown>) => ({
    ...g,
    shop_count: counts[String(g.id)] || 0,
  }))
  res.json({ ok: true, data: result })
})

router.post("/groups", async (req, res) => {
  const { name } = req.body as Record<string, unknown>
  if (!name || !String(name).trim()) { res.status(400).json({ ok: false, error: "名称不能为空" }); return }
  const { data, error } = await supabase
    .schema("internal").from("operator_groups")
    .insert({ name: String(name).trim() }).select().single()
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true, data })
})

router.put("/groups/:id", async (req, res) => {
  const { name } = req.body as Record<string, unknown>
  if (!name || !String(name).trim()) { res.status(400).json({ ok: false, error: "名称不能为空" }); return }
  const { error } = await supabase
    .schema("internal").from("operator_groups")
    .update({ name: String(name).trim() }).eq("id", req.params.id)
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true })
})

router.delete("/groups/:id", async (req, res) => {
  const { error } = await supabase
    .schema("internal").from("operator_groups")
    .delete().eq("id", req.params.id)
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true })
})

// ─────────── 人员 ───────────

router.get("/operators", async (_req, res) => {
  const { data, error } = await supabase
    .schema("internal").from("operators")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true, data })
})

router.post("/operators", async (req, res) => {
  const { name } = req.body as Record<string, unknown>
  if (!name || !String(name).trim()) { res.status(400).json({ ok: false, error: "姓名不能为空" }); return }
  const { data, error } = await supabase
    .schema("internal").from("operators")
    .insert({ name: String(name).trim() }).select().single()
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true, data })
})

router.put("/operators/:id", async (req, res) => {
  const { name } = req.body as Record<string, unknown>
  if (!name) { res.status(400).json({ ok: false, error: "姓名不能为空" }); return }
  const { error } = await supabase
    .schema("internal").from("operators")
    .update({ name: String(name).trim() }).eq("id", req.params.id)
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true })
})

router.delete("/operators/:id", async (req, res) => {
  const { error } = await supabase
    .schema("internal").from("operators")
    .delete().eq("id", req.params.id)
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true })
})

// ─────────── 店铺绑定 ───────────

router.get("/shop-operators", async (_req, res) => {
  const [bindings, operators, shops] = await Promise.all([
    supabase.schema("internal").from("shop_operators").select("*").order("created_at", { ascending: false }),
    supabase.schema("internal").from("operators").select("id, name"),
    supabase.from("shops").select("shop_id, name, platform, status"),
  ])
  if (bindings.error) { res.status(500).json({ ok: false, error: bindings.error.message }); return }

  const opMap = new Map((operators.data || []).map((o: Record<string, unknown>) => [o.id, o]))
  const shopMap = new Map((shops.data || []).map((s: Record<string, unknown>) => [s.shop_id, s]))

  const result = (bindings.data || []).map((b: Record<string, unknown>) => {
    const op = opMap.get(b.operator_id) as Record<string, unknown> | undefined
    const sh = shopMap.get(b.shop_id) as Record<string, unknown> | undefined
    return {
      ...b,
      operator_name: op?.name || "?",
      shop_name: sh?.name || "?",
      platform: sh?.platform || "?",
      shop_status: sh?.status || "?",
    }
  })
  res.json({ ok: true, data: result })
})

router.post("/shop-operators", async (req, res) => {
  const { shop_id, operator_id, group_id } = req.body as Record<string, unknown>
  if (!shop_id || !operator_id) { res.status(400).json({ ok: false, error: "店铺和运营者必选" }); return }
  const { data, error } = await supabase
    .schema("internal").from("shop_operators")
    .insert({ shop_id: Number(shop_id), operator_id: Number(operator_id), group_id: group_id ? Number(group_id) : null })
    .select().single()
  if (error) {
    const msg = error.code === "23505" ? "该店铺已绑定此运营者" : error.message
    res.status(400).json({ ok: false, error: msg }); return
  }
  res.json({ ok: true, data })
})

router.delete("/shop-operators/:id", async (req, res) => {
  const { error } = await supabase
    .schema("internal").from("shop_operators")
    .delete().eq("id", req.params.id)
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true })
})

export default router
