import { Link, useLocation } from "react-router"
import { Package, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE_NAME } from "@/lib/constants"
import { useEffect, useState } from "react"

export default function Header() {
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return false
    return document.documentElement.classList.contains("dark")
  })
  const { pathname } = useLocation()

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg hover:opacity-80">
            <Package className="size-5" />
            <span>{SITE_NAME}</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              to="/"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname === "/" ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              首页
            </Link>
            <Link
              to="/catalog"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname.startsWith("/catalog") || pathname.startsWith("/software")
                  ? "bg-accent font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              工具库
            </Link>
            <Link
              to="/articles"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname.startsWith("/articles")
                  ? "bg-accent font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              文章
            </Link>
          </nav>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDark((d) => !d)}
          aria-label="切换主题"
        >
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>
      </div>
    </header>
  )
}
