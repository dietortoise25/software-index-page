/* ───────────────────────────────────────────────
   AI 经营 Copilot — 前端 API 接口契约
   本文件定义所有 API 的请求/响应类型 + 接口签名
   路径前缀: /api/copilot
   ─────────────────────────────────────────────── */

// ═══════════════════════════════════════════════
// 1. 事件流
// ═══════════════════════════════════════════════

export type EventType = "roi" | "sales" | "inventory" | "ad" | "profit"
export type EventSeverity = "high" | "medium" | "low"

export interface BusinessEvent {
  id: string
  eventType: EventType
  severity: EventSeverity
  title: string
  metric: string
  change: string
  direction: "up" | "down"
  timestamp: string // ISO 8601
  /** AI 分析概述 */
  aiSummary: string
  /** AI 分析的可能原因 */
  possibleCauses: string[]
  /** AI 建议 */
  suggestion: string
  /** 原始数据快照 (调试用) */
  rawData?: Record<string, unknown>
}

export interface EventOverview {
  total: number
  highCount: number
  mediumCount: number
  lowCount: number
  latestAlert: string | null // 最新高优先级事件标题
  aiDailyBrief: string // AI 今日摘要
}

// GET /api/copilot/events
// Query: { type?: EventType; severity?: EventSeverity; since?: string; limit?: number; offset?: number }
// Response: { data: BusinessEvent[]; total: number }

// GET /api/copilot/events/:id
// Response: { data: BusinessEvent }

// GET /api/copilot/events/overview
// Response: { data: EventOverview }

// ═══════════════════════════════════════════════
// 2. ChatBI
// ═══════════════════════════════════════════════

export interface ChatQuestion {
  question: string
  sessionId?: string // 预留多轮扩展
}

export interface ChatAnswer {
  id: string
  question: string
  answer: string // Markdown
  sqlExecuted?: string // 执行的 SQL (调试)
  timestamp: string
}

// POST /api/copilot/chat
// Body: ChatQuestion
// Response: { data: ChatAnswer }

// ═══════════════════════════════════════════════
// 3. 日报
// ═══════════════════════════════════════════════

export interface DailyMetric {
  label: string // "GMV" | "利润" | "订单数" | "ROI"
  value: string
  change: string // "+12%" | "-5%"
  direction: "up" | "down"
}

export interface TopSku {
  name: string
  profitShare: string // "18%"
  margin: string   // "35%"
  stockDays: number
  stockAlert: boolean // 库存 < 5 天
}

export interface DailyReport {
  date: string // "2026-05-19"
  metrics: DailyMetric[]
  topSkus: TopSku[]
  aiSummary: string // AI 总结段落
  anomalyEvents: Array<{
    title: string
    timestamp: string
    severity: EventSeverity
  }>
  pushTime: string // "09:00"
}

// GET /api/copilot/reports/latest
// Response: { data: DailyReport }

// GET /api/copilot/reports/:date
// Response: { data: DailyReport }

// ═══════════════════════════════════════════════
// 4. Skills
// ═══════════════════════════════════════════════

export type TriggerType =
  | "threshold"    // 指标 <|> 阈值
  | "rate_change"  // 环比变化
  | "trend"        // 连续N天趋势
  | "schedule"     // 定时

export interface TriggerConfig {
  metric: string       // 指标名
  operator: string     // "<" | ">" | "日环比" | "连续下降"
  value: number
  unit?: string
  interval?: string    // "每4小时" | "每日9:00"
}

export interface Skill {
  id: string
  name: string
  authorId: string
  authorName: string
  /** 自然语言描述 */
  description: string
  triggerType: TriggerType
  triggerConfig: TriggerConfig
  /** 自然语言分析流程描述 */
  analysisPrompt: string
  targetRole: string // "广告投放负责人" | "运营经理" | "采购经理"
  enabled: boolean
  shared: boolean
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface SkillCreateInput {
  name: string
  description: string
  triggerType: TriggerType
  triggerConfig: TriggerConfig
  analysisPrompt: string
  targetRole: string
  shared: boolean
}

export interface SkillUpdateInput extends Partial<SkillCreateInput> {
  enabled?: boolean
}

// GET /api/copilot/skills
// Query: { enabled?: boolean; shared?: boolean; authorId?: string }
// Response: { data: Skill[]; total: number }

// POST /api/copilot/skills
// Body: SkillCreateInput
// Response: { data: Skill }

// PUT /api/copilot/skills/:id
// Body: SkillUpdateInput
// Response: { data: Skill }

// DELETE /api/copilot/skills/:id
// Response: { ok: boolean }

// POST /api/copilot/skills/:id/toggle
// Body: { enabled: boolean }
// Response: { data: Skill }

// POST /api/copilot/skills/:id/copy
// Response: { data: Skill } // 复制出一个新 Skill

// GET /api/copilot/skills/market
// Query: { search?: string }
// Response: { data: Skill[]; total: number } // shared=true 的公开 Skills

// ═══════════════════════════════════════════════
// 5. 订阅与推送
// ═══════════════════════════════════════════════

export interface Subscription {
  eventType: EventType
  subscribed: boolean
  threshold: {
    metric: string
    operator: string
    value: number
    unit: string
  }
}

export interface UserSettings {
  userId: string
  subscriptions: Subscription[]
  channels: {
    inApp: boolean
    feishu: boolean
    email: boolean
  }
  quietHours: {
    enabled: boolean
    start: string // "22:00"
    end: string   // "08:00"
  }
}

export type PushMessageType = "alert" | "daily"

export interface PushMessage {
  id: string
  type: PushMessageType
  title: string
  summary: string
  time: string // "14:32"
  read: boolean
  eventId?: string // 关联事件ID (type=alert时)
  reportDate?: string // 关联日报日期 (type=daily时)
}

// GET /api/copilot/settings
// Response: { data: UserSettings }

// PUT /api/copilot/settings
// Body: UserSettings
// Response: { data: UserSettings }

// GET /api/copilot/pushes
// Query: { limit?: number; read?: boolean }
// Response: { data: PushMessage[]; unreadCount: number }

// POST /api/copilot/pushes/read
// Body: { ids?: string[] }  // 空数组 = 全部已读
// Response: { ok: boolean }

// POST /api/copilot/pushes/read/:id
// Response: { ok: boolean }

// ═══════════════════════════════════════════════
// 6. 通用响应格式
// ═══════════════════════════════════════════════

export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  ok: boolean
  data: T[]
  total: number
  offset?: number
  limit?: number
}

// ═══════════════════════════════════════════════
// 7. 实时通知 (SSE)
// ═══════════════════════════════════════════════

export type SSEEventType = "new_event" | "event_updated" | "push_received" | "report_generated"

export interface SSEMessage {
  type: SSEEventType
  payload: unknown
  timestamp: string
}

// GET /api/copilot/stream
// 响应: text/event-stream (SSE)
// 每行: data: SSEMessage
