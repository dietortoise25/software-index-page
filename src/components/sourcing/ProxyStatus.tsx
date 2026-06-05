import { useEffect, useState, useCallback } from "react"
import { Wifi, WifiOff, Loader2, AlertCircle, Activity } from "lucide-react"

const PROXY_URL = "http://localhost:8766"

export default function ProxyStatus() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking")
  const [open, setOpen] = useState(false)
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

          {/* Cookie */}
          <p className="text-muted-foreground">
            安装 Chrome 扩展，一键发送含 httpOnly 的完整 cookie：
          </p>
          <ol className="text-muted-foreground space-y-0.5 ml-4 list-decimal text-[11px]">
            <li>Chrome 打开 <code className="bg-muted px-1 rounded">chrome://extensions</code></li>
            <li>开启 <b>开发者模式</b> → <b>加载已解压的扩展程序</b></li>
            <li>选择项目目录中的 <code className="bg-muted px-1 rounded">extension</code> 文件夹</li>
            <li>点击扩展图标 → 点<b>"发送 Cookie 给代理"</b></li>
          </ol>

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
