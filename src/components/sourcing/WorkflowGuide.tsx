import { useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight, FileSpreadsheet, Search, Calculator, Key, Rocket } from "lucide-react"

interface Step {
  icon: typeof FileSpreadsheet
  title: string
  desc: ReactNode
}

const STEPS: Step[] = [
  {
    icon: FileSpreadsheet,
    title: "上传 Shopee Excel",
    desc: "从 Shopee 巴西站导出商品数据（产品ID/名称/主图/价格），支持多个店铺文件一起上传。",
  },
  {
    icon: Calculator,
    title: "调整成本参数",
    desc: "设置汇率（1 BRL = ? CNY）和成本倍率（打包运费+清关+杂费），可保存到服务器。",
  },
  {
    icon: Key,
    title: "配置 1688 登录态（可选，用于获取 SKU 明细价）",
    desc: (
      <>
        打开{" "}
        <a href="https://detail.1688.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          1688 商品详情页
        </a>
        ，F12 → Console 粘贴一行命令即可注入登录态。不配置也能用，候选价格用搜索返回的标价。
      </>
    ),
  },
  {
    icon: Search,
    title: "开始分析",
    desc: "系统并发搜索 1688 同款货源，实时显示进度，自动计算采购成本和利润率，给出推荐/预警分级。",
  },
  {
    icon: Rocket,
    title: "查看结果 & 导出",
    desc: "结果表支持排序、筛选，点击行展开查看候选供应商。可一键导出 CSV 汇总报告。",
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
