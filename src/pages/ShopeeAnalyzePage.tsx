import { useState } from "react"
import { useNavigate } from "react-router"
import { Upload, Activity, CheckCircle, XCircle, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DiagnosisData, AdMetrics } from "@/types/shopee"
import HealthScores from "@/components/shopee/HealthScores"
import ProblemList from "@/components/shopee/ProblemList"
import RuleConfig from "@/components/shopee/RuleConfig"
import SimulationCard from "@/components/shopee/SimulationCard"

interface UploadStatus {
  store: 'ok' | 'missing'
  ad: 'ok' | 'missing'
  order: 'ok' | 'missing'
}

function classifyFile(name: string): 'store' | 'ad' | 'order' {
  const lower = name.toLowerCase()
  if (lower.includes('ad') || lower.includes('广告') || lower.endsWith('.csv')) return 'ad'
  if (lower.includes('order') || lower.includes('订单')) return 'order'
  return 'store'
}

function loadCached<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

export default function ShopeeAnalyzePage() {
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(() => loadCached('diagnosisResult', null))
  const [adMetrics, setAdMetrics] = useState<AdMetrics | null>(() => loadCached('adMetricsResult', null))
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>(() => loadCached('uploadStatus', { store: 'missing', ad: 'missing', order: 'missing' }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setLoading(true)
    setError('')

    const form = new FormData()
    const detected: UploadStatus = { store: 'missing', ad: 'missing', order: 'missing' }
    for (const f of Array.from(files)) {
      const type = classifyFile(f.name)
      if (type === 'ad') { form.append('ad_file', f); detected.ad = 'ok' }
      else if (type === 'order') { form.append('order_file', f); detected.order = 'ok' }
      else { form.append('store_file', f); detected.store = 'ok' }
    }

    try {
      const res = await fetch('/api/shopee/diagnose', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || '分析失败')
      }
      const data = await res.json()
      setDiagnosis(data.diagnose || null)
      setAdMetrics(data.ad_metrics || null)
      setUploadStatus(detected)
      localStorage.setItem('diagnosisResult', JSON.stringify(data.diagnose || null))
      localStorage.setItem('adMetricsResult', JSON.stringify(data.ad_metrics || null))
      localStorage.setItem('uploadStatus', JSON.stringify(detected))

      if (data.analysis?.orders) {
        localStorage.setItem('analysisResult', JSON.stringify(data.analysis))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const s = diagnosis?.overall_score ?? 0
  const scoreColor = s >= 80 ? 'text-green-600' : s >= 60 ? 'text-amber-600' : 'text-red-600'
  const hasAnalysis = !!localStorage.getItem('analysisResult')

  const statusBadge = (status: 'ok' | 'missing', label: string) => (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${status === 'ok' ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'}`}>
      {status === 'ok' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shopee ROI 诊断</h1>
          <p className="text-sm text-muted-foreground">上传店铺报表 + 广告数据，获取智能诊断</p>
        </div>
        <div className="flex items-center gap-2">
          {diagnosis && statusBadge(uploadStatus.store, '店铺报表')}
          {diagnosis && statusBadge(uploadStatus.ad, '广告数据')}
          {diagnosis && statusBadge(uploadStatus.order, '订单明细')}
          {diagnosis && hasAnalysis && (
            <Button variant="outline" size="sm" onClick={() => navigate('/shopee/dashboard')}>
              明细查阅 →
            </Button>
          )}
        </div>
      </div>

      {/* Upload zone */}
      {(!diagnosis || !hasAnalysis) && !loading && (
        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition border-border hover:border-primary/50 bg-card">
          <input type="file" accept=".xlsx,.xls,.csv" multiple className="hidden" onChange={handleUpload} />
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">拖拽或点击上传 Excel + CSV 文件</span>
          <span className="text-xs text-muted-foreground/60 mt-1">支持同时上传店铺统计、广告报告、订单明细</span>
          <span className="text-xs text-amber-500 mt-2">请勿修改文件名。识别规则：含"广告"或 .csv → 广告 | 含"order"/"订单" → 订单明细 | 其他 .xlsx → 店铺统计</span>
        </label>
      )}

      {diagnosis && hasAnalysis && !loading && (
        <label className="flex items-center justify-center gap-2 w-full py-3 border border-dashed rounded-xl cursor-pointer transition border-border hover:border-primary/50 bg-muted/20 text-sm text-muted-foreground">
          <input type="file" accept=".xlsx,.xls,.csv" multiple className="hidden" onChange={handleUpload} />
          <Upload className="w-4 h-4" />
          补充或替换文件重新分析
        </label>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">分析中...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
          <button className="ml-3 underline" onClick={() => setError('')}>重试</button>
        </div>
      )}

      {diagnosis && !hasAnalysis && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <FileSpreadsheet className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">缺少店铺统计报表</p>
            <p className="text-xs text-amber-600 mt-0.5">当前未检测到店铺统计报表（8 张工作表的 .xlsx）。无法查看店铺维度的销售/商品/用户分析。请补充上传该文件。</p>
          </div>
        </div>
      )}

      {diagnosis && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-4 bg-card rounded-xl border shadow-sm">
            <Activity className="w-6 h-6 text-primary" />
            <span className="text-sm text-muted-foreground">健康评分</span>
            <span className={`text-3xl font-bold ${scoreColor}`}>{diagnosis.overall_score}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>

          <HealthScores checks={diagnosis.health_checks} />
          <ProblemList problems={diagnosis.problems} />
          <SimulationCard adMetrics={adMetrics} />
          <RuleConfig />

          <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">🤖</span>
              <span className="text-sm font-medium text-purple-700">AI 深度分析</span>
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">即将上线</span>
            </div>
            <p className="text-xs text-muted-foreground">AI 分析功能正在开发中，届时将自动生成策略建议和自然语言解读。</p>
          </div>
        </div>
      )}
    </div>
  )
}
