import { useState } from "react"
import { Lock, Unlock } from "lucide-react"
import { softwareList } from "@/data/software"
import SearchBar from "@/components/software/SearchBar"
import SoftwareGrid from "@/components/software/SoftwareGrid"
import { useSoftwareFilter } from "@/hooks/useSoftwareFilter"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SITE_DESCRIPTION } from "@/lib/constants"

export default function HomePage() {
  const [search, setSearch] = useState("")
  const [pinUnlocked, setPinUnlocked] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState("")
  const [pinLoading, setPinLoading] = useState(false)

  const visibleList = pinUnlocked ? softwareList : softwareList.filter((s) => !s.requirePin)
  const filtered = useSoftwareFilter(visibleList, search)

  const handleVerify = async () => {
    setPinError("")
    setPinLoading(true)
    try {
      const resp = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const data = await resp.json()
      if (data.ok) {
        setPinUnlocked(true)
        setShowPin(false)
        setPin("")
      } else {
        setPinError(data.error || "PIN 码错误")
      }
    } catch {
      setPinError("网络错误")
    }
    setPinLoading(false)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-3 font-bold text-3xl tracking-tight">软件工具目录</h1>
        <p className="mx-auto max-w-xl text-muted-foreground">{SITE_DESCRIPTION}</p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-6">
        <SearchBar value={search} onChange={setSearch} />
        <Button
          variant={pinUnlocked ? "default" : "ghost"}
          size="icon"
          onClick={() => pinUnlocked ? setPinUnlocked(false) : setShowPin(true)}
          aria-label={pinUnlocked ? "锁定" : "解锁更多工具"}
        >
          {pinUnlocked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
        </Button>
      </div>

      <SoftwareGrid softwareList={filtered} searchQuery={search} />

      <Dialog open={showPin} onOpenChange={setShowPin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>PIN 验证</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">验证后可查看受保护的工具</p>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              placeholder="输入 PIN 码"
              autoFocus
              className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            {pinError && <p className="text-xs text-destructive">{pinError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowPin(false)}>取消</Button>
              <Button size="sm" onClick={handleVerify} disabled={!pin || pinLoading}>
                {pinLoading ? "验证中..." : "验证"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
