import { Check, Search, Clock, XCircle } from "lucide-react"

interface ProductStatus {
  product_id: string
  product_name: string
  data_source: string
  status: "waiting" | "searching" | "done" | "error"
  candidates_count?: number
  error?: string
}

interface Props {
  current: number
  total: number
  products: ProductStatus[]
  phase?: string
  message?: string
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

export default function ProgressPanel({ current, total, products, phase, message }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="space-y-3 rounded-lg border p-4">
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
