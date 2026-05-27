import { useState, useMemo } from "react"
import type { AnalysisResult, Channel, SourceDaily } from "@/types/shopee"
import { fmtBRL, fmtPct, fmtInt } from "@/lib/shopee-format"
import ShopeeTooltip from "./ShopeeTooltip"
import { Card } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"

interface Props {
  data: AnalysisResult
  tKey: 'traffic' | 'paid_traffic'
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#6b7280']

export default function FunnelTab({ data, tKey }: Props) {
  const traffic = data[tKey]
  const channels: Channel[] = traffic?.channels || []
  const card = traffic?.card
  const sourceDaily: SourceDaily[] = traffic?.source_daily || []

  const [expandedSource, setExpandedSource] = useState('')

  const funnelData = useMemo(() => [
    { name: '商品曝光', value: card?.impressions || 0, pct: '' },
    { name: '商品点击', value: card?.clicks || 0, pct: fmtPct(card?.ctr || 0) },
    { name: '下单', value: card?.orders || 0, pct: fmtPct(card?.cvr || 0) },
  ], [card])

  const pieData = useMemo(() =>
    channels.filter(c => c.sales > 0).map(c => ({ name: c.name, value: c.sales })),
  [channels])

  const drillRows = useMemo(() =>
    expandedSource ? sourceDaily.filter(d => d.source === expandedSource) : [],
  [expandedSource, sourceDaily])

  if (!channels.length && !card?.impressions) {
    return <div className="flex flex-col items-center py-12 text-muted-foreground text-sm">暂无流量数据</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <h3 className="text-sm font-medium">转化漏斗</h3>
            <ShopeeTooltip content="商品曝光 → 商品点击(CTR) → 下单(CVR)。优先取流量来源 Sheet 聚合行；若聚合行为零（Shopee 导出偶发缺陷），自动从来源分布日明细汇总兜底。" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 50 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="name" fontSize={13} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {funnelData.map((_, i) => (<Cell key={i} fill={COLORS[i]} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-around text-xs text-muted-foreground mt-1">
            {funnelData.map(f => (
              <span key={f.name}>{f.name}: {fmtInt(f.value)} {f.pct ? `(${f.pct})` : ''}</span>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">渠道销售占比</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                  {pieData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(v: any) => fmtBRL(v)} />
                <Legend formatter={(name: string) => name} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center py-12 text-muted-foreground text-sm">暂无渠道数据</div>
          )}
        </Card>
      </div>

      <Card className="p-4 overflow-x-auto">
        <h3 className="text-sm font-medium mb-3">渠道明细（点击展开每日明细）</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {['渠道', '曝光', '点击', 'CTR', '订单', 'CVR', '销售占比', '销售额'].map(h => (
                <th key={h} className="py-2 px-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {channels.map(ch => {
              const isExpanded = expandedSource === ch.name
              const warn = ch.impressions > 100 && ch.orders === 0
              return (
                <>
                  <tr
                    key={ch.name}
                    onClick={() => setExpandedSource(isExpanded ? '' : ch.name)}
                    className={`border-b border-border/50 cursor-pointer transition ${
                      warn ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-muted/50'
                    }`}
                  >
                    <td className="py-2 px-2 font-medium">{ch.name}{warn ? ' ⚠' : ''}</td>
                    <td className="py-2 px-2">{fmtInt(ch.impressions)}</td>
                    <td className="py-2 px-2">{fmtInt(ch.clicks)}</td>
                    <td className="py-2 px-2">{fmtPct(ch.ctr, 2)}</td>
                    <td className="py-2 px-2">{fmtInt(ch.orders)}</td>
                    <td className="py-2 px-2">{fmtPct(ch.cvr, 2)}</td>
                    <td className="py-2 px-2">{fmtPct(ch.share)}</td>
                    <td className="py-2 px-2">{fmtBRL(ch.sales)}</td>
                  </tr>
                  {isExpanded && drillRows.length > 0 && (
                    <tr key={`${ch.name}-drill`}>
                      <td colSpan={8} className="bg-muted/30 p-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="py-1 px-2 text-left">日期</th>
                              <th className="py-1 px-2 text-right">曝光</th>
                              <th className="py-1 px-2 text-right">点击</th>
                              <th className="py-1 px-2 text-right">订单</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drillRows.map((dr, j) => (
                              <tr key={j} className="border-b border-border/30">
                                <td className="py-1 px-2">{dr.date}</td>
                                <td className="py-1 px-2 text-right">{fmtInt(dr.impressions)}</td>
                                <td className="py-1 px-2 text-right">{fmtInt(dr.clicks)}</td>
                                <td className="py-1 px-2 text-right">{fmtInt(dr.orders)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
