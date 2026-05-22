import { useState, useEffect, useCallback } from "react"
import { Search, ChevronUp, ChevronDown, Link2, Copy, Plus, Check } from "lucide-react"
import AuthGuard from "@/components/auth/AuthGuard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface User {
  id: string
  email: string
  name: string
  username: string
  role: "admin" | "user"
  image?: string | null
  createdAt: string
  updatedAt: string
}

interface PageGrant {
  id: number
  user_id: string
  page_path: string
  expires_at: string
  granted_by: string
  granted_at: string
  token?: string
}

type SortKey = keyof User
type Tab = "users" | "access"

const PAGE_OPTIONS = [
  { value: "/dashboard", label: "运营看板" },
  { value: "/catalog", label: "工具库" },
  { value: "/return-workflow", label: "审批流程" },
  { value: "/review", label: "需求审查" },
]

export default function PermissionsPage() {
  const [tab, setTab] = useState<Tab>("users")
  const [users, setUsers] = useState<User[]>([])
  const [grants, setGrants] = useState<PageGrant[]>([])
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [loading, setLoading] = useState(false)

  // 访客放行表单
  const [grantUserId, setGrantUserId] = useState("")
  const [grantPage, setGrantPage] = useState("/dashboard")
  const [grantHours, setGrantHours] = useState(24)
  const [granting, setGranting] = useState(false)
  const [lastToken, setLastToken] = useState("")
  const [copied, setCopied] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/internal/users")
      const d = await r.json()
      if (d.ok) setUsers(d.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const fetchGrants = useCallback(async () => {
    try {
      const r = await fetch("/api/internal/page-access")
      const d = await r.json()
      if (d.ok) setGrants(d.data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchUsers(); fetchGrants() }, [fetchUsers, fetchGrants])

  const toggleRole = async (email: string, current: string) => {
    const next = current === "admin" ? "user" : "admin"
    await fetch("/api/internal/users/role", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: next }),
    })
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, role: next } : u)))
  }

  const handleGrant = async () => {
    if (!grantUserId) return
    setGranting(true)
    try {
      const r = await fetch("/api/internal/page-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: grantUserId, pagePath: grantPage, expiresInHours: grantHours }),
      })
      const d = await r.json()
      if (d.ok) {
        setLastToken(d.data.token)
        setGrantUserId("")
        fetchGrants()
      }
    } catch { /* ignore */ }
    finally { setGranting(false) }
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}${grants.find(g => g.token === token)?.page_path || "/dashboard"}?token=${token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtered = users
    .filter((u) => [u.name, u.email, u.username].some((f) => f?.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => {
      const cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""))
      return sortDir === "asc" ? cmp : -cmp
    })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("asc") }
  }

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (sortDir === "asc" ? <ChevronUp className="size-3 inline ml-1" /> : <ChevronDown className="size-3 inline ml-1" />) : null

  return (
    <AuthGuard requireAdmin>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold">权限管理</h1>
          <p className="text-muted-foreground text-sm mt-0.5">管理用户角色与访客页面放行</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 rounded-lg bg-muted p-1 w-fit">
          {([
            ["users", "用户角色"],
            ["access", "访客放行"],
          ] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ==================== 用户角色 Tab ==================== */}
        {tab === "users" && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索用户..."
                  className="w-full max-w-xs rounded-lg border bg-muted/50 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <button onClick={() => toggleSort("name")} className="hover:text-foreground">用户<SortIcon col="name" /></button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <button onClick={() => toggleSort("email")} className="hover:text-foreground">邮箱<SortIcon col="email" /></button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <button onClick={() => toggleSort("role")} className="hover:text-foreground">角色<SortIcon col="role" /></button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <button onClick={() => toggleSort("createdAt")} className="hover:text-foreground">创建时间<SortIcon col="createdAt" /></button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="px-4 py-16 text-center text-muted-foreground">加载中...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-16 text-center text-muted-foreground">暂无用户</td></tr>
                  ) : (
                    filtered.map((u) => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {u.image ? <img src={u.image} alt="" className="size-7 rounded-full object-cover" /> :
                              <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">{(u.name || u.email).charAt(0).toUpperCase()}</div>}
                            <span className="font-medium">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleRole(u.email, u.role)}
                            className="cursor-pointer"
                          >
                            <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs hover:opacity-80">
                              {u.role === "admin" ? "管理员" : "内部用户"}
                            </Badge>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString("zh-CN")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ==================== 访客放行 Tab ==================== */}
        {tab === "access" && (
          <div className="space-y-6">
            {/* 创建表单 */}
            <div className="rounded-xl border p-4">
              <h3 className="font-medium text-sm mb-3">创建访问链接</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs text-muted-foreground mb-1 block">访客标识</label>
                  <input
                    value={grantUserId}
                    onChange={(e) => setGrantUserId(e.target.value)}
                    placeholder="如：张三"
                    className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">放行页面</label>
                  <select
                    value={grantPage}
                    onChange={(e) => setGrantPage(e.target.value)}
                    className="rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none"
                  >
                    {PAGE_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">有效期（小时）</label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={grantHours}
                    onChange={(e) => setGrantHours(Number(e.target.value))}
                    className="w-20 rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none"
                  />
                </div>
                <Button size="sm" onClick={handleGrant} disabled={!grantUserId || granting} className="gap-1.5">
                  <Plus className="size-3.5" />
                  {granting ? "生成中..." : "生成链接"}
                </Button>
              </div>

              {lastToken && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
                  <Link2 className="size-4 text-primary" />
                  <input
                    readOnly
                    value={`${window.location.origin}${grantPage}?token=${lastToken}`}
                    className="flex-1 bg-transparent text-xs text-muted-foreground outline-none"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => copyLink(lastToken)}>
                    {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              )}
            </div>

            {/* 已有链接列表 */}
            <div>
              <h3 className="font-medium text-sm mb-2">已有访问链接</h3>
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">访客</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">页面</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">过期时间</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grants.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-16 text-center text-muted-foreground text-sm">暂无访问链接</td></tr>
                    ) : (
                      grants.map((g) => (
                        <tr key={g.id} className="border-b last:border-0 hover:bg-accent/30">
                          <td className="px-4 py-3 font-medium">{g.user_id}</td>
                          <td className="px-4 py-3 text-muted-foreground">{g.page_path}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {new Date(g.expires_at).toLocaleString("zh-CN")}
                          </td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="sm" className="text-xs" onClick={() => copyLink(g.token || "")}>
                              <Copy className="size-3 mr-1" />复制链接
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
