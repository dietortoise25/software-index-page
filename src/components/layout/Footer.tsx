import { SITE_NAME, VERSION } from "@/lib/constants"

export default function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto flex h-12 items-center justify-center gap-4 px-4 text-muted-foreground text-sm">
        <span>&copy; {new Date().getFullYear()} {SITE_NAME} — 公司内部工具 · 腾讯云部署</span>
        <span className="text-xs opacity-50">{VERSION}</span>
      </div>
    </footer>
  )
}
