import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Eye, EyeOff, Save, X } from "lucide-react"
import AuthGuard from "@/components/auth/AuthGuard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface Article {
  id: number
  slug: string
  title: string
  summary: string
  content: string
  cover_image?: string | null
  author: string
  tags: string[]
  status: string
  created_at: string
  updated_at: string
}

const emptyForm = {
  slug: "", title: "", summary: "", content: "", cover_image: "", author: "Alan",
  tags: [] as string[], status: "draft" as "draft" | "published",
}

export default function ArticleManagePage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Article | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [tagInput, setTagInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)

  const fetchArticles = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/internal/articles?all=1")
      const d = await r.json()
      if (d.ok) setArticles(d.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchArticles() }, [fetchArticles])

  const resetForm = () => { setForm(emptyForm); setTagInput(""); setEditing(null); setPreview(false) }

  const startEdit = (a: Article) => {
    setEditing(a)
    setForm({ slug: a.slug, title: a.title, summary: a.summary, content: a.content, cover_image: a.cover_image || "", author: a.author, tags: a.tags, status: a.status as "draft" | "published" })
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) { setForm({ ...form, tags: [...form.tags, t] }); setTagInput("") }
  }

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })
  }

  const handleSave = async () => {
    if (!form.slug || !form.title) return
    setSaving(true)
    try {
      const method = editing ? "PUT" : "POST"
      const url = editing ? `/api/internal/articles/${editing.slug}` : "/api/internal/articles"
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      resetForm()
      fetchArticles()
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  const handleDelete = async (slug: string) => {
    if (!confirm("确定删除？")) return
    await fetch(`/api/internal/articles/${slug}`, { method: "DELETE" })
    fetchArticles()
  }

  const toggleStatus = async (a: Article) => {
    const next = a.status === "published" ? "draft" : "published"
    await fetch(`/api/internal/articles/${a.slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) })
    fetchArticles()
  }

  return (
    <AuthGuard requireAdmin>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">文章管理</h1>
            <p className="text-muted-foreground text-sm mt-0.5">创建、编辑和管理文章</p>
          </div>
          {!editing && (
            <Button size="sm" onClick={() => setEditing({} as Article)} className="gap-1.5">
              <Plus className="size-3.5" />新建文章
            </Button>
          )}
        </div>

        {/* 编辑/新建表单 */}
        {(editing !== null) && (
          <div className="rounded-xl border p-4 mb-6 space-y-3">
            <div className="flex gap-3">
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="slug (URL 标识)" disabled={!!editing?.id}
                className="flex-1 rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="标题"
                className="flex-[2] rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50" />
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                <option value="draft">草稿</option>
                <option value="published">发布</option>
              </select>
            </div>
            <div className="flex gap-3">
              <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="作者"
                className="w-32 rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none" />
              <input value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} placeholder="封面图 URL"
                className="flex-1 rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none" />
            </div>
            <input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="摘要"
              className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none" />
            {/* 标签 */}
            <div className="flex items-center gap-2 flex-wrap">
              {form.tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1 text-xs">
                  {t}<button onClick={() => removeTag(t)}><X className="size-3" /></button>
                </Badge>
              ))}
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="添加标签..." className="w-28 rounded-lg border bg-muted/50 px-2 py-1 text-xs outline-none" />
            </div>
            {/* Markdown 编辑 + 预览 */}
            <div className="flex gap-3">
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Markdown 正文..."
                className={`${preview ? "hidden" : "flex-1"} min-h-[200px] rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none font-mono resize-y`} />
              {preview && (
                <div className="flex-1 min-h-[200px] rounded-lg border bg-muted/30 px-3 py-2 text-sm overflow-auto prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: form.content.replace(/\n/g, "<br>") }} />
              )}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setPreview(!preview)} className="text-xs text-muted-foreground hover:text-foreground">
                {preview ? "← 编辑" : "预览 →"}
              </button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={resetForm}>取消</Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !form.slug || !form.title}>
                  <Save className="size-3.5 mr-1" />{saving ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 文章列表 */}
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">标题</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">标签</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">日期</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">加载中...</td></tr>
              ) : articles.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">暂无文章</td></tr>
              ) : (
                articles.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <span className="font-medium">{a.title}</span>
                      <span className="text-muted-foreground text-xs ml-2">/{a.slug}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleStatus(a)}>
                        <Badge variant={a.status === "published" ? "default" : "secondary"} className="text-xs cursor-pointer">
                          {a.status === "published" ? <><Eye className="size-3 mr-1 inline" />已发布</> : <><EyeOff className="size-3 mr-1 inline" />草稿</>}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {a.tags.slice(0, 3).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                      {new Date(a.created_at).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => startEdit(a)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => handleDelete(a.slug)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGuard>
  )
}
