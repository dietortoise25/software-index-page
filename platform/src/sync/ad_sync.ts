/**
 * 广告费用同步：千易交易报表 → Supabase ad_costs
 * 每天凌晨 2:00 由 scheduler 调用
 */
import { QianyiSDK } from "../sdk/index.js"
import { initSupabase, getSupabase, logSync } from "../sdk/sync.js"

function monthKey(offset = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

interface AdRow { platform: string; report_month: string; affiliate_cost: number; tech_ad_cost: number; total_cost: number; raw_data: unknown }

export async function syncAdCosts(sdk: QianyiSDK, env: string) {
  const module = "ad_costs"
  console.log(`[${new Date().toISOString()}] 开始同步 ${module}...`)
  await logSync(module, "cron_pull", "running", 0)

  try {
    const rows: AdRow[] = []

    // TikTok V2
    try {
      const tiktokData = await sdk.report.tiktokV2({
        createTimeFrom: `${monthKey(1)}-01`,
        createTimeTo: `${monthKey(0)}-01`,
        page: 1, pageSize: 5000,
      }) as { result?: unknown[] }
      const tiktokRows = (tiktokData?.result || []) as Record<string, unknown>[]
      if (tiktokRows.length) {
        const monthMap: Record<string, AdRow> = {}
        for (const r of tiktokRows) {
          const m = String(r.settlement_time || "").slice(0, 7)
          if (!m) continue
          if (!monthMap[m]) monthMap[m] = { platform: "TIKTOK", report_month: m, affiliate_cost: 0, tech_ad_cost: 0, total_cost: 0, raw_data: [] }
          const a = parseFloat(String(r.feeAffiliateAdsCommissionAmount || 0))
          const b = parseFloat(String(r.feeAffiliateCommissionAmount || 0))
          const c = parseFloat(String(r.feeAffiliatePartnerCommissionAmount || 0))
          const d = parseFloat(String(r.udf12 || 0))
          const e = parseFloat(String(r.udf18 || 0))
          monthMap[m].affiliate_cost += a + b + c
          monthMap[m].tech_ad_cost += d + e
          monthMap[m].total_cost += a + b + c + d + e
        }
        rows.push(...Object.values(monthMap))
      }
    } catch (e) { console.log("TikTok 广告报表跳过:", (e as Error).message) }

    // Shopee
    try {
      const shopeeData = await sdk.report.shopeeTransaction({
        createTimeFrom: `${monthKey(1)}-01`,
        createTimeTo: `${monthKey(0)}-01`,
        page: 1, pageSize: 5000,
      }) as { result?: unknown[] }
      const shopeeRows = (shopeeData?.result || []) as Record<string, unknown>[]
      if (shopeeRows.length) {
        const monthMap: Record<string, AdRow> = {}
        for (const r of shopeeRows) {
          const m = String(r.pay_time || "").slice(0, 7)
          if (!m) continue
          if (!monthMap[m]) monthMap[m] = { platform: "SHOPEE", report_month: m, affiliate_cost: 0, tech_ad_cost: 0, total_cost: 0, raw_data: [] }
          const a = parseFloat(String(r.orderAmsCommissionFee || 0))
          const b = parseFloat(String(r.udf7 || 0))
          monthMap[m].tech_ad_cost += a + b
          monthMap[m].total_cost += a + b
        }
        rows.push(...Object.values(monthMap))
      }
    } catch (e) { console.log("Shopee 广告报表跳过:", (e as Error).message) }

    // Upsert
    let synced = 0
    const sb = getSupabase()
    for (const r of rows) {
      const { error } = await sb.from("ad_costs").upsert({
        platform: r.platform,
        report_month: r.report_month,
        affiliate_cost: r.affiliate_cost,
        tech_ad_cost: r.tech_ad_cost,
        total_cost: r.total_cost,
        raw_data: r.raw_data,
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
