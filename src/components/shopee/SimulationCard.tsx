import { useState, useEffect } from "react"
import { TrendingUp, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"

interface Props {
  adMetrics?: any
}

export default function SimulationCard({ adMetrics }: Props) {
  const [reallocPct, setReallocPct] = useState(70)
  const [simResult, setSimResult] = useState<any>(null)

  useEffect(() => {
    if (!adMetrics?.zero_conv_spend) return
    fetch('/api/shopee/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_metrics: adMetrics, realloc_pct: reallocPct }),
    }).then(r => r.json()).then(setSimResult)
  }, [adMetrics, reallocPct])

  if (!adMetrics) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">预算模拟</h3>
        </div>
        <p className="text-xs text-muted-foreground">上传广告数据后可用</p>
      </Card>
    )
  }

  if (!simResult?.feasible) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">预算模拟</h3>
        </div>
        <p className="text-xs text-muted-foreground">{simResult?.reason || '当前数据无需模拟'}</p>
      </Card>
    )
  }

  const b = simResult.baseline
  const o = simResult.optimized

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium">预算模拟</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        将零转化广告预算的 <span className="font-medium text-primary">{reallocPct}%</span>（R${simResult.realloc_amount.toFixed(2)}）转投至高ROAS商品
      </p>

      <div>
        <label className="text-xs text-muted-foreground">再分配比例</label>
        <input
          type="range" min={10} max={100} step={10} value={reallocPct}
          onChange={e => setReallocPct(parseInt(e.target.value))}
          className="w-full mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-2 bg-muted rounded-lg text-center">
          <div className="text-xs text-muted-foreground">当前 ROAS</div>
          <div className="font-bold">{b.roas}</div>
        </div>
        <div className="p-2 bg-blue-50 rounded-lg text-center">
          <div className="text-xs text-blue-500">模拟 ROAS</div>
          <div className="font-bold text-blue-700">{o.roas}</div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-green-600 font-medium">
        <ArrowRight className="w-3 h-3" />
        预计 ROAS 提升 {simResult.improvement_pct}%
      </div>
    </Card>
  )
}
