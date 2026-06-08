import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { SourcingRow } from "@/lib/sourcing"

function fmtCny(v: string | null | undefined) {
  if (!v) return "-"
  return `¥${v}`
}

function skuRange(c: { sku: { count: number; min_price: string | null; max_price: string | null } } | null | undefined): string {
  if (!c || c.sku.count === 0 || !c.sku.min_price) return "待补全"
  const { min_price, max_price } = c.sku
  if (max_price && max_price !== min_price) return `¥${min_price}-¥${max_price}`
  return `¥${min_price}`
}

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

function MatchSummary({ row }: { row: SourcingRow }) {
  const best = row.best_1688
  const picked = best?.matched_sku
  if (!best || row.match_source === "none") return null

  const isLlm = row.match_source === "llm"
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <Badge variant={isLlm ? "default" : "outline"} className="text-[10px]">
          {isLlm ? "AI 智选 SKU" : "自动兜底（最低价）"}
        </Badge>
        {picked && (
          <span className="text-xs">
            <span className="text-muted-foreground">选中规格：</span>
            <span className="font-medium">{picked.full_spec || picked.spec || "-"}</span>
            <span className="ml-2 font-bold text-primary">¥{picked.price}</span>
          </span>
        )}
      </div>
      {isLlm && row.match_reason && (
        <p className="text-xs text-muted-foreground leading-snug">{row.match_reason}</p>
      )}
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
        <td className="py-2 px-2 text-sm text-right font-medium tabular-nums">{skuRange(row.best_1688)}</td>
        <td className="py-2 px-2 text-center">
          <Badge variant="outline" className="text-[11px] bg-gray-100 text-gray-500 border-gray-200">
            待推荐系统
          </Badge>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="bg-muted/20 px-4 py-3">
            {row.candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">未找到同款货源</p>
            ) : (
              <div className="space-y-2">
                <MatchSummary row={row} />
                {row.candidates.map((c, i) => (
                  <div key={i} className="rounded-md border bg-background p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
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
                        {c.item_id === row.best_1688?.item_id && (
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
                      <div className="text-base font-bold text-primary">{skuRange(c)}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">标价 {fmtCny(c.price_cny)}</div>
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
                    {c.sku.count > 0 ? (
                      <table className="w-full mt-2 text-xs border-t">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="text-left font-medium py-1">规格</th>
                            <th className="text-right font-medium py-1">单价</th>
                            <th className="text-right font-medium py-1">可订量</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.sku.items.map((it, j) => {
                            const isPicked =
                              c.item_id === row.best_1688?.item_id &&
                              it.sku_id === row.best_1688?.matched_sku?.sku_id
                            return (
                              <tr key={j} className={`border-t border-dashed ${isPicked ? "bg-primary/10" : ""}`}>
                                <td className="py-1 truncate max-w-[200px]">
                                  {isPicked && <span className="text-primary mr-1">✓</span>}
                                  {it.full_spec || it.spec}
                                </td>
                                <td className="py-1 text-right tabular-nums">¥{it.price}</td>
                                <td className="py-1 text-right tabular-nums text-muted-foreground">{it.can_book_count || "-"}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t">
                        {c.sku.error
                          ? `暂无 SKU 价格表（${c.sku.error}）`
                          : "暂无 SKU 价格表（未配置 SKU Provider 或该商品无数据）"}
                      </p>
                    )}
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
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[minmax(180px,1fr)]" />
            <col style={{ width: 110 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 100 }} />
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
                <ThButton label="SKU价(范围)" sortKey="sku_price" active={sortKey === "sku_price"} dir={sortDir} onClick={handleSort} />
              </th>
              <th className="py-2 px-2 text-center font-medium">状态</th>
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
