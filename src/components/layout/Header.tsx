import { Link, useLocation } from "react-router"
import { Package, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE_NAME } from "@/lib/constants"
import { useDarkMode } from "@/hooks/useDarkMode"

export default function Header() {
  const [dark, toggleDark] = useDarkMode()
  const { pathname } = useLocation()

  const linkClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm transition-all duration-200 ${
      active
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
            <span>{SITE_NAME}</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            <Link to="/" className={linkClass(pathname === "/")}>
              首页
            </Link>
            <Link
              to="/catalog"
              className={linkClass(
                pathname.startsWith("/catalog") || pathname.startsWith("/software"),
              )}
            >
              工具库
            </Link>
            <Link to="/articles" className={linkClass(pathname.startsWith("/articles"))}>
              文章
            </Link>
          </nav>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDark}
          aria-label="切换主题"
          className="transition-all duration-200 hover:bg-accent/60"
        >
          {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </Button>
      </div>
    </header>
  )
}
