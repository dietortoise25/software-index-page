import { useEffect, useState, useCallback } from "react"
import { CalendarDays, TrendingUp, BarChart3, DollarSign, Loader2, AlertCircle, Lock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import PinGate from "@/components/review/PinGate"

type Dimension = "all" | "platform" | "operator"
type Platform = "TIKTOK" | "SHOPEE"

const PLATFORMS: Platform[] = ["TIKTOK", "SHOPEE"]

function getChinaDateRange(daysAgo: number): { start: string; end: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" })
  const now = new Date()
  now.setDate(now.getDate() - daysAgo)
  const dateStr = fmt.format(now)
  return { start: `${dateStr}T00:00:00+08:00`, end: `${dateStr}T23:59:59+08:00` }
}

function getMonthRange(offset: number): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + offset
  const target = new Date(Date.UTC(y, m, 1))
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const mm = String(target.getUTCMonth() + 1).padStart(2, "0")
  return {
    start: `${target.getUTCFullYear()}-${mm}-01T00:00:00+08:00`,
    end: `${target.getUTCFullYear()}-${mm}-${lastDay}T23:59:59+08:00`,
  }
}

interface ChartPoint { month: string; sales: number; count: number }

interface Metrics {
  todayCount: number
  yesterdayCount: number
  todaySales: number
  yesterdaySales: number
  thisMonthCount: number
  thisMonthSales: number
  lastMonthCount: number
  lastMonthSales: number
  chartData: ChartPoint[]
}

function delta(cur: number, prev: number): { sign: string; diff: number; pct: number | null } {
  const diff = cur - prev
  if (prev === 0) return { sign: diff > 0 ? "+" : "", diff, pct: null }
  return { sign: diff > 0 ? "+" : "", diff, pct: Math.round((diff / prev) * 100) }
}

function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  const d = delta(cur, prev)
  if (d.diff === 0) return <span className="text-muted-foreground text-xs">持平</span>
  const color = d.diff > 0 ? "text-emerald-500" : "text-red-500"
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      {d.diff > 0 ? "↑" : "↓"} {d.sign}{d.diff.toLocaleString()}
      {d.pct !== null && <span className="text-muted-foreground ml-0.5 text-[10px]">({d.sign}{d.pct}%)</span>}
    </span>
  )
}

// ===== 第2层：渠道分析 =====
const CHART_COLORS = ["oklch(0.7227 0.192 149.579)", "oklch(0.769 0.188 70.08)", "oklch(0.696 0.149 162.48)", "oklch(0.637 0.208 25.33)"]

function ChannelCharts({ dimension, platform, operatorId }: {
  dimension: Dimension; platform: Platform; operatorId: number
}) {
  const [data, setData] = useState<{ pie: { name: string; value: number }[]; bar: { month: string; TIKTOK: number; SHOPEE: number }[] } | null>(null)

  useEffect(() => {
    const from = getMonthRange(-5)
    const to = getChinaDateRange(0)
    let q = supabase.from("orders").select("platform, total_amount, pay_time").gte("pay_time", from.start).lte("pay_time", to.end)
    if (dimension === "platform") q = q.eq("platform", platform)
    if (dimension === "operator" && operatorId > 0) {
      supabase.schema("internal").from("shop_operators").select("shop_id").eq("operator_id", operatorId).then(({ data: bids }) => {
        const ids = (bids || []).map(b => (b as Record<string, unknown>).shop_id)
        if (ids.length) q.in("shop_id", ids)
      })
    }
    q.then(({ data: rows }) => {
      const rows_ = rows || []
      const pieMap: Record<string, number> = {}
      const barMap: Record<string, Record<string, number>> = {}
      for (const r of rows_) {
        const p = String(r.platform || "?")
        pieMap[p] = (pieMap[p] || 0) + parseFloat(String(r.total_amount || 0))
        const m = String(r.pay_time).slice(0, 7)
        if (!barMap[m]) barMap[m] = {}
        barMap[m][p] = (barMap[m][p] || 0) + parseFloat(String(r.total_amount || 0))
      }
      setData({
        pie: Object.entries(pieMap).map(([name, value]) => ({ name, value })),
        bar: Object.entries(barMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, vals]) => ({ month, TIKTOK: vals.TIKTOK || 0, SHOPEE: vals.SHOPEE || 0 })),
      })
    })
  }, [dimension, platform, operatorId])

  if (!data) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>平台 GMV 占比</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.pie} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ name, value }) => `${name} ${(value / data.pie.reduce((s, d) => s + d.value, 0) * 100).toFixed(0)}%`}>
                {data.pie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `BRL ${Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>平台销售额月对比</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.bar}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `BRL ${Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="TIKTOK" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="SHOPEE" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== 第3层：运营者排行 =====
function OperatorRanking({ dimension, platform, operatorId }: {
  dimension: Dimension; platform: Platform; operatorId: number
}) {
  const [data, setData] = useState<{ name: string; gmv: number; orders: number }[]>([])

  useEffect(() => {
    const thisMonth = getMonthRange(0)
    ;(async () => {
      const { data: bindings } = await supabase.schema("internal").from("shop_operators").select("shop_id, operator_id, operator:operators(name)")
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
      for (const r of rows || []) {
        const op = shopToOp.get(Number(r.shop_id))
        const key = op ? `${op.id}` : "unassigned"
        if (!opMap[key]) opMap[key] = { name: op?.name || "未分配", gmv: 0, orders: 0 }
        opMap[key].gmv += parseFloat(String(r.total_amount || 0))
        opMap[key].orders++
      }
      setData(Object.values(opMap).sort((a, b) => b.gmv - a.gmv).slice(0, 8))
    })()
  }, [dimension, platform, operatorId])

  if (!data.length) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>

  return (
    <Card>
      <CardHeader><CardTitle>本月运营者 GMV Top 8</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-2.5">
              <span className="w-6 text-center font-bold text-muted-foreground text-sm">{i + 1}</span>
              <span className="flex-1 font-medium text-sm">{d.name}</span>
              <span className="text-muted-foreground text-xs">{d.orders} 单</span>
              <span className="text-sm font-semibold">BRL {d.gmv.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ===== 第4层：订单健康度 =====
function OrderHealth({ dimension, platform, operatorId }: {
  dimension: Dimension; platform: Platform; operatorId: number
}) {
  const [data, setData] = useState<{ statusDist: { name: string; value: number }[]; totalOrders: number } | null>(null)

  useEffect(() => {
    (async () => {
      let q = supabase.from("orders").select("status")
      if (dimension === "platform") q = q.eq("platform", platform)
      if (dimension === "operator" && operatorId > 0) {
        const { data: bids } = await supabase.schema("internal").from("shop_operators").select("shop_id").eq("operator_id", operatorId)
        const ids = (bids || []).map(b => (b as Record<string, unknown>).shop_id)
        if (ids.length) q = q.in("shop_id", ids)
      }
      const { data: rows } = await q
      const dist: Record<string, number> = {}
      for (const r of rows || []) { const s = String(r.status || "UNKNOWN"); dist[s] = (dist[s] || 0) + 1 }
      setData({
        statusDist: Object.entries(dist).map(([name, value]) => ({ name, value })),
        totalOrders: (rows || []).length,
      })
    })()
  }, [dimension, platform, operatorId])

  if (!data) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>

  const statusLabels: Record<string, string> = {
    WAIT_PAYMENT: "待付款", WAIT_AUDIT: "待审核", WAIT_SHIP: "待发货",
    SHIPPING: "配送中", SHIPPED: "已发货", CLOSED: "已关闭",
    SHIP_FAILURE: "发货失败", PARTIALLY_SHIPPED: "部分发货",
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>订单状态分布</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.statusDist} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value"
                label={({ name, value }) => `${statusLabels[String(name)] || name} ${value}`}>
                {data.statusDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <p className="mt-2 text-center text-muted-foreground text-xs">总计 {data.totalOrders.toLocaleString()} 单</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>健康指标</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">已关闭订单占比</span>
              <span className="font-semibold text-sm">
                {((data.statusDist.find(d => d.name === "CLOSED")?.value || 0) / data.totalOrders * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">待发货/待审核</span>
              <span className="font-semibold text-sm">
                {data.statusDist.filter(d => ["WAIT_PAYMENT", "WAIT_AUDIT", "WAIT_SHIP"].includes(d.name)).reduce((s, d) => s + d.value, 0)} 单
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">配送中/已发货</span>
              <span className="font-semibold text-sm">
                {data.statusDist.filter(d => ["SHIPPING", "SHIPPED", "PARTIALLY_SHIPPED"].includes(d.name)).reduce((s, d) => s + d.value, 0)} 单
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== 第5层：广告费用分析 =====
function AdCostSection({ dimension, platform, operatorId }: {
  dimension: Dimension; platform: Platform; operatorId: number
}) {
  const [data, setData] = useState<{ monthly: { month: string; TIKTOK: number; SHOPEE: number; total: number }[]; rate: { month: string; rate: number }[]; summary: { spend: number; rate: number; affiliatePct: number } } | null>(null)

  useEffect(() => {
    (async () => {
      let q = supabase.from("ad_costs").select("*").order("report_month", { ascending: true }).limit(12)
      if (dimension === "platform") q = q.eq("platform", platform)
      const { data: rows } = await q
      const rows_ = (rows || []) as Record<string, unknown>[]

      // Merge same months from different platforms
      const merged: Record<string, { TIKTOK: number; SHOPEE: number; total: number }> = {}
      for (const r of rows_) {
        const m = String(r.report_month)
        if (!merged[m]) merged[m] = { TIKTOK: 0, SHOPEE: 0, total: 0 }
        const p = String(r.platform)
        const v = parseFloat(String(r.total_cost || 0))
        merged[m].total += v
        if (p === "TIKTOK") merged[m].TIKTOK = v
        if (p === "SHOPEE") merged[m].SHOPEE = v
      }
      const mergedArr = Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }))

      // Rate: need GMV for same months
      const rateArr: { month: string; rate: number }[] = []
      for (const m of mergedArr) {
        const start = `${m.month}-01T00:00:00+08:00`
        const end = `${m.month}-31T23:59:59+08:00`
        let gmvQ = supabase.from("orders").select("total_amount").gte("pay_time", start).lte("pay_time", end)
        if (dimension === "platform") gmvQ = gmvQ.eq("platform", platform)
        const { data: gmvRows } = await gmvQ
        const gmv = (gmvRows || []).reduce((s, r) => s + parseFloat(String(r.total_amount || 0)), 0)
        rateArr.push({ month: m.month, rate: gmv > 0 ? (m.total / gmv) * 100 : 0 })
      }

      const last = mergedArr[mergedArr.length - 1]
      const lastRate = rateArr[rateArr.length - 1]?.rate || 0
      const affiliateTotal = rows_.filter(r => r.platform === "TIKTOK").reduce((s, r) => s + parseFloat(String((r as any).affiliate_cost || 0)), 0)
      const totalSpend = last?.total || 0

      setData({
        monthly: mergedArr,
        rate: rateArr,
        summary: {
          spend: totalSpend,
          rate: lastRate,
          affiliatePct: totalSpend > 0 ? (affiliateTotal / totalSpend) * 100 : 0,
        },
      })
    })()
  }, [dimension, platform, operatorId])

  if (!data) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>

  if (!data.monthly.length) return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground text-sm">
        暂无广告费用数据，同步脚本将在每日凌晨 2:00 运行
      </CardContent>
    </Card>
  )

  return (
    <div>
      <div className="mb-4 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">本月广告支出</p>
            <p className="mt-1 text-xl font-bold">BRL {data.summary.spend.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">广告费用率</p>
            <p className={`mt-1 text-xl font-bold ${data.summary.rate > 25 ? "text-destructive" : data.summary.rate > 15 ? "text-amber-500" : "text-emerald-500"}`}>
              {data.summary.rate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">达人佣金占比</p>
            <p className="mt-1 text-xl font-bold">{data.summary.affiliatePct.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">数据月份</p>
            <p className="mt-1 text-xl font-bold">{data.monthly.length} 个月</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>平台广告支出</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `BRL ${Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`} />
                <Legend />
                <Bar dataKey="TIKTOK" stackId="a" fill={CHART_COLORS[0]} radius={[0, 0, 0, 0]} />
                <Bar dataKey="SHOPEE" stackId="a" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>广告费用率趋势</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.rate}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Line type="monotone" dataKey="rate" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [pinUnlocked, setPinUnlocked] = useState(() => sessionStorage.getItem("dash_pin") !== null)
  const [pinError, setPinError] = useState<string>()

  const handlePinUnlock = async (p: string) => {
    try {
      const resp = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: p }),
      })
      const data = await resp.json()
      if (data.ok) {
        sessionStorage.setItem("dash_pin", p)
        setPinUnlocked(true)
        setPinError(undefined)
      } else {
        setPinError("PIN 不正确")
      }
    } catch {
      setPinError("网络错误")
    }
  }

  if (!pinUnlocked) {
    return <PinGate onUnlock={handlePinUnlock} error={pinError} />
  }

  return <DashboardContent />
}

interface Operator { id: number; name: string; group_id: number | null }

function DashboardContent() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dimension, setDimension] = useState<Dimension>("all")
  const [platform, setPlatform] = useState<Platform>("TIKTOK")
  const [operatorId, setOperatorId] = useState<number>(0)
  const [operators, setOperators] = useState<Operator[]>([])

  useEffect(() => {
    if (dimension === "operator") {
      supabase.schema("internal").from("operators").select("id, name, group_id").order("name")
        .then(({ data }) => { if (data) setOperators(data as Operator[]) })
    }
  }, [dimension])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const today = getChinaDateRange(0)
      const yesterday = getChinaDateRange(1)
      const thisMonth = getMonthRange(0)
      const lastMonth = getMonthRange(-1)
      const chartFrom = getMonthRange(-5)

      const queries = [
        supabase.from("orders").select("*", { count: "exact", head: true })
          .gte("pay_time", today.start).lte("pay_time", today.end),
        supabase.from("orders").select("*", { count: "exact", head: true })
          .gte("pay_time", yesterday.start).lte("pay_time", yesterday.end),
        supabase.from("orders").select("*", { count: "exact", head: true })
          .gte("pay_time", thisMonth.start).lte("pay_time", thisMonth.end),
        supabase.from("orders").select("*", { count: "exact", head: true })
          .gte("pay_time", lastMonth.start).lte("pay_time", lastMonth.end),
        supabase.from("orders").select("total_amount")
          .gte("pay_time", today.start).lte("pay_time", today.end),
        supabase.from("orders").select("total_amount")
          .gte("pay_time", yesterday.start).lte("pay_time", yesterday.end),
        supabase.from("orders").select("total_amount")
          .gte("pay_time", thisMonth.start).lte("pay_time", thisMonth.end),
        supabase.from("orders").select("total_amount")
          .gte("pay_time", lastMonth.start).lte("pay_time", lastMonth.end),
        supabase.from("orders").select("pay_time, total_amount")
          .gte("pay_time", chartFrom.start).lte("pay_time", today.end),
      ]

      if (dimension === "platform") {
        for (const q of queries) q.eq("platform", platform)
      }

      if (dimension === "operator" && operatorId > 0) {
        const { data: bindings } = await supabase.schema("internal")
          .from("shop_operators").select("shop_id").eq("operator_id", operatorId)
        const shopIds = (bindings || []).map(b => (b as Record<string, unknown>).shop_id)
        if (shopIds.length > 0) {
          for (const q of queries) q.in("shop_id", shopIds)
        }
      }

      const [tc, yc, mc, lc, ts, ys, ms, ls, ch] = await Promise.all(queries)
      const results = [tc, yc, mc, lc, ts, ys, ms, ls, ch]
      for (const r of results) {
        if (r.error) throw r.error
      }

      const sum = (d: typeof ts) => (d.data ?? []).reduce((a, r) => a + (parseFloat(String(r.total_amount ?? 0)) || 0), 0)

      // 按月份汇总图表数据
      const monthMap: Record<string, { sales: number; count: number }> = {}
      for (const r of (ch.data ?? [])) {
        const m = String(r.pay_time).slice(0, 7)
        if (!monthMap[m]) monthMap[m] = { sales: 0, count: 0 }
        monthMap[m].sales += parseFloat(String(r.total_amount ?? 0)) || 0
        monthMap[m].count++
      }
      const chartData: ChartPoint[] = []
      for (let i = -5; i <= 0; i++) {
        const range = getMonthRange(i)
        const key = range.start.slice(0, 7)
        chartData.push({ month: key, ...monthMap[key] || { sales: 0, count: 0 } })
      }

      setMetrics({
        todayCount: tc.count ?? 0,
        yesterdayCount: yc.count ?? 0,
        todaySales: sum(ts),
        yesterdaySales: sum(ys),
        thisMonthCount: mc.count ?? 0,
        thisMonthSales: sum(ms),
        lastMonthCount: lc.count ?? 0,
        lastMonthSales: sum(ls),
        chartData,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败")
    } finally {
      setLoading(false)
    }
  }, [dimension, platform, operatorId])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-8 font-bold text-2xl tracking-tight">订单看板</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-4 font-bold text-2xl tracking-tight">订单看板</h1>
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <AlertCircle className="size-5 shrink-0 text-destructive" />
            <span className="text-destructive text-sm">{error}</span>
          </CardContent>
        </Card>
        <Button variant="outline" className="mt-4" onClick={fetchData}>重试</Button>
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">订单看板</h1>
          <p className="mt-1 text-muted-foreground text-sm">中国时区 · BRL</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border bg-muted/50 p-0.5">
            {([
              ["all", "全部"],
              ["platform", "平台"],
              ["operator", "运营者"],
            ] as [Dimension, string][]).map(([d, label]) => (
              <button
                key={d}
                onClick={() => setDimension(d)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  dimension === d ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {dimension === "platform" && (
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}

          {dimension === "operator" && (
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(Number(e.target.value))}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value={0}>全部运营者</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 实时对比 */}
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-base">
        <div
          className="size-2 rounded-full bg-emerald-500"
          style={{ animation: "heartbeat 1.4s ease-in-out infinite" }}
        />
        今日 vs 昨日 · 本月 vs 上月
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <CalendarDays className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>订单量</CardTitle>
              <p className="text-muted-foreground text-xs">今日 vs 昨日</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight">{metrics.todayCount}</div>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  截止 {new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg text-muted-foreground">昨日 {metrics.yesterdayCount}</div>
                <DeltaBadge cur={metrics.todayCount} prev={metrics.yesterdayCount} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle>销售额</CardTitle>
              <p className="text-muted-foreground text-xs">今日 vs 昨日 · BRL</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight">
                  {metrics.todaySales.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="mt-0.5 text-muted-foreground text-xs">今日</p>
              </div>
              <div className="text-right">
                <div className="text-lg text-muted-foreground">
                  昨日 {metrics.yesterdaySales.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <DeltaBadge cur={metrics.todaySales} prev={metrics.yesterdaySales} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent">
              <BarChart3 className="size-5 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <CardTitle>订单量</CardTitle>
              <p className="text-muted-foreground text-xs">
                {new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", month: "long" })} vs{" "}
                {(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", month: "long" }) })()}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight">{metrics.thisMonthCount}</div>
                <p className="mt-0.5 text-muted-foreground text-xs">本月</p>
              </div>
              <div className="text-right">
                <div className="text-lg text-muted-foreground">上月 {metrics.lastMonthCount}</div>
                <DeltaBadge cur={metrics.thisMonthCount} prev={metrics.lastMonthCount} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent">
              <TrendingUp className="size-5 text-accent-foreground" />
            </div>
            <div className="flex-1">
              <CardTitle>销售额</CardTitle>
              <p className="text-muted-foreground text-xs">本月 vs 上月 · BRL</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight">
                  {metrics.thisMonthSales.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="mt-0.5 text-muted-foreground text-xs">本月</p>
              </div>
              <div className="text-right">
                <div className="text-lg text-muted-foreground">
                  上月 {metrics.lastMonthSales.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <DeltaBadge cur={metrics.thisMonthSales} prev={metrics.lastMonthSales} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      <h2 className="mb-3 font-semibold text-base">近6个月趋势</h2>
      <Card>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={metrics.chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <Tooltip
                formatter={(value, name) => [
                  name === "count" ? `${value} 单` : `BRL ${Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`,
                  name === "count" ? "订单量" : "销售额",
                ]}
              />
              <Line type="monotone" dataKey="count" stroke="oklch(0.769 0.188 70.08)" strokeWidth={2}
                dot={{ r: 3 }} activeDot={{ r: 5 }} yAxisId="right" />
              <Line type="monotone" dataKey="sales" stroke="oklch(0.7227 0.192 149.579)" strokeWidth={2}
                dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* ===== 第2层：渠道分析 ===== */}
      <h2 className="mb-3 font-semibold text-base">渠道分析</h2>
      <ChannelCharts dimension={dimension} platform={platform} operatorId={operatorId} />

      <Separator className="my-8" />

      {/* ===== 第3层：运营者排行 ===== */}
      <h2 className="mb-3 font-semibold text-base">运营者排行</h2>
      <OperatorRanking dimension={dimension} platform={platform} operatorId={operatorId} />

      <Separator className="my-8" />

      {/* ===== 第4层：订单健康度 ===== */}
      <h2 className="mb-3 font-semibold text-base">订单健康度</h2>
      <OrderHealth dimension={dimension} platform={platform} operatorId={operatorId} />

      <Separator className="my-8" />

      {/* ===== 第5层：广告费用分析 ===== */}
      <h2 className="mb-3 font-semibold text-base">广告费用分析</h2>
      <AdCostSection dimension={dimension} platform={platform} operatorId={operatorId} />

      <Separator className="my-8" />

      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Lock className="size-3 text-muted-foreground" />
            <span className="text-muted-foreground text-xs">
              {dimension === "all" ? "全部平台" : dimension === "platform" ? `平台: ${platform}` : "全部运营者"}
            </span>
          </div>
          <a href="/internal/admin" className="text-muted-foreground text-xs hover:text-foreground transition-colors">管理分组与绑定 →</a>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { sessionStorage.removeItem("dash_pin"); window.location.reload() }}
        >
          <Lock className="mr-1 size-3" />
          锁定
        </Button>
      </div>
    </div>
  )
}
