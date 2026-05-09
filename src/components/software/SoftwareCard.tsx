import { Link } from "react-router"
import {
  BarChart3,
  FileText,
  Terminal,
  Settings2,
  Network,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Software } from "@/types/software"

const iconMap: Record<string, LucideIcon> = {
  BarChart3,
  FileText,
  Terminal,
  Settings2,
  Network,
}

interface SoftwareCardProps {
  software: Software
}

export default function SoftwareCard({ software }: SoftwareCardProps) {
  const latest = software.versions.find((v) => v.isLatest) ?? software.versions[0]
  const Icon = iconMap[software.iconName]

  return (
    <Link to={`/software/${software.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-primary">
              {Icon && <Icon className="size-5" />}
              <h3 className="font-semibold text-lg">{software.name}</h3>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {software.category}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 line-clamp-2 text-muted-foreground text-sm">
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
        </CardContent>
      </Card>
    </Link>
  )
}
