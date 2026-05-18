import { useState } from "react"

export type Dimension = "all" | "platform" | "operator"
export type Platform = "TIKTOK" | "SHOPEE"

export interface DashboardFilter {
  dimension: Dimension
  setDimension: (d: Dimension) => void
  platform: Platform
  setPlatform: (p: Platform) => void
  operatorId: number
  setOperatorId: (id: number) => void
}

export function useDashboardFilter(): DashboardFilter {
  const [dimension, setDimension] = useState<Dimension>("all")
  const [platform, setPlatform] = useState<Platform>("TIKTOK")
  const [operatorId, setOperatorId] = useState<number>(0)

  return { dimension, setDimension, platform, setPlatform, operatorId, setOperatorId }
}
