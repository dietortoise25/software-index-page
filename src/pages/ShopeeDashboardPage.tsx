import { useState, useMemo } from "react"
import { useSearchParams, useNavigate } from "react-router"
import { BarChart3, ArrowLeft, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import ShopeeTooltip from "@/components/shopee/ShopeeTooltip"
import type { AnalysisResult, OrderType, TabKey } from "@/types/shopee"
import { fmtDateRange } from "@/lib/shopee-format"
import KpiCards from "@/components/shopee/KpiCards"
import OrderToggle from "@/components/shopee/OrderToggle"
import SalesTab from "@/components/shopee/SalesTab"
import FunnelTab from "@/components/shopee/FunnelTab"
import ProductTab from "@/components/shopee/ProductTab"
import UserTab from "@/components/shopee/UserTab"

export default function ShopeeDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const raw = localStorage.getItem('analysisResult')
  const data: AnalysisResult | null = useMemo(() => {
    try { return raw ? JSON.parse(raw) : null }
    catch { return null }
  }, [raw])

  if (!data || !data.orders) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium mb-2">暂无分析数据</p>
        <p className="text-sm text-muted-foreground mb-6">请先上传店铺报表和广告数据，获取分析报告</p>
        <Button onClick={() => navigate('/shopee')}>
          <ArrowLeft className="w-4 h-4" />
          前往上传
        </Button>
      </div>
    )
  }

  const tabParam = searchParams.get('tab') as TabKey | null
  const typeParam = searchParams.get('type') as OrderType | null
  const [tab, setTab] = useState<TabKey>(tabParam || 'sales')
  const [orderType, setOrderType] = useState<OrderType>(typeParam || 'orders')

  const updateParams = (t: TabKey, ot: OrderType) => {
    setSearchParams({ tab: t, type: ot }, { replace: true })
  }

  const handleTab = (t: TabKey) => { setTab(t); updateParams(t, orderType) }
  const handleToggle = (ot: OrderType) => { setOrderType(ot); updateParams(tab, ot) }

  const tKey: 'traffic' | 'paid_traffic' = orderType === 'orders' ? 'traffic' : 'paid_traffic'
  const pKey: 'products' | 'paid_products' = orderType === 'orders' ? 'products' : 'paid_products'
  const uKey: 'users' | 'paid_users' = orderType === 'orders' ? 'users' : 'paid_users'

  const summary = data[orderType]?.summary
  const hasSales = !!(summary?.total_sales)
  const hasTraffic = !!(data[tKey]?.card?.impressions)
  const hasProducts = !!(data[pKey]?.items?.length)
  const hasUsers = !!(data[uKey]?.total_buyers)

  const TABS: { key: TabKey; label: string; empty: boolean }[] = [
    { key: 'sales', label: '销售概览', empty: !hasSales },
    { key: 'funnel', label: '流量漏斗', empty: !hasTraffic },
    { key: 'products', label: '商品矩阵', empty: !hasProducts },
    { key: 'users', label: '用户资产', empty: !hasUsers },
  ]

  return (
    <div className="container mx-auto px-4 py-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/shopee')}>
            <ArrowLeft className="w-4 h-4" />
            返回诊断
          </Button>
          <span className="text-border">|</span>
          <span className="text-sm text-muted-foreground">
            数据周期：<span className="font-medium text-foreground">{fmtDateRange(data.date_range?.start ?? null, data.date_range?.end ?? null)}</span>
          </span>
          <ShopeeTooltip content="以订单明细为可信数据源。店铺统计汇总行可能为零（Shopee 导出缺陷），已自动从日明细和订单数据补位。详见 docs/data-guide.md。" />
        </div>
        <OrderToggle value={orderType} onChange={handleToggle} />
      </div>

      {summary && <KpiCards summary={summary} />}

      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTab(t.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition relative ${
              tab === t.key ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.empty && tab !== t.key && (
              <span className="ml-1 text-amber-400" title="该维度暂无数据"><AlertTriangle className="w-3 h-3 inline" /></span>
            )}
          </button>
        ))}
      </div>

      {tab === 'sales' && <SalesTab data={data} orderType={orderType} />}
      {tab === 'funnel' && <FunnelTab data={data} tKey={tKey} />}
      {tab === 'products' && <ProductTab data={data} pKey={pKey} />}
      {tab === 'users' && <UserTab data={data} uKey={uKey} />}
    </div>
  )
}
