import { useParams, Link } from "react-router"
import { ArrowLeft, Calendar, User, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { articles } from "@/data/articles"
import EmptyState from "@/components/common/EmptyState"

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
            className="prose prose-neutral max-w-none
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
      </div>
    </div>
  )
}
