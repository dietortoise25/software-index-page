import { useState, useRef, useEffect, useCallback } from "react"
import {
  Upload, FileSpreadsheet, X, Loader2, CheckCircle2, AlertCircle,
  RefreshCw, Settings, Save, ArrowLeft, ExternalLink, ChevronDown, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import PinGate from "@/components/review/PinGate"

interface TaskInfo {
  id: string
  status: "processing" | "done" | "error"
  createdAt: string
  summary?: Record<string, number>
  error?: string
  progress: { step: string; current: number; total: number }
}

interface RuntimeConfig {
  FEISHU_APP_ID: string
  FEISHU_APP_SECRET: string
  FEISHU_BASE_TOKEN: string
  FEISHU_TABLE_WAREHOUSE: string
  FEISHU_TABLE_NON_WAREHOUSE: string
  TABLE_STORE_MAP: string
  PORT: number
  DATA_DIR: string
  CONCURRENCY: number
  UPLOAD_FILE_SIZE_MB: number
  UPLOAD_MAX_FILES: number
}

type Tab = "process" | "config"

const CONFIG_FIELDS: {
  key: keyof RuntimeConfig
  label: string
  description: string
  type: "text" | "number" | "password"
  group: string
}[] = [
  {
    key: "FEISHU_APP_ID",
    label: "飞书应用 ID",
    description: "飞书开放平台给你的应用分配的唯一标识，就像应用的「身份证号」。在飞书开发者后台 → 应用信息里能找到。",
    type: "text",
    group: "飞书连接",
  },
  {
    key: "FEISHU_APP_SECRET",
    label: "飞书应用密钥",
    description: "应用的密码，用来向飞书证明「我是这个应用」。和 APP_ID 配套使用，保存在飞书开发者后台。",
    type: "password",
    group: "飞书连接",
  },
  {
    key: "FEISHU_BASE_TOKEN",
    label: "多维表格标识 (Base Token)",
    description: "你用来存退货数据的那个飞书多维表格的唯一标识。从多维表格的 URL 里就能找到：https://xxx.feishu.cn/base/【就是这串】?table=xxx",
    type: "text",
    group: "飞书连接",
  },
  {
    key: "FEISHU_TABLE_WAREHOUSE",
    label: "仓库责任表",
    description: "仓库原因导致的退货（如商品损坏、错发缺件）写入哪张子表。填写该子表的 ID（tbl 开头）。",
    type: "text",
    group: "表格映射",
  },
  {
    key: "FEISHU_TABLE_NON_WAREHOUSE",
    label: "非仓库责任表",
    description: "非仓库原因导致的退货（如物流问题、买家改变主意）写入哪张子表。填写该子表的 ID（tbl 开头）。",
    type: "text",
    group: "表格映射",
  },
  {
    key: "TABLE_STORE_MAP",
    label: "店铺映射表",
    description: "存放'原始店铺名→标准店铺名+运营者'对应关系的子表。原始名称五花八门，通过这张表统一归类。",
    type: "text",
    group: "表格映射",
  },
  {
    key: "DATA_DIR",
    label: "本地数据目录",
    description: "服务器上存放示例 Excel 文件的目录名。用户不传文件时，自动从这里读取默认数据。",
    type: "text",
    group: "运行设置",
  },
  {
    key: "CONCURRENCY",
    label: "图片并发上传数",
    description: "同时上传多少张退货证据图片到飞书。调大更快但更占带宽，调小更稳但更慢。建议 3~8。",
    type: "number",
    group: "运行设置",
  },
  {
    key: "UPLOAD_FILE_SIZE_MB",
    label: "上传文件大小上限 (MB)",
    description: "允许上传的单个 Excel 文件最大体积，超过这个大小会被拒绝。",
    type: "number",
    group: "运行设置",
  },
  {
    key: "UPLOAD_MAX_FILES",
    label: "单次上传文件数上限",
    description: "一次最多可以同时上传多少个 Excel 文件。",
    type: "number",
    group: "运行设置",
  },
  {
    key: "PORT",
    label: "服务端口",
    description: "这个后端服务监听的端口号。修改后需要重启服务才能生效。通常不用改。",
    type: "number",
    group: "运行设置",
  },
]

export default function ReturnWorkflowPage() {
  const [tab, setTab] = useState<Tab>("process")

  // ── 处理 tab 状态 ──
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [task, setTask] = useState<TaskInfo | null>(null)
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  // ── 配置 tab 状态 ──
  const [config, setConfig] = useState<RuntimeConfig | null>(null)
  const [configDirty, setConfigDirty] = useState<Partial<RuntimeConfig>>({})
  const [configSaving, setConfigSaving] = useState(false)
  const [configMsg, setConfigMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [showGuide, setShowGuide] = useState(true)

  // ── 配置 PIN 锁 ──
  const [configUnlocked, setConfigUnlocked] = useState(() => sessionStorage.getItem("rw_config_pin") === "1")
  const [pinError, setPinError] = useState<string>()

  const handleConfigUnlock = async (p: string) => {
    try {
      const resp = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: p }),
      })
      const data = await resp.json()
      if (data.ok) {
        sessionStorage.setItem("rw_config_pin", "1")
        setConfigUnlocked(true)
        setPinError(undefined)
      } else {
        setPinError("PIN 不正确")
      }
    } catch {
      setPinError("网络错误")
    }
  }

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/return-workflow/tasks")
      const data = await res.json()
      if (data.ok) setTasks(data.tasks)
    } catch { /* ignore */ }
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/return-workflow/config")
      const data = await res.json()
      setConfig(data)
      setConfigDirty({})
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks, taskId])
  useEffect(() => { if (tab === "config") fetchConfig() }, [fetchConfig, tab])

  useEffect(() => {
    if (!taskId) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/return-workflow/task/${taskId}`)
        const data = await res.json()
        if (data.ok) {
          setTask(data)
          if (data.status === "done" || data.status === "error") {
            clearInterval(pollRef.current)
            setSubmitting(false)
          }
        }
      } catch { /* ignore */ }
    }, 1500)
    return () => clearInterval(pollRef.current)
  }, [taskId])

  // ── 处理逻辑 ──
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith(".xls") || f.name.endsWith(".xlsx"),
    )
    setFiles((prev) => [...prev, ...dropped])
    setError(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...selected])
    setError(null)
  }

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name))

  const handleSubmit = async () => {
    if (files.length === 0) { setError("请先选择文件"); return }
    setSubmitting(true)
    setError(null)
    setTask(null)
    try {
      const formData = new FormData()
      files.forEach((f) => formData.append("files", f))
      const res = await fetch("/api/return-workflow/process", { method: "POST", body: formData })
      const data = await res.json()
      if (data.ok) { setTaskId(data.taskId) }
      else { setError(data.error ?? "提交失败"); setSubmitting(false) }
    } catch { setError("网络错误，请重试"); setSubmitting(false) }
  }

  const reset = () => {
    setFiles([]); setTaskId(null); setTask(null); setError(null); setSubmitting(false)
  }

  // ── 配置逻辑 ──
  const updateConfigField = (key: keyof RuntimeConfig, value: string) => {
    setConfigDirty((prev) => ({ ...prev, [key]: value }))
  }

  const saveConfig = async () => {
    if (Object.keys(configDirty).length === 0) return
    setConfigSaving(true)
    setConfigMsg(null)
    try {
      const body: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(configDirty)) {
        const field = CONFIG_FIELDS.find((f) => f.key === k)
        body[k] = field?.type === "number" ? Number(v) : v
      }
      const res = await fetch("/api/return-workflow/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        setConfig(data.config)
        setConfigDirty({})
        setConfigMsg({ type: "ok", text: "配置已保存。部分修改需要重启服务才能生效。" })
      } else {
        setConfigMsg({ type: "err", text: data.error ?? "保存失败" })
      }
    } catch {
      setConfigMsg({ type: "err", text: "网络错误" })
    }
    setConfigSaving(false)
  }

  const configValue = (key: keyof RuntimeConfig): string => {
    if (key in configDirty) return configDirty[key]!
    if (config) return String(config[key] ?? "")
    return ""
  }

  const summaryLabels: Record<string, string> = {
    totalParsed: "解析总数",
    warehouseResponsibility: "仓库责任",
    nonWarehouseResponsibility: "非仓库责任",
    warehouseToInsert: "仓库待录入",
    nonWarehouseToInsert: "非仓库待录入",
    warehouseDeduped: "仓库去重",
    nonWarehouseDeduped: "非仓库去重",
    warehouseInserted: "仓库已录入",
    nonWarehouseInserted: "非仓库已录入",
    warehouseImagesUploaded: "仓库图片上传",
    nonWarehouseImagesUploaded: "非仓库图片上传",
  }

  const groups = [...new Set(CONFIG_FIELDS.map((f) => f.group))]

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="font-bold text-2xl tracking-tight">退货工作流</h1>
            <Badge className="text-xs" variant="secondary">Beta</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            上传 TikTok / Shopee 退货明细 Excel，自动解析分类并录入飞书多维表格
          </p>
          <p className="mt-2 text-amber-600 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            ERP 导出建议单次 ≤500 条。图片上传较慢（~1 张/秒），大量图片请耐心等待。
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            未来版本将对接 ERP 接口实现完全自动化，无需手动导出。
          </p>
        </div>
        <div className="flex rounded-lg border bg-muted/50 p-0.5">
          <button
            onClick={() => setTab("process")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "process" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            处理
          </button>
          <button
            onClick={() => setTab("config")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "config" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="mr-1 inline size-3.5" />
            配置
          </button>
        </div>
      </div>

      {/* 使用指引 */}
      <div className="mb-6 rounded-xl border bg-card/50">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition-colors"
        >
          <span className="font-medium text-sm">使用指引</span>
          {showGuide ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        {showGuide && (
          <div className="border-t px-5 py-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-background p-3">
                <p className="mb-2 font-medium text-sm">1. 导出退单明细</p>
                <a
                  href="https://tfsoftware.zhisuitech.com/?chat=++#/workbench/refund/return"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
                >
                  打开 TF 软件 → 工作台 → 退货退款 <ExternalLink className="size-3" />
                </a>
                <p className="mt-1 text-muted-foreground text-xs">选择 TikTok 或 Shopee 平台，点击「导出退单明细」下载 Excel 文件</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="mb-2 font-medium text-sm">2. 上传并处理</p>
                <p className="text-muted-foreground text-xs">将导出的 Excel 文件拖拽到下方上传区域，或点击选择文件后提交处理，系统会自动分类并录入飞书多维表格</p>
              </div>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="mb-2 font-medium text-sm">3. 查看录入结果</p>
              <p className="text-muted-foreground text-xs">
                处理完成后可在飞书多维表格中查看数据：
                仓库责任退货 → 售后订单处理表，非仓库责任退货 → 客诉订单跟进表
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ======================== 处理 Tab ======================== */}
      {tab === "process" && (
        <>
          {!taskId && (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-muted-foreground/25 p-10 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <Upload className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="mb-1 font-medium text-sm">点击选择或拖拽文件到此处</p>
                <p className="text-muted-foreground text-xs">
                  支持 .xls / .xlsx，单次最多 {config?.UPLOAD_MAX_FILES ?? 10} 个文件
                </p>
                <input ref={inputRef} type="file" accept=".xls,.xlsx" multiple className="hidden" onChange={handleFileSelect} />
              </div>
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((f) => (
                    <div key={f.name} className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <FileSpreadsheet className="size-4 text-primary" />
                        <span className="text-sm">{f.name}</span>
                        <span className="text-muted-foreground text-xs">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(f.name) }}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-destructive text-sm">
                  <AlertCircle className="size-4 shrink-0" />{error}
                </div>
              )}
              <div className="mt-5 flex gap-3">
                <Button onClick={handleSubmit} disabled={submitting || files.length === 0}>
                  {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  提交处理
                </Button>
                {files.length > 0 && <Button variant="outline" onClick={reset}>清空</Button>}
              </div>
            </>
          )}

          {taskId && task && (
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                {task.status === "processing" && <Loader2 className="size-6 animate-spin text-primary" />}
                {task.status === "done" && <CheckCircle2 className="size-6 text-green-500" />}
                {task.status === "error" && <AlertCircle className="size-6 text-destructive" />}
                <div>
                  <p className="font-semibold">
                    {task.status === "processing" && "处理中..."}
                    {task.status === "done" && "处理完成"}
                    {task.status === "error" && "处理失败"}
                  </p>
                  <p className="text-muted-foreground text-xs">{task.progress.step}</p>
                </div>
              </div>
              {task.status === "processing" && (
                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${task.progress.total > 0 ? (task.progress.current / task.progress.total) * 100 : 10}%` }} />
                </div>
              )}
              {task.error && (
                <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm">{task.error}</div>
              )}
              {task.summary && (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Object.entries(task.summary)
                      .filter(([, v]) => typeof v === "number")
                      .map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-muted/50 px-3 py-2">
                          <div className="font-semibold text-lg">{v}</div>
                          <div className="text-muted-foreground text-xs">{summaryLabels[k] ?? k}</div>
                        </div>
                      ))}
                  </div>
                  {task.summary.baseToken && (
                    <div className="mt-3 space-y-1.5">
                      <p className="font-medium text-sm">飞书多维表格</p>
                      {task.summary.tableWarehouse && (
                        <a
                          href={`https://${task.summary.tenantDomain || "ycn26mleug68"}.feishu.cn/base/${task.summary.baseToken}?table=${task.summary.tableWarehouse}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary text-xs hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          售后订单处理（仓库责任）
                        </a>
                      )}
                      {task.summary.tableNonWarehouse && (
                        <a
                          href={`https://${task.summary.tenantDomain || "ycn26mleug68"}.feishu.cn/base/${task.summary.baseToken}?table=${task.summary.tableNonWarehouse}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary text-xs hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          客诉订单跟进（非仓库责任）
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}
              {task.status !== "processing" && (
                <div className="mt-5 flex gap-3">
                  <Button onClick={reset} variant="outline">重新上传</Button>
                  <Button onClick={fetchTasks} variant="ghost" size="sm"><RefreshCw className="mr-1 size-4" />刷新记录</Button>
                </div>
              )}
            </div>
          )}

          <Separator className="my-8" />

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-lg">最近任务</h2>
              <Button variant="ghost" size="sm" onClick={fetchTasks}><RefreshCw className="mr-1 size-3.5" />刷新</Button>
            </div>
            {tasks.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground text-sm">暂无记录</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {t.status === "done" && <CheckCircle2 className="size-4 text-green-500" />}
                        {t.status === "error" && <AlertCircle className="size-4 text-destructive" />}
                        {t.status === "processing" && <Loader2 className="size-4 animate-spin text-primary" />}
                        <span className="font-medium text-sm">{t.id}</span>
                      </div>
                      <p className="mt-0.5 text-muted-foreground text-xs">{new Date(t.createdAt).toLocaleString("zh-CN")}</p>
                    </div>
                    <Badge variant={t.status === "done" ? "default" : t.status === "error" ? "destructive" : "secondary"}>
                      {t.status === "done" ? "已完成" : t.status === "error" ? "失败" : "处理中"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ======================== 配置 Tab ======================== */}
      {tab === "config" && (
        <>
          {!configUnlocked ? (
            <PinGate onUnlock={handleConfigUnlock} error={pinError} />
          ) : !config ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map((group) => (
                <div key={group}>
                  <h2 className="mb-4 font-semibold text-base">{group}</h2>
                  <div className="space-y-4">
                    {CONFIG_FIELDS.filter((f) => f.group === group).map((field) => (
                      <div key={field.key} className="rounded-lg border bg-card p-4">
                        <div className="mb-2 flex items-start justify-between gap-4">
                          <label className="font-medium text-sm" htmlFor={`cfg-${field.key}`}>
                            {field.label}
                          </label>
                          <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
                            {field.key}
                          </code>
                        </div>
                        <p className="mb-3 text-muted-foreground text-xs leading-relaxed">
                          {field.description}
                        </p>
                        <input
                          id={`cfg-${field.key}`}
                          type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                          value={configValue(field.key)}
                          onChange={(e) => updateConfigField(field.key, e.target.value)}
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder={String(config[field.key] ?? "")}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {configMsg && (
                <div className={`rounded-lg px-4 py-3 text-sm ${
                  configMsg.type === "ok"
                    ? "border border-green-500/30 bg-green-500/5 text-green-600"
                    : "border border-destructive/30 bg-destructive/5 text-destructive"
                }`}>
                  {configMsg.text}
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={saveConfig} disabled={configSaving || Object.keys(configDirty).length === 0}>
                  {configSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                  保存配置
                </Button>
                <Button variant="ghost" onClick={fetchConfig} disabled={configSaving}>
                  <RefreshCw className="mr-1 size-4" />
                  撤销修改
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
