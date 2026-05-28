/**
 * 负责人变动审批 — 飞书原生审批 + Webhook 回调
 */
import { Router } from "express"
import { createClient } from "@supabase/supabase-js"
import { getTenantToken } from "../lib/feishu.js"
import { requireAuth } from "../lib/auth-middleware.js"
import crypto from "crypto"

const router = Router()
const sb = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_ANON_KEY || "")

const APPROVAL_CODE = process.env.FEISHU_APPROVAL_CODE || "9959B9BB-78C5-4DBC-9116-0BF3264CB5C6"
const FEISHU_API = "https://open.feishu.cn/open-apis"

// ========== 提交审批 — 飞书原生审批 API ==========
router.post("/approval/submit", requireAuth, async (req, res) => {
  const { shop_id, operator_id, change_type, effective_from, reason } = req.body || {}
  if (!shop_id || !operator_id || !effective_from || !reason) {
    res.status(400).json({ ok: false, error: "参数不完整" }); return
  }

  // 查店铺名、运营者名、原负责人
  const [{ data: shop }, { data: op }, { data: cur }] = await Promise.all([
    sb.from("shops").select("name").eq("shop_id", shop_id).single(),
    sb.schema("internal").from("operators").select("name").eq("id", operator_id).single(),
    sb.schema("internal").from("shop_operators").select("operator_id, operator:operators(name)").eq("shop_id", shop_id).eq("is_primary", true).maybeSingle(),
  ])
  const shopName = (shop as any)?.name || `#${shop_id}`
  const opName = (op as any)?.name || `#${operator_id}`
  const oldOpName = (cur as any)?.operator?.name || "无"

  // 表单值（radio 传 option key = ID；date 传日期字符串）
  const oldOpId = (cur as any)?.operator_id || ""
  const formValues = [
    { id: "widget17790705801330001", type: "radioV2", value: String(shop_id) },
    { id: "widget17790712984530001", type: "radioV2", value: String(oldOpId) },
    { id: "widget17790706682550001", type: "radioV2", value: String(operator_id) },
    { id: "widget17790679198970001", type: "date", value: effective_from },
    { id: "widget17790679297630001", type: "textarea", value: reason },
  ]

  try {
    const token = await getTenantToken()
    const r = await fetch(`${FEISHU_API}/approval/v4/instances`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        approval_code: APPROVAL_CODE,
        open_id: process.env.FEISHU_APPROVER_OPEN_ID || "ou_2b39164fdeba062e42f5eeee83bedc26",
        form: JSON.stringify(formValues),
        node_approver_open_id_list: [
          { key: process.env.FEISHU_APPROVAL_NODE_KEY || "242b9f0dd6d5451a3f91c2b9958f6511", value: [process.env.FEISHU_APPROVER_OPEN_ID || "ou_2b39164fdeba062e42f5eeee83bedc26"] },
        ],
      }),
    })
    const data = await r.json() as any

    if (data.code === 0) {
      const instanceCode = data.data?.instance_code
      // 写入变动记录
      await sb.schema("internal").from("shop_operator_changes").insert({
        shop_id: Number(shop_id), operator_id: Number(operator_id),
        change_type: change_type || "transfer", effective_from, reason: reason.trim(),
        status: "pending", instance_code: instanceCode, submitted_by: process.env.ADMIN_NAME || "Alan",
      })
      console.log(`[审批] 原生实例已创建: ${instanceCode}`)
      res.json({ ok: true, instance_code: instanceCode, message: "审批已提交至飞书" })
    } else {
      console.error("[审批] 原生API失败:", JSON.stringify(data).slice(0, 300))
      res.status(500).json({ ok: false, error: data.msg || "飞书API失败" })
    }
  } catch (err) {
    console.error("[审批] 异常:", (err as Error).message)
    res.status(500).json({ ok: false, error: (err as Error).message })
  }
})

// ========== Webhook 解密（AES-256-CBC） ==========
function decryptFeishu(encrypt: string, key: string): any {
  const keyBytes = crypto.createHash("sha256").update(key).digest()
  const buf = Buffer.from(encrypt, "base64")
  const iv = buf.subarray(0, 16)
  const ciphertext = buf.subarray(16)
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyBytes, iv)
  decipher.setAutoPadding(false)
  let decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  // 去除尾部填充（PKCS7），找 JSON 边界
  let end = decrypted.length - 1
  while (end >= 0 && decrypted[end] <= 16) end--
  decrypted = decrypted.subarray(0, end + 1)
  return JSON.parse(decrypted.toString("utf-8"))
}

// ========== Webhook 回调 — 飞书审批结果通知 ==========
router.post("/approval/callback", async (req, res) => {
  const body = req.body || {}

  // 解密加密的 webhook 数据
  let payload = body
  if (body.encrypt) {
    const key = process.env.FEISHU_ENCRYPT_KEY || process.env.FEISHU_APP_SECRET || ""
    try { payload = decryptFeishu(body.encrypt, key) }
    catch (e) { console.error("[审批] 解密失败:", (e as Error).message); res.json({ ok: false }); return }
  }

  console.log("[审批] webhook type:", payload.type, "event.type:", payload.event?.type)

  // 飞书首次验证 URL 时发的是 challenge
  if (payload.type === "url_verification") {
    res.json({ challenge: payload.challenge })
    return
  }

  // 审批实例状态变更
  const event = payload.event || {}
  if (event.type !== "approval_instance" && event.type !== "approval") { res.json({ ok: true }); return }

  const status = event.status || "APPROVED" // approval 事件默认通过
  const instanceCode = event.instance_code || event.instanceCode || event.approval_code
  console.log("[审批] status:", status, "instanceCode:", instanceCode, "event keys:", Object.keys(event))
  if (!instanceCode) { console.log("[审批] 无instanceCode"); res.json({ ok: true }); return }

  // 通用：先查审批实例详情，解析表单
  let shopId = 0, opId = 0, effDate = ""
  try {
    const token = await getTenantToken()
    const r = await fetch(`${FEISHU_API}/approval/v4/instances/${instanceCode}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const detail = await r.json() as any
    const formStr = detail.data?.form || ""
    const formValues: { id: string; value: string }[] = typeof formStr === "string" ? JSON.parse(formStr) : formStr
    const findWidget = (customId: string) => (formValues as any[]).find((f: any) => f.custom_id === customId)

    shopId = Number(findWidget("widget_shop_name")?.option?.key || findWidget("widget_shop_name")?.value || 0)
    opId = Number(findWidget("widget_new_op")?.option?.key || findWidget("widget_new_op")?.value || 0)
    effDate = (findWidget("widget_date")?.value || "").slice(0, 10)
    console.log("[审批] 解析:", { shopId, opId, effDate })
  } catch (e) { console.error("[审批] 表单解析异常:", (e as Error).message) }

  if (status === "APPROVED") {
    try {
      if (shopId && opId && effDate) {
        // 2. 旧负责人结束
        const prevDay = new Date(new Date(effDate).getTime() - 86400000).toISOString().slice(0, 10)
        await sb.schema("internal").from("shop_operators")
          .update({ effective_to: prevDay, is_primary: false })
          .eq("shop_id", shopId).eq("is_primary", true)

        // 3. 新负责人生效
        const { data: exist } = await sb.schema("internal").from("shop_operators")
          .select("id").eq("shop_id", shopId).eq("operator_id", opId)
        if (exist?.length) {
          await sb.schema("internal").from("shop_operators")
            .update({ is_primary: true, effective_from: effDate, effective_to: null }).eq("id", exist[0].id)
        } else {
          await sb.schema("internal").from("shop_operators")
            .insert({ shop_id: shopId, operator_id: opId, is_primary: true, effective_from: effDate, effective_to: null }) as any
        }

        // 4. 更新/写入变动记录（支持飞书端直接发起的审批）
        const { data: existingChange } = await sb.schema("internal").from("shop_operator_changes")
          .select("id").eq("instance_code", instanceCode)
        if (existingChange?.length) {
          await sb.schema("internal").from("shop_operator_changes")
            .update({ status: "approved", approved_at: new Date().toISOString() })
            .eq("instance_code", instanceCode)
        } else {
          await sb.schema("internal").from("shop_operator_changes").insert({
            shop_id: shopId, operator_id: opId, change_type: "transfer",
            effective_from: effDate, reason: "飞书端发起",
            status: "approved", instance_code: instanceCode,
            submitted_by: "Feishu", approved_at: new Date().toISOString(),
          })
        }

        console.log(`[审批] 自动通过: ${instanceCode}, shop=${shopId}, op=${opId}, date=${effDate}`)
      }
    } catch (err) {
      console.error("[审批] webhook处理异常:", (err as Error).message)
    }
  } else if (status === "REJECTED") {
    const { data: exist } = await sb.schema("internal").from("shop_operator_changes").select("id").eq("instance_code", instanceCode)
    const changeData: Record<string, unknown> = {
      shop_id: shopId || 0, operator_id: opId || 0, change_type: "transfer",
      effective_from: effDate || new Date().toISOString().slice(0, 10),
      reason: "飞书端审批驳回", status: "rejected",
      instance_code: instanceCode, submitted_by: "Feishu",
    }
    if (exist?.length) {
      await sb.schema("internal").from("shop_operator_changes").update(changeData).eq("id", exist[0].id)
    } else {
      await sb.schema("internal").from("shop_operator_changes").insert(changeData)
    }
    console.log(`[审批] 飞书驳回: ${instanceCode}`)
  }

  res.json({ ok: true })
})

// ========== Mock 审批（fallback） ==========
router.post("/approval/:instance_code/review", async (req, res) => {
  const { instance_code } = req.params; const { action } = req.body || {}
  const { data: changes, error: findErr } = await sb.schema("internal").from("shop_operator_changes").select("*").eq("instance_code", instance_code)
  if (findErr || !changes?.length) { res.status(404).json({ ok: false, error: "未找到审批记录" }); return }
  const record = changes[0] as Record<string, unknown>
  if (record.status !== "pending") { res.status(400).json({ ok: false, error: `已处理: ${record.status}` }); return }

  if (action === "approve") {
    await sb.schema("internal").from("shop_operators").update({ effective_to: new Date(new Date(record.effective_from as string).getTime() - 86400000).toISOString().slice(0, 10), is_primary: false }).eq("shop_id", record.shop_id).eq("is_primary", true)
    const { data: existing } = await sb.schema("internal").from("shop_operators").select("id").eq("shop_id", record.shop_id).eq("operator_id", record.operator_id)
    if (existing?.length) { await sb.schema("internal").from("shop_operators").update({ is_primary: true, effective_from: record.effective_from, effective_to: null }).eq("id", existing[0].id) }
    else { await sb.schema("internal").from("shop_operators").insert({ shop_id: record.shop_id, operator_id: record.operator_id, is_primary: true, effective_from: record.effective_from, effective_to: null }) as any }
    await sb.schema("internal").from("shop_operator_changes").update({ status: "approved", approved_at: new Date().toISOString() }).eq("instance_code", instance_code)
    res.json({ ok: true, message: "审批已通过" })
  } else if (action === "reject") {
    await sb.schema("internal").from("shop_operator_changes").update({ status: "rejected" }).eq("instance_code", instance_code)
    res.json({ ok: true, message: "审批已驳回" })
  } else { res.status(400).json({ ok: false, error: "action 必须是 approve 或 reject" }) }
})

// ========== 外部数据源（飞书表单下拉框选项） ==========
// POST — 飞书审批表单调用，返回店铺/运营者列表
router.post("/approval/options/shops", async (req, res) => {
  const { token, query } = (req.body || {}) as Record<string, string>
  if (token !== "feishu_2026") { res.json({ code: 1, msg: "invalid token" }); return }

  const { data } = await sb.from("shops").select("shop_id, name").order("name")
  let shops = (data || []).map(s => ({ id: String(s.shop_id), name: s.name }))
  if (query) shops = shops.filter(s => s.name.includes(query))

  const texts: Record<string, string> = {}
  const options = shops.map(s => { const k = `@i18n@s_${s.id}`; texts[k] = s.name; return { id: s.id, value: k } })

  if (options.length > 0) (options[0] as any).isDefault = true
  res.json({ code: 0, msg: "success!", data: { result: { options, i18nResources: [{ locale: "zh_cn", isDefault: true, texts }], hasMore: false } } })
})

router.post("/approval/options/operators", async (req, res) => {
  const { token, query } = (req.body || {}) as Record<string, string>
  if (token !== "feishu_2026") { res.json({ code: 1, msg: "invalid token" }); return }

  const { data } = await sb.schema("internal").from("operators").select("id, name").order("name")
  let ops = (data || []).map(o => ({ id: String(o.id), name: o.name }))
  if (query) ops = ops.filter(o => o.name.includes(query))

  const texts: Record<string, string> = {}
  const options = ops.map(o => { const k = `@i18n@o_${o.id}`; texts[k] = o.name; return { id: o.id, value: k } })

  if (options.length > 0) (options[0] as any).isDefault = true
  res.json({ code: 0, msg: "success!", data: { result: { options, i18nResources: [{ locale: "zh_cn", isDefault: true, texts }], hasMore: false } } })
})

// ========== 联动数据：选店铺后返回该店主负责人 ==========
router.post("/approval/options/primary", async (req, res) => {
  const { token, linkage_params } = (req.body || {}) as Record<string, any>
  if (token !== "feishu_2026") { res.json({ code: 1, msg: "invalid token" }); return }

  const shopName = linkage_params?.shop_name || linkage_params?.shop_id  // 兼容两种
  if (!shopName) {
    res.json({ code: 0, msg: "success!", data: { result: { options: [], i18nResources: [{ locale: "zh_cn", isDefault: true, texts: {} }], hasMore: false } } })
    return
  }

  // 按店铺名称查 shop_id
  const { data: shop } = await sb.from("shops").select("shop_id").eq("name", String(shopName)).maybeSingle()
  const sid = (shop as any)?.shop_id
  if (!sid) { res.json({ code: 0, msg: "success!", data: { result: { options: [], i18nResources: [{ locale: "zh_cn", isDefault: true, texts: {} }], hasMore: false } } }); return }

  const { data } = await sb.schema("internal").from("shop_operators")
    .select("operator_id, effective_from, operator:operators(name)")
    .eq("shop_id", sid).eq("is_primary", true).maybeSingle()

  const op = (data as any)?.operator
  const name = op?.name || "无"
  const texts: Record<string, string> = {}
  const options = name === "无" ? [] : [{ id: String((data as any)?.operator_id || ""), value: "@i18n@primary" }]
  if (name !== "无") texts["@i18n@primary"] = `${name}（自 ${(data as any)?.effective_from || "?"}）`

  if (options.length > 0) (options[0] as any).isDefault = true
  res.json({ code: 0, msg: "success!", data: { result: { options, i18nResources: [{ locale: "zh_cn", isDefault: true, texts }], hasMore: false } } })
})

// ========== 查询 ==========
router.get("/approval/changes", async (_req, res) => {
  const { data, error } = await sb.schema("internal").from("shop_operator_changes").select("*").order("submitted_at", { ascending: false }).limit(50)
  if (error) { res.status(500).json({ ok: false, error: error.message }); return }
  const { data: ops } = await sb.schema("internal").from("operators").select("id, name")
  const opMap = new Map((ops || []).map((o: Record<string, unknown>) => [o.id, o]))
  res.json({ ok: true, data: (data || []).map((c: Record<string, unknown>) => ({ ...c, operator: opMap.get(c.operator_id) || { name: "?" } })) })
})

export default router
