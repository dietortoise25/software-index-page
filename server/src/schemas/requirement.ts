import { z } from "zod"

export const requirementSchema = z.object({
  title: z.string().min(2).max(80).describe("需求标题"),
  type: z.enum(["new-tool", "improvement", "bugfix", "automation", "other"]).describe("需求类型"),
  priority: z.enum(["urgent", "high", "medium", "low"]).describe("优先级"),
  problem: z.string().min(5).describe("问题痛点"),
  context: z.string().min(5).describe("背景与现状"),
  constraints: z.string().min(1).describe("约束条件"),
  expectedOutcome: z.string().min(5).describe("预期效果"),
  department: z.string().optional().default("").describe("所属部门"),
  contact: z.string().optional().default("").describe("联系方式"),
  expectedDate: z.string().optional().default("").describe("期望完成时间"),
})

export type Requirement = z.infer<typeof requirementSchema>
