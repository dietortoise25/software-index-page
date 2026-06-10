import { Check, Search, Clock, XCircle, Sparkles, RotateCw } from "lucide-react"

interface ProductStatus {
  product_id: string
  product_name: string
  data_source: string
  status: "waiting" | "searching" | "done" | "error"
  candidates_count?: number
  error?: string
}

interface ActiveMatch {
  itemId: string
  text: string
  retrying?: boolean
}

interface Props {
  current: number
  total: number
  products: ProductStatus[]
  phase?: string
  message?: string
  activeMatch?: ActiveMatch | null
  scoredCount?: number
}

const statusIcon = (s: ProductStatus) => {
  switch (s.status) {
    case "done": return <Check size={14} className="text-green-500" />
    case "searching": return <Search size={14} className="text-blue-500 animate-pulse" />
    case "error": return <XCircle size={14} className="text-red-500" />
    default: return <Clock size={14} className="text-muted-foreground" />
  }
}

const statusText = (s: ProductStatus) => {
  switch (s.status) {
    case "done": return `${s.candidates_count ?? 0}候选`
    case "searching": return "搜索中"
    case "error": return s.error || "失败"
    default: return "等待中"
  }
}

export default function ProgressPanel({ current, total, products, phase, message, activeMatch, scoredCount }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {/* 当前评分活跃区：逐字展示 LLM 正在输出的 SKU 评分文本 */}
      {activeMatch && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-primary">
              {activeMatch.retrying ? (
                <RotateCw size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} className="animate-pulse" />
              )}
              {activeMatch.retrying ? "重试中…" : `正在评分候选 ${activeMatch.itemId}`}
            </span>
            {typeof scoredCount === "number" && scoredCount > 0 && (
              <span className="text-muted-foreground tabular-nums">已评分 {scoredCount}</span>
            )}
          </div>
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
            {activeMatch.text}
            <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-primary align-middle" />
          </pre>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {phase === "costing" ? "成本计算中..." : message || "搜图中"}
        </span>
        <span className="text-muted-foreground">
          {current}/{total} ({pct}%)
        </span>
      </div>

      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {products.map((p) => (
          <div key={p.product_id} className="flex items-center justify-between text-xs py-1 px-1 rounded hover:bg-muted/50">
            <div className="flex items-center gap-1.5 min-w-0">
              {statusIcon(p)}
              <span className="truncate">{p.product_name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-muted-foreground text-[10px]">{p.data_source}</span>
              <span className={p.status === "error" ? "text-red-500" : "text-muted-foreground"}>
                {statusText(p)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
