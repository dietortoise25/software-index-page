import { useState, useEffect, useCallback, useMemo } from "react"
import { RefreshCw } from "lucide-react"
import PinGate from "@/components/review/PinGate"
import RequirementCard from "@/components/review/RequirementCard"
import type { StoredRequirement, FilterStatus, ScheduleProposal } from "@/types/requirement"
import { verifyPin } from "@/lib/api"

export default function ReviewPage() {
  const [pin, setPin] = useState("")
  const [unlocked, setUnlocked] = useState(false)
  const [pinError, setPinError] = useState("")

  const [items, setItems] = useState<StoredRequirement[]>([])
  const [filter, setFilter] = useState<FilterStatus>("pending")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState({ title: "", type: "new-tool", priority: "medium", problem: "", context: "", constraints: "", expectedOutcome: "", submitter: "" })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch("/api/requirements/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const data = await resp.json()
      if (data.ok) {
        const list = (data.data as StoredRequirement[]).sort(
          (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
        )
        setItems(list)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [pin])

  useEffect(() => {
    if (unlocked) fetchItems()
  }, [unlocked, fetchItems])

  const handleUnlock = async (p: string) => {
    setPinError("")
    const data = await verifyPin(p)
    if (data.ok) {
      setPin(p)
      setUnlocked(true)
      sessionStorage.setItem("review_pin", p)
    } else {
      setPinError(data.error || "PIN 码不正确")
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("review_pin")
    if (saved) {
      setPin(saved)
      setUnlocked(true)
    }
  }, [])

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    setErrorMsg("")
    try {
      const resp = await fetch(`/api/requirements/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const data = await resp.json()
      if (data.ok) {
        setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" as const } : r)))
      } else {
        setErrorMsg(data.error || "审批失败")
      }
    } catch {
      setErrorMsg("审批失败，请重试")
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: string, note: string) => {
    setActionLoading(id)
    setErrorMsg("")
    try {
      const resp = await fetch(`/api/requirements/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, note }),
      })
      const data = await resp.json()
      if (data.ok) {
        setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" as const, reviewNote: note } : r)))
      } else {
        setErrorMsg(data.error || "驳回失败")
      }
    } catch {
      setErrorMsg("驳回失败，请重试")
    } finally {
      setActionLoading(null)
    }
  }

  const handleReschedule = async (id: string) => {
    setActionLoading(id)
    setErrorMsg("")
    try {
      const resp = await fetch(`/api/requirements/${id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      })
      const data = await resp.json()
      if (data.ok) {
        setItems((prev) => prev.map((r) => (r.id === id ? { ...r, schedule: data.data as ScheduleProposal } : r)))
      } else {
        setErrorMsg(data.error || "重新排期失败")
      }
    } catch {
      setErrorMsg("重新排期失败，请重试")
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdate = async (id: string, fields: Record<string, string>) => {
    setActionLoading(id)
    setErrorMsg("")
    try {
      const resp = await fetch(`/api/requirements/${id}/update`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin, fields }),
      })
      const data = await resp.json()
      if (data.ok) {
        setItems((prev) => prev.map((r) => (r.id === id ? { ...r, requirement: { ...r.requirement, ...fields } } : r)))
      } else { setErrorMsg(data.error || "更新失败") }
    } catch { setErrorMsg("更新失败，请重试") }
    finally { setActionLoading(null) }
  }

  const handleDelete = async (id: string) => {
    setActionLoading(id)
    setErrorMsg("")
    try {
      const resp = await fetch(`/api/requirements/${id}/delete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }),
      })
      const data = await resp.json()
      if (data.ok) {
        setItems((prev) => prev.filter((r) => r.id !== id))
      } else { setErrorMsg(data.error || "删除失败") }
    } catch { setErrorMsg("删除失败，请重试") }
    finally { setActionLoading(null) }
  }

  const handleSendCard = async (id: string) => {
    setActionLoading(id)
    setErrorMsg("")
    try {
      const resp = await fetch(`/api/requirements/${id}/send-card`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }),
      })
      const data = await resp.json()
      if (!data.ok) { setErrorMsg(data.error || "发送失败") }
    } catch { setErrorMsg("发送失败，请重试") }
    finally { setActionLoading(null) }
  }

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newForm.title.trim()) return
    setActionLoading("new")
    setErrorMsg("")
    try {
      const resp = await fetch("/api/requirements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement: { ...newForm, department: "", contact: "", expectedDate: "" }, submitter: newForm.submitter || "Alan" }),
      })
      const data = await resp.json()
      if (data.ok) {
        setShowNewForm(false)
        setNewForm({ title: "", type: "new-tool", priority: "medium", problem: "", context: "", constraints: "", expectedOutcome: "", submitter: "" })
        fetchItems()
      } else { setErrorMsg(data.error || "创建失败") }
    } catch { setErrorMsg("创建失败，请重试") }
    finally { setActionLoading(null) }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const selectAll = () => {
    if (selected.size === filtered.length) { setSelected(new Set()); return }
    setSelected(new Set(filtered.map((r) => r.id)))
  }
  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    setActionLoading("batch")
    setErrorMsg("")
    try {
      const resp = await fetch("/api/requirements/batch-delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, ids: [...selected] }),
      })
      const data = await resp.json()
      if (data.ok) {
        setItems((prev) => prev.filter((r) => !selected.has(r.id)))
        setSelected(new Set())
      } else { setErrorMsg(data.error || "批量删除失败") }
    } catch { setErrorMsg("批量删除失败，请重试") }
    finally { setActionLoading(null) }
  }

  const filtered = useMemo(() => {
    let result = items.filter((r) => r.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          (r.requirement.title as string)?.toLowerCase().includes(q) ||
          r.submitter.toLowerCase().includes(q),
      )
    }
    return result
  }, [items, filter, search])

  const pendingCount = items.filter((r) => r.status === "pending").length
  const approvedCount = items.filter((r) => r.status === "approved").length
  const rejectedCount = items.filter((r) => r.status === "rejected").length

  if (!unlocked) {
    return (
      <div className="container mx-auto px-4 py-8">
        <PinGate onUnlock={handleUnlock} error={pinError} />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">需求审查面板</h1>
          <p className="text-muted-foreground text-sm mt-0.5">审查、排期并创建开发日程</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewForm(true)}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            + 新增需求
          </button>
          <button
            onClick={() => { sessionStorage.removeItem("review_pin"); setUnlocked(false); setPin("") }}
            className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
          >
            退出管理者模式
          </button>
          <button
            onClick={fetchItems}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1"
          >
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 搜索 */}
      <div className="mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索标题或提交人..."
          className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* 过滤标签 */}
      <div className="flex items-center gap-2 mb-4">
        {([
          ["pending", `待审 ${pendingCount}`],
          ["approved", `已通过 ${approvedCount}`],
          ["rejected", `已驳回 ${rejectedCount}`],
        ] as [FilterStatus, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm">{errorMsg}</div>
      )}

      {/* 批量操作栏 */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
              onChange={selectAll} className="rounded" />
            全选 ({filtered.length})
          </label>
          {selected.size > 0 && (
            <>
              <span>已选 {selected.size} 项</span>
              <button onClick={handleBatchDelete} disabled={actionLoading === "batch"}
                className="rounded-lg bg-destructive/10 px-2 py-1 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-40">
                🗑️ 批量删除
              </button>
            </>
          )}
        </div>
      )}

      {/* 新增需求表单 */}
      {showNewForm && (
        <div className="mb-4 rounded-xl border p-4 bg-background">
          <h3 className="font-medium text-sm mb-3">新增需求</h3>
          <form onSubmit={handleCreateRequirement} className="space-y-3">
            <input value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} placeholder="需求标题 *" required
              className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors" />
            <div className="flex gap-3">
              <select value={newForm.type} onChange={(e) => setNewForm({ ...newForm, type: e.target.value })}
                className="rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50">
                <option value="new-tool">新工具开发</option><option value="improvement">功能改进</option><option value="bugfix">Bug 修复</option><option value="automation">自动化流程</option><option value="other">其他</option>
              </select>
              <select value={newForm.priority} onChange={(e) => setNewForm({ ...newForm, priority: e.target.value })}
                className="rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50">
                <option value="urgent">紧急</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option>
              </select>
              <input value={newForm.submitter} onChange={(e) => setNewForm({ ...newForm, submitter: e.target.value })} placeholder="提交人"
                className="w-24 rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50" />
            </div>
            <textarea value={newForm.problem} onChange={(e) => setNewForm({ ...newForm, problem: e.target.value })} placeholder="问题痛点" rows={2}
              className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none" />
            <textarea value={newForm.context} onChange={(e) => setNewForm({ ...newForm, context: e.target.value })} placeholder="背景与现状" rows={2}
              className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none" />
            <textarea value={newForm.expectedOutcome} onChange={(e) => setNewForm({ ...newForm, expectedOutcome: e.target.value })} placeholder="预期效果" rows={2}
              className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewForm(false)}
                className="rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors">取消</button>
              <button type="submit" disabled={!newForm.title.trim() || actionLoading === "new"}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity">创建需求</button>
            </div>
          </form>
        </div>
      )}

      {/* 列表 */}
      {loading && items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="mx-auto size-5 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
          <p className="text-sm">加载中...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <RefreshCw className="size-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {filter === "pending" ? "没有待审需求" : filter === "approved" ? "没有已通过的需求" : "没有被驳回的需求"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
                className="mt-3 shrink-0 rounded" />
              <div className="flex-1 min-w-0">
                <RequirementCard
                  item={item as Parameters<typeof RequirementCard>[0]["item"]}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onReschedule={handleReschedule}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onSendCard={handleSendCard}
                  actionLoading={actionLoading === item.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
