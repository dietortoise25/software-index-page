import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import AuthGuard from "@/components/auth/AuthGuard"
import { useAuth } from "@/lib/auth-context"
import { FilterBar } from "@/components/dashboard/FilterBar"
import { RevenueOverview } from "@/components/dashboard/RevenueOverview"
import { ChannelCharts } from "@/components/dashboard/ChannelCharts"
import { OperatorRanking } from "@/components/dashboard/OperatorRanking"
import { OrderHealth } from "@/components/dashboard/OrderHealth"
import { AdCostSection } from "@/components/dashboard/AdCostSection"
import { useDashboardFilter } from "@/hooks/useDashboardFilter"

export default function DashboardPage() {
  return (
    <AuthGuard requireAdmin>
    <TooltipProvider>
      <DashboardContent />
    </TooltipProvider>
    </AuthGuard>
  )
}

function DashboardContent() {
  const { dimension, setDimension, platform, setPlatform, operatorId, setOperatorId } = useDashboardFilter()
  const { logout } = useAuth()

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">订单看板</h1>
          <p className="mt-1 text-muted-foreground text-sm">中国时区 · BRL</p>
        </div>
        <FilterBar {...{ dimension, setDimension, platform, setPlatform, operatorId, setOperatorId }} />
      </div>

      {/* 第1层：营收总览 */}
      <RevenueOverview {...{ dimension, platform, operatorId }} />

      <Separator className="my-8" />

      {/* 第2层：渠道分析 */}
      <h2 className="mb-3 font-semibold text-base">渠道分析</h2>
      <ChannelCharts {...{ dimension, platform, operatorId }} />

      <Separator className="my-8" />

      {/* 第3层：运营者排行 */}
      <h2 className="mb-3 font-semibold text-base">运营者排行</h2>
      <OperatorRanking {...{ dimension, platform, operatorId }} />

      <Separator className="my-8" />

      {/* 第4层：订单健康度 */}
      <h2 className="mb-3 font-semibold text-base">订单健康度</h2>
      <OrderHealth {...{ dimension, platform, operatorId }} />

      <Separator className="my-8" />

      {/* 第5层：广告费用分析 */}
      <h2 className="mb-3 font-semibold text-base">广告费用分析</h2>
      <AdCostSection {...{ dimension, platform, operatorId }} />

      <Separator className="my-8" />

      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2"><Lock className="size-3 text-muted-foreground" /><span className="text-muted-foreground text-xs">{dimension === "all" ? "全部平台" : dimension === "platform" ? `平台: ${platform}` : "全部运营者"}</span></div>
          <a href="/internal/admin" className="text-muted-foreground text-xs hover:text-foreground transition-colors">管理分组与绑定 →</a>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { logout() }}><Lock className="mr-1 size-3" />锁定</Button>
      </div>
    </div>
  )
}
