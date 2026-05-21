import { useState, useEffect, useRef } from "react"
import { X, Bot, RotateCcw, Maximize2, Minimize2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { Requirement, ScheduleProposal } from "./types"
import MessageBubble from "./MessageBubble"
import TypingIndicator from "./TypingIndicator"
import RequirementPreview from "./RequirementPreview"
import ScheduleProposalView from "./ScheduleProposal"

type ChatState =
  | { phase: "chat" }
  | { phase: "preview"; requirement: Requirement }
  | { phase: "scheduling"; requirement: Requirement; scheduleProposal: ScheduleProposal }
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

/** 检查 AI 回复是否包含 JSON（可能截断中） */
function hasPartialJson(content: string): boolean {
  return content.includes("```json") || content.includes('"title"')
}

/** 从消息流中提取后端注入的模型名称 */
function extractModelName(messages: Array<{ parts: Array<{ type: string; data?: unknown }> }>): string {
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type === "data-custom" && (p as { data?: { model?: string } }).data?.model) {
        return (p as { data: { model: string } }).data.model
      }
    }
  }
  return ""
}

export default function ChatDialog({ open, onClose }: Props) {
  const [state, setState] = useState<ChatState>({ phase: "chat" })
  const [input, setInput] = useState("")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const hasStartedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [modelName, setModelName] = useState("")
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState("")
  const [jsonParseFailed, setJsonParseFailed] = useState(false)

  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ message }) => {
      const fullText = message.parts
        .filter((p: { type: string; text?: string }) => p.type === "text")
        .map((p: { type: string; text?: string }) => p.text || "")
        .join("")
      const req = parseRequirement(fullText)
      if (req) {
        setJsonParseFailed(false)
        setState({ phase: "preview", requirement: req })
      } else if (hasPartialJson(fullText)) {
        setJsonParseFailed(true)
      }
    },
    onError: () => {
      setJsonParseFailed(false)
    },
  })

  // 从流中提取模型名称
  useEffect(() => {
    const name = extractModelName(messages)
    if (name) setModelName(name)
  }, [messages])

  // 打开对话时自动触发开场白（仅一次）
  useEffect(() => {
    if (open && !hasStartedRef.current && status === "ready") {
      hasStartedRef.current = true
      sendMessage({ text: "你好，请自我介绍" })
    }
  }, [open, status])

  const isLoading = status === "submitted" || status === "streaming"
  const isReady = status === "ready"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, status])

  const handleReset = () => {
    setMessages([])
    setState({ phase: "chat" })
    setJsonParseFailed(false)
    hasStartedRef.current = false
  }

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage({ text: input })
    setInput("")
  }

  const handleConfirm = async (edited?: Requirement) => {
    const req = edited || (state.phase === "preview" ? state.requirement : undefined)
    if (!req) return

    setScheduleError("")
    setScheduleLoading(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30_000)
      const resp = await fetch("/api/calendar/propose-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement: req }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await resp.json()
      if (data.ok) {
        setScheduleLoading(false)
        setState({ phase: "scheduling", requirement: req, scheduleProposal: data.data })
      } else {
        throw new Error(data.error || "排期生成失败")
      }
    } catch (err) {
      setScheduleLoading(false)
      setScheduleError(err instanceof Error ? err.message : "网络错误，可跳过排期直接提交")
    }
  }

  const handleScheduleConfirm = async (submitter: string) => {
    if (state.phase !== "scheduling") return
    setState({ phase: "submitting" })

    try {
      const resp = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement: state.requirement,
          schedule: state.scheduleProposal,
          submitter,
        }),
      })
      const data = await resp.json()
      if (data.ok) {
        setState({ phase: "done" })
        setTimeout(() => {
          setState({ phase: "chat" })
          onClose()
        }, 3000)
      } else {
        throw new Error(data.error || "提交失败")
      }
    } catch {
      setState({ phase: "scheduling", requirement: state.requirement, scheduleProposal: state.scheduleProposal })
    }
  }

  const handleScheduleBack = () => {
    if (state.phase === "scheduling") {
      setState({ phase: "preview", requirement: state.requirement })
    }
  }

  const handleSkipSchedule = async () => {
    setScheduleError("")
    setScheduleLoading(false)
    setState({ phase: "submitting" })

    try {
      const req = state.phase === "preview" ? state.requirement : null
      if (!req) return

      const resp = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement: req, submitter: "匿名" }),
      })
      const data = await resp.json()
      if (data.ok) {
        setState({ phase: "done" })
      } else {
        throw new Error(data.error || "提交失败")
      }
    } catch {
      const req = (state as { phase: "preview"; requirement: Requirement }).requirement
      setState({ phase: "preview", requirement: req })
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-end p-4 pointer-events-none">
      <div
        className={`pointer-events-auto flex flex-col rounded-2xl border bg-background shadow-2xl overflow-hidden animate-[fadeInUp_0.3s_ease-out] transition-all duration-300
          ${isFullscreen ? "fixed inset-4 z-[61] w-auto h-auto max-w-none" : "w-full max-w-[420px]"}`}
        style={isFullscreen ? {} : { height: "min(640px, calc(100vh - 32px))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">AI 需求助手</p>
              <p className="text-muted-foreground text-xs">
                {modelName
                  ? <span>由 <span className="font-medium text-foreground/70">{modelName}</span> 驱动</span>
                  : "引导式需求梳理"
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger>
                <button
                  onClick={handleReset}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
                  aria-label="重新开始"
                >
                  <RotateCcw className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">开启新一轮对话</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
                  aria-label={isFullscreen ? "退出全屏" : "全屏"}
                >
                  {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{isFullscreen ? "退出全屏" : "全屏"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors"
                  aria-label="关闭"
                >
                  <X className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">关闭</TooltipContent>
            </Tooltip>
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

          {status === "error" && (
            <div className="px-4 py-3">
              <p className="text-destructive text-xs mb-2">AI 响应失败，请重试</p>
              <button
                onClick={() => { const lastMsg = messages[messages.length - 1]; if (lastMsg && lastMsg.role === "user") { const text = lastMsg.parts.filter(p => p.type === "text").map(p => p.text || "").join(""); sendMessage({ text: "请重新回答: " + text }) } }}
                className="rounded-lg border border-destructive/30 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                重试最后一次消息
              </button>
            </div>
          )}

          {jsonParseFailed && (
            <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-800">
              <p className="text-amber-700 dark:text-amber-400 text-xs">
                AI 未生成完整需求文档，请继续对话或输入"请整理成需求文档"重试
              </p>
            </div>
          )}
        </div>

        {/* Footer states */}
        {state.phase === "preview" && !scheduleLoading && (
          <>
            {scheduleError && (
              <div className="border-t px-4 py-2.5 bg-destructive/10">
                <p className="text-destructive text-xs mb-2">{scheduleError}</p>
                <button
                  onClick={handleSkipSchedule}
                  className="rounded-lg border border-destructive/30 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  跳过排期，直接提交
                </button>
              </div>
            )}
            <RequirementPreview
              requirement={state.requirement}
              submitting={false}
              onBack={() => { setScheduleError(""); setState({ phase: "chat" }) }}
              onConfirm={handleConfirm}
            />
          </>
        )}

        {scheduleLoading && (
          <div className="border-t p-6 text-center">
            <div className="mx-auto size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-2 text-muted-foreground text-sm">正在分析日程并生成排期...</p>
          </div>
        )}

        {state.phase === "scheduling" && (
          <ScheduleProposalView
            proposal={state.scheduleProposal}
            onBack={handleScheduleBack}
            onConfirm={handleScheduleConfirm}
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
            <p className="text-muted-foreground text-xs mb-3">已提交，等待 Alan 审查</p>
            <button
              onClick={() => { setState({ phase: "chat" }); onClose(); }}
              className="rounded-xl bg-muted px-4 py-2 text-xs font-medium hover:bg-accent transition-colors"
            >
              关闭
            </button>
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
