/**
 * 广告费用同步：千易交易报表 → Supabase ad_costs
 * 每天凌晨 2:00 由 scheduler 调用
 */
import { QianyiSDK } from "../sdk/index.js"
import { getSupabase, logSync } from "../sdk/sync.js"

function monthKey(offset = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

interface AdRow { platform: string; report_month: string; affiliate_cost: number; tech_ad_cost: number; total_cost: number }

export async function syncAdCosts(sdk: QianyiSDK, _env: string) {
  const module = "ad_costs"
  console.log(`[${new Date().toISOString()}] 开始同步 ${module}...`)
  await logSync(module, "cron_pull", "running", 0)

  try {
    const sb = getSupabase()
    const { data: shops } = await sb.from("shops").select("shop_id, platform")
    const tiktokIds = shops?.filter(s => s.platform === "TIKTOK").map(s => s.shop_id) || []
    const shopeeIds = shops?.filter(s => s.platform === "SHOPEE").map(s => s.shop_id) || []

    const rows: AdRow[] = []

    // 时间分批（API 限制每次 ≤31 天）
    function dateChunks(monthsBack: number): [string, string][] {
      const chunks: [string, string][] = []
      const now = new Date()
      for (let m = monthsBack; m >= 0; m--) {
        const y = now.getFullYear()
        const mo = now.getMonth() - m
        const d = new Date(y, mo, 1)
        const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
        const endMonth = m === 0 ? now.getDate() : new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate()
        const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(endMonth).padStart(2, "0")}`
        chunks.push([start, end])
      }
      return chunks
    }

    // TikTok V2
    if (tiktokIds.length) {
      try {
        const monthMap: Record<string, AdRow> = {}
        for (const [from, to] of dateChunks(2)) {
          let page = 1
          while (true) {
            const res = await sdk.report.tiktokV2({
              shopIdList: tiktokIds.slice(0, 50), payoutTimeFrom: from, payoutTimeTo: to, page, pageSize: 200,
            }) as { result?: unknown[]; notSuccess?: boolean }
            const items = res?.result || []
            if (!items.length || res?.notSuccess) break
            const batch: Record<string, unknown>[] = []
            for (const r of items as Record<string, unknown>[]) {
              const m = String(r.settlementTimeFormatted || "").slice(0, 7)
              const a = Math.abs(parseFloat(String(r.feeAffiliateAdsCommissionAmount || 0)))
              const b = Math.abs(parseFloat(String(r.feeAffiliateCommissionAmount || 0)))
              const c = Math.abs(parseFloat(String(r.feeAffiliatePartnerCommissionAmount || 0)))
              const d = Math.abs(parseFloat(String(r.udf12 || 0)))
              const e = Math.abs(parseFloat(String(r.udf18 || 0)))
              const total = a + b + c + d + e
              if (m) {
                if (!monthMap[m]) monthMap[m] = { platform: "TIKTOK", report_month: m, affiliate_cost: 0, tech_ad_cost: 0, total_cost: 0 }
                monthMap[m].affiliate_cost += a + b + c; monthMap[m].tech_ad_cost += d + e; monthMap[m].total_cost += total
              }
              const date = String(r.settlementTimeFormatted || "").slice(0, 10)
              if (date && total > 0) {
                batch.push({ platform: "TIKTOK", shop_id: r.shopId, shop_name: r.shopName, settlement_date: date, order_id: String(r.orderId || ""), affiliate_cost: a + b + c, tech_ad_cost: d + e, total_cost: total, raw_data: r, sync_at: new Date().toISOString() })
              }
            }
            if (batch.length) await sb.from("ad_cost_details").upsert(batch, { onConflict: "platform,order_id,settlement_date" }).then(() => {}, () => {})
            if (items.length < 200) break
            page++
          }
        }
        rows.push(...Object.values(monthMap))
        console.log(`  TikTok: ${Object.keys(monthMap).length} 个月, ${Object.values(monthMap).reduce((s, r) => s + r.total_cost, 0).toFixed(2)} BRL`)
      } catch (e) { console.log("  TikTok 跳过:", (e as Error).message) }
    }

    // Shopee
    if (shopeeIds.length) {
      try {
        const monthMap: Record<string, AdRow> = {}
        for (const [from, to] of dateChunks(2)) {
          let page = 1
          while (true) {
            const res = await sdk.report.shopeeTransaction({
              shopIdList: shopeeIds.slice(0, 50), type: 1, payoutTimeFrom: from, payoutTimeTo: to, page, pageSize: 200,
            }) as { result?: unknown[]; notSuccess?: boolean }
            const items = res?.result || []
            if (!items.length || res?.notSuccess) break
            const batch: Record<string, unknown>[] = []
            for (const r of items as Record<string, unknown>[]) {
              const m = String(r.payoutTimeFormatted || "").slice(0, 7)
              const a = Math.abs(parseFloat(String(r.orderAmsCommissionFee || 0)))
              const b = Math.abs(parseFloat(String(r.udf7 || 0)))
              const total = a + b
              if (m) {
                if (!monthMap[m]) monthMap[m] = { platform: "SHOPEE", report_month: m, affiliate_cost: 0, tech_ad_cost: 0, total_cost: 0 }
                monthMap[m].tech_ad_cost += total; monthMap[m].total_cost += total
              }
              const date = String(r.payoutTimeFormatted || "").slice(0, 10)
              if (date && total > 0) {
                batch.push({ platform: "SHOPEE", shop_id: r.shopId, shop_name: r.shopName, settlement_date: date, order_id: String(r.orderId || ""), affiliate_cost: 0, tech_ad_cost: total, total_cost: total, raw_data: r, sync_at: new Date().toISOString() })
              }
            }
            if (batch.length) await sb.from("ad_cost_details").upsert(batch, { onConflict: "platform,order_id,settlement_date" }).then(() => {}, () => {})
            if (items.length < 200) break
            page++
          }
        }
        rows.push(...Object.values(monthMap))
        console.log(`  Shopee: ${Object.keys(monthMap).length} 个月, ${Object.values(monthMap).reduce((s, r) => s + r.total_cost, 0).toFixed(2)} BRL`)
      } catch (e) { console.log("  Shopee 跳过:", (e as Error).message) }
    }

    let synced = 0
    for (const r of rows) {
      const { error } = await sb.from("ad_costs").upsert({
        platform: r.platform, report_month: r.report_month,
        affiliate_cost: r.affiliate_cost, tech_ad_cost: r.tech_ad_cost, total_cost: r.total_cost,
        sync_at: new Date().toISOString(),
      }, { onConflict: "platform,report_month" })
      if (!error) synced++
    }

    console.log(`[${module}] 同步完成: ${synced} 条`)
    await logSync(module, "cron_pull", "success", synced)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[ad_costs] 同步失败: ${msg}`)
    await logSync("ad_costs", "cron_pull", "failure", 0, msg)
  }
}
