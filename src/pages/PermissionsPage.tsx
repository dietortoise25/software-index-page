import { useState } from "react"
import { Shield, Search, ChevronUp, ChevronDown } from "lucide-react"
import AuthGuard from "@/components/auth/AuthGuard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface PermissionUser {
  id: string
  name: string
  email: string
  username: string
  role: "admin" | "user"
  avatar?: string
  createdAt: string
  updatedAt: string
}

type SortKey = keyof PermissionUser

export default function PermissionsPage() {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // TODO: 替换为后端 API 调用
  const [users] = useState<PermissionUser[]>([])

  const filtered = users
    .filter(
      (u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const va = a[sortKey] ?? ""
      const vb = b[sortKey] ?? ""
      const cmp = String(va).localeCompare(String(vb))
      return sortDir === "asc" ? cmp : -cmp
    })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("asc") }
  }

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === "asc" ? <ChevronUp className="size-3 inline ml-1" /> : <ChevronDown className="size-3 inline ml-1" />
    ) : null

  return (
    <AuthGuard requireAdmin>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">权限管理</h1>
            <p className="text-muted-foreground text-sm mt-0.5">管理用户角色与页面访问权限</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索用户..."
                className="w-52 rounded-lg border bg-muted/50 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <Button size="sm" disabled className="text-xs">+ 添加用户</Button>
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <button onClick={() => toggleSort("name")} className="hover:text-foreground transition-colors">
                    用户<SortIcon col="name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <button onClick={() => toggleSort("email")} className="hover:text-foreground transition-colors">
                    邮箱<SortIcon col="email" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <button onClick={() => toggleSort("role")} className="hover:text-foreground transition-colors">
                    角色<SortIcon col="role" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <button onClick={() => toggleSort("createdAt")} className="hover:text-foreground transition-colors">
                    创建时间<SortIcon col="createdAt" />
                  </button>
                </th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    <Shield className="size-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">暂无用户数据</p>
                    <p className="text-xs mt-1">连接后端 API 后显示用户列表</p>
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="size-7 rounded-full" />
                        ) : (
                          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                            {(u.name || u.email).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs">
                        {u.role === "admin" ? "管理员" : "普通用户"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{u.createdAt}</td>
                    <td className="px-4 py-3">
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => {/* TODO: toggle role */ }}
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 角色说明 */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="size-4 text-primary" />
              <h3 className="font-medium text-sm">管理员</h3>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              可访问所有页面：管理后台、审查面板、运营看板、权限管理、审批流程
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="size-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">普通用户</h3>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              可访问：审查面板、运营看板、审批流程。不可访问管理后台和权限管理
            </p>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
