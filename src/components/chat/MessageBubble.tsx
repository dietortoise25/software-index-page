import { Bot } from "lucide-react"
import { marked } from "marked"
import { sanitizeHtml } from "@/lib/sanitize"

interface Props {
  role: "user" | "assistant"
  content: string
  userImage?: string | null
  userName?: string
}

function renderMd(text: string): string {
  return marked.parse(text, { async: false }) as string
}

export default function MessageBubble({ role, content, userImage, userName }: Props) {
  if (role === "user") {
    const initial = (userName || "U").charAt(0).toUpperCase()
    return (
      <div className="flex justify-end gap-2 px-4 py-1.5">
        <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-primary-foreground text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
        {userImage ? (
          <img src={userImage} alt="" className="mt-1 size-7 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
            {initial}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-2 px-4 py-1.5">
      <span className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="size-3.5 text-muted-foreground" />
      </span>
      <div
        className="max-w-[80%] rounded-2xl rounded-tl-md bg-muted px-4 py-2.5 text-sm leading-relaxed space-y-1
          [&_strong]:font-semibold [&_strong]:text-foreground
          [&_em]:italic
          [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
          [&_ul]:list-disc [&_ul]:pl-4
          [&_ol]:list-decimal [&_ol]:pl-4
          [&_li]:mt-0.5
          [&_p]:min-w-0
          [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground
        "
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMd(content)) }}
      />
    </div>
  )
}
