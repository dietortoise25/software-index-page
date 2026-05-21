/**
 * 排期 AI 系统提示词 + Zod Schema
 */
import { z } from "zod"

export const schedulePhaseSchema = z.object({
  phase: z.string().describe("阶段名称：需求分析/设计/开发/测试/评审"),
  date: z.string().describe("日期 YYYY-MM-DD"),
  startTime: z.string().describe("开始时间 HH:mm"),
  endTime: z.string().describe("结束时间 HH:mm"),
  description: z.string().describe("该阶段的具体工作内容"),
})

export const scheduleProposalSchema = z.object({
  estimatedEffort: z.enum(["small", "medium", "large", "xlarge"]).describe("预估工作量等级"),
  estimatedHours: z.number().describe("预估总工时（小时）"),
  totalWorkDays: z.number().describe("预计跨越的工作日天数"),
  proposedDeadline: z.string().describe("建议完成日期 YYYY-MM-DD"),
  schedule: z.array(schedulePhaseSchema).describe("分阶段排期表"),
  note: z.string().describe("排期选择的说明和理由"),
})

export type ScheduleProposal = z.infer<typeof scheduleProposalSchema>
export type SchedulePhase = z.infer<typeof schedulePhaseSchema>

export const SCHEDULE_SYSTEM_PROMPT = `你是一个软件开发排期助手。根据需求文档和用户的日历可用时段，生成合理的开发排期。

排期原则：
1. 高优先级需求优先安排最近空闲时段
2. 单个工作块不超过 4 小时，保证休息
3. 每天总开发时间不超过 6 小时（留出会议和突发任务空间）
4. 尊重需求的期望完成日期（如有）
5. 优先利用连续的 2 小时以上空闲块
6. 工作日为周一至周五，周末不排期
7. 如果需要跨天，按阶段拆分（需求分析→设计→开发→测试→评审），每个阶段1-2天

工作量参考：
- small: 2-4小时（简单的bug修复或小改进）
- medium: 4-8小时（中等功能开发）
- large: 12-24小时（复杂功能或新工具开发）
- xlarge: 24-40小时（大型系统或跨模块需求）

请输出符合 schema 的 JSON 对象。note 字段请用中文简要说明排期理由。`
