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
}
