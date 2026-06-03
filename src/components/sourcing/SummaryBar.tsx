import { Badge } from "@/components/ui/badge"
import type { SourcingSummary } from "@/lib/sourcing"

interface Props {
  summary: SourcingSummary
}

const STATS: { key: keyof SourcingSummary; label: string; color: string }[] = [
  { key: "total_products", label: "总产品", color: "bg-slate-100 text-slate-700" },
  { key: "with_1688_data", label: "有1688数据", color: "bg-blue-100 text-blue-700" },
  { key: "recommended", label: "推荐", color: "bg-emerald-100 text-emerald-700" },
  { key: "consider", label: "可考虑", color: "bg-amber-100 text-amber-700" },
  { key: "warning", label: "预警", color: "bg-red-100 text-red-700" },
  { key: "incomplete", label: "待补全", color: "bg-gray-100 text-gray-500" },
]

export default function SummaryBar({ summary }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATS.map(({ key, label, color }) => (
        <Badge key={key} variant="outline" className={`text-sm px-3 py-1.5 ${color}`}>
          {label} <span className="font-bold ml-1">{summary[key]}</span>
        </Badge>
      ))}
    </div>
  )
}
