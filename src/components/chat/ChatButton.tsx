import { Bot, LogIn } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import ChatDialog from "./ChatDialog"
import { useAuth } from "@/lib/auth-context"

export default function ChatButton() {
  const [open, setOpen] = useState(false)
  const [showLoginTip, setShowLoginTip] = useState(false)
  const { loggedIn } = useAuth()

  const handleClick = () => {
    if (loggedIn) {
      setOpen(true)
    } else {
      setShowLoginTip(true)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="group fixed left-6 bottom-6 z-50 flex items-center gap-2.5 rounded-full bg-background/80 backdrop-blur-md border shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.03] px-1 py-1 pr-5"
        aria-label="AI 需求助手"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground shadow-md shadow-primary/20 transition-transform duration-300 group-hover:scale-105">
          <Bot className="size-5" />
        </span>
        <span className="text-sm font-medium whitespace-nowrap">AI 需求助手</span>
      </button>

      {/* 未登录提示 */}
      {showLoginTip && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setShowLoginTip(false)}>
          <div className="rounded-2xl bg-background p-6 shadow-xl max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
              <LogIn className="size-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-center mb-2">需要登录</h3>
            <p className="text-muted-foreground text-sm text-center mb-4">
              使用 AI 需求助手前请先登录或注册账号
            </p>
            <div className="flex gap-2">
              <Link to="/login" className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground text-center hover:opacity-90 transition-opacity">
                登录
              </Link>
              <Link to="/register" className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium text-center hover:bg-accent transition-colors">
                注册
              </Link>
            </div>
          </div>
        </div>
      )}

      <ChatDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
