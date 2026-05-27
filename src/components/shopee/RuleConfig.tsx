import { useState, useEffect } from "react"
import { Settings2, ToggleLeft, ToggleRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Rule {
  id: string
  title: string
  enabled: boolean
  threshold: number
  severity: string
  anchor: string
  description: string
}

const SEVERITY_OPTIONS = ['critical', 'warning', 'info']

export default function RuleConfig() {
  const [rules, setRules] = useState<Rule[]>([])
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/shopee/rules').then(r => r.json()).then(d => setRules(d.rules || []))
  }, [])

  const updateRule = (index: number, patch: Partial<Rule>) => {
    const next = [...rules]
    next[index] = { ...next[index], ...patch }
    setRules(next)
    setDirty(true)
    setSaved(false)
  }

  const save = async () => {
    await fetch('/api/shopee/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules }),
    })
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition"
      >
        <span className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          规则配置
          {dirty && <span className="text-amber-500 text-xs">● 未保存</span>}
          {saved && <span className="text-green-500 text-xs">✓ 已保存</span>}
        </span>
        <span className="text-xs text-muted-foreground">{open ? '收起 ▲' : '展开 ▼'}</span>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
          {rules.map((rule, i) => (
            <div key={rule.id} className="flex items-center gap-3 text-sm">
              <button
                onClick={() => updateRule(i, { enabled: !rule.enabled })}
                className="flex-shrink-0"
              >
                {rule.enabled
                  ? <ToggleRight className="w-5 h-5 text-primary" />
                  : <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                }
              </button>
              <div className="flex-1 min-w-0">
                <div className="truncate">{rule.title}</div>
                <div className="text-xs text-muted-foreground">{rule.description}</div>
              </div>
              <input
                type="number"
                step={0.01} min={0} max={1}
                value={rule.threshold}
                onChange={e => updateRule(i, { threshold: parseFloat(e.target.value) || 0 })}
                className="w-16 px-1.5 py-0.5 border border-border rounded text-xs text-center bg-background"
              />
              <select
                value={rule.severity}
                onChange={e => updateRule(i, { severity: e.target.value })}
                className="w-20 text-xs border border-border rounded px-1 py-0.5 bg-background"
              >
                {SEVERITY_OPTIONS.map(s => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
          ))}
          <Button onClick={save} className="w-full">保存配置</Button>
        </div>
      )}
    </div>
  )
}
