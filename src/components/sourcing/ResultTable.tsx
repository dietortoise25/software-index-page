import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
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

type SortKey = "product_name" | "shopee_price_num" | "price_cny" | "total_cost_brl" | "margin_brl" | "margin_rate"
type SortDir = "asc" | "desc"

function parsePrice(v: string | null | undefined): number {
  if (!v) return 0
  return parseFloat(v) || 0
}

function sortRows(rows: SourcingRow[], key: SortKey | null, dir: SortDir): SourcingRow[] {
  if (!key) return rows
  return [...rows].sort((a, b) => {
    let va: number, vb: number
    switch (key) {
      case "product_name":
        va = a.product_name.localeCompare(b.product_name, "zh")
        vb = 0
        return dir === "asc" ? va : -va
      case "shopee_price_num":
        va = a.shopee_price_num ?? 0; vb = b.shopee_price_num ?? 0; break
      case "price_cny":
        va = parsePrice(a.best_1688?.price_cny); vb = parsePrice(b.best_1688?.price_cny); break
      case "total_cost_brl":
        va = a.total_cost_brl ?? 0; vb = b.total_cost_brl ?? 0; break
      case "margin_brl":
        va = a.margin_brl ?? -Infinity; vb = b.margin_brl ?? -Infinity; break
      case "margin_rate":
        va = a.margin_rate ?? -Infinity; vb = b.margin_rate ?? -Infinity; break
      default: return 0
    }
    return dir === "asc" ? va - vb : vb - va
  })
}

const REC_FILTERS = ["全部", "推荐", "可考虑", "预警", "待补全"] as const

interface Props {
  rows: SourcingRow[]
}

function ThButton({ label, sortKey, active, dir, onClick }: {
  label: string; sortKey: SortKey; active: boolean; dir: SortDir; onClick: (k: SortKey) => void
}) {
  return (
    <button
      className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
      onClick={() => onClick(sortKey)}
    >
      {label}
      {active ? (dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
               : <ArrowUpDown size={12} className="opacity-40" />}
    </button>
  )
}

function Row({ row }: { row: SourcingRow }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-t hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* 产品名 — 有 colgroup 控制宽度, use truncate */}
        <td className="py-2 px-3 text-sm">
          <div className="flex items-center gap-2 max-w-[260px]">
            {expanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            {row.image_url && (
              <img
                src={row.image_url}
                alt=""
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded object-cover border shrink-0 bg-muted"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            )}
            <div className="min-w-0">
              <span className="truncate block text-xs leading-tight">{row.product_name}</span>
              <span className="text-[10px] text-muted-foreground">{row.data_source}</span>
            </div>
          </div>
        </td>
        <td className="py-2 px-2 text-sm text-right tabular-nums">{row.shopee_price_brl}</td>
        <td className="py-2 px-2 text-sm text-right font-medium tabular-nums">{fmtCny(row.best_1688?.price_cny)}</td>
        <td className="py-2 px-2 text-sm text-right tabular-nums">{fmtBrl(row.total_cost_brl)}</td>
        <td className="py-2 px-2 text-sm text-right tabular-nums">{fmtBrl(row.margin_brl)}</td>
        <td className="py-2 px-2 text-sm text-right tabular-nums">{fmtPct(row.margin_rate)}</td>
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
                    {c.image_url ? (
                      <img
                        src={c.image_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded border object-cover shrink-0 bg-muted"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded border bg-muted shrink-0" />
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
                          <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t}</span>
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [recFilter, setRecFilter] = useState<string>("全部")

  const handleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(k)
      setSortDir("asc")
    }
  }

  const filtered = useMemo(() => {
    let r = rows
    if (recFilter !== "全部") r = r.filter((x) => x.recommendation === recFilter)
    return sortRows(r, sortKey, sortDir)
  }, [rows, recFilter, sortKey, sortDir])

  if (rows.length === 0) return null

  return (
    <div className="space-y-2">
      {/* 筛选栏 */}
      <div className="flex gap-1 flex-wrap">
        {REC_FILTERS.map((f) => (
          <Badge
            key={f}
            variant={recFilter === f ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setRecFilter(f)}
          >
            {f === "全部" ? `全部 (${rows.length})` : `${f} (${rows.filter((x) => x.recommendation === f).length})`}
          </Badge>
        ))}
      </div>

      {/* 表格 */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[minmax(180px,1fr)]" />
            <col style={{ width: 90 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 70 }} />
          </colgroup>
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground">
              <th className="py-2 px-3 text-left font-medium">
                <ThButton label="产品" sortKey="product_name" active={sortKey === "product_name"} dir={sortDir} onClick={handleSort} />
              </th>
              <th className="py-2 px-2 text-right font-medium">
                <ThButton label="Shopee售价" sortKey="shopee_price_num" active={sortKey === "shopee_price_num"} dir={sortDir} onClick={handleSort} />
              </th>
              <th className="py-2 px-2 text-right font-medium">
                <ThButton label="1688价" sortKey="price_cny" active={sortKey === "price_cny"} dir={sortDir} onClick={handleSort} />
              </th>
              <th className="py-2 px-2 text-right font-medium">
                <ThButton label="落地成本" sortKey="total_cost_brl" active={sortKey === "total_cost_brl"} dir={sortDir} onClick={handleSort} />
              </th>
              <th className="py-2 px-2 text-right font-medium">
                <ThButton label="利润" sortKey="margin_brl" active={sortKey === "margin_brl"} dir={sortDir} onClick={handleSort} />
              </th>
              <th className="py-2 px-2 text-right font-medium">
                <ThButton label="利润率" sortKey="margin_rate" active={sortKey === "margin_rate"} dir={sortDir} onClick={handleSort} />
              </th>
              <th className="py-2 px-2 text-center font-medium">推荐</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <Row key={row.product_id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
