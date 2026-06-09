import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SourcingRow } from "@/lib/sourcing"

interface Props {
  rows: SourcingRow[]
  disabled?: boolean
}

function escapeCsv(v: unknown): string {
  const s = v == null ? "" : String(v)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function download(filename: string, lines: string[]) {
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportButton({ rows, disabled }: Props) {
  const handleExport = () => {
    // CSV1: 选品决策汇总
    const h1 = [
      "产品名称", "Shopee售价(R$)", "类目", "月销量",
      "1688最佳候选", "选中SKU(规格)", "落地成本(R$)", "利润率", "推荐状态",
      "图文置信度", "核对结果",
    ]
    const l1: string[] = ["﻿" + h1.map(escapeCsv).join(",")]
    for (const r of rows) {
      const bestConf = r.best_1688?.image_confidence
      l1.push([
        r.product_name, r.shopee_price_brl, r.category_path || "",
        r.shopee_monthly_sales || "",
        r.best_1688?.title || "",
        r.best_1688?.matched_sku?.full_spec || r.best_1688?.matched_sku?.spec || "",
        r.total_cost_brl != null ? r.total_cost_brl.toFixed(2) : "",
        r.margin_rate != null ? `${(r.margin_rate * 100).toFixed(1)}%` : "",
        r.recommendation,
        bestConf != null ? bestConf.toFixed(2) : "",
        bestConf != null ? (bestConf < 0.5 ? "疑似不符" : "通过") : "未核对",
      ].map(escapeCsv).join(","))
    }
    download("选品决策汇总.csv", l1)

    // CSV2: 1688候选明细
    const h2 = ["产品名称", "候选排名", "1688标题", "SKU紧凑格式", "链接"]
    const l2: string[] = ["﻿" + h2.map(escapeCsv).join(",")]
    for (const r of rows) {
      for (let i = 0; i < r.candidates.length; i++) {
        const c = r.candidates[i]
        const conf = c.image_confidence
        const skuStr = c.sku.items.map((it) =>
          `SKU:${it.full_spec || it.spec}|价:¥${it.price}${conf != null ? `|图分:${conf.toFixed(2)}` : ""}`
        ).join("; ")
        l2.push([
          r.product_name, String(i + 1), c.title, skuStr, c.link,
        ].map(escapeCsv).join(","))
      }
    }
    download("1688候选明细.csv", l2)
  }

  return (
    <Button onClick={handleExport} disabled={disabled} variant="outline" size="sm">
      <Download size={14} className="mr-1" />导出 CSV
    </Button>
  )
}
