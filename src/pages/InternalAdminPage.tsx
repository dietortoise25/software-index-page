import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Pencil, Loader2, AlertCircle, Users, UserCog, Link2, Lock } from "lucide-react"
import PinGate from "@/components/review/PinGate"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

type Tab = "groups" | "operators" | "bindings"

interface Group { id: number; name: string; operator_count: number; created_at: string }
interface Operator { id: number; name: string; group_id: number | null; created_at: string }
interface Binding { id: number; shop_id: number; operator_id: number; created_at: string }

function api(path: string, body?: Record<string, unknown>) {
  const saved = sessionStorage.getItem("dash_pin") || ""
  return fetch(`/api/internal${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify({ ...body, pin: saved }) : undefined,
  }).then(r => r.json())
}
function apiPut(path: string, body: Record<string, unknown>) {
  const saved = sessionStorage.getItem("dash_pin") || ""
  return fetch(`/api/internal${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, pin: saved }),
  }).then(r => r.json())
}
function apiDel(path: string) {
  const saved = sessionStorage.getItem("dash_pin") || ""
  return fetch(`/api/internal${path}?pin=${saved}`, { method: "DELETE" }).then(r => r.json())
}

// ─── Shop picker helper ───
function ShopPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [shops, setShops] = useState<{ shop_id: number; name: string; platform: string }[]>([])
  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.from("shops").select("shop_id, name, platform").order("name").then(({ data }) => {
        if (data) setShops(data as any)
      })
    })
  }, [])
  return (
    <select
      value={value || ""}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">选择店铺...</option>
      {shops.map(s => (
        <option key={s.shop_id} value={s.shop_id}>{s.name} ({s.platform})</option>
      ))}
    </select>
  )
}

// ─── Groups Tab ───
function GroupsTab() {
  const [items, setItems] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [newName, setNewName] = useState("")
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")

  const fetch = useCallback(async () => {
    setLoading(true)
    const r = await api("/groups")
    if (r.ok) setItems(r.data)
    else setErr(r.error)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const add = async () => {
    if (!newName.trim()) return
    await api("/groups", { name: newName.trim() })
    setNewName("")
    fetch()
  }
  const update = async (id: number) => {
    await apiPut(`/groups/${id}`, { name: editName.trim() })
    setEditId(null)
    fetch()
  }
  const del = async (id: number) => {
    await apiDel(`/groups/${id}`)
    fetch()
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (err) return <div className="flex items-center gap-2 py-8 text-destructive"><AlertCircle className="size-4" />{err}</div>

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="新建分组名称..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          className="max-w-xs"
        />
        <Button size="sm" onClick={add} disabled={!newName.trim()}><Plus className="size-4 mr-1" />新建</Button>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium">名称</th>
              <th className="px-4 py-2.5 text-left font-medium">人数</th>
              <th className="px-4 py-2.5 text-left font-medium">创建时间</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">暂无分组</td></tr>
            )}
            {items.map(g => (
              <tr key={g.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  {editId === g.id
                    ? <Input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && update(g.id)} className="h-8 w-32" autoFocus />
                    : <span className="font-medium">{g.name}</span>
                  }
                </td>
                <td className="px-4 py-2.5"><Badge variant="secondary" className="text-xs">{g.operator_count}</Badge></td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(g.created_at).toLocaleDateString("zh-CN")}</td>
                <td className="px-4 py-2.5 text-right">
                  {editId === g.id
                    ? <Button size="sm" variant="ghost" onClick={() => update(g.id)}>保存</Button>
                    : <Button size="sm" variant="ghost" onClick={() => { setEditId(g.id); setEditName(g.name) }}><Pencil className="size-3.5" /></Button>
                  }
                  <Button size="sm" variant="ghost" onClick={() => del(g.id)}><Trash2 className="size-3.5 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Operators Tab ───
function OperatorsTab() {
  const [items, setItems] = useState<Operator[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [newName, setNewName] = useState("")
  const [newGroup, setNewGroup] = useState("")
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")
  const [editGroup, setEditGroup] = useState("")

  const fetch = useCallback(async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([api("/operators"), api("/groups")])
    if (r1.ok) setItems(r1.data)
    else setErr(r1.error)
    if (r2.ok) setGroups(r2.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const add = async () => {
    if (!newName.trim()) return
    await api("/operators", { name: newName.trim(), group_id: newGroup || null })
    setNewName(""); setNewGroup("")
    fetch()
  }
  const update = async (id: number) => {
    await apiPut(`/operators/${id}`, { name: editName.trim(), group_id: editGroup || null })
    setEditId(null)
    fetch()
  }
  const del = async (id: number) => { await apiDel(`/operators/${id}`); fetch() }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (err) return <div className="flex items-center gap-2 py-8 text-destructive"><AlertCircle className="size-4" />{err}</div>

  const groupName = (gid: number | null) => groups.find(g => g.id === gid)?.name || "未分组"

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="人员姓名..." value={newName} onChange={e => setNewName(e.target.value)} className="max-w-[160px]" />
        <select value={newGroup} onChange={e => setNewGroup(e.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm max-w-[140px]">
          <option value="">未分组</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <Button size="sm" onClick={add} disabled={!newName.trim()}><Plus className="size-4 mr-1" />添加</Button>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium">姓名</th>
              <th className="px-4 py-2.5 text-left font-medium">分组</th>
              <th className="px-4 py-2.5 text-left font-medium">创建时间</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">暂无人员</td></tr>
            )}
            {items.map(o => (
              <tr key={o.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  {editId === o.id
                    ? <Input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && update(o.id)} className="h-8 w-24" autoFocus />
                    : <span className="font-medium">{o.name}</span>
                  }
                </td>
                <td className="px-4 py-2.5">
                  {editId === o.id
                    ? (
                      <select value={editGroup} onChange={e => setEditGroup(e.target.value)} className="rounded border bg-background px-2 py-1 text-xs">
                        <option value="">未分组</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    )
                    : <Badge variant="outline" className="text-xs">{groupName(o.group_id)}</Badge>
                  }
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleDateString("zh-CN")}</td>
                <td className="px-4 py-2.5 text-right">
                  {editId === o.id
                    ? <Button size="sm" variant="ghost" onClick={() => update(o.id)}>保存</Button>
                    : <Button size="sm" variant="ghost" onClick={() => { setEditId(o.id); setEditName(o.name); setEditGroup(String(o.group_id || "")) }}><Pencil className="size-3.5" /></Button>
                  }
                  <Button size="sm" variant="ghost" onClick={() => del(o.id)}><Trash2 className="size-3.5 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Bindings Tab ───
function BindingsTab() {
  const [items, setItems] = useState<Binding[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [selShop, setSelShop] = useState(0)
  const [selOp, setSelOp] = useState(0)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [r1, r2] = await Promise.all([api("/shop-operators"), api("/operators")])
    if (r1.ok) setItems(r1.data)
    else setErr(r1.error)
    if (r2.ok) setOperators(r2.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const add = async () => {
    if (!selShop || !selOp) return
    const r = await api("/shop-operators", { shop_id: selShop, operator_id: selOp })
    if (r.ok) { setSelShop(0); setSelOp(0); fetch() }
    else alert(r.error)
  }
  const del = async (id: number) => { await apiDel(`/shop-operators/${id}`); fetch() }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (err) return <div className="flex items-center gap-2 py-8 text-destructive"><AlertCircle className="size-4" />{err}</div>

  const opName = (id: number) => operators.find(o => o.id === id)?.name || "?"

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-end">
        <div className="w-[200px]">
          <label className="text-xs text-muted-foreground mb-1 block">店铺</label>
          <ShopPicker value={selShop} onChange={setSelShop} />
        </div>
        <div className="w-[160px]">
          <label className="text-xs text-muted-foreground mb-1 block">运营者</label>
          <select value={selOp} onChange={e => setSelOp(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
            <option value="">选择人员...</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <Button size="sm" onClick={add} disabled={!selShop || !selOp}><Plus className="size-4 mr-1" />绑定</Button>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium">店铺 ID</th>
              <th className="px-4 py-2.5 text-left font-medium">运营者</th>
              <th className="px-4 py-2.5 text-left font-medium">创建时间</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">暂无绑定</td></tr>
            )}
            {items.map(b => (
              <tr key={b.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="px-4 py-2.5 font-mono text-xs">{b.shop_id}</td>
                <td className="px-4 py-2.5">{opName(b.operator_id)}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(b.created_at).toLocaleDateString("zh-CN")}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => del(b.id)}><Trash2 className="size-3.5 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ───
export default function InternalAdminPage() {
  const [pinUnlocked, setPinUnlocked] = useState(() => sessionStorage.getItem("dash_pin") !== null)
  const [pinError, setPinError] = useState<string>()
  const [tab, setTab] = useState<Tab>("groups")

  const handlePinUnlock = async (p: string) => {
    try {
      const resp = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: p }),
      })
      const data = await resp.json()
      if (data.ok) {
        sessionStorage.setItem("dash_pin", "1")
        setPinUnlocked(true)
        setPinError(undefined)
      } else {
        setPinError("PIN 不正确")
      }
    } catch {
      setPinError("网络错误")
    }
  }

  if (!pinUnlocked) {
    return <PinGate onUnlock={handlePinUnlock} error={pinError} />
  }

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "groups", label: "分组管理", icon: Users },
    { key: "operators", label: "人员管理", icon: UserCog },
    { key: "bindings", label: "店铺绑定", icon: Link2 },
  ]

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">内部管理</h1>
          <p className="mt-1 text-muted-foreground text-sm">运营人员、分组与店铺绑定</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { sessionStorage.removeItem("dash_pin"); window.location.reload() }}
        >
          <Lock className="mr-1 size-3" />
          锁定
        </Button>
      </div>

      <div className="mb-6 flex rounded-lg border bg-muted/50 p-0.5">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tabs.find(t => t.key === tab)?.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {tab === "groups" && <GroupsTab />}
          {tab === "operators" && <OperatorsTab />}
          {tab === "bindings" && <BindingsTab />}
        </CardContent>
      </Card>

      <Separator className="my-8" />
      <div className="text-center">
        <a href="/dashboard" className="text-muted-foreground text-sm hover:text-foreground transition-colors">← 返回看板</a>
      </div>
    </div>
  )
}
