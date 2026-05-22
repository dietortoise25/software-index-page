import { useState, useEffect } from "react"
import { Link } from "react-router"
import { Calendar, User, Tag } from "lucide-react"

interface Article {
  id: number; slug: string; title: string; summary: string
  author: string; tags: string[]; created_at: string
}

export default function ArticleListPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/articles")
      .then(r => r.json())
      .then(d => { if (d.ok) setArticles(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="mb-2 font-bold text-3xl tracking-tight">文章与动态</h1>
        <p className="text-muted-foreground">工具发布、使用指南与运营自动化思考</p>
      </div>

      <div className="mx-auto max-w-2xl">
        {loading ? (
          <p className="text-center text-muted-foreground py-16">加载中...</p>
        ) : articles.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">暂无文章</p>
        ) : (
          <div className="relative">
            <div className="absolute top-0 bottom-0 left-[19px] w-px bg-border" />
            <div className="flex flex-col gap-8">
              {articles.map((article) => (
                <article key={article.id} className="relative pl-12">
                  <div className="absolute left-[11px] top-1.5 z-10 flex size-[17px] items-center justify-center rounded-full border-2 border-border bg-card">
                    <div className="size-2 rounded-full bg-primary/60" />
                  </div>
                  <Link to={`/articles/${article.slug}`} className="group block rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5">
                    <h2 className="mb-1.5 font-semibold text-lg group-hover:text-primary transition-colors">{article.title}</h2>
                    <p className="mb-3 text-muted-foreground text-sm leading-relaxed line-clamp-2">{article.summary}</p>
                    <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                      <span className="flex items-center gap-1"><Calendar className="size-3" />{new Date(article.created_at).toLocaleDateString("zh-CN")}</span>
                      <span className="flex items-center gap-1"><User className="size-3" />{article.author}</span>
                      {article.tags.map(t => (
                        <span key={t} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><Tag className="size-2.5" />{t}</span>
                      ))}
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
