import { useState } from "react"
import { Link, useLocation } from "react-router"
import { Package, Moon, Sun, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE_NAME } from "@/lib/constants"
import { useDarkMode } from "@/hooks/useDarkMode"
import UserMenu from "@/components/layout/UserMenu"

const NAV_ITEMS = [
  { to: "/", label: "首页", match: (p: string) => p === "/" },
  { to: "/catalog", label: "工具库", match: (p: string) => p.startsWith("/catalog") || p.startsWith("/software") },
  { to: "/articles", label: "文章", match: (p: string) => p.startsWith("/articles") },
  { to: "/dashboard", label: "看板", match: (p: string) => p === "/dashboard" },
  { to: "/changelog", label: "更新日志", match: (p: string) => p === "/changelog" },
  { to: "/review", label: "审查", match: (p: string) => p === "/review" },
  { to: "/about", label: "关于", match: (p: string) => p === "/about" },
]

export default function Header() {
  const [dark, toggleDark] = useDarkMode()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const linkClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm transition-all duration-200 ${active
      ? "bg-accent/80 font-medium shadow-sm"
      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
    }`

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl saturate-150">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold text-lg transition-opacity duration-200 hover:opacity-75"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Package className="size-4 text-primary" />
            </div>
            <span className="hidden sm:inline">{SITE_NAME}</span>
          </Link>
          {/* 桌面导航 */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} className={linkClass(item.match(pathname))}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            aria-label="切换主题"
            className="transition-all duration-200 hover:bg-accent/60"
          >
            {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </Button>
          <UserMenu />
          {/* 移动端汉堡按钮 */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden rounded-lg p-2 text-muted-foreground hover:bg-accent transition-colors"
            aria-label="菜单"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      {menuOpen && (
        <nav className="sm:hidden border-t bg-background/95 backdrop-blur-xl animate-[fadeInUp_0.2s_ease-out]">
          <div className="container mx-auto px-4 py-2 flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm transition-colors ${item.match(pathname)
                    ? "bg-accent/80 font-medium"
                    : "text-muted-foreground hover:bg-accent/40"
                  }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
