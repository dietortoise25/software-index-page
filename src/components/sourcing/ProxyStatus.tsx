import { useEffect, useState } from "react"
import { Wifi, WifiOff, Loader2 } from "lucide-react"

const PROXY_URL = "http://localhost:8766"

export default function ProxyStatus() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking")

  useEffect(() => {
    fetch(`${PROXY_URL}/health`, { signal: AbortSignal.timeout(3000) })
      .then((r) => r.json())
      .then((data) => {
        if (data?.status === "ok") {
          setStatus("online")
          // 自动通知服务器代理地址
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
  }, [])

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {status === "checking" ? (
        <Loader2 size={12} className="animate-spin text-muted-foreground" />
      ) : status === "online" ? (
        <Wifi size={12} className="text-green-500" />
      ) : (
        <WifiOff size={12} className="text-muted-foreground" />
      )}

      {status === "online" ? (
        <span className="text-green-600">本机代理已连接，可获取 SKU 明细价</span>
      ) : status === "offline" ? (
        <span className="text-muted-foreground">
          代理未连接 —
          <a
            href="/downloads/start_proxy.bat"
            className="text-blue-600 hover:underline ml-0.5"
            onClick={(e) => {
              e.preventDefault()
              alert(
                "1. 下载 start_proxy.bat（或在项目目录中找到它）\n" +
                "2. 双击运行\n" +
                "3. 弹出命令行窗口后最小化即可\n" +
                "4. 刷新此页面"
              )
            }}
          >
            如何启动？
          </a>
        </span>
      ) : null}
    </div>
  )
}
