import { useState, useRef, useEffect } from "react"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface Conversation {
  id: string
  title: string
  agent_type: string
  created_at: string
}

export default function AgentTestPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [error, setError] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function loadConversations() {
    try {
      const res = await fetch("/api/agent/conversations")
      const json = await res.json()
      if (json.ok) setConversations(json.data)
    } catch {
      // 未登录时忽略
    }
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return

    const userMsg: Message = { role: "user", content: input.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setStreaming(true)
    setError("")

    // 构建完整的消息历史
    const allMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error || "对话请求失败")
        setStreaming(false)
        return
      }

      // SSE 流式读取
      const reader = res.body?.getReader()
      if (!reader) { setStreaming(false); return }

      const decoder = new TextDecoder()
      let assistantContent = ""

      // 添加占位消息
      setMessages((prev) => [...prev, { role: "assistant", content: "" }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                assistantContent += data.content
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: "assistant", content: assistantContent }
                  return updated
                })
              }
              if (data.error) {
                setError(data.error)
              }
            } catch {
              // 跳过无法解析的行
            }
          }
        }
      }

      setStreaming(false)
      loadConversations() // 刷新会话列表
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误")
      setStreaming(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold"> Agent 平台测试</h1>

      <div className="flex gap-6">
        {/* 对话区 */}
        <div className="flex-1 space-y-4">
          <div className="border rounded-lg h-96 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {messages.length === 0 && (
              <p className="text-muted-foreground text-center pt-20">
                发送消息测试 Agent 流式对话
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}>
                  <p className="whitespace-pre-wrap text-sm">{m.content || (streaming ? "..." : "")}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="输入消息..."
              disabled={streaming}
              className="flex-1 border rounded-lg px-4 py-2 text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {streaming ? "发送中..." : "发送"}
            </button>
          </div>
        </div>

        {/* 会话列表侧边栏 */}
        <div className="w-64 space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground">历史会话</h2>
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground">暂无会话</p>
          )}
          {conversations.map((c) => (
            <div key={c.id} className="border rounded-lg p-3 text-xs space-y-1">
              <p className="font-medium truncate">{c.title}</p>
              <p className="text-muted-foreground">{c.agent_type}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
