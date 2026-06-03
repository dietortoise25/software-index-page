import { useState } from "react"
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { SourcingRow } from "@/lib/sourcing"

const REC_COLORS: Record<string, string> = {
  "推荐": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "可考虑": "bg-amber-100 text-amber-700 border-amber-200",
  "预警": "bg-red-100 text-red-700 border-red-200",
  "待补全": "bg-gray-100 text-gray-500 border-gray-200",
}

function fmtBrl(v: number | null) {
  if (v === null || v === undefined) return "-"
  return `R$ ${v.toFixed(2)}`
}

function fmtCny(v: string | null | undefined) {
  if (!v) return "-"
  return `¥${v}`
}

function fmtPct(v: number | null) {
  if (v === null || v === undefined) return "-"
  return `${(v * 100).toFixed(1)}%`
}

interface Props {
  rows: SourcingRow[]
}

function Row({ row }: { row: SourcingRow }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-2 px-3 text-sm">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            {row.image_url && (
              <img src={row.image_url} alt="" className="w-10 h-10 rounded object-cover border shrink-0" />
            )}
            <div className="min-w-0">
              <span className="truncate block">{row.product_name}</span>
              <div className="text-[10px] text-muted-foreground">{row.data_source}</div>
            </div>
          </div>
        </td>
        <td className="py-2 px-2 text-sm text-right">{row.shopee_price_brl}</td>
        <td className="py-2 px-2 text-sm text-right font-medium">{fmtCny(row.best_1688?.price_cny)}</td>
        <td className="py-2 px-2 text-sm text-right">{fmtBrl(row.total_cost_brl)}</td>
        <td className="py-2 px-2 text-sm text-right">{fmtBrl(row.margin_brl)}</td>
        <td className="py-2 px-2 text-sm text-right">{fmtPct(row.margin_rate)}</td>
        <td className="py-2 px-2 text-center">
          <Badge variant="outline" className={`text-[11px] ${REC_COLORS[row.recommendation] || ""}`}>
            {row.recommendation}
          </Badge>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-muted/20 px-4 py-3">
            {row.candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">未找到同款货源</p>
            ) : (
              <div className="space-y-2">
                {row.candidates.map((c, i) => (
                  <div key={i} className="flex items-start justify-between rounded-md border bg-background p-3 text-sm gap-3">
                    {c.image_url && (
                      <img src={c.image_url} alt="" className="w-16 h-16 rounded border object-cover shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{c.title}</span>
                        {i === 0 && (
                          <Badge variant="outline" className="text-[10px] shrink-0">最佳</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {c.shop_name} · 销量 {c.sales || "-"} · {c.min_order || "-"}
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {c.offer_tags?.map((t) => (
                          <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-primary">{fmtCny(c.price_cny)}</div>
                      <a
                        href={c.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-0.5 mt-1"
                      >
                        查看详情 <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export default function ResultTable({ rows }: Props) {
  if (rows.length === 0) return null

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-xs text-muted-foreground">
            <th className="py-2 px-3 text-left font-medium">产品</th>
            <th className="py-2 px-2 text-right font-medium w-[90px]">Shopee售价</th>
            <th className="py-2 px-2 text-right font-medium w-[80px]">1688价</th>
            <th className="py-2 px-2 text-right font-medium w-[90px]">落地成本</th>
            <th className="py-2 px-2 text-right font-medium w-[80px]">利润</th>
            <th className="py-2 px-2 text-right font-medium w-[70px]">利润率</th>
            <th className="py-2 px-2 text-center font-medium w-[70px]">推荐</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={row.product_id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
