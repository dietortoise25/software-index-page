import type { AnalysisResult, UserData } from "@/types/shopee"
import { fmtPct, fmtInt } from "@/lib/shopee-format"
import ShopeeTooltip from "./ShopeeTooltip"
import { Card } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

interface Props {
  data: AnalysisResult
  uKey: 'users' | 'paid_users'
}

export default function UserTab({ data, uKey }: Props) {
  const users: UserData = data[uKey]
  if (!users || users.total_buyers === 0) {
    return <div className="flex flex-col items-center py-12 text-muted-foreground text-sm">暂无用户数据</div>
  }

  const buyerData = [
    { name: '新买家', value: users.new_buyers, color: '#3b82f6' },
    { name: '老买家', value: users.existing_buyers, color: '#10b981' },
  ].filter(d => d.value > 0)

  const needsRetention = users.repeat_rate < 0.01 && users.total_buyers > 1
  const remarketOpportunity = users.potential_buyers > users.total_buyers * 2

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: '买家总数', value: fmtInt(users.total_buyers), tip: '报告期内完成购买的去重买家数。数据来源：店铺统计 Excel 买家字段。' },
          { label: '新买家', value: `${fmtInt(users.new_buyers)} (${fmtPct(users.new_ratio)})`, tip: '首次在该店铺购买的买家。占比>80% 说明拉新依赖过重，需提升复购。' },
          { label: '老买家', value: fmtInt(users.existing_buyers), tip: '历史购买过的回头客。数据来源：Shopee 的"现有买家数量"字段。' },
          { label: '复购率', value: fmtPct(users.repeat_rate), tip: '老买家 ÷ 总买家。健康参考 >5%。<1% 为严重零复购——所有生意靠拉新，不可持续。' },
          { label: '潜在买家', value: fmtInt(users.potential_buyers), tip: '加购/浏览但未付款的用户数。若远多于成交买家，存在再营销机会。' },
        ].map(c => (
          <Card key={c.label} className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              {c.label}
              <ShopeeTooltip content={c.tip} size={3} />
            </div>
            <div className="text-lg font-bold">{c.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">买家构成</h3>
          {buyerData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={buyerData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                  {buyerData.map((d, i) => (<Cell key={i} fill={d.color} />))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center py-12 text-muted-foreground text-sm">暂无数据</div>
          )}
          <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-2">
            {buyerData.map(d => (
              <span key={d.name}>● {d.name}: {d.value}</span>
            ))}
          </div>
        </Card>

        <div className="space-y-3">
          {needsRetention && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="text-sm font-medium text-orange-800">零复购风险</div>
              <p className="text-xs text-orange-600 mt-1">
                当前完全依赖拉新，无回头客。建议通过 Shopee 聊天发送优惠券或关注店铺引导，建立买家留存机制。
              </p>
            </div>
          )}
          {remarketOpportunity && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-sm font-medium text-blue-800">再营销机会</div>
              <p className="text-xs text-blue-600 mt-1">
                潜在买家（{users.potential_buyers}）远多于成交买家（{users.total_buyers}），
                可通过限时折扣或购物车提醒促进转化。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
