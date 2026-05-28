import { useState, useEffect } from "react"
import { useParams, Link } from "react-router"
import { ArrowLeft, Calendar, User, Tag } from "lucide-react"
import { marked } from "marked"
import { Button } from "@/components/ui/button"
import EmptyState from "@/components/common/EmptyState"
import { sanitizeHtml } from "@/lib/sanitize"

interface Article {
  id: number; slug: string; title: string; summary: string; content: string
  cover_image?: string | null; author: string; tags: string[]; created_at: string
}

export default function ArticleDetailPage() {
  const { id } = useParams()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/articles/${id}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setArticle(d.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">加载中...</div>
  }

  if (!article) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" render={<Link to="/articles"><ArrowLeft className="size-4" />返回文章列表</Link>} />
        <EmptyState title="文章不存在" description="请检查链接是否正确" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Button variant="ghost" className="mb-6" render={<Link to="/articles"><ArrowLeft className="size-4" />返回文章列表</Link>} />

      {article.cover_image && (
        <img src={article.cover_image} alt="" className="w-full max-h-64 object-cover rounded-xl mb-6" />
      )}

      <h1 className="mb-3 font-bold text-3xl tracking-tight">{article.title}</h1>

      <div className="flex flex-wrap items-center gap-3 mb-8 text-muted-foreground text-sm">
        <span className="flex items-center gap-1"><Calendar className="size-3.5" />{new Date(article.created_at).toLocaleDateString("zh-CN")}</span>
        <span className="flex items-center gap-1"><User className="size-3.5" />{article.author}</span>
        {article.tags.map(t => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"><Tag className="size-2.5" />{t}</span>
        ))}
      </div>

      <article className="prose dark:prose-invert max-w-none text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-xs [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_p]:mb-3"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(marked.parse(article.content, { async: false }) as string) }} />
    </div>
  )
}
