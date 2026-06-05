import { useEffect, useState } from "react"
import { Wifi, WifiOff, Loader2, Key, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

const PROXY_URL = "http://localhost:8766"

export default function ProxyStatus() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking")
  const [open, setOpen] = useState(false)
  const [h5tk, setH5tk] = useState("")
  const [msg, setMsg] = useState("")

  useEffect(() => {
    checkProxy()
  }, [])

  const checkProxy = () => {
    setStatus("checking")
    fetch(`${PROXY_URL}/health`, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.json())
      .then((data) => {
        if (data?.status === "ok") {
          setStatus("online")
          fetch("/api/shopee/sourcing/system", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ system: { proxy_url: PROXY_URL } }),
          }).catch(() => {})
        } else {
          setStatus("offline")
        }
      })
      .catch(() => setStatus("offline"))
  }

  const injectH5tk = async () => {
    if (!h5tk.trim()) return
    try {
      const r = await fetch(`${PROXY_URL}/api/set-cookie`, { method: "POST", body: h5tk.trim() })
      const j = await r.json()
      if (j.ok) {
        setMsg("已注入")
        setTimeout(() => setMsg(""), 2000)
      }
    } catch (e: any) {
      setMsg("失败: " + (e.message || ""))
    }
  }

  return (
    <div className="text-xs">
      <button className="flex items-center gap-1.5 hover:opacity-80" onClick={() => { setOpen(!open); if (!open) checkProxy() }}>
        {status === "checking" ? (
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        ) : status === "online" ? (
          <Wifi size={12} className="text-green-500" />
        ) : (
          <WifiOff size={12} className="text-muted-foreground" />
        )}
        <span className={status === "online" ? "text-green-600" : "text-muted-foreground"}>
          {status === "online" ? "本机代理已连接，可获取 SKU 明细价" : "代理未连接"}
        </span>
      </button>

      {open && (
        <div className="mt-2 p-3 border rounded-md bg-muted/30 space-y-2">
          {status === "offline" && (
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-500 shrink-0" />
              <span>
                请先双击项目目录中的 <code className="bg-muted px-1 rounded">start_proxy.bat</code> 启动本地代理
              </span>
            </div>
          )}

          <p className="text-muted-foreground">
            <b>步骤 1:</b> 在任意 1688 页面 F12 → Console 执行：
          </p>
          <code className="block text-[11px] bg-background p-2 rounded border whitespace-pre-wrap break-all">
{`fetch('http://localhost:8766/api/set-cookie', {method:'POST', body:document.cookie}).then(r=>r.json()).then(console.log)`}
          </code>
          <p className="text-muted-foreground mt-2">
            <b>步骤 2:</b> F12 → Application → Cookies → <code className="bg-muted px-1 rounded">.1688.com</code> → 复制 <code className="bg-muted px-1 rounded">_m_h5_tk</code> 的值，粘贴到下方：
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 h-8 text-xs px-2 border rounded"
              value={h5tk}
              onChange={(e) => setH5tk(e.target.value)}
              placeholder="粘贴 _m_h5_tk 的值（如 abc123_1234567890）"
            />
            <Button size="sm" variant="outline" onClick={injectH5tk} disabled={!h5tk.trim()}>
              注入
            </Button>
          </div>
          {msg && (
            <span className={`flex items-center gap-1 ${msg.includes("失败") ? "text-red-500" : "text-green-500"}`}>
              {msg.includes("失败") ? <AlertCircle size={12} /> : <Check size={12} />}
              {msg}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
