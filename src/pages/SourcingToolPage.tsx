import { useReducer, useCallback } from "react"
import { Scale, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import FileDropzone from "@/components/sourcing/FileDropzone"
import CostConfigForm, { type CostParams } from "@/components/sourcing/CostConfigForm"
import ProgressPanel from "@/components/sourcing/ProgressPanel"
import ResultTable from "@/components/sourcing/ResultTable"
import SummaryBar from "@/components/sourcing/SummaryBar"
import ExportButton from "@/components/sourcing/ExportButton"
import ProxyStatus from "@/components/sourcing/ProxyStatus"
import WorkflowGuide from "@/components/sourcing/WorkflowGuide"
import { analyzeStream } from "@/lib/sourcing"
import type { SourcingRow, SourcingSummary } from "@/lib/sourcing"

/* ── 状态模型 ── */

type Phase = "idle" | "uploaded" | "analyzing" | "done"

interface FileEntry { file: File; name: string; size: string }
interface ProductStatus {
  product_id: string; product_name: string; data_source: string
  status: "waiting" | "searching" | "done" | "error"
  candidates_count?: number; error?: string
}

interface State {
  phase: Phase
  files: FileEntry[]
  cost: CostParams
  progressCurrent: number
  progressTotal: number
  progressPhase: string
  progressMessage: string
  productStatuses: ProductStatus[]
  rows: SourcingRow[]
  summary: SourcingSummary | null
}

const initialCost: CostParams = {
  cny_per_brl: 1.35, cost_multiplier: 1.3,
  target_margin_rate: 0.15, high_margin_rate: 0.30,
}

const initialState: State = {
  phase: "idle", files: [], cost: initialCost,
  progressCurrent: 0, progressTotal: 0, progressPhase: "", progressMessage: "",
  productStatuses: [], rows: [], summary: null,
}

type Action =
  | { type: "ADD_FILES"; files: File[] }
  | { type: "REMOVE_FILE"; index: number }
  | { type: "SET_COST"; cost: CostParams }
  | { type: "START_ANALYZING"; total: number; message: string }
  | { type: "PROGRESS"; phase: string; data: any }
  | { type: "COMPLETE"; rows: SourcingRow[]; summary: SourcingSummary }
  | { type: "ENRICH_SKU"; rows: SourcingRow[]; summary: SourcingSummary }
  | { type: "ERROR"; message: string }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_FILES": {
      const entries: FileEntry[] = action.files.map((f) => ({
        file: f, name: f.name,
        size: f.size < 1024 ? `${f.size}B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)}KB` : `${(f.size / 1048576).toFixed(1)}MB`,
      }))
      return { ...initialState, phase: "uploaded", files: entries, cost: state.cost }
    }
    case "REMOVE_FILE": {
      const files = state.files.filter((_, i) => i !== action.index)
      return { ...state, files, phase: files.length > 0 ? "uploaded" : "idle" }
    }
    case "SET_COST":
      return { ...state, cost: action.cost }
    case "START_ANALYZING":
      return {
        ...state, phase: "analyzing",
        progressCurrent: 0, progressTotal: action.total,
        progressMessage: action.message, progressPhase: "searching",
        productStatuses: [], rows: [], summary: null,
      }
    case "PROGRESS": {
      const { phase, data } = action
      if (phase === "progress") {
        const pstatus: ProductStatus = {
          product_id: data.product_id,
          product_name: data.product_name || "",
          data_source: state.files[0]?.name?.split(".")[0] || "",
          status: data.error ? "error" : "done",
          candidates_count: data.candidates_count,
          error: data.error,
        }
        return {
          ...state,
          progressCurrent: data.current,
          progressTotal: data.total,
          progressMessage: `${data.current}/${data.total} 搜图中`,
          productStatuses: [...state.productStatuses, pstatus],
        }
      }
      return { ...state, progressPhase: phase, progressMessage: data.message || "" }
    }
    case "COMPLETE":
      return {
        ...state, phase: "done",
        rows: action.rows, summary: action.summary,
      }
    case "ENRICH_SKU":
      return {
        ...state, phase: "done",
        rows: action.rows, summary: action.summary,
      }
    case "ERROR":
      alert(action.message)
      return { ...state, phase: state.files.length > 0 ? "uploaded" : "idle" }
    default:
      return state
  }
}

/* ── 页面 ── */

export default function SourcingToolPage() {
  const [s, dispatch] = useReducer(reducer, initialState)

  const handleStart = useCallback(async () => {
    if (s.files.length === 0) return

    const formData = new FormData()
    for (const f of s.files) {
      formData.append("files", f.file)
    }
    formData.append("page_size", "10")
    formData.append("same_style_only", "true")
    formData.append("cny_per_brl", String(s.cost.cny_per_brl))
    formData.append("cost_multiplier", String(s.cost.cost_multiplier))
    formData.append("target_margin_rate", String(s.cost.target_margin_rate))
    formData.append("high_margin_rate", String(s.cost.high_margin_rate))

    dispatch({ type: "START_ANALYZING", total: 0, message: "开始分析..." })

    // 先构建 productStatuses 等待列表
    // 从 SSE 的 start 事件获取 total，从 progress 事件增量更新

    try {
      for await (const ev of analyzeStream(formData)) {
        switch (ev.event) {
          case "phase":
            dispatch({ type: "PROGRESS", phase: ev.data.phase, data: ev.data })
            break
          case "start":
            dispatch({ type: "START_ANALYZING", total: ev.data.total, message: ev.data.message })
            break
          case "progress":
            dispatch({ type: "PROGRESS", phase: "progress", data: ev.data })
            break
          case "complete": {
            let rows = ev.data.rows as SourcingRow[]
            const summary = ev.data.summary as SourcingSummary

            // 检测本地代理
            let proxyOnline = false
            try {
              const hp = await fetch("http://localhost:8766/health", { signal: AbortSignal.timeout(1500) })
              proxyOnline = hp.ok
            } catch { }

            if (!proxyOnline) {
              dispatch({ type: "COMPLETE", rows, summary })
              break
            }

            // 收集所有唯一 offer_id
            const seen = new Set<string>()
            for (const r of rows) {
              for (const c of r.candidates) {
                if (c.item_id && !seen.has(c.item_id)) seen.add(c.item_id)
              }
            }

            const ids = Array.from(seen)
            const skuMap: Record<string, any> = {}
            let fetched = 0

            if (ids.length > 0) {
              dispatch({ type: "PROGRESS", phase: "sku", data: { message: `正在获取 SKU 明细价... 0/${ids.length}` } })

              const CONCURRENCY = 6
              let done = 0
              const queue = [...ids]

              async function worker() {
                while (queue.length > 0) {
                  const oid = queue.shift()!
                  try {
                    const r = await fetch(`http://localhost:8766/api/sku/${oid}`, { signal: AbortSignal.timeout(12000) })
                    const data = await r.json()
                    if (data && data.sku_count > 0) { skuMap[oid] = data; fetched++ }
                  } catch { /* skip individual errors */ }
                  done++
                  if (done % 10 === 0 || done === ids.length) {
                    dispatch({ type: "PROGRESS", phase: "sku", data: { message: `正在获取 SKU 明细价... ${done}/${ids.length}` } })
                  }
                }
              }

              await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
            }

            // 注入 SKU
            rows = rows.map((row) => ({
              ...row,
              candidates: row.candidates.map((c) => ({
                ...c,
                sku: skuMap[c.item_id] || c.sku,
              })),
            }))

            dispatch({ type: "COMPLETE", rows, summary })
            break
          }
        }
      }
    } catch (e: any) {
      dispatch({ type: "ERROR", message: e.message || "分析失败" })
    }
  }, [s.files, s.cost])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Scale size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">选品比价</h1>
          <p className="text-sm text-muted-foreground">
            Shopee 商品导出 → 1688 以图搜同款 → 成本利润计算
          </p>
          <ProxyStatus />
        </div>
      </div>

      {/* 使用引导 */}
      <WorkflowGuide />

      {/* ① 文件上传 */}
      <Card className="p-4">
        <h2 className="text-sm font-medium mb-3">1. 上传 Shopee Excel</h2>
        <FileDropzone
          files={s.files}
          onFilesAdded={(fs) => dispatch({ type: "ADD_FILES", files: fs })}
          onRemoveFile={(i) => dispatch({ type: "REMOVE_FILE", index: i })}
          disabled={s.phase === "analyzing"}
        />
      </Card>

      {/* ② 成本配置 */}
      <Card className="p-4">
        <h2 className="text-sm font-medium mb-3">2. 成本参数</h2>
        <CostConfigForm
          values={s.cost}
          onChange={(c) => dispatch({ type: "SET_COST", cost: c })}
          disabled={s.phase === "analyzing"}
        />
      </Card>

      {/* 开始分析 */}
      <Button
        size="lg"
        className="w-full"
        disabled={s.files.length === 0 || s.phase === "analyzing"}
        onClick={handleStart}
      >
        <Rocket size={18} className="mr-2" />
        {s.phase === "analyzing" ? "分析中..." : "开始分析"}
      </Button>

      {/* ③ SSE 进度 */}
      {s.phase === "analyzing" && (
        <ProgressPanel
          current={s.progressCurrent}
          total={s.progressTotal}
          products={s.productStatuses}
          phase={s.progressPhase}
          message={s.progressMessage}
        />
      )}

      {/* ④ 结果 */}
      {s.phase === "done" && s.summary && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <SummaryBar summary={s.summary} />
            <ExportButton rows={s.rows} />
          </div>
          <ResultTable rows={s.rows} />
        </>
      )}
    </div>
  )
}
