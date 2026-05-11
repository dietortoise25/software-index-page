import { Bot } from "lucide-react"
import { useState } from "react"
import ChatDialog from "./ChatDialog"

export default function ChatButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-6 bottom-6 z-50 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-emerald-400 text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-primary/40"
        aria-label="AI 需求助手"
      >
        <Bot className="size-6" />
      </button>
      <ChatDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
