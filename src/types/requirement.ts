/**
 * 需求相关类型（前端）
 *
 * 注意：这些类型的权威来源在 server/src/schemas/requirement.ts（Zod schema）
 * 和 server/src/lib/storage.ts（StoredRequirement），修改时需保持两边一致。
 */

export interface Requirement {
  title: string
  type: "new-tool" | "improvement" | "bugfix" | "automation" | "other"
  priority: "urgent" | "high" | "medium" | "low"
  problem: string
  context: string
  constraints: string
  expectedOutcome: string
  department: string
  contact: string
  expectedDate: string
}

export interface StoredRequirement {
  id: string
  status: "pending" | "approved" | "rejected"
  requirement: Requirement
  schedule?: Record<string, unknown> | null
  submitter: string
  submittedAt: string
  reviewedAt?: string | null
  reviewNote?: string
}

export type FilterStatus = "pending" | "approved" | "rejected"
