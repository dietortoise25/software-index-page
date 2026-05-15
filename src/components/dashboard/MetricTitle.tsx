import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { METRICS_DICT } from "@/data/metrics-dictionary"

export function MetricTitle({ dictKey }: { dictKey: string }) {
  const m = METRICS_DICT[dictKey]
  if (!m) return null
  return (
    <Tooltip>
      <TooltipTrigger>
        <span className="inline-flex items-center gap-1 cursor-help text-muted-foreground text-xs">
          {m.label}
          <Info className="size-3 text-muted-foreground/40" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-xs leading-relaxed">
        {m.tip}
      </TooltipContent>
    </Tooltip>
  )
}
