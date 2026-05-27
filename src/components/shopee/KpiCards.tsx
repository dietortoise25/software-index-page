import type { OrderSummary } from "@/types/shopee"
import { fmtBRL, fmtPct, fmtInt } from "@/lib/shopee-format"
import ShopeeTooltip from "./ShopeeTooltip"
import { Card } from "@/components/ui/card"

interface Props {
  summary: OrderSummary
}

const TIPS: Record<string, string> = {
  '销售额': 'Σ 每日销售额 (BRL)。数据来源：店铺统计 Excel "已下订单" Sheet 日明细行。',
  '订单数': 'Σ 每日订单数。含已完成和已取消订单。',
  '客单价': '销售额 ÷ 订单数。衡量单笔订单价值。巴西美妆参考区间 R$15-30。',
  '转化率': '订单数 ÷ 访客数。访客→下单的转化效率。健康参考 >2%。',
  '取消率': '已取消订单 ÷ (总订单 + 取消订单)。含系统自动取消和用户主动取消。健康参考 <15%。',
  '补贴占比': '(销售额 - 扣除Shopee补贴后销售额) ÷ 销售额。衡量平台补贴依赖度。健康参考 <10%。',
}

export default function KpiCards({ summary }: Props) {
  const cards = [
    { label: '销售额', value: fmtBRL(summary.total_sales), accent: 'text-blue-600' },
    { label: '订单数', value: fmtInt(summary.total_orders), accent: 'text-emerald-600' },
    { label: '客单价', value: fmtBRL(summary.aov), accent: 'text-violet-600' },
    { label: '转化率', value: fmtPct(summary.conversion_rate), accent: 'text-indigo-600' },
    { label: '取消率', value: fmtPct(summary.cancel_rate), accent: 'text-amber-600' },
    { label: '补贴占比', value: fmtPct(summary.subsidy_rate), accent: 'text-rose-600' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      {cards.map(c => (
        <Card key={c.label} className="p-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            {c.label}
            <ShopeeTooltip content={TIPS[c.label] || ''} size={3} />
          </div>
          <div className={`text-lg font-bold ${c.accent}`}>{c.value}</div>
        </Card>
      ))}
    </div>
  )
}
