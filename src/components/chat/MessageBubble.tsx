import { Bot, User } from "lucide-react"

interface Props {
  role: "user" | "assistant"
  content: string
}

export default function MessageBubble({ role, content }: Props) {
  if (role === "user") {
    return (
      <div className="flex justify-end gap-2 px-4 py-1.5">
        <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-primary-foreground text-sm leading-relaxed">
          {content}
        </div>
        <span className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="size-3.5 text-primary" />
        </span>
      </div>
    )
  }

  return (
    <div className="flex gap-2 px-4 py-1.5">
      <span className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="size-3.5 text-muted-foreground" />
      </span>
      <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  )
}
