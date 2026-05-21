import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { getMonthRange } from "@/lib/date-range"
import { MetricTitle } from "./MetricTitle"
import type { Dimension, Platform } from "./FilterBar"

export function OperatorRanking({ dimension, platform, operatorId }: { dimension: Dimension; platform: Platform; operatorId: number }) {
  const [data, setData] = useState<{ name: string; gmv: number; orders: number }[]>([])

  useEffect(() => {
    const thisMonth = getMonthRange(0);
    (async () => {
      const { data: bindings } = await supabase.schema("internal").from("shop_operators")
        .select("shop_id, operator_id, operator:operators(name)").eq("is_primary", true)
      if (!bindings) return
      const shopToOp = new Map<number, { id: number; name: string }>()
      for (const b of bindings) {
        const op = (b as Record<string, unknown>).operator as Record<string, unknown>
        shopToOp.set(Number(b.shop_id), { id: Number(b.operator_id), name: String(op?.name || "?") })
      }
      let q = supabase.from("orders").select("shop_id, total_amount").gte("pay_time", thisMonth.start).lte("pay_time", thisMonth.end)
      if (dimension === "platform") q = q.eq("platform", platform)
      if (dimension === "operator" && operatorId > 0) {
        const ids = [...shopToOp.entries()].filter(([, op]) => op.id === operatorId).map(([sid]) => sid)
        if (ids.length) q = q.in("shop_id", ids)
      }
      const { data: rows } = await q
      const opMap: Record<string, { name: string; gmv: number; orders: number }> = {}
      for (const r of (rows || [])) {
        const op = shopToOp.get(Number(r.shop_id))
        const amount = parseFloat(String(r.total_amount || 0))
        if (!op) { const k = "unassigned"; if (!opMap[k]) opMap[k] = { name: "未分配", gmv: 0, orders: 0 }; opMap[k].gmv += amount; opMap[k].orders++ }
        else { const k = `${op.id}`; if (!opMap[k]) opMap[k] = { name: op.name, gmv: 0, orders: 0 }; opMap[k].gmv += amount; opMap[k].orders++ }
      }
      setData(Object.values(opMap).sort((a, b) => b.gmv - a.gmv).slice(0, 8))
    })()
  }, [dimension, platform, operatorId])

  if (!data.length) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>

  return (
    <Card>
      <CardHeader><CardTitle><MetricTitle dictKey="operatorGmvRank" /></CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-2.5">
              <span className="w-6 text-center font-bold text-muted-foreground text-sm">{i + 1}</span>
              <span className="flex-1 font-medium text-sm">{d.name}</span>
              <span className="text-muted-foreground text-xs">{d.orders.toFixed(0)} 单</span>
              <span className="text-sm font-semibold">BRL {d.gmv.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
