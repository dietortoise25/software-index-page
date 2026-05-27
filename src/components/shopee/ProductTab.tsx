import { useMemo } from "react"
import type { AnalysisResult, Product } from "@/types/shopee"
import { fmtBRL, fmtPct, fmtInt } from "@/lib/shopee-format"
import ShopeeTooltip from "./ShopeeTooltip"
import { Card } from "@/components/ui/card"
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Cell } from "recharts"

interface Props {
  data: AnalysisResult
  pKey: 'products' | 'paid_products'
}

const BAR_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe']

export default function ProductTab({ data, pKey }: Props) {
  const productData = data[pKey]
  const items: Product[] = productData?.items || []

  const paretoData = useMemo(() => {
    const sorted = [...items]
    const total = sorted.reduce((s, p) => s + p.sales, 0)
    let cum = 0
    return sorted.map((p, i) => {
      cum += p.sales
      return {
        name: p.name.length > 18 ? p.name.slice(0, 16) + '..' : p.name,
        sales: p.sales,
        cumShare: total > 0 ? (cum / total) * 100 : 0,
        fill: BAR_COLORS[i] || '#94a3b8',
      }
    })
  }, [items])

  if (!items.length) {
    return <div className="flex flex-col items-center py-12 text-muted-foreground text-sm">暂无商品数据</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Top1 占比', val: fmtPct(productData.top1_share) },
          { label: 'Top3 占比', val: fmtPct(productData.top3_share) },
          { label: 'Top5 占比', val: fmtPct(productData.top5_share) },
        ].map(c => (
          <Card key={c.label} className="p-3 text-center">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="text-lg font-bold text-primary">{c.val}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="text-sm font-medium">商品帕累托分析</h3>
          <ShopeeTooltip content="柱状图=各SKU销售额，红线=累计销售占比。以订单明细Excel为可信数据源；店铺统计商品Sheet为空时自动从订单聚合。" />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={paretoData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={60} />
            <YAxis yAxisId="left" fontSize={12} tickFormatter={v => `R$${v}`} />
            <YAxis yAxisId="right" orientation="right" fontSize={12} domain={[0, 100]} tickFormatter={v => `${v}%`} />
            <Tooltip
              formatter={(v: any, name: any) => name === 'sales' ? fmtBRL(v) : `${Number(v).toFixed(1)}%`}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar yAxisId="left" dataKey="sales" name="sales" radius={[4, 4, 0, 0]}>
              {paretoData.map((d, i) => (<Cell key={i} fill={d.fill} />))}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="cumShare" name="cumShare" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="text-xs text-muted-foreground mt-1">红线：累计占比，虚线：80%参考线</div>
      </Card>

      <Card className="p-4 overflow-x-auto">
        <h3 className="text-sm font-medium mb-3">商品明细</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {['排名', '商品', '销售额', '占比', '曝光', 'CTR', 'CVR', '订单'].map(h => (
                <th key={h} className="py-2 px-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-muted/50">
                <td className="py-2 px-2">{i + 1}</td>
                <td className="py-2 px-2 max-w-xs truncate" title={p.name}>{p.name}</td>
                <td className="py-2 px-2">{fmtBRL(p.sales)}</td>
                <td className="py-2 px-2">{fmtPct(p.share)}</td>
                <td className="py-2 px-2">{fmtInt(p.impressions)}</td>
                <td className="py-2 px-2">{fmtPct(p.ctr, 2)}</td>
                <td className="py-2 px-2">{fmtPct(p.cvr, 2)}</td>
                <td className="py-2 px-2">{fmtInt(p.orders)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
