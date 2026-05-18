import { useState } from "react"
import { ChevronDown, ChevronUp, Check, X, RefreshCw, Calendar, Pencil, Trash2, Send } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { StoredRequirement } from "@/types/requirement"

interface Props {
  item: StoredRequirement
  onApprove: (id: string) => void
  onReject: (id: string, note: string) => void
  onReschedule: (id: string) => void
  onUpdate: (id: string, fields: Record<string, string>) => void
  onDelete: (id: string) => void
  onSendCard: (id: string) => void
  actionLoading?: boolean
}

const TYPE_LABELS: Record<string, string> = {
  "new-tool": "新工具", improvement: "改进", bugfix: "Bug修复", automation: "自动化", other: "其他",
}
const PRI_VARIANT: Record<string, "destructive" | "secondary" | "default" | "outline"> = {
  urgent: "destructive", high: "destructive", medium: "default", low: "secondary",
}
const PRI_LABELS: Record<string, string> = { urgent: "紧急", high: "高", medium: "中", low: "低" }
const STATUS_VARIANT: Record<string, "destructive" | "secondary" | "default" | "outline"> = {
  pending: "secondary", approved: "default", rejected: "destructive",
}
const STATUS_LABELS: Record<string, string> = { pending: "待审", approved: "已通过", rejected: "已驳回" }

const EDITABLE_FIELDS = [
  { key: "title", label: "需求标题", type: "input" },
  { key: "problem", label: "问题痛点", type: "textarea" },
  { key: "context", label: "背景与现状", type: "textarea" },
  { key: "constraints", label: "约束条件", type: "textarea" },
  { key: "expectedOutcome", label: "预期效果", type: "textarea" },
]

export default function RequirementCard({ item, onApprove, onReject, onReschedule, onUpdate, onDelete, onSendCard, actionLoading }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectNote, setRejectNote] = useState("")
  const [editMode, setEditMode] = useState(false)
  const [editFields, setEditFields] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sendCardMsg, setSendCardMsg] = useState("")

  const dateStr = new Date(item.submittedAt).toLocaleDateString("zh-CN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
  const reviewedStr = item.reviewedAt
    ? new Date(item.reviewedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : ""

  const enterEdit = () => {
    setEditFields({
      title: item.requirement.title,
      problem: item.requirement.problem,
      context: item.requirement.context,
      constraints: item.requirement.constraints,
      expectedOutcome: item.requirement.expectedOutcome,
    })
    setEditMode(true)
  }

  const saveEdit = () => {
    onUpdate(item.id, editFields)
    setEditMode(false)
  }

  const handleSendCard = async () => {
    setSendCardMsg("")
    onSendCard(item.id)
    setSendCardMsg("卡片已发送")
    setTimeout(() => setSendCardMsg(""), 3000)
  }

  return (
    <Card size="sm" className="overflow-hidden">
      {/* 摘要栏 */}
      <CardContent className="flex items-center gap-2 flex-wrap">
        <Badge variant={PRI_VARIANT[item.requirement.priority] || "secondary"}>{PRI_LABELS[item.requirement.priority]}</Badge>
        <span className="text-xs text-muted-foreground">{TYPE_LABELS[item.requirement.type]}</span>
        <span className="font-medium text-sm truncate flex-1 min-w-[120px]">{item.requirement.title}</span>
        <span className="text-xs text-muted-foreground">{item.submitter}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">{dateStr}</span>
        {reviewedStr && <span className="text-xs text-muted-foreground hidden sm:inline">审查于 {reviewedStr}</span>}
        <Badge variant={STATUS_VARIANT[item.status] || "outline"}>{STATUS_LABELS[item.status]}</Badge>

        {/* 操作按钮 */}
        {item.status === "pending" && confirmApprove ? (
          <>
            <Button size="xs" onClick={() => { onApprove(item.id); setConfirmApprove(false) }} disabled={actionLoading}>
              <Check /> 确认
            </Button>
            <Button size="xs" variant="outline" onClick={() => setConfirmApprove(false)}>取消</Button>
          </>
        ) : item.status === "pending" ? (
          <>
            <Button size="icon-xs" variant="ghost" onClick={() => setConfirmApprove(true)} disabled={actionLoading}
              className="text-emerald-600 hover:bg-emerald-50" aria-label="通过">
              <Check />
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={() => setRejectOpen(!rejectOpen)} disabled={actionLoading}
              className="text-red-500 hover:bg-red-50" aria-label="驳回">
              <X />
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={() => onReschedule(item.id)} disabled={actionLoading}
              className="text-blue-500 hover:bg-blue-50" aria-label="重新排期">
              <RefreshCw className="size-3.5" />
            </Button>
          </>
        ) : null}

        <Button size="icon-xs" variant={editMode ? "default" : "ghost"} onClick={editMode ? saveEdit : enterEdit} disabled={actionLoading} aria-label={editMode ? "保存" : "编辑"}>
          <Pencil className="size-3.5" />
        </Button>

        {confirmDelete ? (
          <>
            <Button size="xs" variant="destructive" onClick={() => { onDelete(item.id); setConfirmDelete(false) }} disabled={actionLoading}>
              <Trash2 className="size-3" /> 确认删除
            </Button>
            <Button size="xs" variant="outline" onClick={() => setConfirmDelete(false)}>取消</Button>
          </>
        ) : (
          <Button size="icon-xs" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={actionLoading}
            className="text-muted-foreground hover:bg-red-50 hover:text-red-500" aria-label="删除">
            <Trash2 className="size-3.5" />
          </Button>
        )}

        <Button size="icon-xs" variant="ghost" onClick={handleSendCard} disabled={actionLoading}
          className="text-muted-foreground hover:bg-blue-50 hover:text-blue-500" aria-label="发送飞书卡片">
          <Send className="size-3.5" />
        </Button>

        <Button size="icon-xs" variant="ghost" onClick={() => setExpanded(!expanded)} aria-label="展开">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </CardContent>

      {/* 驳回备注输入 */}
      {rejectOpen && (
        <div className="border-t px-4 py-3 bg-red-50/50 dark:bg-red-950/10">
          <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="驳回原因（可选）" rows={2} />
          <div className="flex justify-end gap-2 mt-2">
            <Button size="xs" variant="destructive" onClick={() => { onReject(item.id, rejectNote); setRejectOpen(false); setRejectNote("") }} disabled={actionLoading}>确认驳回</Button>
            <Button size="xs" variant="outline" onClick={() => { setRejectOpen(false); setRejectNote("") }}>取消</Button>
          </div>
        </div>
      )}

      {sendCardMsg && (
        <div className="border-t px-4 py-2 bg-blue-50/50 dark:bg-blue-950/10 text-blue-700 dark:text-blue-400 text-xs">{sendCardMsg}</div>
      )}

      {/* 展开详情 */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3 text-sm">
          {editMode ? (
            <div className="space-y-2">
              {EDITABLE_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="text-muted-foreground text-xs">{f.label}</label>
                  {f.type === "textarea" ? (
                    <Textarea value={editFields[f.key] || ""} onChange={(e) => setEditFields({ ...editFields, [f.key]: e.target.value })} rows={2} className="mt-0.5" />
                  ) : (
                    <Input value={editFields[f.key] || ""} onChange={(e) => setEditFields({ ...editFields, [f.key]: e.target.value })} className="mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><p className="text-muted-foreground text-xs mb-1">问题痛点</p><p>{item.requirement.problem}</p></div>
              <div><p className="text-muted-foreground text-xs mb-1">背景与现状</p><p>{item.requirement.context}</p></div>
              <div><p className="text-muted-foreground text-xs mb-1">约束条件</p><p>{item.requirement.constraints}</p></div>
              <div><p className="text-muted-foreground text-xs mb-1">预期效果</p><p>{item.requirement.expectedOutcome}</p></div>
            </div>
          )}

          {item.schedule && (
            <div className="border-t pt-3">
              <p className="text-muted-foreground text-xs mb-2 flex items-center gap-1">
                <Calendar className="size-3.5" />
                排期计划 · {item.schedule.estimatedHours}h · {item.schedule.totalWorkDays}天 · 截止 {item.schedule.proposedDeadline}
              </p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-muted/50"><th className="text-left px-2 py-1 font-medium text-muted-foreground">阶段</th><th className="text-left px-2 py-1 font-medium text-muted-foreground">日期</th><th className="text-left px-2 py-1 font-medium text-muted-foreground">时间</th><th className="text-left px-2 py-1 font-medium text-muted-foreground">内容</th></tr></thead>
                  <tbody>
                    {item.schedule.schedule.map((s, i) => (
                      <tr key={i} className="border-t"><td className="px-2 py-1">{s.phase}</td><td className="px-2 py-1 text-muted-foreground">{s.date}</td><td className="px-2 py-1 text-muted-foreground">{s.startTime}-{s.endTime}</td><td className="px-2 py-1 text-muted-foreground">{s.description}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {item.schedule.note && <p className="text-muted-foreground text-xs mt-1">{item.schedule.note}</p>}
            </div>
          )}

          {item.reviewNote && (
            <div className="rounded-lg bg-muted/30 px-3 py-2"><p className="text-xs text-muted-foreground">驳回原因：{item.reviewNote}</p></div>
          )}
        </div>
      )}
    </Card>
  )
}
