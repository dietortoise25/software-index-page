import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { SourcingRow } from "@/lib/sourcing"

type SortKey = "product_name" | "shopee_price_num" | "sku_price"
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
      case "sku_price":
        va = parsePrice(a.best_1688?.sku?.min_price); vb = parsePrice(b.best_1688?.sku?.min_price); break
      default: return 0
    }
    return dir === "asc" ? va - vb : vb - va
  })
}

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

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-400"
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-16 text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-6 text-right tabular-nums">{score}</span>
    </div>
  )
}

function MatchSummary({ row }: { row: SourcingRow }) {
  const best = row.best_1688
  const picked = best?.matched_sku
  if (!best || row.match_source === "none") return null

  const isLlm = row.match_source === "llm"
  const scores = row.match_scores
  const overall = row.match_overall_score

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
      <div className="flex gap-4">
        {/* 左侧：badge + 主图 + 链接 */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <Badge variant={isLlm ? "default" : "outline"} className="text-[10px] whitespace-nowrap">
            {isLlm ? "AI 智选" : "兜底最低价"}
          </Badge>
          {best.image_url ? (
            <img src={best.image_url} alt="" referrerPolicy="no-referrer"
              className="w-16 h-16 rounded border object-cover bg-muted"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
          ) : (
            <div className="w-16 h-16 rounded border bg-muted" />
          )}
          <a href={best.link} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-blue-600 hover:underline inline-flex items-center gap-0.5">
            1688链接 <ExternalLink size={9} />
          </a>
        </div>

        {/* 右侧：评分卡 + 综合分 + 理由 */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* 选中规格信息 */}
          {picked && (
            <div className="text-xs">
              <span className="text-muted-foreground">规格：</span>
              <span className="font-medium">{picked.full_spec || picked.spec || "-"}</span>
              <span className="ml-2 font-bold text-primary">¥{picked.price}</span>
            </div>
          )}

          {/* 4维评分条形图 */}
          {scores && (
            <div className="space-y-1">
              <ScoreBar label="价格" score={scores.price} />
              <ScoreBar label="图文匹配" score={scores.image_match} />
              <ScoreBar label="店铺信誉" score={scores.shop_credit} />
              <ScoreBar label="销量" score={scores.sales} />
            </div>
          )}

          {/* 综合评分 */}
          {overall != null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">综合评分</span>
              <span className="text-lg font-bold text-primary tabular-nums">{overall}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          )}

          {/* 推荐理由 */}
          {isLlm && row.match_reason && (
            <p className="text-xs text-muted-foreground leading-snug">{row.match_reason}</p>
          )}
        </div>
      </div>
    </div>
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
            <span className="truncate text-xs leading-tight">{row.product_name}</span>
          </div>
        </td>
        <td className="py-2 px-2 text-sm text-right tabular-nums">{row.shopee_price_brl}</td>
        <td className="py-2 px-2 text-xs truncate max-w-[110px]">{row.category_path || "-"}</td>
        <td className="py-2 px-2 text-xs text-right tabular-nums">{row.shopee_monthly_sales || "-"}</td>
        <td className="py-2 px-2 text-xs truncate max-w-[160px]">{row.best_1688?.title || "-"}</td>
        <td className="py-2 px-2 text-xs truncate max-w-[120px]">{row.best_1688?.matched_sku?.full_spec || row.best_1688?.matched_sku?.spec || "-"}</td>
        <td className="py-2 px-2 text-sm text-right tabular-nums font-medium">
          {row.total_cost_brl != null ? `R$${row.total_cost_brl.toFixed(2)}` : "-"}
        </td>
        <td className="py-2 px-2 text-sm text-right tabular-nums">
          {row.margin_rate != null ? `${(row.margin_rate * 100).toFixed(1)}%` : "-"}
        </td>
        <td className="py-2 px-2 text-center">
          <Badge variant="outline" className={
            row.recommendation === "推荐" ? "bg-green-100 text-green-700 border-green-200" :
            row.recommendation === "可考虑" ? "bg-blue-100 text-blue-700 border-blue-200" :
            row.recommendation === "预警" ? "bg-red-100 text-red-700 border-red-200" :
            "bg-gray-100 text-gray-500 border-gray-200"
          }>
            {row.recommendation}
          </Badge>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-muted/20 px-4 py-3">
            {row.candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">未找到同款货源</p>
            ) : (
              <div className="space-y-2">
                <MatchSummary row={row} />
                {row.candidates.map((c, i) => {
                  const conf = c.image_confidence
                  const suspect = conf != null && conf < 0.5
                  return (
                    <div key={i} className={`rounded-md border p-3 text-sm ${suspect ? "border-red-300 bg-red-50" : "bg-background"}`}>
                      <div className="flex items-center gap-3">
                        {c.image_url ? (
                          <img src={c.image_url} alt="" referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded border object-cover shrink-0 bg-muted"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                        ) : (
                          <div className="w-12 h-12 rounded border bg-muted shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium truncate text-xs">{c.title}</span>
                            {c.item_id === row.best_1688?.item_id && (
                              <Badge variant="outline" className="text-[10px] shrink-0">最佳</Badge>
                            )}
                            {suspect && (
                              <Badge variant="destructive" className="text-[10px] shrink-0">疑似不符</Badge>
                            )}
                            {conf != null && (
                              <span className="text-[10px] text-muted-foreground">图分:{conf.toFixed(2)}</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {c.shop_name} · 销量 {c.sales || "-"}
                            <a href={c.link} target="_blank" rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="ml-2 text-blue-600 hover:underline inline-flex items-center gap-0.5">
                              详情 <ExternalLink size={10} />
                            </a>
                          </div>
                          {c.sku.count > 0 && (
                            <div className="mt-1 text-[11px] text-muted-foreground font-mono space-x-2 flex flex-wrap gap-y-0.5">
                              {c.sku.items.map((it, j) => (
                                <span key={j} className={
                                  c.item_id === row.best_1688?.item_id && it.sku_id === row.best_1688?.matched_sku?.sku_id
                                    ? "text-primary font-semibold" : ""
                                }>
                                  SKU:{it.full_spec || it.spec}|价:¥{it.price}{conf != null ? `|图分:${conf.toFixed(2)}` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
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

  const handleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(k)
      setSortDir("asc")
    }
  }

  const filtered = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])

  if (rows.length === 0) return null

  return (
    <div className="space-y-2">
      {/* 表格 */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <colgroup>
            <col style={{ minWidth: 200 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 80 }} />
            <col style={{ minWidth: 160 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground">
              <th className="py-2 px-3 text-left font-medium">
                <ThButton label="产品名称" sortKey="product_name" active={sortKey === "product_name"} dir={sortDir} onClick={handleSort} />
              </th>
              <th className="py-2 px-2 text-right font-medium">
                <ThButton label="Shopee售价(R$)" sortKey="shopee_price_num" active={sortKey === "shopee_price_num"} dir={sortDir} onClick={handleSort} />
              </th>
              <th className="py-2 px-2 text-left font-medium">类目</th>
              <th className="py-2 px-2 text-right font-medium">月销量</th>
              <th className="py-2 px-2 text-left font-medium">1688最佳候选</th>
              <th className="py-2 px-2 text-left font-medium">选中SKU(规格)</th>
              <th className="py-2 px-2 text-right font-medium">
                <ThButton label="落地成本(R$)" sortKey="sku_price" active={sortKey === "sku_price"} dir={sortDir} onClick={handleSort} />
              </th>
              <th className="py-2 px-2 text-right font-medium">利润率</th>
              <th className="py-2 px-2 text-center font-medium">推荐状态</th>
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
