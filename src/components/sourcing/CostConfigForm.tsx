import { useEffect, useState } from "react"
import { Save, RotateCcw, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { fetchConfig, saveConfig } from "@/lib/sourcing"

export interface CostParams {
  cny_per_brl: number
  cost_multiplier: number
  target_margin_rate: number
  high_margin_rate: number
}

const DEFAULTS: CostParams = {
  cny_per_brl: 1.35,
  cost_multiplier: 1.3,
  target_margin_rate: 0.15,
  high_margin_rate: 0.30,
}

interface Props {
  values: CostParams
  onChange: (v: CostParams) => void
  disabled?: boolean
}

export default function CostConfigForm({ values, onChange, disabled }: Props) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        onChange({
          cny_per_brl: cfg.cost.cny_per_brl,
          cost_multiplier: cfg.cost.cost_multiplier,
          target_margin_rate: cfg.thresholds.target_margin_rate,
          high_margin_rate: cfg.thresholds.high_margin_rate,
        })
      })
      .catch(() => { /* use defaults */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (k: keyof CostParams, v: string) => {
    const n = parseFloat(v)
    if (isNaN(n) || n < 0) return
    onChange({ ...values, [k]: n })
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await saveConfig({
        cost: {
          cny_per_brl: values.cny_per_brl,
          cost_multiplier: values.cost_multiplier,
        },
        thresholds: {
          target_margin_rate: values.target_margin_rate,
          high_margin_rate: values.high_margin_rate,
        },
      })
      setMsg({ type: "ok", text: "配置已保存" })
      setTimeout(() => setMsg(null), 3000)
    } catch (e: any) {
      setMsg({ type: "err", text: e.message || "保存失败" })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => onChange({ ...DEFAULTS })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">成本倍率 (进货价 × 倍率 = R$)</Label>
          <Input
            type="number" step="0.01" min="1"
            value={values.cost_multiplier}
            onChange={(e) => update("cost_multiplier", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div>
          <Label className="text-xs">推荐阈值 (%)</Label>
          <Input
            type="number" step="1" min="0" max="100"
            value={Math.round(values.high_margin_rate * 100)}
            onChange={(e) => update("high_margin_rate", String(Number(e.target.value) / 100))}
            disabled={disabled}
          />
        </div>
        <div>
          <Label className="text-xs">可考虑阈值 (%)</Label>
          <Input
            type="number" step="1" min="0" max="100"
            value={Math.round(values.target_margin_rate * 100)}
            onChange={(e) => update("target_margin_rate", String(Number(e.target.value) / 100))}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Button variant="outline" size="sm" onClick={handleSave} disabled={disabled || loading}>
          <Save size={14} className="mr-1" />保存配置
        </Button>
        <Button variant="ghost" size="sm" onClick={handleReset} disabled={disabled}>
          <RotateCcw size={14} className="mr-1" />恢复默认
        </Button>
        {msg && (
          <span className={`text-xs ${msg.type === "ok" ? "text-green-600" : "text-red-500"} flex items-center gap-0.5`}>
            {msg.type === "ok" && <Check size={12} />}
            {msg.text}
          </span>
        )}
      </div>
    </div>
  )
}
