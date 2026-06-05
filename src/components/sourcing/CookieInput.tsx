import { useEffect, useState } from "react"
import { Key, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchAuthStatus, saveAuthCookie } from "@/lib/sourcing"

export default function CookieInput() {
  const [open, setOpen] = useState(false)
  const [cookie, setCookie] = useState("")
  const [status, setStatus] = useState<{ has: boolean; len: number } | null>(null)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    fetchAuthStatus().then((s) => setStatus({ has: s.has_cookie, len: s.cookie_len })).catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!cookie.trim()) return
    try {
      await saveAuthCookie(cookie.trim())
      setStatus({ has: true, len: cookie.trim().length })
      setMsg("已保存")
      setTimeout(() => setMsg(""), 2000)
    } catch (e: any) {
      setMsg("保存失败: " + (e.message || ""))
    }
  }

  return (
    <div className="text-xs">
      <button
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Key size={12} />
        <span>{status?.has ? `1688 登录态已配置 (${status.len}字符)` : "未配置 1688 登录态"}</span>
        {status?.has ? <Check size={12} className="text-green-500" /> : <AlertCircle size={12} className="text-amber-500" />}
      </button>

      {open && (
        <div className="mt-2 space-y-2 p-3 border rounded-md bg-muted/30">
          <p className="text-muted-foreground">
            在 1688 详情页 F12 → Console 执行：
          </p>
          <code className="block text-[11px] bg-background p-2 rounded border whitespace-pre-wrap break-all">
            {`fetch('${window.location.origin}/api/shopee/sourcing/auth', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:document.cookie})}).then(r=>r.json()).then(console.log)`}
          </code>
          <p className="text-muted-foreground">或手动粘贴完整 cookie：</p>
          <textarea
            className="w-full h-20 text-xs p-2 border rounded resize-none"
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            placeholder="粘贴 1688.com 的完整 cookie 字符串..."
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleSave}>保存</Button>
            {msg && <span className={msg.includes("失败") ? "text-red-500" : "text-green-500"}>{msg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
