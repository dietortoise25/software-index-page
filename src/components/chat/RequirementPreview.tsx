import type { Requirement } from "./types"

interface Props {
  requirement: Requirement
  onConfirm: (edited?: Requirement) => void
  onBack: () => void
  submitting: boolean
}

const FIELD_LABELS: Record<string, string> = {
  title: "需求标题",
  type: "需求类型",
  priority: "优先级",
  problem: "问题痛点",
  context: "背景与现状",
  constraints: "约束条件",
  expectedOutcome: "预期效果",
  department: "部门",
  contact: "联系方式",
  expectedDate: "期望时间",
}

const TYPE_LABELS: Record<string, string> = {
  "new-tool": "新工具开发",
  improvement: "功能改进",
  bugfix: "Bug 修复",
  automation: "自动化流程",
  other: "其他",
}
const PRI_LABELS: Record<string, string> = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
}

function formatValue(key: string, value: string): string {
  if (key === "type") return TYPE_LABELS[value] || value
  if (key === "priority") return PRI_LABELS[value] || value
  return value
}

export default function RequirementPreview({ requirement, onConfirm, onBack, submitting }: Props) {
  const displayFields = ["title", "type", "priority", "problem", "context", "constraints", "expectedOutcome"]

  return (
    <div className="border-t p-4 space-y-3">
      <p className="font-medium text-sm">📋 需求确认</p>

      <div className="rounded-xl border bg-card/60 p-4 space-y-3 max-h-80 overflow-y-auto">
        {displayFields.map((key) => {
          const val = (requirement as unknown as Record<string, string>)[key]
          if (!val) return null
          return (
            <div key={key} className="space-y-0.5">
              <p className="text-muted-foreground text-xs font-medium">{FIELD_LABELS[key]}</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{formatValue(key, val)}</p>
            </div>
          )
        })}
        {requirement.department && (
          <div className="space-y-0.5">
            <p className="text-muted-foreground text-xs font-medium">部门</p>
            <p className="text-sm">{requirement.department}</p>
          </div>
        )}
        {requirement.contact && (
          <div className="space-y-0.5">
            <p className="text-muted-foreground text-xs font-medium">联系方式</p>
            <p className="text-sm">{requirement.contact}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex-1 rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-accent disabled:opacity-50"
        >
          返回修改
        </button>
        <button
          onClick={() => onConfirm()}
          disabled={submitting}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "提交中..." : "确认提交"}
        </button>
      </div>
    </div>
  )
}
