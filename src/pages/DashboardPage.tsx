import { useEffect, useState, useCallback } from "react"
import { CalendarDays, TrendingUp, BarChart3, DollarSign, Loader2, AlertCircle, Lock } from "lucide-react"
import { supabase } from "@/lib/supabase"
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

interface Metrics {
  todayCount: number
  yesterdayCount: number
  todaySales: number
  yesterdaySales: number
  thisMonthCount: number
  thisMonthSales: number
  lastMonthCount: number
  lastMonthSales: number
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
        sessionStorage.setItem("dash_pin", "1")
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

function DashboardContent() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dimension, setDimension] = useState<Dimension>("all")
  const [platform, setPlatform] = useState<Platform>("TIKTOK")

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const today = getChinaDateRange(0)
      const yesterday = getChinaDateRange(1)
      const thisMonth = getMonthRange(0)
      const lastMonth = getMonthRange(-1)

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
      ]

      if (dimension === "platform") {
        for (const q of queries) {
          q.eq("platform", platform)
        }
      }

      const [tc, yc, mc, lc, ts, ys, ms, ls] = await Promise.all(queries)
      const results = [tc, yc, mc, lc, ts, ys, ms, ls]
      for (const r of results) {
        if (r.error) throw r.error
      }

      const sum = (d: typeof ts) => (d.data ?? []).reduce((a, r) => a + (parseFloat(String(r.total_amount ?? 0)) || 0), 0)

      setMetrics({
        todayCount: tc.count ?? 0,
        yesterdayCount: yc.count ?? 0,
        todaySales: sum(ts),
        yesterdaySales: sum(ys),
        thisMonthCount: mc.count ?? 0,
        thisMonthSales: sum(ms),
        lastMonthCount: lc.count ?? 0,
        lastMonthSales: sum(ls),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败")
    } finally {
      setLoading(false)
    }
  }, [dimension, platform])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
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
      <div className="container mx-auto max-w-4xl px-4 py-8">
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
    <div className="container mx-auto max-w-4xl px-4 py-8">
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
                disabled={d === "operator"}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  d === "operator" ? "cursor-not-allowed text-muted-foreground/40" :
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
        </div>
      </div>

      {/* 实时对比 */}
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-base">
        <div
          className="size-2 rounded-full bg-emerald-500"
          style={{ animation: "heartbeat 1.4s ease-in-out infinite" }}
        />
        今日 vs 昨日
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      <Separator className="my-8" />

      {/* 月度对比 */}
      <h2 className="mb-3 font-semibold text-base">本月 vs 上月</h2>
      <div className="grid gap-4 sm:grid-cols-2">
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
