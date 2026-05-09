import { Link } from "react-router"
import { Package, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE_NAME } from "@/lib/constants"
import { useEffect, useState } from "react"

export default function Header() {
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return false
    return document.documentElement.classList.contains("dark")
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg hover:opacity-80">
          <Package className="size-5" />
          <span>{SITE_NAME}</span>
        </Link>
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
