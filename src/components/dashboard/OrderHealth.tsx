import { useEffect, useState } from "react"
import { Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { MetricTitle } from "./MetricTitle"
import { getMonthRange } from "@/lib/date-range"
import type { Dimension, Platform } from "./FilterBar"

const COLORS = ["oklch(0.7227 0.192 149.579)", "oklch(0.769 0.188 70.08)", "oklch(0.696 0.149 162.48)", "oklch(0.637 0.208 25.33)"]
const STATUS_LABELS: Record<string, string> = { WAIT_PAYMENT: "待付款", WAIT_AUDIT: "待审核", WAIT_SHIP: "待发货", SHIPPING: "配送中", SHIPPED: "已发货", CLOSED: "已关闭", SHIP_FAILURE: "发货失败", PARTIALLY_SHIPPED: "部分发货" }

export function OrderHealth({ dimension, platform, operatorId }: { dimension: Dimension; platform: Platform; operatorId: number }) {
  const [data, setData] = useState<{ statusDist: { name: string; value: number }[]; totalOrders: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    (async () => {
      try {
      setError(null)
      const thisMonth = getMonthRange(0)
      let q = supabase.from("orders").select("status").gte("pay_time", thisMonth.start).lte("pay_time", thisMonth.end)
      if (dimension === "platform") q = q.eq("platform", platform)
      if (dimension === "operator" && operatorId > 0) {
        const { data: bids } = await supabase.schema("internal").from("shop_operators").select("shop_id").eq("operator_id", operatorId)
        const ids = (bids || []).map(b => (b as Record<string, unknown>).shop_id); if (ids.length) q = q.in("shop_id", ids)
      }
      const { data: rows, error: qe } = await q
      if (qe) throw qe
      const dist: Record<string, number> = {}; for (const r of (rows || [])) { const s = String(r.status || "UNKNOWN"); dist[s] = (dist[s] || 0) + 1 }
      setData({ statusDist: Object.entries(dist).map(([name, value]) => ({ name, value })), totalOrders: (rows || []).length })
      } catch (e: any) { setError(e?.message || "查询失败") }
    })()
  }, [dimension, platform, operatorId, retryKey])

  if (error) return (
    <Card><CardContent className="flex items-center gap-3 py-8">
      <AlertCircle className="size-5 shrink-0 text-destructive" />
      <span className="text-destructive text-sm flex-1">{error}</span>
      <button onClick={() => { setError(null); setRetryKey(k => k + 1) }} className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10">
        <RefreshCw className="size-3.5" /> 重试
      </button>
    </CardContent></Card>
  )
  if (!data) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader><CardTitle><MetricTitle dictKey="statusDist" /></CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart><Pie data={data.statusDist} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" label={({ name, value }) => `${STATUS_LABELS[String(name)] || name} ${value}`}>{data.statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
          <p className="mt-2 text-center text-muted-foreground text-xs">总计 {data.totalOrders.toLocaleString()} 单</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><MetricTitle dictKey="healthMetrics" /></CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center"><span className="text-sm">已关闭订单占比</span><span className="font-semibold text-sm">{data.totalOrders > 0 ? ((data.statusDist.find(d => d.name === "CLOSED")?.value || 0) / data.totalOrders * 100).toFixed(1) : "0.0"}%</span></div>
            <div className="flex justify-between items-center"><span className="text-sm">待发货/待审核</span><span className="font-semibold text-sm">{data.statusDist.filter(d => ["WAIT_PAYMENT", "WAIT_AUDIT", "WAIT_SHIP"].includes(d.name)).reduce((s, d) => s + d.value, 0)} 单</span></div>
            <div className="flex justify-between items-center"><span className="text-sm">配送中/已发货</span><span className="font-semibold text-sm">{data.statusDist.filter(d => ["SHIPPING", "SHIPPED", "PARTIALLY_SHIPPED"].includes(d.name)).reduce((s, d) => s + d.value, 0)} 单</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
