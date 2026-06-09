import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import * as XLSX from "xlsx"
import type { SourcingRow } from "@/lib/sourcing"

interface Props {
  rows: SourcingRow[]
  rawColumns?: string[]
  disabled?: boolean
}

export default function ExportButton({ rows, rawColumns = [], disabled }: Props) {
  const handleExport = () => {
    const wb = XLSX.utils.book_new()

    // Sheet1: 选品决策汇总（产品ID/名称/主图/价格已在 rawColumns 透传，不再重复）
    const analysisCols = [
      "1688最佳候选", "选中SKU(规格)", "选中SKU单价(¥)", "落地成本(R$)",
      "利润率", "推荐状态", "匹配来源", "图文置信度", "核对结果",
    ]
    const h1 = [...rawColumns, ...analysisCols]
    const data1 = rows.map((r) => {
      const bestConf = r.best_1688?.image_confidence
      const rawVals = rawColumns.map((col) => r[col] ?? "")
      const analysisVals = [
        r.best_1688?.title || "",
        r.best_1688?.matched_sku?.full_spec || r.best_1688?.matched_sku?.spec || "",
        r.best_1688?.matched_sku?.price || "",
        r.total_cost_brl != null ? Number(r.total_cost_brl.toFixed(2)) : "",
        r.margin_rate != null ? `${(r.margin_rate * 100).toFixed(1)}%` : "",
        r.recommendation,
        r.match_source,
        bestConf != null ? Number(bestConf.toFixed(2)) : "",
        bestConf != null ? (bestConf < 0.5 ? "疑似不符" : "通过") : "未核对",
      ]
      return [...rawVals, ...analysisVals]
    })
    const ws1 = XLSX.utils.aoa_to_sheet([h1, ...data1])
    XLSX.utils.book_append_sheet(wb, ws1, "选品汇总")

    // Sheet2: 1688候选明细（产品ID/名称已在 rawColumns 透传）
    const h2 = [
      ...rawColumns,
      "候选排名", "1688标题", "店铺", "图文置信度",
      "SKU规格", "SKU最低价(¥)", "1688链接",
    ]
    const data2: unknown[][] = []
    for (const r of rows) {
      const rawVals = rawColumns.map((col) => r[col] ?? "")
      for (let i = 0; i < r.candidates.length; i++) {
        const c = r.candidates[i]
        const skuStr = c.sku.items.map((it) =>
          `${it.full_spec || it.spec} ¥${it.price}`
        ).join("; ")
        const minPrice = c.sku.items.length > 0
          ? Math.min(...c.sku.items.map((it) => parseFloat(it.price) || 999))
          : ""
        data2.push([
          ...rawVals,
          i + 1, c.title, c.shop_name || "",
          c.image_confidence != null ? Number(c.image_confidence.toFixed(2)) : "",
          skuStr, minPrice !== "" ? Number(minPrice.toFixed(2)) : "",
          c.link,
        ])
      }
    }
    const ws2 = XLSX.utils.aoa_to_sheet([h2, ...data2])
    XLSX.utils.book_append_sheet(wb, ws2, "候选明细")

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "选品分析结果.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button onClick={handleExport} disabled={disabled} variant="outline" size="sm">
      <Download size={14} className="mr-1" />导出 Excel
    </Button>
  )
}
