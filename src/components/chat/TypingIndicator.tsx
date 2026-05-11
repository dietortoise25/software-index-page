import { Bot } from "lucide-react"

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2">
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="size-3 text-muted-foreground" />
      </span>
      <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-muted px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block size-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: `${i * 120}ms`, animationDuration: "0.8s" }}
          />
        ))}
      </div>
    </div>
  )
}
