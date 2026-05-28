import { useEffect, useState } from "react"
import { Loader2, ChevronLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { MetricTitle } from "./MetricTitle"
import type { Dimension, Platform } from "./FilterBar"

const COLORS = ["oklch(0.7227 0.192 149.579)", "oklch(0.769 0.188 70.08)", "oklch(0.696 0.149 162.48)"]

type DrillLevel = "month" | "day" | "shop"
interface DrillState { level: DrillLevel; month?: string; day?: string }

export function AdCostSection({ dimension, platform, operatorId }: { dimension: Dimension; platform: Platform; operatorId: number }) {
  const [monthly, setMonthly] = useState<{ month: string; TIKTOK: number; SHOPEE: number; total: number }[]>([])
  const [rate, setRate] = useState<{ month: string; rate: number }[]>([])
  const [summary, setSummary] = useState<{ spend: number; rate: number; affiliatePct: number }>({ spend: 0, rate: 0, affiliatePct: 0 })
  const [loading, setLoading] = useState(true)
  const [drill, setDrill] = useState<DrillState>({ level: "month" })
  const [drillData, setDrillData] = useState<{ date: string; affiliate: number; tech: number; total: number }[]>([])
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      let q = supabase.from("ad_costs").select("*").order("report_month", { ascending: true }).limit(12)
      if (dimension === "platform") q = q.eq("platform", platform)
      const { data: rows } = await q; const rows_ = (rows || []) as Record<string, unknown>[]
      const merged: Record<string, { TIKTOK: number; SHOPEE: number; total: number }> = {}
      for (const r of rows_) { const m = String(r.report_month); if (!merged[m]) merged[m] = { TIKTOK: 0, SHOPEE: 0, total: 0 }; const p = String(r.platform); const v = parseFloat(String(r.total_cost || 0)); merged[m].total += v; if (p === "TIKTOK") merged[m].TIKTOK = v; if (p === "SHOPEE") merged[m].SHOPEE = v }
      const mergedArr = Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }))

      const rateArr: { month: string; rate: number }[] = []
      for (const m of mergedArr) {
        const [y, mo] = m.month.split('-').map(Number)
        const lastDay = new Date(y, mo, 0).getDate()
        const { data: gmvRows } = await supabase.from("orders").select("total_amount").gte("pay_time", `${m.month}-01T00:00:00+08:00`).lte("pay_time", `${m.month}-${String(lastDay).padStart(2, '0')}T23:59:59+08:00`)
        const gmv = (gmvRows || []).reduce((s, r) => s + parseFloat(String(r.total_amount || 0)), 0)
        rateArr.push({ month: m.month, rate: gmv > 0 ? (m.total / gmv) * 100 : 0 })
      }
      const last = mergedArr[mergedArr.length - 1]
      const lastRate = rateArr[rateArr.length - 1]?.rate || 0
      const affTotal = rows_.filter(r => r.platform === "TIKTOK").reduce((s, r) => s + parseFloat(String((r as any).affiliate_cost || 0)), 0)
      setMonthly(mergedArr); setRate(rateArr)
      setSummary({ spend: last?.total || 0, rate: lastRate, affiliatePct: last?.total ? (affTotal / last.total) * 100 : 0 })
      setLoading(false)
    })()
  }, [dimension, platform, operatorId])

  // 点击某月 → 从 ad_cost_details 查按天汇总
  const drillToMonth = async (month: string) => {
    setDrill({ level: "day", month }); setDrillLoading(true)
    const [y, m] = month.split("-").map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const { data } = await supabase.from("ad_cost_details")
      .select("settlement_date, total_cost, affiliate_cost, tech_ad_cost")
      .gte("settlement_date", `${month}-01`).lte("settlement_date", `${month}-${String(lastDay).padStart(2, "0")}`)
      .order("settlement_date")
    const dm: Record<string, { total: number; affiliate: number; tech: number }> = {}
    for (const r of (data || [])) {
      const d = String(r.settlement_date); if (!dm[d]) dm[d] = { total: 0, affiliate: 0, tech: 0 }
      dm[d].total += parseFloat(String(r.total_cost || 0)); dm[d].affiliate += parseFloat(String(r.affiliate_cost || 0)); dm[d].tech += parseFloat(String(r.tech_ad_cost || 0))
    }
    setDrillData(Object.entries(dm).sort(([a],[b])=>a.localeCompare(b)).map(([date, v]) => ({ date, ...v })))
    setDrillLoading(false)
  }

  // 点击某天 → 查按店汇总
  const drillToDay = async (day: string) => {
    setDrill({ level: "shop", month: drill.month, day }); setDrillLoading(true)
    const { data: shops } = await supabase.from("shops").select("shop_id, name")
    const shopMap = new Map((shops || []).map(s => [s.shop_id, s.name]))
    const { data } = await supabase.from("ad_cost_details").select("shop_id, total_cost, affiliate_cost, tech_ad_cost").eq("settlement_date", day)
    const sm: Record<number, { total: number; affiliate: number; tech: number; name: string }> = {}
    for (const r of (data || [])) {
      const sid = Number(r.shop_id)
      if (!sm[sid]) sm[sid] = { total: 0, affiliate: 0, tech: 0, name: shopMap.get(sid) || `#${sid}` }
      sm[sid].total += parseFloat(String(r.total_cost || 0)); sm[sid].affiliate += parseFloat(String(r.affiliate_cost || 0)); sm[sid].tech += parseFloat(String(r.tech_ad_cost || 0))
    }
    setDrillData(Object.entries(sm).sort(([,a],[,b]) => b.total - a.total).map(([, v]) => ({ date: v.name, ...v })))
    setDrillLoading(false)
  }

  const back = () => {
    if (drill.level === "shop") { setDrill({ level: "day", month: drill.month }); drillToMonth(drill.month!) }
    else { setDrill({ level: "month" }); setDrillData([]) }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
  if (!monthly.length) return <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">暂无广告费用数据</CardContent></Card>

  return (
    <div>
      {drill.level === "month" ? (
        <>
          <div className="mb-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[
              { dictKey: "adSpend", value: `BRL ${summary.spend.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}` },
              { dictKey: "adRate", value: `${summary.rate.toFixed(1)}%`, color: summary.rate > 25 ? "text-destructive" : summary.rate > 15 ? "text-amber-500" : "text-emerald-500" },
              { dictKey: "affiliatePct", value: `${summary.affiliatePct.toFixed(1)}%` },
              { dictKey: "adMonths", value: `${monthly.length} 个月` },
            ].map((c, i) => (
              <Card key={i}><CardContent className="pt-4"><MetricTitle dictKey={c.dictKey} /><p className={`mt-1 text-xl font-bold ${(c as any).color || ""}`}>{c.value}</p></CardContent></Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle><MetricTitle dictKey="adPlatformBar" /></CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `BRL ${Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`} /><Legend />
                    <Bar dataKey="TIKTOK" stackId="a" fill={COLORS[0]} cursor="pointer" onClick={(d: any) => drillToMonth(d.month)} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="SHOPEE" stackId="a" fill={COLORS[1]} cursor="pointer" onClick={(d: any) => drillToMonth(d.month)} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-1 text-center text-muted-foreground text-xs">点击柱体查看按天下钻</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle><MetricTitle dictKey="adRateTrend" /></CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={rate}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} unit="%" /><Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} /><Line type="monotone" dataKey="rate" stroke={COLORS[2]} strokeWidth={2} dot={{ r: 3 }} /></LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Button variant="ghost" size="sm" onClick={back}><ChevronLeft className="size-4 mr-1" />返回</Button>
            <CardTitle>{drill.level === "day" ? `${drill.month} 按天广告支出` : `${drill.day} 按店广告支出`}</CardTitle>
          </CardHeader>
          <CardContent>
            {drillLoading ? <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> : drill.level === "day" ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={drillData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" /><YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `BRL ${Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`} />
                  <Bar dataKey="total" fill={COLORS[0]} radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => drillToDay(d.date)} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="space-y-2">
                {drillData.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-2.5">
                    <span className="w-6 text-center font-bold text-muted-foreground text-sm">{i + 1}</span>
                    <span className="flex-1 font-medium text-sm">{d.date}</span>
                    <span className="text-muted-foreground text-xs">达人 BRL {Number(d.affiliate).toFixed(2)}</span>
                    <span className="text-sm font-semibold">BRL {Number(d.total).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            {drill.level === "day" && <p className="mt-2 text-center text-muted-foreground text-xs">点击柱体查看按店明细</p>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
