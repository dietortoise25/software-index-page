import { useEffect, useState } from "react"
import { Wifi, WifiOff, Loader2 } from "lucide-react"
import { fetchSkuProviderStatus } from "@/lib/sourcing"

export default function ProxyStatus() {
  const [state, setState] = useState<"checking" | "ready" | "unconfigured">("checking")
  const [info, setInfo] = useState("")

  useEffect(() => {
    let cancelled = false
    fetchSkuProviderStatus()
      .then((s) => {
        if (cancelled) return
        setState(s.ready ? "ready" : "unconfigured")
        setInfo(s.message)
      })
      .catch(() => {
        if (cancelled) return
        setState("unconfigured")
        setInfo("无法获取 SKU Provider 状态")
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="text-xs">
      <div className="flex items-center gap-1.5">
        {state === "checking" ? (
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        ) : state === "ready" ? (
          <Wifi size={12} className="text-green-500" />
        ) : (
          <WifiOff size={12} className="text-muted-foreground" />
        )}
        <span className={state === "ready" ? "text-green-600" : "text-muted-foreground"}>
          {info || (state === "checking" ? "检测 SKU Provider..." : "未配置 SKU Provider")}
        </span>
      </div>
    </div>
  )
}
