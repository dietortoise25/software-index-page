import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { getMonthRange, getChinaDateRange } from "@/lib/date-range"
import { MetricTitle } from "./MetricTitle"
import type { Dimension, Platform } from "./FilterBar"

const COLORS = ["oklch(0.7227 0.192 149.579)", "oklch(0.769 0.188 70.08)", "oklch(0.696 0.149 162.48)", "oklch(0.637 0.208 25.33)"]

export function ChannelCharts({ dimension, platform, operatorId }: { dimension: Dimension; platform: Platform; operatorId: number }) {
  const [data, setData] = useState<{ pie: { name: string; value: number }[]; bar: { month: string; TIKTOK: number; SHOPEE: number }[] } | null>(null)

  useEffect(() => {
    const from = getMonthRange(-5), to = getChinaDateRange(0)
    let q = supabase.from("orders").select("platform, total_amount, pay_time").gte("pay_time", from.start).lte("pay_time", to.end)
    if (dimension === "platform") q = q.eq("platform", platform)
    if (dimension === "operator" && operatorId > 0) {
      supabase.schema("internal").from("shop_operators").select("shop_id").eq("operator_id", operatorId).then(({ data: bids }) => {
        const ids = (bids || []).map(b => (b as Record<string, unknown>).shop_id)
        if (ids.length) q.in("shop_id", ids)
      })
    }
    q.then(({ data: rows }) => {
      const pieMap: Record<string, number> = {}, barMap: Record<string, Record<string, number>> = {}
      for (const r of (rows || [])) {
        const p = String(r.platform || "?"); pieMap[p] = (pieMap[p] || 0) + parseFloat(String(r.total_amount || 0))
        const m = String(r.pay_time).slice(0, 7); if (!barMap[m]) barMap[m] = {}; barMap[m][p] = (barMap[m][p] || 0) + parseFloat(String(r.total_amount || 0))
      }
      setData({ pie: Object.entries(pieMap).map(([name, value]) => ({ name, value })), bar: Object.entries(barMap).sort(([a],[b])=>a.localeCompare(b)).map(([month, vals]) => ({ month, TIKTOK: vals.TIKTOK || 0, SHOPEE: vals.SHOPEE || 0 })) })
    })
  }, [dimension, platform, operatorId])

  if (!data) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader><CardTitle><MetricTitle dictKey="platformGmvPie" /></CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart><Pie data={data.pie} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ name, value }) => `${name} ${(value / data.pie.reduce((s, d) => s + d.value, 0) * 100).toFixed(0)}%`}>{data.pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => `BRL ${Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`} /></PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle><MetricTitle dictKey="platformMonthlyBar" /></CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.bar}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => `BRL ${Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`} /><Legend /><Bar dataKey="TIKTOK" fill={COLORS[0]} radius={[4, 4, 0, 0]} /><Bar dataKey="SHOPEE" fill={COLORS[1]} radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
