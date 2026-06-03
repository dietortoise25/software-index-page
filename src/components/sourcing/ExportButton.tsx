import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SourcingRow } from "@/lib/sourcing"

interface Props {
  rows: SourcingRow[]
  disabled?: boolean
}

function escapeCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

export default function ExportButton({ rows, disabled }: Props) {
  const handleExport = () => {
    // 汇总决策表 CSV (Excel 直接打开)
    const headers = [
      "产品ID", "产品名称", "数据来源", "类目",
      "Shopee售价", "1688最低价(¥)", "1688供应商",
      "落地成本(R$)", "利润(R$)", "利润率", "推荐", "Shopee图片", "1688链接",
    ]
    const lines: string[] = []
    lines.push("﻿" + headers.map(escapeCsv).join(","))

    for (const r of rows) {
      lines.push([
        r.product_id, r.product_name, r.data_source, r.category_path,
        r.shopee_price_brl, r.min_price_cny || "", r.best_1688_shop,
        r.total_cost_brl != null ? r.total_cost_brl.toFixed(2) : "",
        r.margin_brl != null ? r.margin_brl.toFixed(2) : "",
        r.margin_rate != null ? `${(r.margin_rate * 100).toFixed(1)}%` : "",
        r.recommendation, r.image_url || "", r.best_1688_url,
      ].map(escapeCsv).join(","))
    }

    // 候选明细
    lines.push("")
    lines.push("--- 1688候选明细 ---")
    lines.push("﻿" + [
      "产品ID", "产品名称", "候选排名", "1688标题", "价格(¥)", "销量", "店铺", "起批量", "标签", "链接", "图片",
    ].map(escapeCsv).join(","))

    for (const r of rows) {
      for (let i = 0; i < r.candidates.length; i++) {
        const c = r.candidates[i]
        lines.push([
          r.product_id, r.product_name, String(i + 1), c.title, c.price_cny,
          c.sales, c.shop_name, c.min_order, (c.offer_tags || []).join(" / "), c.link, c.image_url || "",
        ].map(escapeCsv).join(","))
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "选品比价分析报告.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button onClick={handleExport} disabled={disabled} variant="outline" size="sm">
      <Download size={14} className="mr-1" />导出 CSV
    </Button>
  )
}
