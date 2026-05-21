import { useState } from "react"
import { Lock } from "lucide-react"

interface Props {
  onUnlock: (pin: string) => void
  error?: string
}

export default function PinGate({ onUnlock, error }: Props) {
  const [pin, setPin] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length >= 4) onUnlock(pin)
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm mx-auto text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Lock className="size-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold mb-1">管理者验证</h2>
        <p className="text-muted-foreground text-sm mb-6">请输入 PIN 码以访问审查面板</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="输入 4-6 位 PIN 码"
            className="w-full rounded-xl border bg-muted/50 px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-primary/50 focus:bg-background transition-colors"
            autoFocus
          />
          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={pin.length < 4}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all"
          >
            验证
          </button>
        </form>
      </div>
    </div>
  )
}
