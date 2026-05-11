import { Calendar, User, Tag } from "lucide-react"
import { articles } from "@/data/articles"

export default function ArticleListPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="mb-2 font-bold text-3xl tracking-tight">文章与动态</h1>
        <p className="text-muted-foreground">工具发布、使用指南与运营自动化思考</p>
      </div>

      <div className="mx-auto max-w-2xl">
        {/* Timeline line */}
        <div className="relative">
          <div className="absolute top-0 bottom-0 left-[19px] w-px bg-border" />

          <div className="flex flex-col gap-8">
            {articles.map((article) => (
              <article key={article.id} className="relative pl-12">
                {/* Timeline dot */}
                <div className="absolute left-[11px] top-1.5 z-10 flex size-[17px] items-center justify-center rounded-full border-2 border-border bg-card">
                  <div className="size-2 rounded-full bg-primary/60" />
                </div>

                {/* Card */}
                <div className="group rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:shadow-primary/5">
                  {/* Meta */}
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {article.date}
                    </span>
                    {article.author && (
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3" />
                        {article.author}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="mb-2 font-semibold text-lg leading-snug group-hover:text-primary transition-colors">
                    {article.title}
                  </h2>

                  {/* Summary */}
                  <p className="mb-3 text-muted-foreground text-sm leading-relaxed">
                    {article.summary}
                  </p>

                  {/* Tags */}
                  {article.tags && article.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag className="size-3 text-muted-foreground" />
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
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
