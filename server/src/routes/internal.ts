import { Router, Request, Response } from "express"
import { createClient } from "@supabase/supabase-js"

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || "",
)

function getPin(req: Request) {
  return String((req.body as Record<string, unknown>)?.pin || "")
}

function verifyPin(req: Request): boolean {
  return getPin(req) === process.env.REVIEW_PIN
}

function pinError(res: Response) {
  res.status(403).json({ ok: false, error: "PIN 验证失败" })
}

// ─────────── 分组 ───────────

router.get("/groups", async (req, res) => {
  if (!verifyPin(req)) return pinError(res)
  const { data, error } = await supabase
    .schema("internal").from("operator_groups")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }

  // 统计每个分组的人员数
  const { data: counts } = await supabase
    .schema("internal").from("operators")
    .select("group_id")
  const groupCounts: Record<string, number> = {}
  for (const o of (counts || [])) {
    const gid = String(o.group_id)
    groupCounts[gid] = (groupCounts[gid] || 0) + 1
  }

  const result = (data || []).map((g: Record<string, unknown>) => ({
    ...g,
    operator_count: groupCounts[String(g.id)] || 0,
  }))
  res.json({ ok: true, data: result })
})

router.post("/groups", async (req, res) => {
  if (!verifyPin(req)) return pinError(res)
  const { name } = req.body as Record<string, unknown>
  if (!name || !String(name).trim()) { res.status(400).json({ ok: false, error: "名称不能为空" }); return }
  const { data, error } = await supabase
    .schema("internal").from("operator_groups")
    .insert({ name: String(name).trim() }).select().single()
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true, data })
})

router.put("/groups/:id", async (req, res) => {
  if (!verifyPin(req)) return pinError(res)
  const { name } = req.body as Record<string, unknown>
  if (!name || !String(name).trim()) { res.status(400).json({ ok: false, error: "名称不能为空" }); return }
  const { data, error } = await supabase
    .schema("internal").from("operator_groups")
    .update({ name: String(name).trim() }).eq("id", req.params.id).select().single()
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true, data })
})

router.delete("/groups/:id", async (req, res) => {
  if (!verifyPin(req)) return pinError(res)
  const { error } = await supabase
    .schema("internal").from("operator_groups")
    .delete().eq("id", req.params.id)
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true })
})

// ─────────── 人员 ───────────

router.get("/operators", async (req, res) => {
  if (!verifyPin(req)) return pinError(res)
  const groupId = req.query.group_id as string | undefined
  let query = supabase
    .schema("internal").from("operators")
    .select("*")
    .order("created_at", { ascending: false })
  if (groupId) query = query.eq("group_id", groupId)
  const { data, error } = await query
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true, data })
})

router.post("/operators", async (req, res) => {
  if (!verifyPin(req)) return pinError(res)
  const { name, group_id } = req.body as Record<string, unknown>
  if (!name || !String(name).trim()) { res.status(400).json({ ok: false, error: "姓名不能为空" }); return }
  const { data, error } = await supabase
    .schema("internal").from("operators")
    .insert({ name: String(name).trim(), group_id: group_id || null }).select().single()
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true, data })
})

router.put("/operators/:id", async (req, res) => {
  if (!verifyPin(req)) return pinError(res)
  const { name, group_id } = req.body as Record<string, unknown>
  const updates: Record<string, unknown> = {}
  if (name) updates.name = String(name).trim()
  if (group_id !== undefined) updates.group_id = group_id || null
  const { data, error } = await supabase
    .schema("internal").from("operators")
    .update(updates).eq("id", req.params.id).select().single()
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true, data })
})

router.delete("/operators/:id", async (req, res) => {
  if (!verifyPin(req)) return pinError(res)
  const { error } = await supabase
    .schema("internal").from("operators")
    .delete().eq("id", req.params.id)
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true })
})

// ─────────── 店铺绑定 ───────────

router.get("/shop-operators", async (req, res) => {
  if (!verifyPin(req)) return pinError(res)
  const { data, error } = await supabase
    .schema("internal").from("shop_operators")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true, data })
})

router.post("/shop-operators", async (req, res) => {
  if (!verifyPin(req)) return pinError(res)
  const { shop_id, operator_id } = req.body as Record<string, unknown>
  if (!shop_id || !operator_id) { res.status(400).json({ ok: false, error: "店铺和运营者必选" }); return }
  const { data, error } = await supabase
    .schema("internal").from("shop_operators")
    .insert({ shop_id: Number(shop_id), operator_id: Number(operator_id) }).select().single()
  if (error) {
    const msg = error.code === "23505" ? "该店铺已绑定此运营者" : error.message
    res.status(400).json({ ok: false, error: msg }); return
  }
  res.json({ ok: true, data })
})

router.delete("/shop-operators/:id", async (req, res) => {
  if (!verifyPin(req)) return pinError(res)
  const { error } = await supabase
    .schema("internal").from("shop_operators")
    .delete().eq("id", req.params.id)
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  res.json({ ok: true })
})

export default router
