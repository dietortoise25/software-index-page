import { useMemo } from "react"
import type { AnalysisResult, OrderType, DailyOrder } from "@/types/shopee"
import { fmtBRL, fmtInt } from "@/lib/shopee-format"
import ShopeeTooltip from "./ShopeeTooltip"
import { Card } from "@/components/ui/card"
import {
  Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart,
} from "recharts"

interface Props {
  data: AnalysisResult
  orderType: OrderType
}

export default function SalesTab({ data, orderType }: Props) {
  const ordersData = data[orderType === 'orders' ? 'orders' : 'paid_orders']
  const daily: DailyOrder[] = ordersData?.daily || []

  const chartData = useMemo(() =>
    daily.map(d => ({
      date: (d['日期'] || '').slice(5),
      sales: d['销售额 (BRL)'] || 0,
      orders: d['订单数'] || 0,
      visitors: d['访客数'] || 0,
      clicks: d['商品点击量'] || 0,
    })),
  [daily])

  if (!daily.length) {
    return <div className="flex flex-col items-center py-12 text-muted-foreground text-sm">暂无销售数据</div>
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="text-sm font-medium">日销售额 & 订单趋势</h3>
          <ShopeeTooltip content="数据来源：店铺统计 Excel '已下订单' Sheet 日明细行。销售额以巴西雷亚尔(BRL)计，日期为巴西格式(dd/mm/yyyy)。" />
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis yAxisId="left" fontSize={12} tickFormatter={v => `R$${v}`} />
            <YAxis yAxisId="right" orientation="right" fontSize={12} allowDecimals={false} />
            <Tooltip
              formatter={(v: any, name: any) => name === 'sales' ? fmtBRL(v) : fmtInt(v)}
              contentStyle={{ fontSize: 13, borderRadius: 8 }}
            />
            <Bar yAxisId="right" dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} name="orders" />
            <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#ef4444" strokeWidth={2} dot={{ r: 5 }} name="sales" />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4 overflow-x-auto">
        <h3 className="text-sm font-medium mb-3">每日明细</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {['日期', '销售额', '订单', '点击', '访客', '转化率', '买家', '新买家', '潜在'].map(h => (
                <th key={h} className="py-2 px-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {daily.map((d, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                <td className="py-2 px-2">{d['日期'] || ''}</td>
                <td className="py-2 px-2">{fmtBRL(d['销售额 (BRL)'])}</td>
                <td className="py-2 px-2">{fmtInt(d['订单数'])}</td>
                <td className="py-2 px-2">{fmtInt(d['商品点击量'])}</td>
                <td className="py-2 px-2">{fmtInt(d['访客数'])}</td>
                <td className="py-2 px-2">{(d['订单转化率'] * 100).toFixed(2)}%</td>
                <td className="py-2 px-2">{fmtInt(d['买家数'])}</td>
                <td className="py-2 px-2">{fmtInt(d['新买家数'])}</td>
                <td className="py-2 px-2">{fmtInt(d['潜在买家数'])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
