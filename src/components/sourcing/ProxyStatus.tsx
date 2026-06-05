import { useEffect, useState, useCallback } from "react"
import { Wifi, WifiOff, Loader2, Check, AlertCircle, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"

const PROXY_URL = "http://localhost:8766"

export default function ProxyStatus() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking")
  const [open, setOpen] = useState(false)
  const [h5tk, setH5tk] = useState("")
  const [msg, setMsg] = useState("")
  const [stats, setStats] = useState<{ queries: number; successes: number; errors: number } | null>(null)
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([])

  const checkProxy = useCallback(() => {
    setStatus("checking")
    fetch(`${PROXY_URL}/health`, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.json())
      .then((data) => {
        if (data?.status === "ok") {
          setStatus("online")
          setStats(data.stats || null)
        } else {
          setStatus("offline")
        }
      })
      .catch(() => setStatus("offline"))
  }, [])

  const fetchStats = useCallback(() => {
    fetch(`${PROXY_URL}/api/stats`, { signal: AbortSignal.timeout(2000) })
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) setStats(data.stats)
        if (data.logs) setLogs(data.logs.reverse())
      })
      .catch(() => {})
  }, [])

  useEffect(() => { checkProxy() }, [checkProxy])

  // 展开时每 2 秒刷新状态
  useEffect(() => {
    if (!open) return
    const t = setInterval(fetchStats, 2000)
    return () => clearInterval(t)
  }, [open, fetchStats])

  const injectH5tk = async () => {
    if (!h5tk.trim()) return
    try {
      const r = await fetch(`${PROXY_URL}/api/set-cookie`, { method: "POST", body: h5tk.trim() })
      const j = await r.json()
      if (j.ok) {
        setMsg("已注入")
        checkProxy()
        setTimeout(() => setMsg(""), 2000)
      }
    } catch (e: any) {
      setMsg("失败: " + (e.message || ""))
    }
  }

  return (
    <div className="text-xs">
      <button className="flex items-center gap-1.5 hover:opacity-80" onClick={() => { setOpen(!open); if (!open) fetchStats() }}>
        {status === "checking" ? (
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        ) : status === "online" ? (
          <Wifi size={12} className="text-green-500" />
        ) : (
          <WifiOff size={12} className="text-muted-foreground" />
        )}
        <span className={status === "online" ? "text-green-600" : "text-muted-foreground"}>
          {status === "online"
            ? `本机代理已连接${stats ? ` | 查询${stats.queries} 成功${stats.successes} 失败${stats.errors}` : ""}`
            : "代理未连接"}
        </span>
      </button>

      {open && (
        <div className="mt-2 p-3 border rounded-md bg-muted/30 space-y-2">
          {status === "offline" && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle size={14} />
              <span>请先双击项目目录中的 <code className="bg-muted px-1 rounded">start_proxy.bat</code> 启动本地代理</span>
            </div>
          )}

          {/* Cookie 注入 */}
          <p className="text-muted-foreground">
            <b>步骤 1:</b> 在 1688 页面 F12 → Console 执行：
          </p>
          <code className="block text-[11px] bg-background p-2 rounded border break-all">
{`fetch('${PROXY_URL}/api/set-cookie', {method:'POST', body:document.cookie}).then(r=>r.json()).then(console.log)`}
          </code>
          <p className="text-muted-foreground">
            <b>步骤 2:</b> 粘贴 <code className="bg-muted px-1 rounded">_m_h5_tk</code> 值：
          </p>
          <div className="flex gap-2">
            <input className="flex-1 h-8 text-xs px-2 border rounded" value={h5tk} onChange={(e) => setH5tk(e.target.value)} placeholder="粘贴 _m_h5_tk 的值" />
            <Button size="sm" variant="outline" onClick={injectH5tk} disabled={!h5tk.trim()}>注入</Button>
          </div>
          {msg && (
            <span className={`flex items-center gap-1 ${msg.includes("失败") ? "text-red-500" : "text-green-500"}`}>
              {msg.includes("失败") ? <AlertCircle size={12} /> : <Check size={12} />}{msg}
            </span>
          )}

          {/* 实时日志 */}
          {logs.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Activity size={10} /> 代理日志
                <button className="ml-auto text-[10px] underline" onClick={fetchStats}>刷新</button>
              </div>
              {logs.slice(0, 15).map((l, i) => {
                const isErr = l.msg.includes("失败")
                return (
                  <div key={i} className={`text-[10px] font-mono ${isErr ? "text-red-500" : "text-muted-foreground"}`}>
                    {l.time.slice(11, 19)} {l.msg}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
