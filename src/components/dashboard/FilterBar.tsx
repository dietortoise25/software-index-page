import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Dimension, Platform } from "@/hooks/useDashboardFilter"

export type { Dimension, Platform }
const PLATFORMS: Platform[] = ["TIKTOK", "SHOPEE"]

interface Operator { id: number; name: string }

interface Props {
  dimension: Dimension; setDimension: (d: Dimension) => void
  platform: Platform; setPlatform: (p: Platform) => void
  operatorId: number; setOperatorId: (id: number) => void
}

export function FilterBar({ dimension, setDimension, platform, setPlatform, operatorId, setOperatorId }: Props) {
  const [operators, setOperators] = useState<Operator[]>([])

  useEffect(() => {
    if (dimension === "operator") {
      supabase.schema("internal").from("operators").select("id, name").order("name")
        .then(({ data }) => { if (data) setOperators(data as Operator[]) })
    }
  }, [dimension])

  return (
    <div className="flex items-center gap-3">
      <div className="flex rounded-lg border bg-muted/50 p-0.5">
        {(["all", "platform", "operator"] as Dimension[]).map(d => (
          <button key={d} onClick={() => setDimension(d)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              dimension === d ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {{ all: "全部", platform: "平台", operator: "运营者" }[d]}
          </button>
        ))}
      </div>

      {dimension === "platform" && (
        <select value={platform} onChange={e => setPlatform(e.target.value as Platform)}
          className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      )}

      {dimension === "operator" && (
        <select value={operatorId} onChange={e => setOperatorId(Number(e.target.value))}
          className="rounded-lg border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
          <option value={0}>全部运营者</option>
          {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
    </div>
  )
}
