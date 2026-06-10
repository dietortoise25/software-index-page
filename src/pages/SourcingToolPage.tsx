import { useReducer, useCallback, useState, useEffect } from "react"
import { Scale, Rocket, ChevronLeft, ChevronRight } from "lucide-react"
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

interface ActiveMatch { itemId: string; text: string; retrying?: boolean }

interface State {
  phase: Phase
  files: FileEntry[]
  cost: CostParams
  skuProvider: string
  limit: number
  progressCurrent: number
  progressTotal: number
  progressPhase: string
  progressMessage: string
  productStatuses: ProductStatus[]
  activeMatch: ActiveMatch | null
  scoredCandidates: Record<string, number>
  rows: SourcingRow[]
  summary: SourcingSummary | null
  rawColumns: string[]
}

const initialCost: CostParams = {
  cny_per_brl: 1.35, cost_multiplier: 1.3,
  target_margin_rate: 0.15, high_margin_rate: 0.30,
}

const PROVIDER_KEY = "sourcing.sku_provider"
function loadProvider(): string {
  try { return localStorage.getItem(PROVIDER_KEY) || "onebound" } catch { return "onebound" }
}

const initialState: State = {
  phase: "idle", files: [], cost: initialCost, skuProvider: loadProvider(), limit: 20,
  progressCurrent: 0, progressTotal: 0, progressPhase: "", progressMessage: "",
  productStatuses: [], activeMatch: null, scoredCandidates: {}, rows: [], summary: null, rawColumns: [],
}

type Action =
  | { type: "ADD_FILES"; files: File[] }
  | { type: "REMOVE_FILE"; index: number }
  | { type: "SET_COST"; cost: CostParams }
  | { type: "SET_PROVIDER"; provider: string }
  | { type: "SET_LIMIT"; limit: number }
  | { type: "START_ANALYZING"; total: number; message: string }
  | { type: "PROGRESS"; phase: string; data: any }
  | { type: "SKU_PROGRESS"; current: number; total: number; message: string }
  | { type: "MATCH_PROGRESS"; current: number; total: number; message: string }
  | { type: "VERIFY_PROGRESS"; current: number; total: number; message: string }
  | { type: "LLM_TOKEN"; itemId: string; token: string }
  | { type: "CANDIDATE_SCORED"; itemId: string; score: number }
  | { type: "LLM_RETRY"; itemId: string }
  | { type: "COMPLETE"; rows: SourcingRow[]; summary: SourcingSummary; rawColumns: string[] }
  | { type: "ERROR"; message: string }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_FILES": {
      const entries: FileEntry[] = action.files.map((f) => ({
        file: f, name: f.name,
        size: f.size < 1024 ? `${f.size}B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)}KB` : `${(f.size / 1048576).toFixed(1)}MB`,
      }))
      return { ...initialState, phase: "uploaded", files: entries, cost: state.cost, skuProvider: state.skuProvider, limit: state.limit }
    }
    case "REMOVE_FILE": {
      const files = state.files.filter((_, i) => i !== action.index)
      return { ...state, files, phase: files.length > 0 ? "uploaded" : "idle" }
    }
    case "SET_COST":
      return { ...state, cost: action.cost }
    case "SET_PROVIDER":
      try { localStorage.setItem(PROVIDER_KEY, action.provider) } catch { /* 忽略隐私模式写入失败 */ }
      return { ...state, skuProvider: action.provider }
    case "SET_LIMIT":
      return { ...state, limit: action.limit }
    case "START_ANALYZING":
      return {
        ...state, phase: "analyzing",
        progressCurrent: 0, progressTotal: action.total,
        progressMessage: action.message, progressPhase: "searching",
        productStatuses: [], activeMatch: null, scoredCandidates: {},
        rows: [], summary: null,
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
    case "SKU_PROGRESS":
      return {
        ...state,
        progressPhase: "fetching_sku",
        progressCurrent: action.current,
        progressTotal: action.total,
        progressMessage: action.message,
      }
    case "MATCH_PROGRESS":
      return {
        ...state,
        progressPhase: "matching_sku",
        progressCurrent: action.current,
        progressTotal: action.total,
        progressMessage: action.message,
      }
    case "VERIFY_PROGRESS":
      return {
        ...state,
        progressPhase: "image_verify",
        progressCurrent: action.current,
        progressTotal: action.total,
        progressMessage: action.message,
      }
    case "LLM_TOKEN": {
      // 同一候选追加 token；切到新候选则重开累积
      const same = state.activeMatch?.itemId === action.itemId
      return {
        ...state,
        activeMatch: {
          itemId: action.itemId,
          text: (same ? state.activeMatch!.text : "") + action.token,
          retrying: false,
        },
      }
    }
    case "CANDIDATE_SCORED": {
      // 定格该候选最终综合分；若正是当前活跃候选则清空活跃区等待下一个
      const scoredCandidates = { ...state.scoredCandidates, [action.itemId]: action.score }
      const activeMatch = state.activeMatch?.itemId === action.itemId ? null : state.activeMatch
      return { ...state, scoredCandidates, activeMatch }
    }
    case "LLM_RETRY": {
      // 当前候选 LLM 中断重试，清空已累积文本重新开始
      if (state.activeMatch?.itemId !== action.itemId) return state
      return {
        ...state,
        activeMatch: { itemId: action.itemId, text: "", retrying: true },
      }
    }
    case "COMPLETE":
      return {
        ...state, phase: "done",
        rows: action.rows, summary: action.summary, rawColumns: action.rawColumns,
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
    formData.append("sku_provider", s.skuProvider)
    formData.append("limit", String(s.limit))

    dispatch({ type: "START_ANALYZING", total: 0, message: "开始分析..." })

    // 先构建 productStatuses 等待列表
    // 从 SSE 的 start 事件获取 total，从 progress 事件增量更新

    try {
      for await (const ev of analyzeStream(formData)) {
        switch (ev.event) {
          case "phase":
            if (ev.data.phase === "fetching_sku" && ev.data.ready) {
              dispatch({
                type: "SKU_PROGRESS",
                current: 0,
                total: ev.data.total || 0,
                message: ev.data.message || "",
              })
            } else if (ev.data.phase === "matching_sku") {
              dispatch({
                type: "MATCH_PROGRESS",
                current: 0,
                total: ev.data.total || 0,
                message: ev.data.message || "",
              })
            } else if (ev.data.phase === "image_verify") {
              dispatch({
                type: "VERIFY_PROGRESS",
                current: 0,
                total: ev.data.total || 0,
                message: ev.data.message || "",
              })
            } else {
              dispatch({ type: "PROGRESS", phase: ev.data.phase, data: ev.data })
            }
            break
          case "sku_progress":
            dispatch({
              type: "SKU_PROGRESS",
              current: ev.data.current,
              total: ev.data.total,
              message: ev.data.message || "",
            })
            break
          case "match_progress":
            dispatch({
              type: "MATCH_PROGRESS",
              current: ev.data.current,
              total: ev.data.total,
              message: ev.data.message || "",
            })
            break
          case "verify_progress":
            dispatch({
              type: "VERIFY_PROGRESS",
              current: ev.data.current,
              total: ev.data.total,
              message: ev.data.message || "",
            })
            break
          case "llm_token": {
            const itemId: string = String(ev.data.item_id ?? "")
            const token: string = String(ev.data.token ?? "")
            if (itemId) dispatch({ type: "LLM_TOKEN", itemId, token })
            break
          }
          case "candidate_scored": {
            const itemId: string = String(ev.data.item_id ?? "")
            const score: number = Number(ev.data.match_overall_score ?? 0)
            if (itemId) dispatch({ type: "CANDIDATE_SCORED", itemId, score })
            break
          }
          case "llm_retry": {
            const itemId: string = String(ev.data.item_id ?? "")
            if (itemId) dispatch({ type: "LLM_RETRY", itemId })
            break
          }
          case "start":
            dispatch({ type: "START_ANALYZING", total: ev.data.total, message: ev.data.message })
            break
          case "progress":
            dispatch({ type: "PROGRESS", phase: "progress", data: ev.data })
            break
          case "complete":
            dispatch({
              type: "COMPLETE",
              rows: ev.data.rows as SourcingRow[],
              summary: ev.data.summary as SourcingSummary,
              rawColumns: (ev.data.raw_columns as string[]) || [],
            })
            break
        }
      }
    } catch (e: any) {
      dispatch({ type: "ERROR", message: e.message || "分析失败" })
    }
  }, [s.files, s.cost, s.skuProvider, s.limit])

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isCollapsed = s.phase === "done" && !sidebarOpen

  useEffect(() => {
    if (s.phase === "done") setSidebarOpen(false)
    if (s.phase === "analyzing") setSidebarOpen(true)
  }, [s.phase])

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* 左侧输入面板 */}
      <aside
        className={`flex-shrink-0 border-r bg-muted/10 transition-all duration-300 overflow-y-auto ${
          isCollapsed ? "w-12" : "w-[360px]"
        }`}
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center pt-4 gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded hover:bg-muted" title="展开面板">
              <ChevronRight size={18} />
            </button>
            <Scale size={18} className="text-primary" />
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale size={20} className="text-primary" />
                <h1 className="text-lg font-bold">选品比价</h1>
              </div>
              {s.phase === "done" && (
                <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-muted" title="收起面板">
                  <ChevronLeft size={16} />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Shopee 导出 → 1688 以图搜同款 → 成本利润计算</p>
            <ProxyStatus />
            <WorkflowGuide />

            {/* 文件上传 */}
            <Card className="p-3">
              <h2 className="text-xs font-medium mb-2">上传 Shopee Excel</h2>
              <FileDropzone
                files={s.files}
                onFilesAdded={(fs) => dispatch({ type: "ADD_FILES", files: fs })}
                onRemoveFile={(i) => dispatch({ type: "REMOVE_FILE", index: i })}
                disabled={s.phase === "analyzing"}
              />
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="row-limit" className="text-xs text-muted-foreground whitespace-nowrap">前</label>
                <input
                  id="row-limit" type="number" min="0" step="1"
                  value={s.limit || ""} placeholder="全部"
                  disabled={s.phase === "analyzing"}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    dispatch({ type: "SET_LIMIT", limit: isNaN(n) || n < 0 ? 0 : n })
                  }}
                  className="w-16 h-7 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
                />
                <span className="text-xs text-muted-foreground">行</span>
              </div>
            </Card>

            {/* 成本配置 */}
            <Card className="p-3">
              <h2 className="text-xs font-medium mb-2">成本参数</h2>
              <CostConfigForm
                values={s.cost}
                onChange={(c) => dispatch({ type: "SET_COST", cost: c })}
                disabled={s.phase === "analyzing"}
              />
            </Card>

            {/* 价格数据源 */}
            <Card className="p-3">
              <h2 className="text-xs font-medium mb-2">价格数据源</h2>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { v: "onebound", title: "万邦", desc: "真实价" },
                  { v: "mock", title: "模拟", desc: "调试用" },
                  { v: "none", title: "不查", desc: "参考价" },
                ].map((opt) => {
                  const active = s.skuProvider === opt.v
                  return (
                    <button
                      key={opt.v} type="button"
                      disabled={s.phase === "analyzing"}
                      onClick={() => dispatch({ type: "SET_PROVIDER", provider: opt.v })}
                      className={`text-left rounded-md border p-2 transition text-xs disabled:opacity-50 ${
                        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="font-medium">{opt.title}</div>
                      <div className="text-muted-foreground text-[10px]">{opt.desc}</div>
                    </button>
                  )
                })}
              </div>
            </Card>

            {/* 开始按钮 */}
            <Button
              className="w-full"
              disabled={s.files.length === 0 || s.phase === "analyzing"}
              onClick={handleStart}
            >
              <Rocket size={16} className="mr-1.5" />
              {s.phase === "analyzing" ? "分析中..." : "开始分析"}
            </Button>

          </div>
        )}
      </aside>

      {/* 右侧结果面板 */}
      <main className="flex-1 overflow-y-auto p-4">
        {s.phase === "done" && s.summary ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <SummaryBar summary={s.summary} />
              <ExportButton rows={s.rows} rawColumns={s.rawColumns} />
            </div>
            <ResultTable rows={s.rows} />
          </div>
        ) : s.phase === "analyzing" ? (
          <div className="p-4">
            <ProgressPanel
              current={s.progressCurrent}
              total={s.progressTotal}
              products={s.productStatuses}
              phase={s.progressPhase}
              message={s.progressMessage}
              activeMatch={s.activeMatch}
              scoredCount={Object.keys(s.scoredCandidates).length}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            上传文件并点击「开始分析」后，结果将展示在此处
          </div>
        )}
      </main>
    </div>
  )
}
