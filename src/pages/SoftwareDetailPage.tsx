import { useParams, Link } from "react-router"
import { ArrowLeft } from "lucide-react"
import {
  BarChart3,
  FileText,
  Terminal,
  Settings2,
  Network,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { softwareList } from "@/data/software"
import VersionTimeline from "@/components/software/VersionTimeline"
import EmptyState from "@/components/common/EmptyState"

const iconMap: Record<string, LucideIcon> = {
  BarChart3,
  FileText,
  Terminal,
  Settings2,
  Network,
}

export default function SoftwareDetailPage() {
  const { id } = useParams()
  const software = softwareList.find((s) => s.id === id)

  if (!software) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          render={
            <Link to="/">
              <ArrowLeft className="size-4" />
              返回首页
            </Link>
          }
        />
        <EmptyState title="未找到该软件" description="请检查链接是否正确，或返回首页浏览" />
      </div>
    )
  }

  const latestVersion = software.versions.find((v) => v.isLatest) ?? software.versions[0]
  const Icon = iconMap[software.iconName]

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        className="mb-6"
        render={
          <Link to="/">
            <ArrowLeft className="size-4" />
            返回首页
          </Link>
        }
      />

      <div className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          {Icon && <Icon className="size-7 text-primary" />}
          <h1 className="font-bold text-3xl tracking-tight">{software.name}</h1>
          <Badge variant="secondary" className="text-sm">
            {software.category}
          </Badge>
          {latestVersion && (
            <Badge variant="outline" className="font-mono text-sm">
              v{latestVersion.version}
            </Badge>
          )}
        </div>
        <p className="max-w-2xl text-muted-foreground">{software.description}</p>
        {software.homepageUrl && (
          <a
            href={software.homepageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-primary text-sm underline underline-offset-4"
          >
            查看项目主页
          </a>
        )}
      </div>

      <Separator className="mb-8" />

      <div>
        <h2 className="mb-4 font-semibold text-xl">版本历史</h2>
        <VersionTimeline versions={software.versions} />
      </div>
    </div>
  )
}
