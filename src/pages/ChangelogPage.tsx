import { Link } from "react-router"
import { ArrowLeft, Sparkles, Wrench, RefreshCw, GitCommit } from "lucide-react"
import { changelog } from "@/data/changelog"

const ICONS = {
  new: <Sparkles className="size-3.5 text-emerald-500" />,
  fix: <Wrench className="size-3.5 text-amber-500" />,
  change: <RefreshCw className="size-3.5 text-blue-500" />,
}

const TYPE_LABELS = {
  new: "新增",
  fix: "修复",
  change: "变更",
}

export default function ChangelogPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="size-4" />
        返回首页
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <GitCommit className="size-5 text-primary" />
        <h1 className="text-2xl font-bold">更新日志</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-8">记录网站每次版本的功能变更与问题修复</p>

      <div className="space-y-8">
        {changelog.map((entry) => (
          <div key={entry.version}>
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-medium text-primary">
                {entry.version}
              </span>
              <span className="text-xs text-muted-foreground">{entry.date}</span>
            </div>
            <h2 className="text-lg font-semibold mb-3">{entry.title}</h2>
            <ul className="space-y-2">
              {entry.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0">{ICONS[item.type]}</span>
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground/80">{TYPE_LABELS[item.type]}</span>
                    {" "}{item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
