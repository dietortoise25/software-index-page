import { useEffect, useState } from "react"
import { Wifi, WifiOff, Loader2 } from "lucide-react"

declare global {
  interface Window {
    __1688SKU_BRIDGE__?: {
      queryBatch(offerIds: string[], backendUrl: string): Promise<{ ok: boolean; total?: number; success?: number; error?: string }>
      status(): Promise<{ state: string; cookie_len?: number; has_h5tk?: boolean }>
    }
  }
}

export default function ProxyStatus() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking")
  const [info, setInfo] = useState("")

  useEffect(() => {
    let cancelled = false
    let attempts = 0

    function check() {
      const bridge = window.__1688SKU_BRIDGE__
      if (!bridge) {
        attempts++
        if (attempts < 10) setTimeout(check, 500) // 重试最多 5 秒
        else if (!cancelled) { setStatus("offline"); setInfo("扩展未安装") }
        return
      }

      bridge.status().then((s) => {
        if (cancelled) return
        if (s.state === "online" && s.has_h5tk) {
          setStatus("online"); setInfo(`1688 登录态有效 (${s.cookie_len} 字符)`)
        } else if (s.state === "online") {
          setStatus("online"); setInfo("扩展在线，请先登录 1688")
        } else {
          setStatus("offline"); setInfo("扩展无响应")
        }
      }).catch(() => { if (!cancelled) { setStatus("offline"); setInfo("扩展通信失败") } })
    }

    check()
    return () => { cancelled = true }
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
      <span className={status === "online" ? "text-green-600" : "text-muted-foreground"}>
        {info || (status === "checking" ? "检测中..." : "扩展未安装")}
      </span>
    </div>
  )
}
