import { Link } from "react-router"
import {
  BarChart3,
  FileText,
  Terminal,
  Settings2,
  Network,
  RefreshCw,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Software } from "@/types/software"

const iconMap: Record<string, LucideIcon> = {
  BarChart3,
  FileText,
  Terminal,
  Settings2,
  Network,
  RefreshCw,
}

interface SoftwareCardProps {
  software: Software
}

export default function SoftwareCard({ software }: SoftwareCardProps) {
  const latest = software.versions.find((v) => v.isLatest) ?? software.versions[0]
  const Icon = iconMap[software.iconName]

  return (
    <Link
      to={`/software/${software.id}`}
      className="group block h-full rounded-xl border bg-card p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 transition-colors duration-300 group-hover:bg-primary/15">
            {Icon && <Icon className="size-[18px] text-primary" />}
          </div>
          <h3 className="font-semibold text-base transition-colors duration-200 group-hover:text-primary">
            {software.name}
          </h3>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {software.category}
        </Badge>
      </div>
      <p className="mb-4 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
        {software.description}
      </p>
      <div className="flex items-center gap-2 text-xs">
        {latest && (
          <Badge variant="outline" className="font-mono">
            v{latest.version}
          </Badge>
        )}
        {latest?.workbenchUrl && (
          <span className="text-muted-foreground">Web 工作台可用</span>
        )}
      </div>
    </Link>
  )
}
