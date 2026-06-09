import { useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight, FileSpreadsheet, Search, Calculator, Eye, Rocket } from "lucide-react"

interface Step {
  icon: typeof FileSpreadsheet
  title: string
  desc: ReactNode
}

const STEPS: Step[] = [
  {
    icon: FileSpreadsheet,
    title: "上传 Shopee Excel + 设置行数",
    desc: "导出 Shopee 巴西站商品数据，支持多文件。可设置「仅分析前 N 行」快速调试，留空则全量分析。",
  },
  {
    icon: Calculator,
    title: "调整成本参数",
    desc: "设置汇率（BRL→CNY）和成本倍率（打包+运费+清关），可保存到服务器。",
  },
  {
    icon: Search,
    title: "开始分析",
    desc: "系统依次执行：搜图找货源 → 拉取 SKU 价格表 → GPT 图文核对(标记疑似不符) → AI 智选最佳 SKU → 计算落地成本和利润率。",
  },
  {
    icon: Eye,
    title: "查看 9 列结果表",
    desc: "主表展示：产品名/Shopee售价/类目/月销量/最佳候选/选中SKU/落地成本/利润率/推荐状态。展开行可看全部候选的紧凑 SKU 明细和图文核对分数。",
  },
  {
    icon: Rocket,
    title: "导出 2 个 CSV",
    desc: "点击「导出 CSV」同时下载：选品决策汇总（9列+图文置信度）和 1688候选明细（紧凑 SKU 格式）。",
  },
]

export default function WorkflowGuide() {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-lg border bg-muted/20">
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        使用引导
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {STEPS.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <s.icon size={16} className="text-primary" />
                </div>
                {i < STEPS.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
              </div>
              <div className="pb-2">
                <p className="text-sm font-medium">
                  {i + 1}. {s.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
