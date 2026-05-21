export interface ReviewProduct {
  terms?: Record<string, string>
  decisions?: string[]
  risks?: string[]
  adrSuggested?: string[]
  relatedCode?: string[]
}

export interface Requirement {
  title: string
  type: "new-tool" | "improvement" | "bugfix" | "automation" | "other"
  priority: "urgent" | "high" | "medium" | "low"
  problem: string
  context: string
  constraints: string
  expectedOutcome: string
  department?: string
  contact?: string
  expectedDate?: string
  _review?: ReviewProduct
}

export interface SchedulePhase {
  phase: string
  date: string
  startTime: string
  endTime: string
  description: string
}

export interface ScheduleProposal {
  estimatedEffort: "small" | "medium" | "large" | "xlarge"
  estimatedHours: number
  totalWorkDays: number
  proposedDeadline: string
  schedule: SchedulePhase[]
  note: string
}
