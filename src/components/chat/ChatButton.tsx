import { Bot } from "lucide-react"
import { useState } from "react"
import ChatDialog from "./ChatDialog"

export default function ChatButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group fixed left-6 bottom-6 z-50 flex items-center gap-2.5 rounded-full bg-background/80 backdrop-blur-md border shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.03] px-1 py-1 pr-5"
        aria-label="AI 需求助手"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground shadow-md shadow-primary/20 transition-transform duration-300 group-hover:scale-105">
          <Bot className="size-5" />
        </span>
        <span className="text-sm font-medium whitespace-nowrap">AI 需求助手</span>
      </button>
      <ChatDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
