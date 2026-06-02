import { Link } from "react-router"
import { Separator } from "@/components/ui/separator"
import { SITE_NAME, VERSION } from "@/lib/constants"

const FOOTER_LINKS = [
  { to: "/", label: "主页" },
  { to: "/articles", label: "文章" },
  { to: "/catalog", label: "工具库" },
  { to: "/about", label: "关于" },
  { to: "/dashboard", label: "控制台" },
  { to: "/changelog", label: "更新日志" },
  { to: "/agent-test", label: "Agent" },
]

export default function Footer() {
  return (
    <footer className="border-t mt-8">
      <div className="container mx-auto px-4 py-6">
        <nav className="flex flex-wrap items-center justify-center gap-3 mb-3">
          {FOOTER_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-all"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Separator className="mb-3" />
        <div className="text-center text-muted-foreground text-sm">
          <span>&copy; {new Date().getFullYear()} {SITE_NAME} — 公司内部工具</span>
          <span className="ml-4 text-xs opacity-50">{VERSION}</span>
        </div>
      </div>
    </footer>
  )
}
