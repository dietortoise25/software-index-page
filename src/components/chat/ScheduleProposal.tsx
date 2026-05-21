import type { ScheduleProposal as ScheduleProposalType } from "./types"

const EFFORT_LABELS: Record<string, string> = {
  small: "小 (2-4小时)",
  medium: "中 (4-8小时)",
  large: "大 (12-24小时)",
  xlarge: "超大 (24-40小时)",
}

const EFFORT_COLORS: Record<string, string> = {
  small: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  large: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  xlarge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

interface Props {
  proposal: ScheduleProposalType
  onBack: () => void
  onConfirm: (submitter: string) => void
}

import { useState } from "react"

export default function ScheduleProposal({ proposal, onBack, onConfirm }: Props) {
  const [submitter, setSubmitter] = useState("")
  if (!proposal) {
    return (
      <div className="border-t p-6 text-center">
        <p className="text-muted-foreground text-sm">排期数据加载中...</p>
      </div>
    )
  }

  return (
    <div className="border-t flex flex-col max-h-[320px] animate-[fadeInUp_0.3s_ease-out]">
      <div className="px-4 py-2.5 border-b flex items-center justify-between shrink-0">
        <span className="font-medium text-sm">排期确认</span>
        <span className="text-muted-foreground text-xs">step 2/2</span>
      </div>

      <div className="overflow-y-auto px-4 py-3 space-y-3">
        {/* 预估信息 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${EFFORT_COLORS[proposal.estimatedEffort] || ""}`}>
            {EFFORT_LABELS[proposal.estimatedEffort] || proposal.estimatedEffort}
          </span>
          <span className="text-muted-foreground text-xs">
            预估 {proposal.estimatedHours} 小时 · {proposal.totalWorkDays} 个工作日
          </span>
        </div>

        <div className="text-xs">
          <span className="text-muted-foreground">建议完成日期：</span>
          <span className="font-medium">{proposal.proposedDeadline}</span>
        </div>

        {/* 排期明细表 */}
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">阶段</th>
                <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">日期</th>
                <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">时间</th>
                <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">内容</th>
              </tr>
            </thead>
            <tbody>
              {proposal.schedule.map((s, i) => (
                <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-2.5 py-1.5">{s.phase}</td>
                  <td className="px-2.5 py-1.5 text-muted-foreground">{s.date}</td>
                  <td className="px-2.5 py-1.5 text-muted-foreground">{s.startTime}-{s.endTime}</td>
                  <td className="px-2.5 py-1.5 text-muted-foreground">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI 说明 */}
        {proposal.note && (
          <div className="rounded-lg bg-muted/30 px-3 py-2">
            <p className="text-muted-foreground text-xs">{proposal.note}</p>
          </div>
        )}
      </div>

      {/* 提交人 */}
      <div className="px-4 py-2 border-t">
        <input
          value={submitter}
          onChange={(e) => setSubmitter(e.target.value)}
          placeholder="你的名字（方便识别提交者）"
          className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-xs outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* 操作按钮 */}
      <div className="border-t px-4 py-3 flex gap-2 shrink-0">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          返回修改
        </button>
        <button
          onClick={() => onConfirm(submitter.trim() || "匿名")}
          className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          提交需求
        </button>
      </div>
    </div>
  )
}
