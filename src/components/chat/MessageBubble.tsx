import { Bot, User } from "lucide-react"
import { marked } from "marked"

interface Props {
  role: "user" | "assistant"
  content: string
}

/** 轻量 markdown 渲染：仅 inline 格式 + 段落，不引入完整 prose */
function renderMd(text: string): string {
  const html = marked.parse(text, { async: false }) as string
  // 去掉 marked 默认包裹的 <p> 如果内容就是单段落
  return html
}

export default function MessageBubble({ role, content }: Props) {
  if (role === "user") {
    return (
      <div className="flex justify-end gap-2 px-4 py-1.5">
        <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-primary-foreground text-sm leading-relaxed whitespace-pre-wrap">
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
        dangerouslySetInnerHTML={{ __html: renderMd(content) }}
      />
    </div>
  )
}
