import { useState, useCallback, useEffect, useRef } from "react"
import {
  BellRing, MessageSquare, AlertTriangle, Brain, BarChart3,
  Send, Activity, Newspaper, X, Radio, HelpCircle,
  Settings, Wand2, Plus, Copy, Globe, Clock, SlidersHorizontal,
  Bell, Mail, ToggleLeft, ToggleRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

/* ────────────────────────────────────
   Mock Data
   ──────────────────────────────────── */

interface BusinessEvent {
  id: string
  eventType: "roi" | "sales" | "inventory" | "ad" | "profit"
  severity: "high" | "medium" | "low"
  title: string
  metric: string
  change: string
  direction: "up" | "down"
  timestamp: string
  aiSummary: string
  possibleCauses: string[]
  suggestion: string
}

const EVENT_TYPE_LABELS: Record<BusinessEvent["eventType"], string> = {
  roi: "ROI异常",
  sales: "销量异常",
  inventory: "库存异常",
  ad: "广告异常",
  profit: "利润异常",
}

const MOCK_EVENTS: BusinessEvent[] = [
  {
    id: "evt-001",
    eventType: "roi",
    severity: "high",
    title: "TikTok 美国站 ROI 异常下降",
    metric: "ROI",
    change: "-23%",
    direction: "down",
    timestamp: "14:32",
    aiSummary: "ROI从1.8降至1.39，主要由CPM上涨和CTR下降共同导致。西海岸广告组受影响最大。",
    possibleCauses: ["TikTok CPM 环比上涨 18%", "女性 25-34 岁用户 CTR 下降 12%", "Landing Page 加载速度变慢 0.8s"],
    suggestion: "建议关注西海岸广告组素材疲劳问题，可考虑降低该组预算 20% 并测试新素材。",
  },
  {
    id: "evt-002",
    eventType: "profit",
    severity: "medium",
    title: "冷冻虾毛利率持续下滑",
    metric: "毛利率",
    change: "-5.2%",
    direction: "down",
    timestamp: "14:15",
    aiSummary: "近7天冷冻虾品类毛利率从32%下降至26.8%，采购成本上涨是主因。",
    possibleCauses: ["采购成本环比上涨 8%", "物流运费上涨", "促销活动拉低均价"],
    suggestion: "建议与采购确认成本变动趋势，评估是否需要调整售价或更换供应商。",
  },
  {
    id: "evt-003",
    eventType: "sales",
    severity: "high",
    title: "美国站 GMV 异常下降",
    metric: "GMV",
    change: "-18%",
    direction: "down",
    timestamp: "13:50",
    aiSummary: "美国站今日GMV环比下降18%，转化率和客单价均下滑，虾仁缺货加剧了下降趋势。",
    possibleCauses: ["竞品开启大促活动", "虾仁缺货导致无法承接流量", "美国站转化率下降 5%"],
    suggestion: "建议优先补货虾仁，同时关注竞品促销动态并评估是否需要调整定价。",
  },
  {
    id: "evt-004",
    eventType: "inventory",
    severity: "high",
    title: "高利润 SKU 库存预警",
    metric: "库存天数",
    change: "< 3天",
    direction: "down",
    timestamp: "12:10",
    aiSummary: "3个高利润SKU库存不足3天，预计明天断货。这些SKU贡献了12%的利润。",
    possibleCauses: ["上周促销消耗库存过快", "补货周期未跟上", "供应商发货延迟"],
    suggestion: "建议立即联系采购紧急补货，同时在广告端暂停这3个SKU的推广。",
  },
  {
    id: "evt-005",
    eventType: "ad",
    severity: "high",
    title: "TikTok 广告 CPM 暴涨",
    metric: "CPM",
    change: "+35%",
    direction: "up",
    timestamp: "11:40",
    aiSummary: "TikTok美国西海岸CPM从$4.2飙升至$5.67，涨幅35%，拉低整体ROI约18个百分点。",
    possibleCauses: ["平台竞价竞争加剧", "素材点击率下降导致质量分降低", "广告受众重叠导致频次过高"],
    suggestion: "建议暂停西海岸高CPM广告组，重新测试新素材和受众组合后再恢复投放。",
  },
]

const TOP_SKUS = [
  { name: "冷冻虾仁 500g", profitShare: "18%", margin: "35%", stock: "2天", alert: true },
  { name: "调味虾 300g", profitShare: "12%", margin: "28%", stock: "7天", alert: false },
  { name: "虾滑 200g", profitShare: "9%", margin: "32%", stock: "1天", alert: true },
  { name: "冷冻大虾 1kg", profitShare: "8%", margin: "30%", stock: "5天", alert: false },
  { name: "虾饺 400g", profitShare: "7%", margin: "25%", stock: "12天", alert: false },
]

const PUSH_MESSAGES = [
  {
    id: "push-1",
    type: "alert",
    title: "TikTok 美国 ROI 下降 23%",
    summary: "CPM上涨 + CTR下降，建议关注西海岸广告组",
    time: "14:32",
  },
  {
    id: "push-2",
    type: "alert",
    title: "高利润 SKU 库存不足 3 天",
    summary: "虾仁、虾滑即将断货，建议紧急补货",
    time: "12:10",
  },
  {
    id: "push-3",
    type: "daily",
    title: "今日经营日报已生成",
    summary: "GMV +12%，利润 -5%",
    time: "09:00",
  },
]

interface Skill {
  id: string
  name: string
  author: string
  description: string
  trigger: string
  target: string
  enabled: boolean
  shared: boolean
}

const MOCK_SKILLS: Skill[] = [
  {
    id: "sk-001",
    name: "ROI 归因分析",
    author: "Alan",
    description: "当ROI低于阈值时，自动分析CPM、CTR、CVR变化，按渠道下钻，生成归因报告并标注主要驱动因素。",
    trigger: "TikTok ROI < 1.5 · 每4小时检查",
    target: "广告投放负责人",
    enabled: true,
    shared: true,
  },
  {
    id: "sk-002",
    name: "库存预警 + 补货建议",
    author: "Alan",
    description: "监控高利润SKU库存天数，当库存<5天时分析历史销量趋势、补货周期、供应商交期，生成补货建议。",
    trigger: "库存天数 < 5天 · 每日9:00 + 实时",
    target: "采购经理",
    enabled: true,
    shared: true,
  },
  {
    id: "sk-003",
    name: "竞品促销影响分析",
    author: "小明",
    description: "当GMV异常下降时，对比竞品促销日历、搜索排名变化、价格竞争力，判断是否为竞品活动冲击。",
    trigger: "GMV日环比下降 > 10% · 每日10:00",
    target: "运营经理",
    enabled: false,
    shared: true,
  },
  {
    id: "sk-004",
    name: "广告疲劳检测",
    author: "Alan",
    description: "监控广告素材CTR趋势，当CTR连续3天下降时分析频次、受众重叠率、素材生命周期，建议更换时机。",
    trigger: "CTR连续3天下降 · 每日8:00",
    target: "广告投放负责人",
    enabled: true,
    shared: false,
  },
]

interface SettingItem {
  eventType: BusinessEvent["eventType"] | "all"
  label: string
  subscribed: boolean
  threshold?: { metric: string; operator: string; value: number; unit: string }
}

const MOCK_SETTINGS: SettingItem[] = [
  { eventType: "roi", label: "ROI异常", subscribed: true, threshold: { metric: "ROI", operator: "<", value: 1.5, unit: "" } },
  { eventType: "sales", label: "销量异常", subscribed: true, threshold: { metric: "GMV", operator: "日环比", value: 10, unit: "%" } },
  { eventType: "ad", label: "广告异常", subscribed: true, threshold: { metric: "CPM", operator: "涨幅 >", value: 20, unit: "%" } },
  { eventType: "inventory", label: "库存异常", subscribed: true, threshold: { metric: "库存天数", operator: "<", value: 5, unit: "天" } },
  { eventType: "profit", label: "利润异常", subscribed: true, threshold: { metric: "毛利率", operator: "日降幅 >", value: 3, unit: "%" } },
]

/* ────────────────────────────────────
   Helpers
   ──────────────────────────────────── */

type View = "events" | "chat" | "report" | "skills" | "settings"

function SeverityDot({ severity }: { severity: BusinessEvent["severity"] }) {
  const c = { high: "bg-red-500", medium: "bg-amber-500", low: "bg-emerald-500" }
  return <span className={`inline-block size-2 rounded-full ${c[severity]}`} />
}

function EventTypeBadge({ type }: { type: BusinessEvent["eventType"] }) {
  const colors: Record<string, string> = {
    roi: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
    sales: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    inventory: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800",
    ad: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800",
    profit: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  }
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${colors[type]}`}>
      {EVENT_TYPE_LABELS[type]}
    </span>
  )
}

const CHAT_MOCK: Record<string, string> = {
  "为什么今天销量下降？":
    "今日GMV下降8%，主要来自：\n\n1. **美国站转化率下降 5%** — 可能与竞品促销有关\n2. **TikTok 流量环比减少 12%** — 广告素材 CTR 在下降\n3. **高利润SKU虾仁缺货** — 库存不足无法承接流量\n\n建议优先处理缺货问题，同时关注美国站竞品动态。",
  "最近利润变化趋势？":
    "近7天利润趋势：\n\n- **5/12-5/14**：利润 +5%（虾类促销带动）\n- **5/15-5/17**：利润 -3%（采购成本上涨）\n- **5/18-5/19**：利润 -5%（毛利率下降 + 物流费上涨）\n\n整体趋势：**短期承压**，压力主要来自成本端。",
  "哪个SKU贡献最高利润？":
    "近7天利润贡献 Top 5：\n\n1. **冷冻虾仁 500g** — 利润贡献 18%，毛利率 35%\n2. **调味虾 300g** — 利润贡献 12%，毛利率 28%\n3. **虾滑 200g** — 利润贡献 9%，毛利率 32%\n4. **冷冻大虾 1kg** — 利润贡献 8%，毛利率 30%\n5. **虾饺 400g** — 利润贡献 7%，毛利率 25%\n\n⚠️ 虾仁和虾滑当前库存均不足3天。",
}

/* ────────────────────────────────────
   Sub-Components
   ──────────────────────────────────── */

function NavItem({ icon: Icon, label, active, onClick }: {
  icon: React.FC<{ className?: string }>
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] transition-colors w-full
        ${active ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/40"}`}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </button>
  )
}

function EventCard({ event, selected, onClick }: {
  event: BusinessEvent
  selected: boolean
  onClick: () => void
}) {
  const isDown = event.direction === "down"
  const changeColor = isDown
    ? "text-red-600 dark:text-red-400"
    : "text-emerald-600 dark:text-emerald-400"

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-accent/30
        ${selected ? "bg-accent/50 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <SeverityDot severity={event.severity} />
            <EventTypeBadge type={event.eventType} />
          </div>
          <p className="text-sm font-medium truncate">{event.title}</p>
        </div>
        <div className={`shrink-0 text-right ${changeColor}`}>
          <span className="font-bold text-sm tabular-nums">{event.change}</span>
          <span className="text-[10px] ml-0.5 text-muted-foreground">{event.metric}</span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{event.timestamp}</p>
    </button>
  )
}

function EventDetail({ event }: { event: BusinessEvent }) {
  const isDown = event.direction === "down"
  const color = isDown ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <EventTypeBadge type={event.eventType} />
        <SeverityDot severity={event.severity} />
        <span className="text-xs text-muted-foreground">{event.timestamp}</span>
      </div>

      <h3 className="font-semibold mb-1">{event.title}</h3>
      <p className={`font-bold text-2xl tabular-nums mb-4 ${color}`}>
        {event.change} <span className="text-sm font-normal text-muted-foreground">{event.metric}</span>
      </p>

      {/* AI 概述 */}
      <div className="flex items-start gap-2.5 rounded-lg bg-accent/50 p-3 mb-4">
        <Brain className="size-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed">{event.aiSummary}</p>
      </div>

      {/* 可能原因 */}
      <p className="text-xs font-medium text-muted-foreground mb-2">可能原因</p>
      <ul className="space-y-1.5 mb-4">
        {event.possibleCauses.map((c, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="size-1.5 rounded-full bg-primary/60 shrink-0" />
            {c}
          </li>
        ))}
      </ul>

      {/* AI 建议 */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs font-medium text-primary mb-1">AI 建议</p>
        <p className="text-sm leading-relaxed">{event.suggestion}</p>
      </div>
    </div>
  )
}

function EventOverview() {
  const high = MOCK_EVENTS.filter((e) => e.severity === "high").length
  const medium = MOCK_EVENTS.filter((e) => e.severity === "medium").length
  const low = MOCK_EVENTS.filter((e) => e.severity === "low").length

  return (
    <div className="p-5">
      <div className="mb-4">
        <p className="font-semibold text-sm">今日经营概览</p>
        <p className="text-xs text-muted-foreground">2026-05-19 · 实时更新</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-2xl font-bold tabular-nums">{MOCK_EVENTS.length}</p>
          <p className="text-xs text-muted-foreground">事件总数</p>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{high}</p>
          <p className="text-xs text-red-600/70 dark:text-red-400/70">高优先级</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{medium}</p>
          <p className="text-xs text-muted-foreground">中优先级</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{low}</p>
          <p className="text-xs text-muted-foreground">低优先级</p>
        </div>
      </div>

      {/* 快速摘要 */}
      <div className="rounded-lg bg-accent/30 p-3">
        <p className="text-xs font-medium mb-1">AI 今日摘要</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          今日检测到 {MOCK_EVENTS.length} 个经营事件，其中 {high} 个需优先处理。ROI和库存是主要风险点，建议重点关注。
        </p>
      </div>
    </div>
  )
}

function ChatPanel() {
  const [input, setInput] = useState("")
  const [conversation, setConversation] = useState<Array<{ role: "user" | "ai"; text: string }>>([])

  const handleSend = (text?: string) => {
    const q = (text || input).trim()
    if (!q) return
    const answer = CHAT_MOCK[q] || "让我分析一下...\n\n建议从**流量来源**和**转化链路**两个角度排查。你想先看哪个平台的数据？"
    setConversation((prev) => [...prev, { role: "user", text: q }, { role: "ai", text: answer }])
    setInput("")
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center gap-2">
        <MessageSquare className="size-4 text-primary" />
        <span className="font-medium text-sm">ChatBI</span>
        <Badge variant="secondary" className="ml-auto text-[10px]">单轮问答</Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conversation.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BarChart3 className="size-8 text-muted-foreground/25 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">用自然语言探索经营数据</p>
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {Object.keys(CHAT_MOCK).map((s) => (
                <button key={s} onClick={() => handleSend(s)}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-accent/40 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {conversation.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "ai" && (
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                <Brain className="size-3.5 text-primary" />
              </div>
            )}
            <div className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%]
              ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <p className="whitespace-pre-line">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="输入经营问题..." autoFocus
          className="flex-1 rounded-xl border bg-muted/50 px-3.5 py-2 text-sm outline-none focus:border-primary/50 transition-colors" />
        <Button size="icon" onClick={() => handleSend()} disabled={!input.trim()} className="shrink-0 rounded-xl">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function DailyReportView() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-lg">AI 经营日报</h2>
            <p className="text-sm text-muted-foreground">2026年5月19日 · 每日 9:00 飞书推送</p>
          </div>
          <Badge variant="secondary">AI 生成</Badge>
        </div>

        {/* 核心指标 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "GMV", value: "R$ 38,240", change: "+12%", up: true },
            { label: "利润", value: "R$ 9,560", change: "-5%", up: false },
            { label: "订单数", value: "1,283", change: "+8%", up: true },
            { label: "ROI", value: "1.62", change: "-8%", up: false },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
              <p className="font-bold text-lg tabular-nums">{m.value}</p>
              <span className={`text-xs font-medium ${m.up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {m.change}
              </span>
            </div>
          ))}
        </div>

        {/* Top SKU */}
        <div className="mb-6">
          <h3 className="font-medium text-sm mb-3">Top SKU 利润贡献</h3>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">SKU</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">利润贡献</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">毛利率</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">库存</th>
                </tr>
              </thead>
              <tbody>
                {TOP_SKUS.map((sku) => (
                  <tr key={sku.name} className="border-t">
                    <td className="px-3 py-2.5 font-medium">{sku.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{sku.profitShare}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{sku.margin}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {sku.alert ? (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <AlertTriangle className="size-3" />
                          {sku.stock}
                        </span>
                      ) : sku.stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI 总结 */}
        <div className="flex items-start gap-2.5 rounded-lg bg-accent/50 p-4 mb-6">
          <Brain className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <p className="font-medium mb-1">AI 总结</p>
            <p>GMV增长12%主要来自巴西站虾类促销。利润下降5%因冷冻虾采购成本上涨及物流费用增加。虾仁和虾滑库存均不足3天，建议优先补货以避免断货损失。</p>
          </div>
        </div>

        {/* 异常事件简报 */}
        <div>
          <h3 className="font-medium text-sm mb-2">今日异常事件</h3>
          <div className="space-y-1.5">
            {MOCK_EVENTS.filter((e) => e.severity === "high").map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                <SeverityDot severity="high" />
                {e.title}
                <span className="text-xs text-muted-foreground/60 ml-auto">{e.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PushDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-80 border-l bg-background shadow-2xl animate-[fadeInUp_0.2s_ease-out]">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <BellRing className="size-4 text-primary" />
            <span className="font-medium text-sm">推送消息</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto">
          {PUSH_MESSAGES.map((msg) => (
            <div key={msg.id} className="px-4 py-3 border-b hover:bg-accent/20 transition-colors">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${msg.type === "alert" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"}`}>
                  {msg.type === "alert" ? "预警" : "日报"}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">{msg.time}</span>
              </div>
              <p className="text-sm font-medium">{msg.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{msg.summary}</p>
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 border-t bg-muted/30 px-4 py-2.5">
          <p className="text-[10px] text-muted-foreground text-center">通过飞书机器人自动推送 · 仅高价值异常</p>
        </div>
      </div>
    </>
  )
}

function SettingsView() {
  const [items, setItems] = useState(MOCK_SETTINGS)

  const toggle = (i: number) => {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, subscribed: !item.subscribed } : item))
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-lg">订阅配置</h2>
            <p className="text-sm text-muted-foreground">管理事件订阅和通知偏好</p>
          </div>
        </div>

        {/* 事件订阅 */}
        <div className="mb-8">
          <h3 className="font-medium text-sm mb-3">事件类型订阅</h3>
          <div className="rounded-lg border overflow-hidden">
            {items.map((item, i) => (
              <div key={item.eventType} className={`flex items-center gap-4 px-4 py-3.5 ${i > 0 ? "border-t" : ""} hover:bg-accent/20 transition-colors`}>
                <button onClick={() => toggle(i)} className="shrink-0">
                  {item.subscribed
                    ? <ToggleRight className="size-6 text-primary" />
                    : <ToggleLeft className="size-6 text-muted-foreground/40" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  {item.threshold && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.threshold.metric} {item.threshold.operator} {item.threshold.value}{item.threshold.unit} 时触发
                    </p>
                  )}
                </div>
                {item.subscribed && item.threshold && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2 py-1 shrink-0">
                    <SlidersHorizontal className="size-3" />
                    阈值可调
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 自定义阈值示例 — 仅当订阅时显示 */}
        <div className="mb-8">
          <h3 className="font-medium text-sm mb-3">自定义阈值</h3>
          <div className="space-y-3">
            {items.filter((s) => s.subscribed).slice(0, 3).map((item) => (
              <div key={item.eventType} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{item.label}</p>
                  {item.threshold && (
                    <span className="text-xs text-muted-foreground">
                      当前：{item.threshold.metric} {item.threshold.operator} {item.threshold.value}{item.threshold.unit}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">阈值</span>
                  <input type="range" className="flex-1 accent-primary" min={0} max={100} defaultValue={item.threshold?.value || 50} />
                  <span className="text-sm font-medium tabular-nums w-12 text-right">{item.threshold?.value}{item.threshold?.unit || ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 推送渠道 */}
        <div className="mb-8">
          <h3 className="font-medium text-sm mb-3">推送渠道</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Bell, label: "站内通知", active: true },
              { icon: MessageSquare, label: "飞书消息", active: true },
              { icon: Mail, label: "邮件", active: false },
            ].map((ch) => (
              <div key={ch.label} className={`rounded-lg border p-3 text-center cursor-pointer transition-colors ${ch.active ? "border-primary/50 bg-primary/5" : "opacity-50 hover:opacity-80"}`}>
                <ch.icon className={`size-5 mx-auto mb-1 ${ch.active ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-xs font-medium">{ch.label}</p>
                {ch.active && <p className="text-[10px] text-primary mt-0.5">已开启</p>}
              </div>
            ))}
          </div>
        </div>

        {/* 静默时段 */}
        <div>
          <h3 className="font-medium text-sm mb-3">静默时段</h3>
          <div className="rounded-lg border p-4 flex items-center gap-4">
            <Clock className="size-5 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">22:00</span>
              <span className="text-muted-foreground">至</span>
              <span className="font-medium">08:00</span>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">期间不推送非紧急通知</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SkillsView() {
  const [skills, setSkills] = useState(MOCK_SKILLS)
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [leftWidth, setLeftWidth] = useState(42)
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = Math.min(75, Math.max(20, (x / rect.width) * 100))
      setLeftWidth(pct)
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [])

  const toggleSkill = (id: string) => {
    setSkills((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* Left: Skill List */}
      <div className="flex flex-col border-r" style={{ width: `${leftWidth}%`, minWidth: 260 }}>
        <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">分析 Skills</p>
            <p className="text-[10px] text-muted-foreground">数分师固化的分析能力</p>
          </div>
          <Button size="icon" className="size-7 rounded-lg" onClick={() => setShowCreate(true)}>
            <Plus className="size-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {skills.map((skill) => (
            <button
              key={skill.id}
              onClick={() => setSelectedSkill(skill)}
              className={`w-full text-left px-4 py-3 border-b transition-colors hover:bg-accent/20
                ${selectedSkill?.id === skill.id ? "bg-accent/50 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{skill.name}</span>
                <button onClick={(e) => { e.stopPropagation(); toggleSkill(skill.id) }}>
                  {skill.enabled
                    ? <ToggleRight className="size-5 text-primary" />
                    : <ToggleLeft className="size-5 text-muted-foreground/40" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{skill.description}</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{skill.author}</span>
                {skill.shared && (
                  <span className="rounded-full bg-blue-100 dark:bg-blue-950/30 px-1.5 py-0.5 text-[10px] text-blue-700 dark:text-blue-400">共享</span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="shrink-0 border-t px-4 py-2 text-[10px] text-muted-foreground">
          共 {skills.length} 个 Skill · {skills.filter((s) => s.enabled).length} 个启用中
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={onMouseDown}
        className="group relative flex w-[5px] shrink-0 cursor-col-resize items-center justify-center bg-transparent hover:bg-primary/20 transition-colors"
      >
        <div className="absolute inset-y-0 w-px bg-border group-hover:bg-primary/40 transition-colors" />
        <div className="z-10 flex h-8 w-1 flex-col items-center justify-center gap-[3px] rounded-full bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="size-[2px] rounded-full bg-muted-foreground/60" />
          <span className="size-[2px] rounded-full bg-muted-foreground/60" />
          <span className="size-[2px] rounded-full bg-muted-foreground/60" />
        </div>
      </div>

      {/* Right: Skill Detail / Create Form */}
      <div className="flex-1 overflow-y-auto">
        {showCreate ? (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-sm">创建新 Skill</h3>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-accent">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium mb-1">技能名称</p>
                <input className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50" placeholder="如：ROI 归因分析" />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">自然语言描述</p>
                <textarea className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none h-24" placeholder="用自然语言描述这个分析的流程：当什么情况发生时，先看什么，再看什么，最后生成什么结论…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium mb-1">触发条件</p>
                  <select className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none">
                    <option>ROI &lt; 阈值</option>
                    <option>GMV 日环比下降</option>
                    <option>库存 &lt; 天数</option>
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">推送对象</p>
                  <select className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none">
                    <option>广告投放负责人</option>
                    <option>运营经理</option>
                    <option>采购经理</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>取消</Button>
                <Button size="sm" onClick={() => setShowCreate(false)}>创建 Skill</Button>
              </div>
            </div>
          </div>
        ) : selectedSkill ? (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wand2 className="size-4 text-primary" />
                <h3 className="font-medium text-sm">{selectedSkill.name}</h3>
              </div>
              <button onClick={() => { toggleSkill(selectedSkill.id); }}>
                {selectedSkill.enabled
                  ? <ToggleRight className="size-5 text-primary" />
                  : <ToggleLeft className="size-5 text-muted-foreground/40" />}
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-accent/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">分析描述</p>
                <p className="text-sm leading-relaxed">{selectedSkill.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">触发条件</p>
                  <p className="text-sm font-medium">{selectedSkill.trigger}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">推送对象</p>
                  <p className="text-sm font-medium">{selectedSkill.target}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>作者：{selectedSkill.author}</span>
                {selectedSkill.shared && (
                  <>
                    <Globe className="size-3" />
                    <span className="text-blue-600 dark:text-blue-400">团队共享</span>
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm"><Copy className="size-3.5 mr-1" />复制此 Skill</Button>
                <Button variant="outline" size="sm">编辑</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Wand2 className="size-10 mb-3 opacity-25" />
            <p className="text-sm">选择一个 Skill 查看详情</p>
            <p className="text-xs mt-1 opacity-70">或点击 + 创建新的分析技能</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────
   Main APP Shell
   ──────────────────────────────────── */

const FILTER_TABS: Array<{ key: BusinessEvent["eventType"] | "all"; label: string }> = [
  { key: "all", label: "全部" },
  { key: "roi", label: "ROI异常" },
  { key: "sales", label: "销量异常" },
  { key: "ad", label: "广告异常" },
  { key: "inventory", label: "库存异常" },
  { key: "profit", label: "利润异常" },
]

export default function FuturePage() {
  const [view, setView] = useState<View>("events")
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<BusinessEvent["eventType"] | "all">("all")
  const [pushOpen, setPushOpen] = useState(false)

  // Panel resize
  const [leftWidth, setLeftWidth] = useState(42) // percentage
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = Math.min(75, Math.max(20, (x / rect.width) * 100))
      setLeftWidth(pct)
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [])

  const filteredEvents = filterType === "all"
    ? MOCK_EVENTS
    : MOCK_EVENTS.filter((e) => e.eventType === filterType)

  const selectedEvent = MOCK_EVENTS.find((e) => e.id === selectedEventId) || null

  const rightPanel = () => {
    if (view === "chat") return <ChatPanel />
    if (view === "report" || view === "settings") return null
    if (view === "skills") return null
    if (selectedEvent) return <EventDetail event={selectedEvent} />
    return <EventOverview />
  }

  // Only show resize handle in events/chat views
  const showResize = view === "events" || view === "chat"

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ── Header Bar ── */}
      <header className="flex h-11 items-center justify-between border-b px-4 shrink-0 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
            <Activity className="size-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm">AI 经营 Copilot</span>
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/30 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            运行中
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPushOpen(true)}
            className="relative rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
          >
            <BellRing className="size-4" />
            <span className="absolute top-1 right-1 size-2 rounded-full bg-red-500" />
          </button>
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10">
            <span className="text-xs font-medium text-primary">A</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <nav className="flex w-[52px] shrink-0 flex-col items-center border-r py-3 gap-1 px-1.5 bg-muted/20">
          <NavItem icon={Radio} label="事件流" active={view === "events"} onClick={() => { setView("events"); setSelectedEventId(null) }} />
          <NavItem icon={MessageSquare} label="ChatBI" active={view === "chat"} onClick={() => setView("chat")} />
          <NavItem icon={Newspaper} label="日报" active={view === "report"} onClick={() => setView("report")} />
          <NavItem icon={Wand2} label="Skills" active={view === "skills"} onClick={() => setView("skills")} />
          <NavItem icon={Settings} label="设置" active={view === "settings"} onClick={() => setView("settings")} />

          <div className="mt-auto mb-1 relative group">
            <div className="flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors cursor-default">
              <HelpCircle className="size-4" />
              <span>MVP</span>
            </div>
            <div className="absolute left-full bottom-0 ml-2 w-48 rounded-lg border bg-popover p-3 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <p className="text-xs font-medium mb-1.5">MVP 阶段边界</p>
              <ul className="space-y-1 text-[11px] text-muted-foreground">
                <li className="text-red-500">✗ 不做自动经营决策</li>
                <li className="text-red-500">✗ 不做自动预算调整</li>
                <li className="text-red-500">✗ 不做多Agent协同</li>
                <li className="text-red-500">✗ 不做复杂因果推断</li>
                <li className="text-emerald-600 dark:text-emerald-400 mt-1">✓ 异常发现 + AI解释</li>
                <li className="text-emerald-600 dark:text-emerald-400">✓ 经营日报 + ChatBI</li>
                <li className="text-emerald-600 dark:text-emerald-400">✓ Skills 分析能力固化</li>
              </ul>
            </div>
          </div>
        </nav>

        {/* ── Main Workspace ── */}
        <main className="flex flex-1 overflow-hidden">
          {view === "report" ? (
            <DailyReportView />
          ) : view === "settings" ? (
            <SettingsView />
          ) : view === "skills" ? (
            <SkillsView />
          ) : (
            <div ref={containerRef} className="flex flex-1 overflow-hidden">
              {/* Left: Event List */}
              <div className="flex flex-col border-r" style={{ width: `${leftWidth}%`, minWidth: 260 }}>
                {/* Filter pills */}
                <div className="shrink-0 px-3 py-2.5 flex items-center gap-1.5 overflow-x-auto border-b">
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setFilterType(tab.key)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors
                        ${filterType === tab.key
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/40"}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Event list */}
                <div className="flex-1 overflow-y-auto">
                  {filteredEvents.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">无匹配事件</p>
                  ) : (
                    filteredEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        selected={selectedEventId === event.id}
                        onClick={() => setSelectedEventId(event.id)}
                      />
                    ))
                  )}
                </div>

                <div className="shrink-0 border-t px-3 py-2 text-[10px] text-muted-foreground">
                  共 {filteredEvents.length} 个事件 · 实时检测中
                </div>
              </div>

              {/* Resize Handle */}
              {showResize && (
                <div
                  onMouseDown={onMouseDown}
                  className="group relative flex w-[5px] shrink-0 cursor-col-resize items-center justify-center bg-transparent hover:bg-primary/20 transition-colors"
                >
                  <div className="absolute inset-y-0 w-px bg-border group-hover:bg-primary/40 transition-colors" />
                  <div className="z-10 flex h-8 w-1 flex-col items-center justify-center gap-[3px] rounded-full bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="size-[2px] rounded-full bg-muted-foreground/60" />
                    <span className="size-[2px] rounded-full bg-muted-foreground/60" />
                    <span className="size-[2px] rounded-full bg-muted-foreground/60" />
                  </div>
                </div>
              )}

              {/* Right: Detail / ChatBI */}
              <div className="flex-1 overflow-y-auto">
                {rightPanel()}
              </div>
            </div>
          )}
        </main>
      </div>

      <PushDrawer open={pushOpen} onClose={() => setPushOpen(false)} />
    </div>
  )
}
