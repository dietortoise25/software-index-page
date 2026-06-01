import { useState, useRef, useEffect, useCallback } from "react"
import { Play, Save, RefreshCw, CheckCircle, XCircle, Loader2, Clock, Search, Send, FileText, ChevronDown, ChevronRight, Lightbulb, Plus, Pencil, Trash2, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth-context"
import { newsConfigSchema } from "@/lib/validation"

// ─── 类型 ───────────────────────────────────────────────

interface NewsConfig {
  topics: string[]
  keywords: string[]
  cron: string
  receive_id: string
  receive_type: "open_id" | "chat_id"
  language: string
  search_count: number
  card_count: number
  mode: "manual" | "ai"
  goal: string
  enabled: boolean
  sources: string[]
  source_options?: Record<string, { search_count?: number; read_count?: number }>
}

type StageStatus = "idle" | "active" | "done" | "error"

interface StageState {
  label: string
  status: StageStatus
  detail?: string
  timestamp?: string
  thinking?: string
  icon: typeof CheckCircle
  subStages?: Array<{ source: string; label: string; status: StageStatus; detail?: string }>
}

interface ConfigRow {
  id: string
  name: string
  config: NewsConfig
  created_at: string
}

interface RunRecord {
  id: string
  status: "pending" | "running" | "success" | "failed"
  trigger_type: "manual" | "cron"
  search_query?: string
  result_count?: number
  summary?: unknown
  card_json?: unknown
  error?: string
  started_at: string
  finished_at?: string
}

// ─── 辅助 ────────────────────────────────────────────────

const ICONS: Record<StageStatus, typeof CheckCircle> = {
  idle: Clock,
  active: Loader2,
  done: CheckCircle,
  error: XCircle,
}

const STATUS_COLORS: Record<StageStatus, string> = {
  idle: "text-muted-foreground",
  active: "text-blue-500",
  done: "text-green-500",
  error: "text-red-500",
}

const LINE_COLORS: Record<StageStatus, string> = {
  idle: "bg-border",
  active: "bg-blue-300",
  done: "bg-green-300",
  error: "bg-red-300",
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatDuration(ms: number) {
  return (ms / 1000).toFixed(1) + "s"
}

// ─── StageNode ───────────────────────────────────────────

function StageNode({ stage, isLast }: { stage: StageState; isLast: boolean }) {
  const Icon = ICONS[stage.status]
  const colorClass = STATUS_COLORS[stage.status]
  const [showThinking, setShowThinking] = useState(false)

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <Icon className={`w-4 h-4 ${colorClass} ${stage.status === "active" ? "animate-spin" : ""}`} />
        {!isLast && <div className={`w-px h-6 ${LINE_COLORS[stage.status]}`} />}
      </div>
      <div className="pb-3 min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">{stage.label}</p>
          {stage.thinking && (
            <div className="relative">
              <Info
                className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help transition-colors"
                onMouseEnter={() => setShowThinking(true)}
                onMouseLeave={() => setShowThinking(false)}
              />
              {showThinking && (
                <div className="absolute left-0 bottom-full mb-1 z-50 w-72 max-h-48 overflow-y-auto bg-popover border rounded-lg p-3 shadow-lg">
                  <p className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">{stage.thinking}</p>
                </div>
              )}
            </div>
          )}
        </div>
        {stage.detail && <p className="text-xs text-muted-foreground truncate">{stage.detail}</p>}
        {stage.timestamp && <p className="text-[10px] text-muted-foreground/60">{stage.timestamp}</p>}
        {stage.subStages?.map((ss, i) => {
          const SubIcon = ICONS[ss.status]
          const subColor = STATUS_COLORS[ss.status]
          return (
            <div key={i} className="flex items-center gap-1.5 mt-0.5 ml-1">
              <SubIcon className={`w-3 h-3 ${subColor} ${ss.status === "active" ? "animate-spin" : ""}`} />
              <span className="text-[10px] text-muted-foreground">{ss.label}</span>
              {ss.detail && <span className="text-[9px] text-muted-foreground/60">{ss.detail}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── PipelineView ────────────────────────────────────────

function PipelineView({ stages, error }: { stages: StageState[]; error?: string }) {
  return (
    <div className="border rounded-lg p-4 space-y-1 bg-muted/10">
      <h3 className="text-sm font-semibold mb-3">流水线状态</h3>
      {stages.map((s, i) => (
        <StageNode key={i} stage={s} isLast={i === stages.length - 1} />
      ))}
      {error && (
        <div className="flex gap-3">
          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}

// ─── ConfigPanel ─────────────────────────────────────────

function errClass(key: string, errs: Record<string, string>) {
  return errs[key] ? "border-destructive" : ""
}

function ConfigPanel({ config, onChange, onSave, saving, mode, onModeChange, goal, onGoalChange, selfOpenId, formErrors, apiKeys }: {
  config: NewsConfig
  onChange: (c: NewsConfig) => void
  onSave: () => void
  saving: boolean
  mode: "manual" | "ai"
  onModeChange: (m: "manual" | "ai") => void
  goal: string
  onGoalChange: (g: string) => void
  selfOpenId: string
  formErrors: Record<string, string>
  apiKeys: Record<string, string>
}) {
  const LANG_ITEMS = [{ label: "中文", value: "zh" }, { label: "English", value: "en" }]
  const RECEIVE_ITEMS = [
    { label: "发给自己", value: "open_id" },
    { label: "群聊 (chat_id)", value: "chat_id" },
  ]
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold">配置</h3>

      {/* 模式切换 */}
      <div className="flex gap-1 bg-muted rounded p-0.5">
        <button onClick={() => onModeChange("ai")}
          className={`flex-1 text-xs py-1 rounded font-medium transition-colors ${mode === "ai" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >AI 生成</button>
        <button onClick={() => onModeChange("manual")}
          className={`flex-1 text-xs py-1 rounded font-medium transition-colors ${mode === "manual" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >手动配置</button>
      </div>

      {mode === "ai" ? (
        <div>
          <label className="text-[11px] text-muted-foreground">你想了解什么？</label>
          <Textarea value={goal} onChange={e => onGoalChange(e.target.value)}
            placeholder="身处中国的跨境电商公司文案策划，运营公司自媒体账号，需要巴西最新资讯…"
            rows={3}
            className="text-xs mt-0.5 resize-none" />
        </div>
      ) : (
        <>
          <div>
            <label className="text-[11px] text-muted-foreground">新闻主题（逗号分隔）</label>
            <Input value={config.topics.join(", ")} onChange={e => onChange({ ...config, topics: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
              className="text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">关键词（逗号分隔）</label>
            <Input value={config.keywords.join(", ")} onChange={e => onChange({ ...config, keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
              className="text-xs mt-0.5" />
          </div>
        </>
      )}

      {/* 新闻源多选 + 搜索数 */}
      <div>
        <label className="text-[11px] text-muted-foreground">新闻源</label>
        <div className="flex flex-col gap-1.5 mt-0.5">
          {[
            { key: "tavily", label: "Tavily", api: "tavily" },
            { key: "jina_search", label: "Jina 搜索", api: "jina" },
            { key: "jina_deep", label: "Jina 深度", api: "jina" },
          ].map(src => {
            const checked = (config.sources || ["tavily"]).includes(src.key)
            const missingKey = src.api && apiKeys[src.api] !== "configured"
            const opts = config.source_options?.[src.key] || {}
            const searchCount = opts.search_count ?? config.search_count
            return (
              <label key={src.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => {
                  const s = config.sources || ["tavily"]
                  onChange({ ...config, sources: checked ? s.filter(x => x !== src.key) : [...s, src.key] })
                }} className="w-3 h-3" />
                <span className="w-14">{src.label}</span>
                {missingKey && <span className="text-[10px] text-amber-500" title="API Key 未配置">⚠️</span>}
                {checked && (
                  <input type="number" min={1} max={200} value={searchCount}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      const v = parseInt(e.target.value) || 10
                      onChange({ ...config, source_options: { ...config.source_options, [src.key]: { ...opts, search_count: v } } })
                    }}
                    className="w-12 text-xs border rounded px-1 py-px"
                  />
                )}
              </label>
            )
          })}
        </div>
        {formErrors.sources && <p className="text-[10px] text-destructive mt-0.5">{formErrors.sources}</p>}
      </div>

      {/* 定时触发 + 时间 */}
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-muted-foreground shrink-0">定时触发</label>
        <button onClick={() => onChange({ ...config, enabled: !(config.enabled ?? true) })}
          className={`w-8 h-4 rounded-full transition-colors shrink-0 ${(config.enabled ?? true) ? "bg-primary" : "bg-muted-foreground/30"}`}
        >
          <div className={`w-3 h-3 rounded-full bg-white transition-transform mx-0.5 ${(config.enabled ?? true) ? "translate-x-3.5" : ""}`} />
        </button>
        <Input type="time" value={cronToTime(config.cron)}
          onChange={e => onChange({ ...config, cron: timeToCron(e.target.value) })}
          disabled={!(config.enabled ?? true)}
          step="60"
          className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none text-xs w-24" />
        <span className="text-[11px] text-muted-foreground ml-1">每天</span>
      </div>

      <div>
        <label className="text-[11px] text-muted-foreground">语言</label>
        <Select items={LANG_ITEMS} value={config.language} onValueChange={v => onChange({ ...config, language: v ?? "zh" })}>
          <SelectTrigger className="text-xs mt-0.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh">中文</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">接收者 ID</label>
          <Input value={config.receive_id} onChange={e => onChange({ ...config, receive_id: e.target.value })}
            placeholder="ou_xxx 或 chat_xxx"
            className={`text-xs mt-0.5 font-mono ${errClass("receive_id", formErrors)}`} />
          {formErrors.receive_id && <p className="text-[10px] text-destructive mt-0.5">{formErrors.receive_id}</p>}
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">接收者类型</label>
          <Select items={RECEIVE_ITEMS} value={config.receive_type} onValueChange={v => {
            const t = (v ?? "chat_id") as "open_id" | "chat_id"
            onChange({ ...config, receive_type: t, receive_id: t === "open_id" && selfOpenId ? selfOpenId : config.receive_id })
          }}>
            <SelectTrigger className="text-xs mt-0.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open_id">发给自己</SelectItem>
              <SelectItem value="chat_id">群聊 (chat_id)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground">卡片条数 (飞书)</label>
          <Input type="number" min={1} max={50} value={config.card_count}
            onChange={e => onChange({ ...config, card_count: parseInt(e.target.value) || 5 })}
            className={`text-xs mt-0.5 ${errClass("card_count", formErrors)}`} />
          {formErrors.card_count && <p className="text-[10px] text-destructive mt-0.5">{formErrors.card_count}</p>}
        </div>
      </div>

      <button onClick={onSave} disabled={saving}
        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50">
        <Save className="w-3 h-3" /> {saving ? "保存中..." : "保存配置"}
      </button>
    </div>
  )
}

// ─── HistoryList ─────────────────────────────────────────

function HistoryList({ runs, onSelect, selectedId }: {
  runs: RunRecord[]
  onSelect: (r: RunRecord) => void
  selectedId?: string
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <h3 className="text-sm font-semibold">历史运行</h3>
      {runs.length === 0 && <p className="text-xs text-muted-foreground">暂无记录</p>}
      {runs.slice(0, 10).map(r => (
        <div key={r.id}>
          <div onClick={() => { setExpanded(expanded === r.id ? null : r.id); onSelect(r) }}
            className={`flex items-center gap-2 text-xs p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${selectedId === r.id ? "bg-muted" : ""}`}
          >
            {r.status === "running" ? <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
              : r.status === "success" ? <CheckCircle className="w-3 h-3 text-green-500" />
                : <XCircle className="w-3 h-3 text-red-500" />}
            <span className="w-10">{r.trigger_type === "cron" ? "⏰定时" : "🖐手动"}</span>
            <span className="text-muted-foreground">{formatTime(r.started_at)}</span>
            {r.result_count !== undefined && <span>{r.result_count}条</span>}
            <span className="text-muted-foreground ml-auto">
              {r.finished_at && r.started_at
                ? formatDuration(new Date(r.finished_at).getTime() - new Date(r.started_at).getTime())
                : "..."}
            </span>
            {expanded === r.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
          {expanded === r.id && r.error && (
            <p className="text-[10px] text-red-500 ml-10 mb-1">失败: {r.error}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── CardPreview ─────────────────────────────────────────

function CardPreview({ cardJson }: { cardJson?: unknown }) {
  if (!cardJson) return null
  const card = cardJson as Record<string, unknown>
  return (
    <div className="border rounded-lg p-4 bg-white text-gray-900 max-w-md mx-auto space-y-2 text-xs">
      <div className="bg-blue-500 text-white rounded-t p-2">
        <p className="font-semibold">{(card as { title?: string }).title || "预览"}</p>
      </div>
      <p className="text-muted-foreground">{(card as { summary?: string }).summary || ""}</p>
      <hr />
      {(card as { items?: Array<{ title: string; digest: string; url: string; source: string; topic?: string; reason?: string }> }).items?.map((item, i) => (
        <div key={i}>
          <div className="flex items-center gap-1 mb-0.5">
            <p className="font-medium">{i + 1}. {item.title}</p>
            {item.topic && <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded">{item.topic}</span>}
          </div>
          <p className="text-muted-foreground text-[10px]">{item.digest}</p>
          {item.reason && <p className="text-[9px] text-amber-600 mt-0.5">💡 {item.reason}</p>}
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-[10px] underline">{item.source}</a>
        </div>
      ))}
      <hr />
      <p className="text-[10px] text-muted-foreground">
        {(card as { tags?: string[] }).tags?.join(" · ") || ""}
      </p>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────

const defaultConfig: NewsConfig = {
  topics: ["AI", "LLM", "AI Agent"],
  keywords: ["大模型", "智能体"],
  cron: "0 9 * * *",
  receive_id: "oc_70900f981e8f18aea2e3471b9d5d7d42",
  receive_type: "chat_id",
  language: "zh",
  search_count: 50,
  card_count: 20,
  mode: "ai",
  goal: "身处中国的跨境电商公司文案策划 你运营的公司自媒体账号主要内容产出方向是：掌握巴西本地最新资讯，掌握一手经济、电商、商业、贸易往来、政治交流等热点动态，同时与国内关注巴西市场的群体探讨巴西市场、交流巴西电商运营心得、交流实战经验 ，所以请你搜索值得做的 吸引人看的巴西这三天内的热点信息 我要整理成资讯 让大家更多的关注公司的自媒体账号 注意必须是这三天之类 最新的",
  enabled: true,
  sources: ["tavily"],
  source_options: {
    tavily: { search_count: 50 },
    jina_search: { search_count: 10 },
    jina_deep: { search_count: 5, read_count: 5 },
  },
}

function cronToTime(cron: string): string {
  const parts = cron.split(" ")
  if (parts.length >= 2) {
    return `${parts[1].padStart(2, "0")}:${parts[0].padStart(2, "0")}`
  }
  return "09:00"
}

function timeToCron(time: string): string {
  const [hour, minute] = time.split(":")
  return `${parseInt(minute)} ${parseInt(hour)} * * *`
}

export default function NewsDigestTab() {
  const { user } = useAuth()
  const selfOpenId = (user?.email?.endsWith("@feishu.user") ? user.email.split("@")[0] : "") || ""

  // 配置列表
  const [configs, setConfigs] = useState<ConfigRow[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [config, setConfig] = useState<NewsConfig>({ ...defaultConfig })
  const [configName, setConfigName] = useState("")
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newName, setNewName] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<"manual" | "ai">("ai")
  const [goal, setGoal] = useState("")
  const [stages, setStages] = useState<StageState[]>([
    { label: "启动", status: "idle", icon: Clock },
    { label: "生成主题", status: "idle", icon: Lightbulb },
    { label: "搜索新闻", status: "idle", icon: Search },
    { label: "摘要", status: "idle", icon: FileText },
    { label: "组装卡片", status: "idle", icon: FileText },
    { label: "发送飞书", status: "idle", icon: Send },
    { label: "完成", status: "idle", icon: CheckCircle },
  ])
  const [error, setError] = useState("")
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string>()
  const [cardPreview, setCardPreview] = useState<unknown>()
  const [duration, setDuration] = useState("")
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const abortRef = useRef<AbortController | null>(null)

  const loadConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/news-configs")
      const json = await res.json()
      if (json.ok && json.data.length > 0) {
        setConfigs(json.data)
        if (!selectedId || !json.data.find((c: ConfigRow) => c.id === selectedId)) {
          const first = json.data[0] as ConfigRow
          setSelectedId(first.id)
          setConfig(first.config)
          setConfigName(first.name)
        }
      }
    } catch { /* ignore */ }
  }, [selectedId])

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/news-digest/runs?limit=30")
      const json = await res.json()
      if (json.ok) setRuns(json.data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadConfigs(); loadRuns() }, [loadConfigs, loadRuns])
  useEffect(() => {
    fetch("/api/agent/news-cron-status").then(r => r.json()).then(j => {
      if (j.ok) setApiKeys(j.data.health?.api_keys || {})
    }).catch(() => {})
  }, [])

  function selectConfig(row: ConfigRow) {
    setSelectedId(row.id)
    setConfig(row.config)
    setConfigName(row.name)
    setMode(row.config.mode || "ai")
    setGoal(row.config.goal || "")
  }

  async function createNewConfig() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/agent/news-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), config: defaultConfig }),
      })
      const json = await res.json()
      if (json.ok) {
        setShowNewDialog(false)
        setNewName("")
        await loadConfigs()
        selectConfig(json.data)
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  function validateConfig() {
    const merged = { ...config, mode, goal }
    const parsed = newsConfigSchema.safeParse(merged)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string
        if (!errs[key]) errs[key] = issue.message
      }
      setFormErrors(errs)
      return null
    }
    setFormErrors({})
    return merged
  }

  async function saveConfig() {
    if (!selectedId) return
    const merged = validateConfig()
    if (!merged) return
    setSaving(true)
    try {
      const res = await fetch(`/api/agent/news-configs/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: configName, config: merged }),
      })
      const json = await res.json()
      if (json.ok) {
        setConfig(json.data.config)
        setConfigName(json.data.name)
        loadConfigs()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function deleteConfig(id: string) {
    try {
      await fetch(`/api/agent/news-configs/${id}`, { method: "DELETE" })
      setShowDeleteConfirm(null)
      if (selectedId === id) setSelectedId("")
      loadConfigs()
    } catch { /* ignore */ }
  }

  const baseStages: StageState[] = mode === "ai"
    ? [
      { label: "启动", status: "idle", icon: Clock },
      { label: "生成主题", status: "idle", icon: Lightbulb },
      { label: "搜索新闻", status: "idle", icon: Search },
      { label: "摘要", status: "idle", icon: FileText },
      { label: "组装卡片", status: "idle", icon: FileText },
      { label: "发送飞书", status: "idle", icon: Send },
      { label: "完成", status: "idle", icon: CheckCircle },
    ]
    : [
      { label: "启动", status: "idle", icon: Clock },
      { label: "搜索新闻", status: "idle", icon: Search },
      { label: "摘要", status: "idle", icon: FileText },
      { label: "组装卡片", status: "idle", icon: FileText },
      { label: "发送飞书", status: "idle", icon: Send },
      { label: "完成", status: "idle", icon: CheckCircle },
    ]

  function resetStages() {
    setStages(baseStages.map(s => ({ ...s, status: "idle" as StageStatus, detail: undefined, timestamp: undefined })))
    setError("")
    setCardPreview(undefined)
    setDuration("")
  }

  async function manualRun() {
    if (running) return
    const merged = validateConfig()
    if (!merged) return
    const currentMode = mode
    const currentGoal = currentMode === "ai" ? goal.trim() : ""
    if (currentMode === "ai" && !currentGoal) return

    resetStages()
    setRunning(true)
    setStages(prev => prev.map((s, i) => i === 0 ? { ...s, status: "active", timestamp: new Date().toLocaleTimeString() } : s))
    abortRef.current = new AbortController()

    try {
      const body: Record<string, unknown> = { config }
      if (currentGoal) body.goal = currentGoal

      const res = await fetch("/api/agent/news-digest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current!.signal,
      })

      const reader = res.body?.getReader()
      if (!reader) { setRunning(false); return }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        for (const line of buffer.split("\n")) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6))
            setStages(prev => {
              const next = [...prev]
              const isAI = next.length === 7
              const off = isAI ? 1 : 0
              switch (event.status) {
                case "generating_topics":
                  next[0] = { ...next[0], status: "done" }
                  next[1] = { ...next[1], status: "active", timestamp: new Date().toLocaleTimeString() }
                  break
                case "topics_ready":
                  next[1] = { ...next[1], status: "done", detail: event.topics.join(", "), thinking: event.thinking, timestamp: new Date().toLocaleTimeString() }
                  next[2] = { ...next[2], status: "active", timestamp: new Date().toLocaleTimeString() }
                  break
                case "searching": {
                  const src = (event as { source?: string }).source || "unknown"
                  const label: Record<string, string> = { tavily: "Tavily", jina_search: "Jina搜索", jina_deep: "Jina深度" }
                  if (isAI) next[1] = { ...next[1], status: "done" }
                  next[0 + off] = { ...next[0 + off], status: "done" }
                  const searchStage = next[1 + off]
                  const prevSubs = searchStage.subStages || []
                  const filtered = prevSubs.filter(s => s.source !== src)
                  next[1 + off] = { ...searchStage, status: "active", detail: event.query,
                    subStages: [...filtered, { source: src, label: label[src] || src, status: "active" }],
                    timestamp: new Date().toLocaleTimeString() }
                  break
                }
                case "reading": {
                  const re = event as { source: string; current: number; total: number }
                  const label: Record<string, string> = { tavily: "Tavily", jina_search: "Jina搜索", jina_deep: "Jina深度" }
                  const searchStage = next[1 + off]
                  const prevSubs = searchStage.subStages || []
                  const filtered = prevSubs.filter(s => s.source !== re.source)
                  next[1 + off] = { ...searchStage,
                    subStages: [...filtered, { source: re.source, label: label[re.source] || re.source, status: "active", detail: `全文 ${re.current}/${re.total}` }],
                  }
                  break
                }
                case "reading_done": {
                  const rd = event as { source: string; count: number }
                  const label: Record<string, string> = { tavily: "Tavily", jina_search: "Jina搜索", jina_deep: "Jina深度" }
                  const searchStage = next[1 + off]
                  const prevSubs = searchStage.subStages || []
                  const filtered = prevSubs.filter(s => s.source !== rd.source)
                  next[1 + off] = { ...searchStage,
                    subStages: [...filtered, { source: rd.source, label: label[rd.source] || rd.source, status: "done", detail: `全文 ${rd.count} 篇` }],
                  }
                  break
                }
                case "source_error": {
                  const se = event as { source: string; error: string }
                  const label: Record<string, string> = { tavily: "Tavily", jina_search: "Jina搜索", jina_deep: "Jina深度" }
                  const searchStage = next[1 + off]
                  const prevSubs = searchStage.subStages || []
                  const filtered = prevSubs.filter(s => s.source !== se.source)
                  next[1 + off] = { ...searchStage,
                    subStages: [...filtered, { source: se.source, label: label[se.source] || se.source, status: "error", detail: se.error }],
                  }
                  break
                }
                case "search_done":
                  next[1 + off] = { ...next[1 + off], status: "done", detail: `找到 ${event.resultCount} 条结果`,
                    subStages: (next[1 + off].subStages || []).map(s => s.status === "active" ? { ...s, status: "done" as StageStatus } : s) }
                  next[2 + off] = { ...next[2 + off], status: "active", timestamp: new Date().toLocaleTimeString() }
                  break
                case "summarizing":
                  next[2 + off] = { ...next[2 + off], status: "active", detail: event.progress, timestamp: new Date().toLocaleTimeString() }
                  break
                case "summarize_done":
                  next[2 + off] = { ...next[2 + off], status: "done", thinking: (event as { thinking?: string }).thinking }
                  next[3 + off] = { ...next[3 + off], status: "active", timestamp: new Date().toLocaleTimeString() }
                  break
                case "building_card":
                  next[2 + off] = { ...next[2 + off], status: "done" }
                  next[3 + off] = { ...next[3 + off], status: "active", timestamp: new Date().toLocaleTimeString() }
                  break
                case "sending":
                  next[3 + off] = { ...next[3 + off], status: "done" }
                  next[4 + off] = { ...next[4 + off], status: "active", detail: event.target, timestamp: new Date().toLocaleTimeString() }
                  break
                case "done":
                  next[4 + off] = { ...next[4 + off], status: "done" }
                  next[5 + off] = { ...next[5 + off], status: "done", detail: `耗时 ${event.duration}s`, timestamp: new Date().toLocaleTimeString() }
                  setCardPreview(event.cardJson)
                  setDuration(`${event.duration}s`)
                  break
                case "error":
                  const idx = prev.findIndex(s => s.status === "active")
                  if (idx >= 0) next[idx] = { ...next[idx], status: "error" }
                  setError(`${event.stage}: ${event.error}`)
                  break
              }
              return next
            })
          } catch { /* skip */ }
        }
        buffer = ""
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message)
    }

    setRunning(false)
    loadRuns()
  }

  const hasConfigs = configs.length > 0
  const atLimit = configs.length >= 10

  return (
    <div className="flex gap-4">
      {/* 左侧：配置卡片列表 */}
      <div className="w-64 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">配置列表</h3>
          <button onClick={() => setShowNewDialog(true)} disabled={atLimit}
            className="flex items-center gap-1 text-[10px] text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            title={atLimit ? "最多保存 10 条配置" : "新建配置"}>
            <Plus className="w-3 h-3" /> 新建
          </button>
        </div>

        {!hasConfigs && <p className="text-xs text-muted-foreground">暂无配置，点击"新建"创建</p>}

        {configs.map(c => {
          const enabled = c.config.enabled ?? true
          const sources = c.config.sources?.length ? c.config.sources : ["tavily"]
          const sourceLabels: Record<string, string> = { tavily: "Tavily", jina_search: "Jina搜索", jina_deep: "Jina深度" }
          return (
          <div key={c.id} onClick={() => selectConfig(c)}
            className={`border rounded-lg p-3 cursor-pointer transition-colors ${selectedId === c.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${enabled ? "bg-green-500" : "bg-muted-foreground/50"}`} />
                  <p className="text-xs font-medium truncate">{c.name}</p>
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {sources.map(s => sourceLabels[s] || s).join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={e => { e.stopPropagation(); selectConfig(c); setMode("manual"); setGoal("") }}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                <Pencil className="w-3 h-3" /> 编辑
              </button>
              <button onClick={e => { e.stopPropagation(); setShowDeleteConfirm(c.id) }}
                className="text-[10px] text-muted-foreground hover:text-red-500 flex items-center gap-0.5">
                <Trash2 className="w-3 h-3" /> 删除
              </button>
            </div>
          </div>
          )})}
      </div>

      {/* 右侧：主内容区 */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* 操作栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={manualRun} disabled={running || !selectedId}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? "执行中..." : "手动执行"}
            </button>
            <button onClick={loadRuns} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <RefreshCw className="w-3 h-3" /> 刷新
            </button>
          </div>
          {duration && <span className="text-xs text-muted-foreground">上次耗时: {duration}</span>}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* 配置面板 */}
          <ConfigPanel config={config} onChange={setConfig} onSave={saveConfig} saving={saving}
            mode={mode} onModeChange={setMode} goal={goal} onGoalChange={setGoal} selfOpenId={selfOpenId} formErrors={formErrors} apiKeys={apiKeys} />

          {/* 流水线 */}
          <PipelineView stages={stages} error={error} />

          {/* 卡片预览 */}
          <CardPreview cardJson={cardPreview} />
        </div>

        {/* 历史 */}
        <HistoryList runs={runs} onSelect={(r) => { setSelectedRunId(r.id); setCardPreview(r.card_json) }} selectedId={selectedRunId} />
      </div>

      {/* 新建弹窗 */}
      {showNewDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowNewDialog(false)}>
          <div className="bg-background border rounded-xl p-6 w-80 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm">新建配置</h3>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createNewConfig()}
              placeholder="配置名称，如：跨境电商日报" autoFocus
              className="w-full border rounded px-3 py-1.5 text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewDialog(false)}
                className="px-3 py-1.5 text-xs rounded border">取消</button>
              <button onClick={createNewConfig} disabled={saving || !newName.trim()}
                className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50">创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-background border rounded-xl p-6 w-80 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm">确认删除</h3>
            <p className="text-xs text-muted-foreground">删除后不可恢复，确定要删除这条配置吗？</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs rounded border">取消</button>
              <button onClick={() => deleteConfig(showDeleteConfirm)}
                className="px-3 py-1.5 text-xs rounded bg-red-500 text-white">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
