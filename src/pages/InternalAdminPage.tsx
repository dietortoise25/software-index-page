import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Pencil, Loader2, AlertCircle, Users, UserCog, Link2, Lock, ShieldCheck } from "lucide-react"
import PinGate from "@/components/review/PinGate"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

type Tab = "groups" | "operators" | "bindings" | "approval"

interface Group { id: number; name: string; shop_count: number; created_at: string }
interface Operator { id: number; name: string; created_at: string }
interface Binding {
  id: number; shop_id: number; operator_id: number; group_id: number | null; created_at: string
  shop_name: string; platform: string; shop_status: string
  operator_name: string
  is_primary: boolean; effective_from: string | null; effective_to: string | null
}

function api(path: string, body?: Record<string, unknown>) {
  const saved = sessionStorage.getItem("dash_pin") || ""
  const sep = path.includes("?") ? "&" : "?"
  return fetch(`/api/internal${path}${sep}pin=${saved}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
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
              <th className="px-4 py-2.5 text-left font-medium">店铺数</th>
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
                <td className="px-4 py-2.5"><Badge variant="secondary" className="text-xs">{g.shop_count}</Badge></td>
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
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [newName, setNewName] = useState("")
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")

  const fetch = useCallback(async () => {
    setLoading(true)
    const r = await api("/operators")
    if (r.ok) setItems(r.data)
    else setErr(r.error)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const add = async () => {
    if (!newName.trim()) return
    await api("/operators", { name: newName.trim() })
    setNewName("")
    fetch()
  }
  const update = async (id: number) => {
    await apiPut(`/operators/${id}`, { name: editName.trim() })
    setEditId(null)
    fetch()
  }
  const del = async (id: number) => { await apiDel(`/operators/${id}`); fetch() }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (err) return <div className="flex items-center gap-2 py-8 text-destructive"><AlertCircle className="size-4" />{err}</div>

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="人员姓名..." value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()} className="max-w-[160px]" />
        <Button size="sm" onClick={add} disabled={!newName.trim()}><Plus className="size-4 mr-1" />添加</Button>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium">姓名</th>
              <th className="px-4 py-2.5 text-left font-medium">创建时间</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">暂无人员</td></tr>
            )}
            {items.map(o => (
              <tr key={o.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  {editId === o.id
                    ? <Input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && update(o.id)} className="h-8 w-24" autoFocus />
                    : <span className="font-medium">{o.name}</span>
                  }
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleDateString("zh-CN")}</td>
                <td className="px-4 py-2.5 text-right">
                  {editId === o.id
                    ? <Button size="sm" variant="ghost" onClick={() => update(o.id)}>保存</Button>
                    : <Button size="sm" variant="ghost" onClick={() => { setEditId(o.id); setEditName(o.name) }}><Pencil className="size-3.5" /></Button>
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
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [selShop, setSelShop] = useState(0)
  const [selOp, setSelOp] = useState(0)
  const [selGroup, setSelGroup] = useState(0)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [r1, r2, r3] = await Promise.all([api("/shop-operators"), api("/operators"), api("/groups")])
    if (r1.ok) setItems(r1.data)
    else setErr(r1.error)
    if (r2.ok) setOperators(r2.data)
    if (r3.ok) setGroups(r3.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const add = async () => {
    if (!selShop || !selOp) return
    const r = await api("/shop-operators", { shop_id: selShop, operator_id: selOp, group_id: selGroup || null })
    if (r.ok) { setSelShop(0); setSelOp(0); setSelGroup(0); fetch() }
    else alert(r.error)
  }
  const del = async (id: number) => { await apiDel(`/shop-operators/${id}`); fetch() }

  const groupName = (gid: number | null) => groups.find(g => g.id === gid)?.name || "-"

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (err) return <div className="flex items-center gap-2 py-8 text-destructive"><AlertCircle className="size-4" />{err}</div>

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-end">
        <div className="w-[200px]">
          <label className="text-xs text-muted-foreground mb-1 block">店铺</label>
          <ShopPicker value={selShop} onChange={setSelShop} />
        </div>
        <div className="w-[140px]">
          <label className="text-xs text-muted-foreground mb-1 block">运营者</label>
          <select value={selOp} onChange={e => setSelOp(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
            <option value="">选择人员...</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="w-[150px]">
          <label className="text-xs text-muted-foreground mb-1 block">分组</label>
          <select value={selGroup} onChange={e => setSelGroup(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
            <option value="">无分组</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <Button size="sm" onClick={add} disabled={!selShop || !selOp}><Plus className="size-4 mr-1" />绑定</Button>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium">店铺</th>
              <th className="px-4 py-2.5 text-left font-medium">运营者</th>
              <th className="px-4 py-2.5 text-left font-medium">角色</th>
              <th className="px-4 py-2.5 text-left font-medium">负责时间</th>
              <th className="px-4 py-2.5 text-left font-medium">分组</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">暂无绑定</td></tr>
            )}
            {items.map(b => (
              <tr key={b.id} className={`border-b last:border-b-0 hover:bg-muted/30 ${b.is_primary ? "bg-emerald-500/5" : ""}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {b.is_primary && <span className="size-1.5 rounded-full bg-emerald-500" title="主负责人" />}
                    <span className="font-medium text-sm">{b.shop_name}</span>
                  </div>
                  <code className="ml-1.5 text-muted-foreground text-[10px]">#{b.shop_id} · {b.platform}</code>
                </td>
                <td className="px-4 py-2.5 text-sm">{b.operator_name}</td>
                <td className="px-4 py-2.5">
                  {b.is_primary ? (
                    <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">主负责人</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">协助者</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {b.effective_from ? `${b.effective_from} ~ ${b.effective_to || "至今"}` : "-"}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{groupName(b.group_id)}</td>
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

// ─── Approval Tab ───
function ApprovalTab() {
  const [shops, setShops] = useState<{ shop_id: number; name: string; platform: string }[]>([])
  const [operators, setOperators] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selShop, setSelShop] = useState(0)
  const [selOp, setSelOp] = useState(0)
  const [selDate, setSelDate] = useState(new Date().toISOString().slice(0, 10))
  const [selReason, setSelReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [reviewInstance, setReviewInstance] = useState("")
  const [changes, setChanges] = useState<any[]>([])

  const fetch = async () => {
    setLoading(true)
    const [s, o, c] = await Promise.all([
      api("/shop-operators"),
      api("/operators"),
      api("/approval/changes"),
    ])
    if (s.ok) {
      setShops([...new Map((s.data || []).map((b: any) => [b.shop_id, { shop_id: b.shop_id, name: b.shop_name, platform: b.platform }])).values()] as any)
    }
    if (o.ok) setOperators(o.data || [])
    if (c.ok) setChanges(c.data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const submit = async () => {
    if (!selShop || !selOp || !selDate || !selReason.trim()) return
    setSubmitting(true); setMsg(null)
    const r = await api("/approval/submit", {
      shop_id: selShop, operator_id: selOp, change_type: "transfer",
      effective_from: selDate, reason: selReason.trim(),
    } as any)
    if (r.ok) {
      setMsg({ type: "ok", text: `审批已提交 (${r.instance_code})` })
      setSelShop(0); setSelOp(0); setSelReason("")
      fetch()
    } else {
      setMsg({ type: "err", text: r.error })
    }
    setSubmitting(false)
  }

  const review = async () => {
    if (!reviewInstance) return
    const r = await api("/approval/" + reviewInstance + "/review", { action: "approve" } as any)
    if (r.ok) { setMsg({ type: "ok", text: r.message }); setReviewInstance(""); fetch() }
    else setMsg({ type: "err", text: r.error })
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      {/* 提交审批 */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold text-sm mb-3">发起负责人变动</h3>
        <div className="flex gap-2 flex-wrap items-end">
          <div className="w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">店铺</label>
            <select value={selShop} onChange={e => setSelShop(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
              <option value={0}>选择店铺...</option>
              {shops.map(s => <option key={s.shop_id} value={s.shop_id}>{s.name} ({s.platform})</option>)}
            </select>
          </div>
          <div className="w-[140px]">
            <label className="text-xs text-muted-foreground mb-1 block">新负责人</label>
            <select value={selOp} onChange={e => setSelOp(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-2 text-sm">
              <option value={0}>选择人员...</option>
              {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="w-[140px]">
            <label className="text-xs text-muted-foreground mb-1 block">生效日期</label>
            <Input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">变动原因</label>
            <Input placeholder="如：转岗、离职交接..." value={selReason} onChange={e => setSelReason(e.target.value)} className="h-9 text-sm" />
          </div>
          <Button size="sm" onClick={submit} disabled={submitting || !selShop || !selOp || !selReason.trim()}>
            {submitting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}提交审批
          </Button>
        </div>
        {msg && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${msg.type === "ok" ? "border border-emerald-500/30 bg-emerald-500/5 text-emerald-600" : "border border-destructive/30 bg-destructive/5 text-destructive"}`}>
            {msg.text}
          </div>
        )}
      </div>

      {/* 模拟审批（Mock） */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold text-sm mb-3">⚡ Mock 审批（模拟飞书审批人操作）</h3>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground mb-1 block">审批单号 (instance_code)</label>
            <Input placeholder="change_xxx..." value={reviewInstance} onChange={e => setReviewInstance(e.target.value)} className="h-9 text-sm" />
          </div>
          <Button size="sm" onClick={review} disabled={!reviewInstance}>同意审批</Button>
          <Button size="sm" variant="outline" onClick={async () => {
            if (!reviewInstance) return
            const r = await api("/approval/" + reviewInstance + "/review", { action: "reject" } as any)
            if (r.ok) { setMsg({ type: "ok", text: r.message }); setReviewInstance(""); fetch() }
            else setMsg({ type: "err", text: r.error })
          }}>驳回</Button>
        </div>
      </div>

      {/* 变动记录 */}
      <div>
        <h3 className="font-semibold text-sm mb-3">变动记录</h3>
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">时间</th>
                <th className="px-4 py-2 text-left font-medium">店铺ID</th>
                <th className="px-4 py-2 text-left font-medium">运营者</th>
                <th className="px-4 py-2 text-left font-medium">生效日期</th>
                <th className="px-4 py-2 text-left font-medium">原因</th>
                <th className="px-4 py-2 text-left font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {changes.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">暂无记录</td></tr>}
              {changes.map((c: any) => (
                <tr key={c.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(c.submitted_at).toLocaleString("zh-CN")}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.shop_id}</td>
                  <td className="px-4 py-2 text-sm">{c.operator?.name || "?"}</td>
                  <td className="px-4 py-2 text-xs">{c.effective_from}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{c.reason}</td>
                  <td className="px-4 py-2"><Badge variant={c.status === "approved" ? "default" : c.status === "rejected" ? "destructive" : "secondary"} className="text-xs">{c.status === "approved" ? "已通过" : c.status === "rejected" ? "已驳回" : "待审批"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Page ───
export default function InternalAdminPage() {
  const [pinUnlocked, setPinUnlocked] = useState(() => import.meta.env.DEV || sessionStorage.getItem("dash_pin") !== null)
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
        sessionStorage.setItem("dash_pin", p)
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
    { key: "approval", label: "负责人管理", icon: ShieldCheck },
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
          {tab === "approval" && <ApprovalTab />}
        </CardContent>
      </Card>

      <Separator className="my-8" />
      <div className="text-center">
        <a href="/dashboard" className="text-muted-foreground text-sm hover:text-foreground transition-colors">← 返回看板</a>
      </div>
    </div>
  )
}
