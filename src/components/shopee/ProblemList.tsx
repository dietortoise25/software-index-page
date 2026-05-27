import { AlertTriangle, Info, XCircle } from "lucide-react"

interface Problem {
  id: string
  title: string
  severity: string
  detail: string
  description: string
  actions: any[]
}

interface Props {
  problems: Problem[]
}

const SEVERITY_ICON: Record<string, any> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
}
const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  warning: 'text-amber-600 bg-amber-50 border-amber-200',
  info: 'text-blue-600 bg-blue-50 border-blue-200',
}

export default function ProblemList({ problems }: Props) {
  if (!problems.length) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
        未发现明显问题，店铺健康度良好。
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">待处理问题 ({problems.length})</h3>
      {problems.map((p) => {
        const Icon = SEVERITY_ICON[p.severity] || Info
        return (
          <div key={p.id} className={`p-3 rounded-xl border ${SEVERITY_COLOR[p.severity]}`}>
            <div className="flex items-start gap-2">
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{p.title}</div>
                <div className="text-xs mt-0.5 opacity-80">{p.detail}</div>
                {p.actions.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {p.actions.map((a: any, j: number) => (
                      <button key={j} className="px-2 py-0.5 text-xs bg-white/60 rounded border border-current/20 hover:bg-white">
                        {a.label || '执行'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs font-medium uppercase opacity-60 flex-shrink-0">
                {p.severity}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
