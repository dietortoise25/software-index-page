import { useState, useEffect, useRef } from "react"
import { X, Bot, RotateCcw } from "lucide-react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { Requirement } from "./types"
import MessageBubble from "./MessageBubble"
import TypingIndicator from "./TypingIndicator"
import RequirementPreview from "./RequirementPreview"

type ChatState =
  | { phase: "chat" }
  | { phase: "preview"; requirement: Requirement }
  | { phase: "submitting" }
  | { phase: "done" }

interface Props {
  open: boolean
  onClose: () => void
}

/** 解析 AI 回复中的 JSON 需求 */
function parseRequirement(content: string): Requirement | null {
  const match = content.match(/```json\s*([\s\S]*?)\s*```/)
  if (!match) return null
  try {
    const obj = JSON.parse(match[1])
    if (obj.title && obj.type && obj.problem) return obj as Requirement
    return null
  } catch {
    return null
  }
}

export default function ChatDialog({ open, onClose }: Props) {
  const [state, setState] = useState<ChatState>({ phase: "chat" })
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ message }) => {
      const fullText = message.parts
        .filter((p: { type: string; text?: string }) => p.type === "text")
        .map((p: { type: string; text?: string }) => p.text || "")
        .join("")
      const req = parseRequirement(fullText)
      if (req) setState({ phase: "preview", requirement: req })
    },
  })

  const isLoading = status === "submitted" || status === "streaming"
  const isReady = status === "ready"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, status])

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage({ text: input })
    setInput("")
  }

  const handleConfirm = async (edited?: Requirement) => {
    setState({ phase: "submitting" })
    try {
      // Extract text content from parts for the API
      const conversationText = messages.map((m) => ({
        role: m.role,
        content: m.parts.filter((p) => p.type === "text").map((p) => p.text || "").join(""),
      }))

      const resp = await fetch("/api/requirement/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edited ? { edited } : { messages: conversationText }),
      })
      const data = await resp.json()
      if (data.ok) {
        setState({ phase: "done" })
        setTimeout(() => {
          setState({ phase: "chat" })
          onClose()
        }, 2500)
      } else {
        throw new Error(data.error || "提交失败")
      }
    } catch {
      // stay in preview on error
      setState({ phase: "preview", requirement: edited || (state as { requirement: Requirement }).requirement })
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-end p-4 pointer-events-none">
      <div
        className="pointer-events-auto flex w-full max-w-[420px] flex-col rounded-2xl border bg-background shadow-2xl overflow-hidden animate-[fadeInUp_0.3s_ease-out]"
        style={{ height: "min(640px, calc(100vh - 32px))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">AI 需求助手</p>
              <p className="text-muted-foreground text-xs">引导式需求梳理</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setState({ phase: "chat" })}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
              aria-label="重新开始"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-2 space-y-1">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-6 text-primary" />
              </div>
              <p className="font-medium text-sm">你好！我是AI需求助手</p>
              <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                我会通过几个问题帮你梳理需求，整理成规范的需求文档。准备好了就告诉我你的想法吧。
              </p>
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts.filter((p) => p.type === "text").map((p) => p.text || "").join("")
            return <MessageBubble key={m.id} role={m.role as "user" | "assistant"} content={text} />
          })}

          {isLoading && <TypingIndicator />}
        </div>

        {/* Footer states */}
        {state.phase === "preview" && (
          <RequirementPreview
            requirement={state.requirement}
            submitting={false}
            onBack={() => setState({ phase: "chat" })}
            onConfirm={handleConfirm}
          />
        )}

        {state.phase === "submitting" && (
          <div className="border-t p-6 text-center">
            <div className="mx-auto size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-2 text-muted-foreground text-sm">正在发送...</p>
          </div>
        )}

        {state.phase === "done" && (
          <div className="border-t p-6 text-center animate-[fadeInUp_0.3s_ease-out]">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10">
              <svg className="size-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mt-2 font-medium text-sm">提交成功</p>
            <p className="text-muted-foreground text-xs">飞书卡片已发送</p>
          </div>
        )}

        {state.phase === "chat" && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend() }}
            className="border-t p-3 flex gap-2 shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="描述你的需求..."
              disabled={!isReady}
              className="flex-1 rounded-xl border bg-muted/50 px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:bg-background transition-colors disabled:opacity-50"
              autoFocus={messages.length > 0}
            />
            <button
              type="submit"
              disabled={!input.trim() || !isReady}
              className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40"
            >
              {isLoading ? "..." : "发送"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
