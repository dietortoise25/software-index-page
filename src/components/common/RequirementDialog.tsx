import { useState } from "react"
import { requirementFormSchema } from "@/lib/validation"
import { MessageSquarePlus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

const TYPE_OPTIONS = [
  { value: "", label: "请选择" },
  { value: "new-tool", label: "新工具开发" },
  { value: "improvement", label: "功能改进" },
  { value: "bugfix", label: "Bug 修复" },
  { value: "automation", label: "自动化流程" },
  { value: "other", label: "其他" },
]

const PRIORITY_OPTIONS = [
  { value: "", label: "请选择" },
  { value: "urgent", label: "紧急" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
]

const INITIAL = {
  type: "",
  title: "",
  department: "",
  priority: "",
  description: "",
  expectedDate: "",
  contact: "",
}

export default function RequirementDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(INITIAL)
  const [submitted, setSubmitted] = useState(false)

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = requirementFormSchema.safeParse(form)
    if (!parsed.success) { setSendError(parsed.error.issues[0].message); return }
    setSending(true)
    setSendError("")

    try {
      const body = new URLSearchParams(form).toString()
      const resp = await fetch("/api/requirement", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      })
      const data = await resp.json()
      if (!data.ok) throw new Error(data.error || "提交失败")
      setSubmitted(true)
      setTimeout(() => {
        setOpen(false)
        setForm(INITIAL)
        setSubmitted(false)
      }, 2000)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "网络错误，请重试")
    } finally {
      setSending(false)
    }
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setForm(INITIAL)
      setSubmitted(false)
    }
    setOpen(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger>
        <button className="group fixed right-6 bottom-6 z-50 flex items-center gap-2.5 rounded-full bg-background/80 backdrop-blur-md border shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.03] pl-5 px-1 py-1" aria-label="提交需求">
          <span className="text-sm font-medium whitespace-nowrap">提交需求</span>
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-transform duration-300 group-hover:scale-105">
            <MessageSquarePlus className="size-5" />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>提交需求</DialogTitle>
          <DialogDescription>
            填写以下信息，我们会尽快评估并响应你的需求
          </DialogDescription>
        </DialogHeader>
        {submitted ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-primary/10">
              <MessageSquarePlus className="size-6 text-primary" />
            </div>
            <p className="font-medium text-lg">提交成功</p>
            <p className="text-muted-foreground text-sm">感谢你的反馈，我们会尽快处理</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="type">需求类型 *</Label>
                <Select items={TYPE_OPTIONS.filter(o => o.value).map(o => ({ label: o.label, value: o.value }))} value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v ?? "" }))}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.filter(o => o.value).map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="priority">优先级 *</Label>
                <Select items={PRIORITY_OPTIONS.filter(o => o.value).map(o => ({ label: o.label, value: o.value }))} value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v ?? "" }))}>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.filter(o => o.value).map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="title">需求标题 *</Label>
              <Input id="title" value={form.title} onChange={set("title")} placeholder="一句话概括你的需求" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="department">所属部门</Label>
                <Input id="department" value={form.department} onChange={set("department")} placeholder="如：运营部" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="expectedDate">期望完成时间</Label>
                <Input id="expectedDate" type="date" value={form.expectedDate} onChange={set("expectedDate")} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">详细描述 *</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={set("description")}
                placeholder="请描述需求背景、期望效果、是否有参考案例等"
                rows={4}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contact">联系方式</Label>
              <Input id="contact" value={form.contact} onChange={set("contact")} placeholder="飞书 / 邮箱 / 手机" />
            </div>
            {sendError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm">{sendError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
                取消
              </Button>
              <Button type="submit" disabled={sending}>
                {sending ? "提交中..." : "提交需求"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
