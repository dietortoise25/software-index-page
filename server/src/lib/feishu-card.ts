/**
 * 飞书互动卡片构建器 — 将结构化需求转为飞书卡片 JSON
 */

import type { Requirement } from "../schemas/requirement.js"
import type { ScheduleProposal } from "../lib/schedule-prompt.js"

const typeLabel: Record<string, string> = {
  "new-tool": "新工具开发", improvement: "功能改进",
  bugfix: "Bug 修复", automation: "自动化流程", other: "其他",
}
const priLabel: Record<string, string> = {
  urgent: "紧急", high: "高", medium: "中", low: "低",
}

export function buildRequirementsCard(req: Requirement, schedule?: ScheduleProposal) {
  const fields: Array<object> = [
    { tag: "hr" },
    { tag: "div", text: { tag: "lark_md", content: `**问题痛点**\n${req.problem}` } },
    { tag: "hr" },
    { tag: "div", text: { tag: "lark_md", content: `**背景与现状**\n${req.context}` } },
    { tag: "hr" },
    { tag: "div", text: { tag: "lark_md", content: `**约束条件**\n${req.constraints}` } },
    { tag: "hr" },
    { tag: "div", text: { tag: "lark_md", content: `**预期效果**\n${req.expectedOutcome}` } },
  ]

  if (req.department) {
    fields.push({ tag: "hr" }, { tag: "div", text: { tag: "lark_md", content: `**部门**\n${req.department}` } })
  }
  if (req.contact) {
    fields.push({ tag: "hr" }, { tag: "div", text: { tag: "lark_md", content: `**联系方式**\n${req.contact}` } })
  }
  if (req.expectedDate) {
    fields.push({ tag: "hr" }, { tag: "div", text: { tag: "lark_md", content: `**期望完成时间**\n${req.expectedDate}` } })
  }

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: `[AI 需求] ${req.title}` },
      template: "blue",
    },
    elements: [
      {
        tag: "column_set",
        flex_mode: "none",
        background_style: "default",
        columns: [
          {
            tag: "column", width: "weighted", weight: 1, vertical_align: "top",
            elements: [{ tag: "div", text: { tag: "lark_md", content: `**需求类型**\n${typeLabel[req.type] || req.type}` } }],
          },
          {
            tag: "column", width: "weighted", weight: 1, vertical_align: "top",
            elements: [{ tag: "div", text: { tag: "lark_md", content: `**优先级**\n${priLabel[req.priority] || req.priority}` } }],
          },
        ],
      },
      ...fields,
      ...(schedule ? [
        { tag: "hr" },
        { tag: "div", text: { tag: "lark_md", content: `**排期计划**\n预估工作量：${schedule.estimatedHours}小时 · 预计 ${schedule.totalWorkDays} 个工作日\n建议完成日期：${schedule.proposedDeadline}` } },
        { tag: "div", text: { tag: "lark_md", content: schedule.schedule.map((s) => `• ${s.phase}：${s.date} ${s.startTime}-${s.endTime} — ${s.description}`).join("\n") } },
        schedule.note ? { tag: "div", text: { tag: "lark_md", content: `💡 ${schedule.note}` } } : null,
      ].filter(Boolean) : []),
      { tag: "hr" },
      {
        tag: "note",
        elements: [{ tag: "plain_text", content: "🤖 由 AI 需求助手自动生成" }],
      },
    ],
  }
}
