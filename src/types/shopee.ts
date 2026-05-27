export interface DateRange {
  start: string | null
  end: string | null
}

export interface OrderSummary {
  total_sales: number
  total_orders: number
  aov: number
  subsidy: number
  subsidy_rate: number
  cancelled_orders: number
  cancel_rate: number
  returned_orders: number
  return_rate: number
  sales_days: number
  total_days: number
  total_visitors: number
  total_clicks: number
  conversion_rate: number
  click_to_order_rate: number
}

export interface DailyOrder {
  '日期': string
  '销售额 (BRL)': number
  '订单数': number
  '商品点击量': number
  '访客数': number
  '订单转化率': number
  '买家数': number
  '新买家数': number
  '潜在买家数': number
}

export interface OrdersData {
  summary: OrderSummary
  daily: DailyOrder[]
}

export interface FunnelCard {
  impressions: number
  clicks: number
  orders: number
  ctr: number
  cvr: number
}

export interface Channel {
  name: string
  sales: number
  share: number
  impressions: number
  clicks: number
  orders: number
  ctr: number
  cvr: number
}

export interface SourceDaily {
  source: string
  date: string
  impressions: number
  clicks: number
  orders: number
}

export interface TrafficData {
  card: FunnelCard
  channels: Channel[]
  source_daily: SourceDaily[]
}

export interface Product {
  id: string
  name: string
  status: string
  sales: number
  share: number
  impressions: number
  clicks: number
  orders: number
  ctr: number
  cvr: number
}

export interface ProductData {
  items: Product[]
  top1_share: number
  top3_share: number
  top5_share: number
  product_count: number
}

export interface UserData {
  total_buyers: number
  new_buyers: number
  existing_buyers: number
  potential_buyers: number
  new_ratio: number
  repeat_rate: number
}

export interface AnalysisResult {
  date_range: DateRange
  sheet_names: Record<string, string>
  orders: OrdersData
  paid_orders: OrdersData
  traffic: TrafficData
  paid_traffic: TrafficData
  products: ProductData
  paid_products: ProductData
  users: UserData
  paid_users: UserData
}

export type OrderType = 'orders' | 'paid_orders'
export type TabKey = 'sales' | 'funnel' | 'products' | 'users'

export interface HealthCheck {
  id: string
  title: string
  health: 'pass' | 'critical' | 'warning' | 'info'
  threshold: number
  anchor: string
}

export interface DiagnoseProblem {
  id: string
  title: string
  severity: 'critical' | 'warning' | 'info'
  detail: string
  description: string
  actions: { type: string; label: string; impact?: string }[]
}

export interface DiagnosisData {
  overall_score: number
  health_checks: HealthCheck[]
  problems: DiagnoseProblem[]
  ai_insights: string | null
}

export interface AdMetrics {
  total_spend: number
  total_sales: number
  roas: number
  zero_conv_count: number
  zero_conv_spend: number
  high_roas_ads: Array<{ ad_name: string; spend: number; roas: number }>
  ad_count: number
  ctr: number
  cvr: number
}
