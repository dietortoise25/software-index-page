import { useState, useMemo, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calculator, TrendingUp, TrendingDown, ReceiptText, Package, Plus, Trash2, AlertTriangle, ExternalLink, DollarSign, Landmark, Truck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

/* ── 常量 ── */

type Platform = "shopee" | "tiktok"

interface ShopeeTier {
  max: number
  rate: number
  fixed: number
}

const SHOPEE_TIERS: ShopeeTier[] = [
  { max: 79.99, rate: 0.20, fixed: 4 },
  { max: 99.99, rate: 0.14, fixed: 16 },
  { max: 199.99, rate: 0.14, fixed: 20 },
  { max: 499.99, rate: 0.14, fixed: 26 },
  { max: Infinity, rate: 0.14, fixed: 26 },
]

const SIMPLES_TABLE = [
  { max: 180_000, rate: 0.04 },
  { max: 360_000, rate: 0.073 },
  { max: 720_000, rate: 0.095 },
  { max: 1_800_000, rate: 0.107 },
  { max: 3_600_000, rate: 0.143 },
  { max: 4_800_000, rate: 0.19 },
]

const TIKTOK_COMMISSION = 0.06
const TIKTOK_FIXED_FEE = 4
const TIKTOK_SFP_RATE = 0.06
const TIKTOK_SFP_CAP = 50

/* ── 工具函数 ── */

function getShopeeFee(price: number) {
  for (const tier of SHOPEE_TIERS) {
    if (price <= tier.max) {
      const commission = price * tier.rate
      return { rate: tier.rate, fixed: tier.fixed, commission, total: commission + tier.fixed }
    }
  }
  const last = SHOPEE_TIERS[SHOPEE_TIERS.length - 1]
  const commission = price * last.rate
  return { rate: last.rate, fixed: last.fixed, commission, total: commission + last.fixed }
}

function getSimplesRate(rbt12: number) {
  for (const tier of SIMPLES_TABLE) {
    if (rbt12 <= tier.max) return tier.rate
  }
  return SIMPLES_TABLE[SIMPLES_TABLE.length - 1].rate
}

function getTikTokFee(price: number) {
  const commission = price * TIKTOK_COMMISSION
  const sfpRaw = price * TIKTOK_SFP_RATE
  const sfp = Math.min(sfpRaw, TIKTOK_SFP_CAP)
  return { commission, sfp, fixed: TIKTOK_FIXED_FEE, total: commission + TIKTOK_FIXED_FEE + sfp }
}

function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPercent(n: number): string {
  return (n * 100).toFixed(2) + "%"
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    if (prevRef.current === value) {
      setDisplay(value)
      return
    }
    prevRef.current = value
    const start = performance.now()
    const from = display
    const duration = 350

    let raf = 0
    function tick(now: number) {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (value - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span className={className}>{fmt(Math.abs(display))}</span>
}

/* ── 折叠明细组件 ── */

interface CalcResult {
  price: number; platformFee: number; taxRate: number; taxBase: number; taxAmount: number
  shipVal: number; otherTotal: number; totalCost: number; netProfit: number; profitMargin: number
  shopeeFee: { rate: number; fixed: number; commission: number; total: number } | null
  tiktokFee: { commission: number; sfp: number; fixed: number; total: number } | null
}

function CollapsibleDetail({
  platform, result, invoicePercent, otherCosts, fmt, fmtPercent,
}: {
  platform: Platform
  result: CalcResult
  invoicePercent: string
  otherCosts: OtherCost[]
  fmt: (n: number) => string
  fmtPercent: (n: number) => string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center justify-between text-sm font-semibold hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <ReceiptText className="h-4 w-4" />
          费用明细
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <Separator />
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">商品售价</span>
                <span className="font-medium">R$ {fmt(result.price)}</span>
              </div>
              <Separator />
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">平台费用</span>
                <span className="text-xs" />
              </div>
              {platform === "shopee" && result.shopeeFee && (
                <>
                  <div className="flex justify-between py-1 pl-4">
                    <span className="text-muted-foreground">佣金 ({fmtPercent(result.shopeeFee.rate)})</span>
                    <span className="text-red-600 dark:text-red-400">- R$ {fmt(result.shopeeFee.commission)}</span>
                  </div>
                  <div className="flex justify-between py-1 pl-4">
                    <span className="text-muted-foreground">固定费</span>
                    <span className="text-red-600 dark:text-red-400">- R$ {fmt(result.shopeeFee.fixed)}</span>
                  </div>
                </>
              )}
              {platform === "tiktok" && result.tiktokFee && (
                <>
                  <div className="flex justify-between py-1 pl-4">
                    <span className="text-muted-foreground">佣金 (6%)</span>
                    <span className="text-red-600 dark:text-red-400">- R$ {fmt(result.tiktokFee.commission)}</span>
                  </div>
                  <div className="flex justify-between py-1 pl-4">
                    <span className="text-muted-foreground">固定费 (R$4/件)</span>
                    <span className="text-red-600 dark:text-red-400">- R$ {fmt(result.tiktokFee.fixed)}</span>
                  </div>
                  <div className="flex justify-between py-1 pl-4">
                    <span className="text-muted-foreground">SFP 运费佣金 (6%)</span>
                    <span className="text-red-600 dark:text-red-400">- R$ {fmt(result.tiktokFee.sfp)}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">税费</span>
                <span className="text-xs" />
              </div>
              <div className="flex justify-between py-1 pl-4">
                <span className="text-muted-foreground">
                  Simples ({fmtPercent(result.taxRate)}) × 开票 {invoicePercent || "0"}%
                </span>
                <span className="text-red-600 dark:text-red-400">- R$ {fmt(result.taxAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">其他成本</span>
                <span className="text-xs" />
              </div>
              {result.shipVal > 0 && (
                <div className="flex justify-between py-1 pl-4">
                  <span className="text-muted-foreground">运费</span>
                  <span className="text-red-600 dark:text-red-400">- R$ {fmt(result.shipVal)}</span>
                </div>
              )}
              {otherCosts.map((c: OtherCost) => {
                const amt = parseFloat(c.amount) || 0
                if (amt <= 0) return null
                return (
                  <div key={c.id} className="flex justify-between py-1 pl-4">
                    <span className="text-muted-foreground">{c.name || "其他费用"}</span>
                    <span className="text-red-600 dark:text-red-400">- R$ {fmt(amt)}</span>
                  </div>
                )
              })}
              <Separator />
              <div className="flex justify-between py-2">
                <span className="font-semibold">总成本</span>
                <span className="font-semibold text-red-600 dark:text-red-400">- R$ {fmt(result.totalCost)}</span>
              </div>
              <div className="flex justify-between py-2 text-base">
                <span className="font-bold">净利润</span>
                <span className={`font-bold ${result.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {result.netProfit >= 0 ? "+ " : "- "}R$ {fmt(Math.abs(result.netProfit))}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

/* ── 组件 ── */

interface OtherCost {
  id: number
  name: string
  amount: string
}

export default function BrazilProfitCalculatorPage() {
  const [platform, setPlatform] = useState<Platform>("shopee")
  const [price, setPrice] = useState("")
  const [rbt12, setRbt12] = useState("")
  const [invoicePercent, setInvoicePercent] = useState("100")
  const [shipping, setShipping] = useState("")
  const [otherCosts, setOtherCosts] = useState<OtherCost[]>([])
  const [nextId, setNextId] = useState(1)
  const [changeId, setChangeId] = useState(0)

  const addOtherCost = () => {
    setOtherCosts([...otherCosts, { id: nextId, name: "", amount: "" }])
    setNextId(nextId + 1)
  }

  const removeOtherCost = (id: number) => {
    setOtherCosts(otherCosts.filter((c) => c.id !== id))
  }

  const updateOtherCost = (id: number, field: "name" | "amount", value: string) => {
    setOtherCosts(otherCosts.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  }

  /* ── 计算 ── */

  const result = useMemo(() => {
    const p = parseFloat(price)
    const rbt12Val = parseFloat(rbt12)
    const invPct = parseFloat(invoicePercent) || 0
    const shipVal = parseFloat(shipping) || 0
    const otherTotal = otherCosts.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0)

    if (isNaN(p) || p <= 0) {
      return null
    }

    // 平台费用
    const shopeeFee = platform === "shopee" ? getShopeeFee(p) : null
    const tiktokFee = platform === "tiktok" ? getTikTokFee(p) : null

    // 税费
    const taxRate = !isNaN(rbt12Val) && rbt12Val > 0 ? getSimplesRate(rbt12Val) : 0
    const taxBase = p * (invPct / 100)
    const taxAmount = taxBase * taxRate

    // 平台总费用
    const platformFee = platform === "shopee" ? shopeeFee!.total : tiktokFee!.total

    // 总成本
    const totalCost = platformFee + taxAmount + shipVal + otherTotal

    // 净利润
    const netProfit = p - totalCost

    // 利润率
    const profitMargin = (netProfit / p) * 100

    return {
      price: p,
      platformFee,
      taxRate,
      taxBase,
      taxAmount,
      shipVal,
      otherTotal,
      totalCost,
      netProfit,
      profitMargin,
      shopeeFee,
      tiktokFee,
    }
  }, [price, rbt12, invoicePercent, shipping, otherCosts, platform])

  const simplesRate = useMemo(() => {
    const r = parseFloat(rbt12)
    if (isNaN(r) || r <= 0) return null
    return getSimplesRate(r)
  }, [rbt12])

  useEffect(() => {
    if (result) setChangeId((id) => id + 1)
  }, [result?.netProfit, result?.platformFee, result?.taxAmount, result?.shipVal, result?.otherTotal])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* 标题 */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">巴西电商利润计算器</h1>
          <p className="text-sm text-muted-foreground">Shopee & TikTok Shop · Simples Nacional</p>
        </div>

        {/* 公司类型提醒 */}
        <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10 p-4 max-w-3xl mx-auto">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">仅适用于 Simples Nacional (CNPJ) 企业卖家</p>
              <p className="mt-1 text-amber-700/80 dark:text-amber-300/70">
                如您的公司类型为 CPF 个人、Lucro Presumido（核定利润）或 Lucro Real（实际利润），本工具计算结果不适用，请咨询会计师。
              </p>
            </div>
          </div>
        </Card>

        {/* 平台切换 */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg max-w-xs mx-auto">
          <button
            onClick={() => setPlatform("shopee")}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
              platform === "shopee"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Shopee
          </button>
          <button
            onClick={() => setPlatform("tiktok")}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
              platform === "tiktok"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            TikTok Shop
          </button>
        </div>

        {/* 主内容：左右两栏 */}
        <div className={`grid gap-6 ${result ? "lg:grid-cols-2" : "max-w-xl mx-auto"}`}>
          {/* 左栏：输入 */}
          <div className="space-y-6">
          <Card className="p-6 space-y-5">
          {/* 商品售价 */}
          <div className="flex items-center gap-3">
            <Label htmlFor="price" className="w-40 shrink-0 text-sm font-medium flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              商品售价 (BRL)
            </Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="例: 100.00"
              className="flex-1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <Separator />

          {/* 税务 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Landmark className="h-4 w-4" />
              发票与税务 · Simples Nacional
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label htmlFor="rbt12" className="w-40 shrink-0 text-sm">年营收 RBT12 (BRL)</Label>
                <div className="flex-1">
                  <Input
                    id="rbt12"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="例: 250000"
                    value={rbt12}
                    onChange={(e) => setRbt12(e.target.value)}
                  />
                  {simplesRate !== null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      适用税率: <span className="font-semibold text-foreground">{fmtPercent(simplesRate)}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Label htmlFor="invoice" className="w-40 shrink-0 text-sm">开票比例 (%)</Label>
                <div className="flex-1">
                  <Input
                    id="invoice"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="默认 100"
                    value={invoicePercent}
                    onChange={(e) => setInvoicePercent(e.target.value)}
                  />
                  {result && (
                    <p className="text-xs text-muted-foreground mt-1">
                      计税基数: <span className="font-semibold text-foreground">R$ {fmt(result.taxBase)}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 其他成本 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Truck className="h-4 w-4" />
              其他成本
            </h3>

            <div className="flex items-center gap-3">
              <Label htmlFor="shipping" className="w-40 shrink-0 text-sm">运费 (BRL)</Label>
              <Input
                id="shipping"
                type="number"
                step="0.01"
                min="0"
                placeholder="例: 15.00"
                className="flex-1"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
              />
            </div>

            {otherCosts.map((cost) => (
              <div key={cost.id} className="flex items-center gap-2">
                <Input
                  placeholder="费用名称"
                  className="flex-1"
                  value={cost.name}
                  onChange={(e) => updateOtherCost(cost.id, "name", e.target.value)}
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="金额"
                  className="w-28"
                  value={cost.amount}
                  onChange={(e) => updateOtherCost(cost.id, "amount", e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeOtherCost(cost.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full" onClick={addOtherCost}>
              <Plus className="h-4 w-4 mr-1.5" />
              添加其他费用
            </Button>
          </div>
        </Card>
          </div>

          {/* 右栏：结果 */}
          {result && (
            <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* 摘要卡片 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <motion.div
                key={`platform-${changeId}`}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <Card className="p-4 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">平台费用</p>
                  <p className={`text-lg font-bold ${result.platformFee > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    - R$ <AnimatedNumber value={result.platformFee} />
                  </p>
                </Card>
              </motion.div>
              <motion.div
                key={`tax-${changeId}`}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.05 }}
              >
                <Card className="p-4 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">税费 (Simples)</p>
                  <p className={`text-lg font-bold ${result.taxAmount > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    - R$ <AnimatedNumber value={result.taxAmount} />
                  </p>
                </Card>
              </motion.div>
              <motion.div
                key={`other-${changeId}`}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
              >
                <Card className="p-4 text-center space-y-1">
                  <p className="text-xs text-muted-foreground">其他成本</p>
                  <p className={`text-lg font-bold ${(result.shipVal + result.otherTotal) > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                    - R$ <AnimatedNumber value={result.shipVal + result.otherTotal} />
                  </p>
                </Card>
              </motion.div>
              <motion.div
                key={`profit-${changeId}`}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.15 }}
              >
                <Card className={`p-4 text-center space-y-1 border-2 ${result.netProfit >= 0 ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/10" : "border-red-500/30 bg-red-50/50 dark:bg-red-950/10"}`}>
                  <p className="text-xs text-muted-foreground">净利润</p>
                  <p className={`text-lg font-bold ${result.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {result.netProfit >= 0 ? "+ " : "- "}R$ <AnimatedNumber value={Math.abs(result.netProfit)} />
                  </p>
                </Card>
              </motion.div>
            </div>

            {/* 利润率条 */}
            <motion.div
              key={`bar-${changeId}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">利润率</span>
                  <span className={`font-bold ${result.profitMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {result.profitMargin >= 0 ? <TrendingUp className="inline h-4 w-4 mr-1" /> : <TrendingDown className="inline h-4 w-4 mr-1" />}
                    {fmtPercent(result.profitMargin / 100)}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      result.profitMargin >= 20 ? "bg-green-500"
                      : result.profitMargin >= 0 ? "bg-amber-500"
                      : "bg-red-500"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(100, (result.netProfit / result.price) * 100))}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  每卖出一件该商品，净利润约 R$ {fmt(result.netProfit)}
                </p>
              </Card>
            </motion.div>

            {/* 明细（可折叠） */}
            <CollapsibleDetail
              platform={platform}
              result={result}
              invoicePercent={invoicePercent}
              otherCosts={otherCosts}
              fmt={fmt}
              fmtPercent={fmtPercent}
            />


            {/* TikTok SFP 提醒 */}
            {platform === "tiktok" && (
              <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/10 p-4">
                <div className="flex items-start gap-3">
                  <Package className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium">关于 SFP 运费佣金</p>
                    <p className="mt-1 text-blue-700/80 dark:text-blue-300/70">
                      TikTok Shop SFP 运费补贴计划默认自动加入，收取 6% 运费佣金（封顶 R$ 50/件）。
                      卖家同时享有平台运费券补贴，本工具未将补贴计入收益，实际利润可能略高于计算结果（保守估算）。
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* 空状态 */}
        {!result && (
          <Card className="p-12 text-center space-y-3">
            <Calculator className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">输入商品售价后自动计算</p>
          </Card>
        )}

        </div>

        {/* 参考链接 */}
        <Card className="p-5 space-y-3 max-w-3xl mx-auto">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <ExternalLink className="h-4 w-4" />
            参考来源
          </h3>
          <div className="space-y-1.5 text-sm">
            <p>
              <span className="font-medium">Shopee 官方：</span>
              <a
                href="https://seller.br.shopee.cn/edu/article/26839/Comissao-para-vendedores-CNPJ-e-CPF-em-2026"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                Comissão CNPJ/CPF 2026
              </a>
            </p>
            <p>
              <span className="font-medium">TikTok Shop：</span>
              <a
                href="https://seller-br.tiktok.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                Seller Center BR
              </a>
            </p>
            <p>
              <span className="font-medium">Simples Nacional：</span>
              <a
                href="http://www8.receita.fazenda.gov.br/SimplesNacional/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                Portal do Simples Nacional - Anexo I (Comércio)
              </a>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            费率更新日期：2026-03-01（Shopee）/ 2026-02-05（TikTok）。如有变动请以平台官方公告为准。
          </p>
        </Card>
      </div>
    </div>
  )
}
