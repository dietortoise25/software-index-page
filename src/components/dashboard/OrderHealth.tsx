import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { MetricTitle } from "./MetricTitle"
import type { Dimension, Platform } from "./FilterBar"

const COLORS = ["oklch(0.7227 0.192 149.579)", "oklch(0.769 0.188 70.08)", "oklch(0.696 0.149 162.48)", "oklch(0.637 0.208 25.33)"]
const STATUS_LABELS: Record<string, string> = { WAIT_PAYMENT: "待付款", WAIT_AUDIT: "待审核", WAIT_SHIP: "待发货", SHIPPING: "配送中", SHIPPED: "已发货", CLOSED: "已关闭", SHIP_FAILURE: "发货失败", PARTIALLY_SHIPPED: "部分发货" }

export function OrderHealth({ dimension, platform, operatorId }: { dimension: Dimension; platform: Platform; operatorId: number }) {
  const [data, setData] = useState<{ statusDist: { name: string; value: number }[]; totalOrders: number } | null>(null)

  useEffect(() => {
    (async () => {
      let q = supabase.from("orders").select("status")
      if (dimension === "platform") q = q.eq("platform", platform)
      if (dimension === "operator" && operatorId > 0) {
        const { data: bids } = await supabase.schema("internal").from("shop_operators").select("shop_id").eq("operator_id", operatorId)
        const ids = (bids || []).map(b => (b as Record<string, unknown>).shop_id); if (ids.length) q = q.in("shop_id", ids)
      }
      const { data: rows } = await q
      const dist: Record<string, number> = {}; for (const r of (rows || [])) { const s = String(r.status || "UNKNOWN"); dist[s] = (dist[s] || 0) + 1 }
      setData({ statusDist: Object.entries(dist).map(([name, value]) => ({ name, value })), totalOrders: (rows || []).length })
    })()
  }, [dimension, platform, operatorId])

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
            <div className="flex justify-between items-center"><span className="text-sm">已关闭订单占比</span><span className="font-semibold text-sm">{((data.statusDist.find(d => d.name === "CLOSED")?.value || 0) / data.totalOrders * 100).toFixed(1)}%</span></div>
            <div className="flex justify-between items-center"><span className="text-sm">待发货/待审核</span><span className="font-semibold text-sm">{data.statusDist.filter(d => ["WAIT_PAYMENT", "WAIT_AUDIT", "WAIT_SHIP"].includes(d.name)).reduce((s, d) => s + d.value, 0)} 单</span></div>
            <div className="flex justify-between items-center"><span className="text-sm">配送中/已发货</span><span className="font-semibold text-sm">{data.statusDist.filter(d => ["SHIPPING", "SHIPPED", "PARTIALLY_SHIPPED"].includes(d.name)).reduce((s, d) => s + d.value, 0)} 单</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
