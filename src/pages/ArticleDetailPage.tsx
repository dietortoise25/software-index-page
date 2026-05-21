import { useParams, Link } from "react-router"
import { ArrowLeft, Calendar, User, Tag, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { articles } from "@/data/articles"
import EmptyState from "@/components/common/EmptyState"

// 关联到 /future MVP 演示的文章 ID
const FUTURE_LINKED_IDS = new Set(["ai-data-operating-system", "ai-business-copilot"])

export default function ArticleDetailPage() {
  const { id } = useParams()
  const article = articles.find((a) => a.id === id)

  if (!article) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          render={
            <Link to="/articles">
              <ArrowLeft className="size-4" />
              返回文章列表
            </Link>
          }
        />
        <EmptyState title="文章不存在" description="请检查链接是否正确" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <Button
          variant="ghost"
          className="mb-8 -ml-3"
          render={
            <Link to="/articles">
              <ArrowLeft className="size-4" />
              返回文章列表
            </Link>
          }
        />

        {/* Header */}
        <header className="mb-8">
          {article.tags && article.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Tag className="size-3.5 text-muted-foreground" />
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-secondary px-2 py-0.5 text-secondary-foreground text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="mb-4 font-bold text-3xl leading-tight tracking-tight">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
            {article.author && (
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3.5" />
                {article.author}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              {article.date}
            </span>
          </div>
        </header>

        {/* Content */}
        {article.content ? (
          <div
            className="prose prose-neutral dark:prose-invert max-w-none
              prose-headings:font-semibold prose-headings:tracking-tight
              prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-xl
              prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-lg
              prose-p:leading-relaxed prose-p:text-foreground/85
              prose-a:text-primary prose-a:underline prose-a:underline-offset-4
              prose-strong:text-foreground
              prose-li:leading-relaxed prose-li:text-foreground/85
              prose-blockquote:border-l-primary/30 prose-blockquote:text-muted-foreground
              prose-code:rounded prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm
              prose-img:rounded-xl"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        ) : (
          <p className="text-muted-foreground">{article.summary}</p>
        )}

        {/* /future MVP 演示链接 */}
        {FUTURE_LINKED_IDS.has(article.id) && (
          <Card className="mt-10 overflow-hidden border-primary/20">
            <div className="flex items-center gap-4 p-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ExternalLink className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm">查看 MVP 前端演示</p>
                <p className="text-xs text-muted-foreground mt-0.5">基于本文理念构建的经营 Copilot 仪表盘原型</p>
              </div>
              <Button className="shrink-0 ml-auto" render={<Link to="/future">打开演示 <ExternalLink className="size-3.5 ml-1" /></Link>} />
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
