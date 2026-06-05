import { useEffect, useRef, useState } from "react"
import { Wifi, WifiOff, Loader2 } from "lucide-react"

function sendToExtension(action: string, payload: any = {}): Promise<any> {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2)
    const handler = (e: MessageEvent) => {
      if (e.source !== window || !e.data || e.data._bridge !== "1688-sk-response") return
      if (e.data._id !== id) return
      window.removeEventListener("message", handler)
      resolve(e.data._result || { ok: false, error: "no response" })
    }
    window.addEventListener("message", handler)
    window.postMessage({ _bridge: "1688-sk-request", _id: id, action, ...payload }, "*")
    setTimeout(() => { window.removeEventListener("message", handler); resolve(null) }, 5000)
  })
}

export default function ProxyStatus() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking")
  const [info, setInfo] = useState("")
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([])
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false
    let attempts = 0

    async function check() {
      if (cancelRef.current) return
      const s = await sendToExtension("status")
      if (cancelRef.current) return

      if (s && s.state === "online" && s.has_h5tk) {
        setStatus("online"); setInfo(`1688 登录态有效 (${s.cookie_len} 字符)`)
        if (s.log) setLogs(s.log)
      } else if (s && s.state === "online") {
        setStatus("online"); setInfo("扩展在线，请先登录 1688")
        if (s.log) setLogs(s.log)
      } else {
        attempts++
        if (attempts < 10) setTimeout(check, 500)
        else if (!cancelRef.current) { setStatus("offline"); setInfo("扩展未安装或未登录 1688") }
      }
    }
    check()
    return () => { cancelRef.current = true }
  }, [])

  return (
    <div className="text-xs">
      <button className="flex items-center gap-1.5 hover:opacity-80" onClick={() => setOpen(!open)}>
        {status === "checking" ? (
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        ) : status === "online" ? (
          <Wifi size={12} className="text-green-500" />
        ) : (
          <WifiOff size={12} className="text-muted-foreground" />
        )}
        <span className={status === "online" ? "text-green-600" : "text-muted-foreground"}>
          {info || (status === "checking" ? "检测中..." : "扩展未安装或未登录 1688")}
        </span>
      </button>

      {open && logs.length > 0 && (
        <div className="mt-1 p-2 border rounded-md bg-muted/30 max-h-40 overflow-y-auto space-y-0.5">
          {logs.slice(-15).map((l, i) => {
            const isErr = l.msg.includes("FAIL")
            return (
              <div key={i} className={`text-[10px] font-mono ${isErr ? "text-red-500" : "text-muted-foreground"}`}>
                {l.time?.slice(11, 19) || ""} {l.msg}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { sendToExtension }
