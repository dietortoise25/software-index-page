import { useState, useRef, useEffect } from "react"
import NewsDigestTab from "@/components/agent/NewsDigestTab"

interface Message {
  role: "user" | "assistant"
  content: string
  status?: string
  meta?: {
    toolCalls: string[]
    tokens: { prompt: number; completion: number; total: number }
    thinkingEnabled: boolean
  }
}

function StatusLabel({ status }: { status?: string }) {
  if (!status) return null
  const dots = (
    <span className="flex gap-0.5 ml-1">
      <span className="w-1 h-1 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  )
  if (status.startsWith("tool_call:")) {
    const name = status.slice(10)
    return <div className="flex items-center gap-1.5 text-muted-foreground py-0.5"><span className="text-xs">Calling {name}</span>{dots}</div>
  }
  const labels: Record<string, string> = { thinking: "Thinking", tool_done: "Processing", generating: "Generating" }
  const label = labels[status] || status
  return <div className="flex items-center gap-1.5 text-muted-foreground py-0.5"><span className="text-xs">{label}</span>{dots}</div>
}

interface Conversation {
  id: string; title: string; agent_type: string; created_at: string
}

const TABS = [
  { id: "demo-0", label: "Demo-0", desc: "Agent 基座 · 功能完整", status: "active" as const },
  { id: "news-digest", label: "新闻汇集", desc: "Tavily 搜索 + LLM 摘要 + 飞书推送", status: "active" as const },
  { id: "linear", label: "线性工作流", desc: "createAgent 替换手写 tool loop", status: "coming" as const },
  { id: "branching", label: "分支路由", desc: "StateGraph + 意图分类 + 多 Agent", status: "coming" as const },
  { id: "supervisor", label: "Supervisor", desc: "createSupervisor 多 Agent 协作", status: "coming" as const },
  { id: "swarm", label: "Swarm", desc: "Agent 自主握手传递", status: "coming" as const },
]

const MILESTONES = [
  { done: true, label: "SSE 流式对话" },
  { done: true, label: "工具调用 (get_current_time)" },
  { done: true, label: "会话持久化 + 用户记忆" },
  { done: true, label: "Thinking 模式保留 (双层补丁)" },
  { done: true, label: "生产部署 (systemd + Nginx)" },
]

function MetaRow({ meta }: { meta: Message["meta"] }) {
  if (!meta) return null
  const parts: string[] = []
  if (meta.toolCalls.length > 0) parts.push(`\u{1F6E0} ${meta.toolCalls.join(", ")}`)
  if (meta.tokens.total > 0) parts.push(`${meta.tokens.total} tokens`)
  if (meta.thinkingEnabled) parts.push("thinking \u2713")
  if (parts.length === 0) return null
  return <div className="text-[10px] text-muted-foreground/60 mt-0.5 px-1 select-none">{parts.join(" · ")}</div>
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-card border rounded-xl p-6 max-w-sm space-y-3">
        <h3 className="font-semibold text-sm">Demo-0 · Agent 基座</h3>
        <p className="text-xs text-muted-foreground">
          基于 LangChain.js + ChatOpenAI 构建的 Agent 运行时平台。通过双层 pnpm patch 保留 DeepSeek
          thinking 模式，支持工具调用、会话持久化和用户记忆。
        </p>
        <div className="space-y-1.5">
          {MILESTONES.map((m) => (
            <div key={m.label} className="flex items-center gap-2 text-xs">
              <span className={m.done ? "text-green-500" : "text-muted-foreground/30"}>
                {m.done ? "\u2713" : "\u25CB"}
              </span>
              <span className={m.done ? "" : "text-muted-foreground/50"}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ComingSoon({ tab }: { tab: typeof TABS[number] }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-card border rounded-xl p-8 max-w-sm text-center space-y-3">
        <span className="inline-block bg-amber-100 text-amber-700 text-[10px] font-medium px-2 py-0.5 rounded-full">开发中</span>
        <h3 className="font-semibold">{tab.label}</h3>
        <p className="text-sm text-muted-foreground">{tab.desc}</p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded">LangGraph</span>
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded">TypeScript</span>
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded">SSE</span>
        </div>
      </div>
    </div>
  )
}

export default function AgentTestPage() {
  const [activeTab, setActiveTab] = useState("demo-0")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convId, setConvId] = useState<string | undefined>()
  const [error, setError] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadConversations() }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function loadConversations() {
    try {
      const res = await fetch("/api/agent/conversations")
      const json = await res.json()
      if (json.ok) setConversations(json.data)
    } catch { /* 未登录 */ }
  }

  async function loadConversation(c: Conversation) {
    setConvId(c.id)
    try {
      const res = await fetch(`/api/agent/conversations/${c.id}`)
      const json = await res.json()
      if (json.ok && json.data.messages) {
        setMessages(json.data.messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })))
      }
    } catch { /* ignore */ }
  }

  function newChat() {
    setMessages([])
    setConvId(undefined)
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return
    const userMsg: Message = { role: "user", content: input.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setStreaming(true)
    setError("")

    const allMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const body: Record<string, unknown> = { messages: allMessages }
      if (convId) body.conversationId = convId

      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error || "请求失败")
        setStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setStreaming(false); return }

      const decoder = new TextDecoder()
      let assistantContent = ""
      let meta: Message["meta"]

      setMessages((prev) => [...prev, { role: "assistant", content: "", status: "connecting" }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.status) {
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { ...updated[updated.length - 1], status: data.status }
                return updated
              })
            }
            if (data.content) {
              assistantContent += data.content
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: "assistant", content: assistantContent }
                return updated
              })
            }
            if (data.done) {
              if (data.meta) meta = data.meta
              if (data.conversationId && !convId) setConvId(data.conversationId)
            }
            if (data.error) setError(data.error)
          } catch { /* skip */ }
        }
      }

      if (meta) {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], meta, status: undefined }
          return updated
        })
      }

      setStreaming(false)
      loadConversations()
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误")
      setStreaming(false)
    }
  }

  const currentTab = TABS.find(t => t.id === activeTab)!

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Agent 平台探索</h1>

      <div className="flex gap-1 border-b pb-0">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMessages([]); setError("") }}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors -mb-[1px] border border-b-0 ${
              activeTab === tab.id ? "bg-background text-foreground border-border" : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            {tab.label}
            {tab.status === "coming" && <span className="ml-1.5 text-[9px] bg-muted px-1 py-0.5 rounded">Soon</span>}
          </button>
        ))}
      </div>

      {currentTab.id === "news-digest" ? (
        <NewsDigestTab />
      ) : currentTab.status === "coming" ? (
        <ComingSoon tab={currentTab} />
      ) : (
        <div className="flex gap-6">
          <div className="flex-1 space-y-4 min-w-0">
            <div className="border rounded-lg h-[28rem] overflow-y-auto p-4 space-y-3 bg-muted/20">
              {messages.length === 0 ? <EmptyState /> : (
                messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-4 py-2 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                      {m.status ? <StatusLabel status={m.status} /> : <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>}
                      {!m.status && m.role === "assistant" && <MetaRow meta={m.meta} />}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {error && <div className="bg-destructive/10 text-destructive px-4 py-2 rounded text-xs">{error}</div>}

            <div className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="输入消息..." disabled={streaming}
                className="flex-1 border rounded-lg px-4 py-2 text-sm bg-background"
              />
              <button onClick={sendMessage} disabled={streaming || !input.trim()}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >{streaming ? "..." : "发送"}</button>
            </div>
          </div>

          <div className="w-56 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-xs text-muted-foreground">历史会话</h2>
              <button onClick={newChat} className="text-[10px] text-primary hover:underline">新对话</button>
            </div>
            {conversations.length === 0 && <p className="text-[11px] text-muted-foreground">暂无会话（登录后可见）</p>}
            <div className="space-y-1">
              {conversations.map((c) => (
                <div key={c.id}
                  onClick={() => loadConversation(c)}
                  className={`border rounded-lg p-2 text-[11px] space-y-0.5 cursor-pointer hover:bg-muted/50 transition-colors ${convId === c.id ? "bg-muted border-primary/50" : ""}`}
                >
                  <p className="font-medium truncate">{c.title}</p>
                  <p className="text-muted-foreground">{c.agent_type}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
