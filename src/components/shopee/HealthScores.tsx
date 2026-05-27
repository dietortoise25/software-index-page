import ShopeeTooltip from "./ShopeeTooltip"
import { Card } from "@/components/ui/card"

interface HealthCheck {
  id: string
  title: string
  health: string
  threshold: number
  anchor: string
}

interface Props {
  checks: HealthCheck[]
}

const ID_LABELS: Record<string, string> = {
  zero_conversion_waste: '预算效率',
  cancel_rate_high: '取消率',
  zero_repeat_purchase: '复购率',
  low_conversion_rate: '店铺转化',
  product_over_concentration: '商品集中度',
  high_new_buyer_dependency: '新客依赖',
  high_spend_no_conversion: '广告浪费',
  low_ad_ctr: '广告CTR',
}

const ID_TIPS: Record<string, string> = {
  zero_conversion_waste: '零转化广告花费 ÷ 总广告花费。>30% 触发告警——大量预算投在了不产生订单的广告上。',
  cancel_rate_high: '已取消订单 ÷ (总订单+取消)。>15% 告警。含系统自动取消和用户取消。',
  zero_repeat_purchase: '老买家 ÷ 总买家。<1% 告警——生意完全依赖拉新，无回头客。',
  low_conversion_rate: '订单数 ÷ 访客数。<2% 告警。衡量店铺流量→成交的效率。',
  product_over_concentration: 'Top5 商品销售 ÷ 总销售。>85% 告警——销售过于集中，单品风险高。',
  high_new_buyer_dependency: '新买家 ÷ 总买家。>80% 告警——过度依赖拉新，复购不足。',
  high_spend_no_conversion: '存在单条花费超阈值但零转化的广告。需逐条审查落地页/价格/关键词。',
  low_ad_ctr: '广告点击 ÷ 广告展示。<2% 告警。CTR 低说明广告素材/定向吸引力不足。',
}

const HEALTH_COLORS: Record<string, string> = {
  pass: 'border-green-200 bg-green-50',
  critical: 'border-red-200 bg-red-50',
  warning: 'border-amber-200 bg-amber-50',
  info: 'border-blue-200 bg-blue-50',
}

const HEALTH_DOTS: Record<string, string> = {
  pass: '🟢',
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
}

export default function HealthScores({ checks }: Props) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-2">健康评分卡</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {checks.map(c => (
          <Card key={c.id} className={`p-3 ${HEALTH_COLORS[c.health] || ''}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs">{HEALTH_DOTS[c.health] || '⚪'}</span>
              <span className="text-xs font-medium">
                {ID_LABELS[c.id] || c.title}
              </span>
              <ShopeeTooltip content={ID_TIPS[c.id] || c.title} size={3} />
            </div>
            <div className="text-xs text-muted-foreground">
              阈值: {(c.threshold * 100).toFixed(0)}% · {c.anchor === 'baseline' ? '数据基线' : c.anchor}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
