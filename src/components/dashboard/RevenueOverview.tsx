import { useEffect, useState, useCallback } from "react"
import { CalendarDays, TrendingUp, BarChart3, DollarSign, Loader2, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"
import { getChinaDateRange, getMonthRange } from "@/lib/date-range"
import { METRICS_DICT } from "@/data/metrics-dictionary"
import type { Dimension, Platform } from "./FilterBar"
import { Info } from "lucide-react"

interface ChartPoint { month: string; sales: number; count: number }
interface Metrics { todayCount: number; yesterdayCount: number; todaySales: number; yesterdaySales: number; thisMonthCount: number; thisMonthSales: number; lastMonthCount: number; lastMonthSales: number; chartData: ChartPoint[] }

function delta(cur: number, prev: number) { const diff = cur - prev; if (prev === 0) return { sign: diff > 0 ? "+" : "", diff, pct: null }; return { sign: diff > 0 ? "+" : "", diff, pct: Math.round((diff / prev) * 100) } }
function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  const d = delta(cur, prev)
  if (d.diff === 0) return <span className="text-muted-foreground text-xs">持平</span>
  const color = d.diff > 0 ? "text-emerald-500" : "text-red-500"
  return <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>{d.diff > 0 ? "↑" : "↓"} {d.sign}{d.diff.toLocaleString()}{d.pct !== null && <span className="text-muted-foreground ml-0.5 text-[10px]">({d.sign}{d.pct}%)</span>}</span>
}

function InfoIcon({ dictKey }: { dictKey: string }) {
  const m = METRICS_DICT[dictKey]
  if (!m) return null
  return <Tooltip><TooltipTrigger><Info className="size-3.5 text-muted-foreground/40 cursor-help" /></TooltipTrigger><TooltipContent side="top" className="max-w-64 text-xs">{m.tip}</TooltipContent></Tooltip>
}

export function RevenueOverview({ dimension, platform, operatorId }: { dimension: Dimension; platform: Platform; operatorId: number }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const today = getChinaDateRange(0), yesterday = getChinaDateRange(1)
      const thisMonth = getMonthRange(0), lastMonth = getMonthRange(-1), chartFrom = getMonthRange(-5)

      const queries = [
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("pay_time", today.start).lte("pay_time", today.end),
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("pay_time", yesterday.start).lte("pay_time", yesterday.end),
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("pay_time", thisMonth.start).lte("pay_time", thisMonth.end),
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("pay_time", lastMonth.start).lte("pay_time", lastMonth.end),
        supabase.from("orders").select("total_amount").gte("pay_time", today.start).lte("pay_time", today.end),
        supabase.from("orders").select("total_amount").gte("pay_time", yesterday.start).lte("pay_time", yesterday.end),
        supabase.from("orders").select("total_amount").gte("pay_time", thisMonth.start).lte("pay_time", thisMonth.end),
        supabase.from("orders").select("total_amount").gte("pay_time", lastMonth.start).lte("pay_time", lastMonth.end),
        supabase.from("orders").select("pay_time, total_amount").gte("pay_time", chartFrom.start).lte("pay_time", today.end),
      ]

      if (dimension === "platform") for (const q of queries) q.eq("platform", platform)
      if (dimension === "operator" && operatorId > 0) {
        const { data: bids } = await supabase.schema("internal").from("shop_operators").select("shop_id").eq("operator_id", operatorId)
        const ids = (bids || []).map(b => (b as Record<string, unknown>).shop_id)
        if (ids.length) for (const q of queries) q.in("shop_id", ids)
      }

      const [tc, yc, mc, lc, ts, ys, ms, ls, ch] = await Promise.all(queries) as any[]
      for (const r of [tc, yc, mc, lc, ts, ys, ms, ls, ch]) { if (r.error) throw r.error }
      const sum = (d: any) => (d.data ?? []).reduce((a: number, r: any) => a + (parseFloat(String(r.total_amount ?? 0)) || 0), 0)

      const monthMap: Record<string, { sales: number; count: number }> = {}
      for (const r of (ch.data ?? [])) { const m = String(r.pay_time).slice(0, 7); if (!monthMap[m]) monthMap[m] = { sales: 0, count: 0 }; monthMap[m].sales += parseFloat(String(r.total_amount ?? 0)) || 0; monthMap[m].count++ }
      const cd: ChartPoint[] = []; for (let i = -5; i <= 0; i++) { const range = getMonthRange(i); const key = range.start.slice(0, 7); cd.push({ month: key, ...monthMap[key] || { sales: 0, count: 0 } }) }

      setMetrics({ todayCount: tc.count ?? 0, yesterdayCount: yc.count ?? 0, todaySales: sum(ts), yesterdaySales: sum(ys), thisMonthCount: mc.count ?? 0, thisMonthSales: sum(ms), lastMonthCount: lc.count ?? 0, lastMonthSales: sum(ls), chartData: cd })
    } catch (err) { setError(err instanceof Error ? err.message : "查询失败") } finally { setLoading(false) }
  }, [dimension, platform, operatorId])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[...Array(4)].map((_,i) => <Card key={i}><CardContent className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></CardContent></Card>)}</div>
  if (error) return <Card><CardContent className="flex items-center gap-3 py-8"><AlertCircle className="size-5 shrink-0 text-destructive" /><span className="text-destructive text-sm">{error}</span></CardContent></Card>
  if (!metrics) return null

  return (
    <>
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-base">
        <div className="size-2 rounded-full bg-emerald-500" style={{ animation: "heartbeat 1.4s ease-in-out infinite" }} />
        今日 vs 昨日 · 本月 vs 上月
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { dictKey: "todayCount", value: metrics.todayCount, subtitle: `截止 ${new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" })}`, compare: metrics.yesterdayCount, compareLabel: "昨日", icon: CalendarDays },
          { dictKey: "todaySales", value: `BRL ${metrics.todaySales.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, subtitle: "今日", compare: `BRL ${metrics.yesterdaySales.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, compareLabel: "昨日", icon: DollarSign },
          { dictKey: "thisMonthCount", value: metrics.thisMonthCount, subtitle: "本月", compare: metrics.lastMonthCount, compareLabel: "上月", icon: BarChart3 },
          { dictKey: "thisMonthSales", value: `BRL ${metrics.thisMonthSales.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, subtitle: "本月", compare: `BRL ${metrics.lastMonthSales.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, compareLabel: "上月", icon: TrendingUp },
        ].map((card, i) => {
          const m = METRICS_DICT[card.dictKey]
          const cur = typeof card.value === "number" ? card.value : 0
          const prev = typeof card.compare === "number" ? card.compare : 0
          return (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10"><card.icon className="size-5 text-primary" /></div>
                <div className="flex-1"><CardTitle><span className="inline-flex items-center gap-1">{m?.label || card.dictKey}<InfoIcon dictKey={card.dictKey} /></span></CardTitle></div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div><div className="text-2xl font-bold tracking-tight">{typeof card.value === "number" ? card.value.toLocaleString() : card.value}</div><p className="mt-0.5 text-muted-foreground text-xs">{card.subtitle}</p></div>
                  <div className="text-right"><div className="text-sm text-muted-foreground">{card.compareLabel} {typeof card.compare === "string" ? card.compare : card.compare.toLocaleString()}</div>{typeof cur === "number" && typeof prev === "number" && <DeltaBadge cur={cur} prev={prev} />}</div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Separator className="my-8" />

      <h2 className="mb-3 font-semibold text-base">近6个月趋势</h2>
      <Card><CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={metrics.chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" /><YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} className="text-muted-foreground" />
            <RechartsTooltip formatter={(v, name) => [name === "count" ? `${v} 单` : `BRL ${Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`, name === "count" ? "订单量" : "销售额"]} />
            <Line type="monotone" dataKey="count" stroke="oklch(0.769 0.188 70.08)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} yAxisId="right" />
            <Line type="monotone" dataKey="sales" stroke="oklch(0.7227 0.192 149.579)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent></Card>
    </>
  )
}
