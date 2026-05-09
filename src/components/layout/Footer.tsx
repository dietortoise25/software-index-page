import { SITE_NAME } from "@/lib/constants"

export default function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto flex h-12 items-center justify-center px-4 text-muted-foreground text-sm">
        &copy; {new Date().getFullYear()} {SITE_NAME} — 公司内部工具 · 腾讯云部署
      </div>
    </footer>
  )
}
