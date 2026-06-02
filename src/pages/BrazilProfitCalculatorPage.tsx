import { useState, useMemo, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts"
import { Calculator, TrendingUp, TrendingDown, ReceiptText, Package, Plus, Trash2, AlertTriangle, DollarSign, Landmark, Truck, Info, ChevronRight, Store, CircleDollarSign } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

/* ── 常量 ── */

type Platform = "shopee" | "tiktok"
type TaxMode = "simples" | "mei" | "zero"

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

const MEI_MONTHLY_FEE = 75

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
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPercent(n: number): string {
  return (n * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
}

/* ── 子组件 ── */

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help inline-block" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

const PIE_COLOR_KEYS = ["--destructive", "--chart-1", "--chart-2", "--chart-5"]

function useThemeColors() {
  const [colors, setColors] = useState<string[]>([])
  const refresh = () => {
    const root = document.documentElement
    const style = getComputedStyle(root)
    setColors(PIE_COLOR_KEYS.map((k) => style.getPropertyValue(k).trim()))
  }
  useEffect(() => {
    refresh()
    const obs = new MutationObserver(refresh)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])
  return colors
}

const PIE_FALLBACK = ["#ef4444", "#22c55e", "#3b82f6", "#9ca3af", "#8b5cf6"]

function CostPieChart({
  platformFee, taxAmount, procVal, shipVal, otherTotal,
}: {
  platformFee: number; taxAmount: number; procVal: number; shipVal: number; otherTotal: number
}) {
  const themeColors = useThemeColors()
  const fillColors = themeColors.length > 0 ? themeColors : PIE_FALLBACK

  const raw = [
    { name: "平台费", value: platformFee },
    { name: "税费", value: taxAmount },
    { name: "采购成本", value: procVal },
    { name: "运费", value: shipVal },
    { name: "其他", value: otherTotal },
  ].filter((d) => d.value > 0)
  const totalCostOnly = platformFee + taxAmount + procVal + shipVal + otherTotal
  const total = totalCostOnly > 0 ? totalCostOnly : 1
  const data = raw.map((d) => ({ ...d, pct: ((d.value / total) * 100).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }))

  function renderLabel(props: any) {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props
    const r = innerRadius + (outerRadius - innerRadius) * 0.6
    const x = cx + r * Math.cos(-midAngle * (Math.PI / 180))
    const y = cy + r * Math.sin(-midAngle * (Math.PI / 180))
    if (percent < 0.05) return null
    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="text-[11px] font-semibold fill-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,.3)" }}>
        <tspan x={x} dy={-5}>{name}</tspan>
        <tspan x={x} dy={14}>{(percent * 100).toFixed(0)}%</tspan>
      </text>
    )
  }

  return (
    <Card className="p-4 flex items-center gap-6">
      <div className="w-60 h-60 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={114}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
              label={renderLabel}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={fillColors[i % fillColors.length]} className="outline-none" />
              ))}
            </Pie>
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                const fmtVal = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                return (
                  <div className="bg-background border rounded-md px-2.5 py-1.5 text-xs shadow-md">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-muted-foreground ml-1">R$ {fmtVal(d.value)}</span>
                    <span className="text-muted-foreground ml-1">({d.pct}%)</span>
                  </div>
                )
              }}
            />
            <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-xs font-medium">
              成本占比
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
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

/* ── 二级折叠明细 ── */

interface DetailCategory {
  label: string
  total: number
  items: { label: string; value: number; muted?: boolean }[]
  defaultOpen?: boolean
}

function TwoLevelDetail({
  categories, summary, price,
}: {
  categories: DetailCategory[]
  summary: { label: string; value: number; highlight?: boolean }[]
  price: number
}) {
  const pct = (v: number) => (price > 0 ? ((v / price) * 100).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "0.0")
  const [open, setOpen] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const init: Record<string, boolean> = {}
    categories.forEach((c) => {
      if (c.defaultOpen) init[c.label] = true
    })
    setExpandedCats(init)
  }, [])

  const toggleCat = (label: string) => {
    setExpandedCats((prev) => ({ ...prev, [label]: !prev[label] }))
  }

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
            <div className="p-4 space-y-1 text-sm">
              {/* 一级：分类汇总 */}
              {categories.map((cat) => (
                <div key={cat.label}>
                  <button
                    onClick={() => toggleCat(cat.label)}
                    className="w-full flex items-center justify-between py-2 hover:bg-muted/40 rounded px-2 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <motion.span
                        animate={{ rotate: expandedCats[cat.label] ? 90 : 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </motion.span>
                      {cat.label}
                      <span className="text-xs text-muted-foreground/60">({pct(cat.total)}%)</span>
                    </span>
                    <span className="font-medium tabular-nums text-right text-red-600 dark:text-red-400">
                      R$ {fmt(cat.total)}
                    </span>
                  </button>
                  {/* 二级：展开明细 */}
                  <AnimatePresence>
                    {expandedCats[cat.label] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-8 pr-2 space-y-0.5 pb-1">
                          {cat.items.map((item) => (
                            <div key={item.label} className="flex justify-between py-1">
                              <span className={item.muted ? "text-muted-foreground/70" : "text-muted-foreground"}>
                                {item.label}
                              </span>
                              <span className="tabular-nums text-right text-red-600/80 dark:text-red-400/80">
                                R$ {fmt(item.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              <Separator className="my-1" />

              {/* 总计 */}
              {summary.map((s) => (
                <div
                  key={s.label}
                  className={`flex justify-between py-2 px-2 rounded ${s.highlight ? "bg-green-50 dark:bg-green-950/20" : ""}`}
                >
                  <span className={s.highlight ? "font-bold" : "font-semibold"}>
                    {s.label}
                    <span className="text-xs text-muted-foreground/60 ml-1">({pct(Math.abs(s.value))}%)</span>
                  </span>
                  <span className={`font-bold tabular-nums ${s.highlight ? "text-green-600 dark:text-green-400" : s.value > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    {s.highlight ? "+ " : "- "}R$ {fmt(Math.abs(s.value))}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

/* ── 类型 ── */

interface OtherCost {
  id: number
  name: string
  amount: string
}

/* ── 主组件 ── */

export default function BrazilProfitCalculatorPage() {
  const [platform, setPlatform] = useState<Platform>("shopee")
  const [price, setPrice] = useState("")
  const [taxMode, setTaxMode] = useState<TaxMode>("simples")
  const [rbt12, setRbt12] = useState("")
  const [customTaxRate, setCustomTaxRate] = useState("")
  const [useCustomTax, setUseCustomTax] = useState(false)
  const [showWarning, setShowWarning] = useState(true)
  const [invoicePercent, setInvoicePercent] = useState("100")
  const [shipping, setShipping] = useState("")
  const [procurement, setProcurement] = useState("")
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

  const effectiveTaxRate = useMemo(() => {
    if (taxMode === "zero") return 0
    if (taxMode === "mei") return 0 // MEI fixed fee, not rate-based
    if (useCustomTax) {
      const r = parseFloat(customTaxRate)
      return !isNaN(r) && r >= 0 ? r / 100 : null
    }
    const r = parseFloat(rbt12)
    if (isNaN(r) || r <= 0) return SIMPLES_TABLE[0].rate // 默认最低档
    return getSimplesRate(r)
  }, [taxMode, useCustomTax, customTaxRate, rbt12])

  const result = useMemo(() => {
    const p = parseFloat(price)
    const invPct = parseFloat(invoicePercent) || 0
    const procVal = parseFloat(procurement) || 0
    const shipVal = parseFloat(shipping) || 0
    const otherTotal = otherCosts.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0)

    if (isNaN(p) || p <= 0) return null

    const shopeeFee = platform === "shopee" ? getShopeeFee(p) : null
    const tiktokFee = platform === "tiktok" ? getTikTokFee(p) : null
    const platformFee = platform === "shopee" ? shopeeFee!.total : tiktokFee!.total

    const taxRate = effectiveTaxRate ?? 0
    const taxBase = p * (invPct / 100)
    const taxAmount = taxMode === "mei" ? 0 : taxBase * taxRate // MEI handled separately

    const totalCost = platformFee + taxAmount + procVal + shipVal + otherTotal
    const netProfit = p - totalCost
    const profitMargin = (netProfit / p) * 100

    return {
      price: p,
      platformFee,
      taxRate,
      taxBase,
      taxAmount,
      procVal,
      shipVal,
      otherTotal,
      totalCost,
      netProfit,
      profitMargin,
      shopeeFee,
      tiktokFee,
    }
  }, [price, rbt12, invoicePercent, procurement, shipping, otherCosts, platform, taxMode, effectiveTaxRate])

  useEffect(() => {
    if (result) setChangeId((id) => id + 1)
  }, [result?.netProfit, result?.platformFee, result?.taxAmount, result?.procVal, result?.shipVal, result?.otherTotal])

  /* ── 明细数据 ── */

  const detailCategories = useMemo((): DetailCategory[] => {
    if (!result) return []
    const cats: DetailCategory[] = []

    // 平台费用
    const platformItems: { label: string; value: number }[] = []
    if (platform === "shopee" && result.shopeeFee) {
      platformItems.push({ label: `佣金 (${fmtPercent(result.shopeeFee.rate)})`, value: result.shopeeFee.commission })
      platformItems.push({ label: "固定费", value: result.shopeeFee.fixed })
    } else if (platform === "tiktok" && result.tiktokFee) {
      platformItems.push({ label: "佣金 (6%)", value: result.tiktokFee.commission })
      platformItems.push({ label: "固定费 (R$4/件)", value: result.tiktokFee.fixed })
      platformItems.push({ label: "SFP 运费佣金 (6%)", value: result.tiktokFee.sfp })
    }
    cats.push({ label: "平台费用", total: result.platformFee, items: platformItems, defaultOpen: true })

    // 税费
    const taxItems: { label: string; value: number }[] = []
    if (taxMode === "simples") {
      const rateSource = useCustomTax ? `自定义 ${customTaxRate || "0"}%` : `Simples ${fmtPercent(result.taxRate)}`
      taxItems.push({ label: `${rateSource} × 开票 ${invoicePercent || "0"}%`, value: result.taxAmount })
    } else if (taxMode === "mei") {
      taxItems.push({ label: `MEI 固定月费 ≈ R$ ${fmt(MEI_MONTHLY_FEE)}（反推不计入单件）`, value: 0 })
    } else {
      taxItems.push({ label: "零税模式（仅推演）", value: 0 })
    }
    cats.push({ label: "税费", total: result.taxAmount, items: taxItems, defaultOpen: true })

    // 其他成本
    const otherItems: { label: string; value: number }[] = []
    if (result.procVal > 0) otherItems.push({ label: "采购成本", value: result.procVal })
    if (result.shipVal > 0) otherItems.push({ label: "运费", value: result.shipVal })
    otherCosts.forEach((c) => {
      const amt = parseFloat(c.amount) || 0
      if (amt > 0) otherItems.push({ label: c.name || "其他费用", value: amt })
    })
    if (otherItems.length > 0) {
      cats.push({ label: "其他成本", total: result.procVal + result.shipVal + result.otherTotal, items: otherItems, defaultOpen: otherItems.length <= 2 })
    }

    return cats
  }, [result, platform, taxMode, useCustomTax, customTaxRate, invoicePercent, otherCosts])

  const detailSummary = useMemo(() => {
    if (!result) return []
    return [
      { label: "总成本", value: result.totalCost },
      { label: "净利润", value: result.netProfit, highlight: true },
    ]
  }, [result])

  /* ── 税率显示 ── */

  const taxRateDisplay = useMemo(() => {
    if (taxMode === "zero") return "0%"
    if (taxMode === "mei") return `R$ ${MEI_MONTHLY_FEE}/月`
    if (useCustomTax && customTaxRate) return `${customTaxRate}%（自定义）`
    if (effectiveTaxRate !== null) return `${fmtPercent(effectiveTaxRate)}`
    return "4.00%（默认）"
  }, [taxMode, useCustomTax, customTaxRate, effectiveTaxRate])

  return (
    <TooltipProvider delay={300}>
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background to-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
          {/* 标题 */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">巴西电商利润计算器</h1>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
              Shopee & TikTok Shop · Simples Nacional
              <Popover>
                <PopoverTrigger>
                  <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground/50 hover:text-muted-foreground cursor-pointer transition-colors">
                    <Info className="h-3.5 w-3.5" />
                    参考来源
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-80 text-left">
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="font-medium">Shopee 官方：</span>
                      <a href="https://seller.br.shopee.cn/edu/article/26839/Comissao-para-vendedores-CNPJ-e-CPF-em-2026" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline block mt-0.5">Comissão CNPJ/CPF 2026</a>
                    </div>
                    <div>
                      <span className="font-medium">TikTok Shop：</span>
                      <a href="https://seller-br.tiktok.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline block mt-0.5">Seller Center BR</a>
                    </div>
                    <div>
                      <span className="font-medium">Simples Nacional：</span>
                      <a href="http://www8.receita.fazenda.gov.br/SimplesNacional/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline block mt-0.5">Portal do Simples Nacional - Anexo I (Comércio)</a>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t">费率更新：2026-03-01（Shopee）/ 2026-02-05（TikTok）</p>
                </PopoverContent>
              </Popover>
            </p>
          </div>

          {/* 公司类型提醒 */}
          {showWarning && (
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
              <div className="flex justify-end mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                  onClick={() => setShowWarning(false)}
                >
                  我知道了
                </Button>
              </div>
            </Card>
          )}

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

          {/* 主内容：左右两栏 4:6 */}
          <div className="grid gap-6 lg:grid-cols-10">
            {/* 左栏：输入 */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="p-6 space-y-5">
                {/* 商品售价 */}
                <div className="flex items-center gap-3">
                  <Label htmlFor="price" className="w-40 shrink-0 text-sm font-medium flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    商品售价
                    <InfoTip text="买家实际支付的金额。用于计算平台佣金和固定费的基数。" />
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="例: 100"
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
                    发票与税务
                  </h3>

                  {/* 税制模式 */}
                  <div className="flex items-center gap-3">
                    <Label className="w-40 shrink-0 text-sm flex items-center gap-1">
                      税制模式
                      <InfoTip text="Simples Nacional: 按年营收阶梯税率。MEI: 小微个体户固定月费。零税: 仅用于推演极端场景（如对手不开发票）。" />
                    </Label>
                    <div className="flex gap-1 p-0.5 bg-muted rounded-md flex-1">
                      {([
                        ["simples", "Simples"],
                        ["mei", "MEI"],
                        ["zero", "零税"],
                      ] as const).map(([mode, label]) => (
                        <button
                          key={mode}
                          onClick={() => setTaxMode(mode)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-sm transition-all ${
                            taxMode === mode
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Simples 配置 */}
                  {taxMode === "simples" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Label htmlFor="rbt12" className="w-40 shrink-0 text-sm flex items-center gap-1">
                          年营收 RBT12 (BRL)
                          <InfoTip text="过去12个月总营收。不确定时留空，默认按最低档 4.00% 计税（保守估算）。用于反推对手成本时也可直接自定义税率。" />
                        </Label>
                        <div className="flex-1">
                          <Input
                            id="rbt12"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="留空默认最低档 4.00%"
                            value={rbt12}
                            onChange={(e) => { setRbt12(e.target.value); setUseCustomTax(false) }}
                          />
                        </div>
                      </div>

                      {/* 自定义税率 */}
                      <div className="flex items-center gap-3">
                        <div className="w-40 shrink-0" />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={useCustomTax}
                            onChange={(e) => setUseCustomTax(e.target.checked)}
                            className="rounded"
                          />
                          自定义税率
                        </label>
                        {useCustomTax && (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="4.00"
                              className="w-20 h-8 text-xs"
                              value={customTaxRate}
                              onChange={(e) => setCustomTaxRate(e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        )}
                      </div>

                      {!useCustomTax && (
                        <div className="flex items-center gap-3">
                          <div className="w-40 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            适用税率: <span className="font-semibold text-foreground">{taxRateDisplay}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MEI 模式 */}
                  {taxMode === "mei" && (
                    <div className="flex items-center gap-3">
                      <div className="w-40 shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        MEI 固定月费约 <span className="font-semibold text-foreground">R$ {MEI_MONTHLY_FEE}/月</span>，
                        不计入单件税费。如需精确请手动填入其他费用。
                      </p>
                    </div>
                  )}

                  {/* 零税模式 */}
                  {taxMode === "zero" && (
                    <div className="flex items-center gap-3">
                      <div className="w-40 shrink-0" />
                      <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>零税仅用于推演极端场景（如对手完全不开发票），不代表合规建议。</span>
                      </div>
                    </div>
                  )}

                  {/* 开票比例（Simples / 零税 显示） */}
                  {taxMode !== "mei" && (
                    <div className="flex items-center gap-3">
                      <Label htmlFor="invoice" className="w-40 shrink-0 text-sm flex items-center gap-1">
                        开票比例 (%)
                        <InfoTip text="实际开票金额占售价的比例。例如售价 100 但发票开 50，则填 50%。计税基数 = 售价 × 此比例。" />
                      </Label>
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
                             · 税金: <span className="font-semibold text-foreground">R$ {fmt(result.taxAmount)}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* 其他成本 */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Truck className="h-4 w-4" />
                    其他成本
                  </h3>

                  <div className="flex items-center gap-3">
                    <Label htmlFor="procurement" className="w-40 shrink-0 text-sm flex items-center gap-1">
                      采购成本 (BRL)
                      <InfoTip text="商品的进货/制造成本。分析自身利润时必填，反推对手成本时可为 0。" />
                    </Label>
                    <Input
                      id="procurement"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="例: 30.00"
                      className="flex-1"
                      value={procurement}
                      onChange={(e) => setProcurement(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Label htmlFor="shipping" className="w-40 shrink-0 text-sm flex items-center gap-1">
                      运费 (BRL)
                      <InfoTip text="单件商品的物流成本。如使用平台官方物流，可参考运费补贴计划的实际支出。" />
                    </Label>
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

            {/* 右栏：结果 / 空状态 */}
            <div className="lg:col-span-6">
            {result ? (
              <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                {/* 摘要卡片：平台费用 / 税费 / 总成本 / 净利润+利润率 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <motion.div
                    key={`platform-${changeId}`}
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <Card className="p-3 text-center space-y-0.5">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Store className="h-3.5 w-3.5" />
                        平台费用
                        <InfoTip text="平台收取的佣金 + 固定费 + 交易费/SFP 等合计。Shopee 佣金已含交易费。" />
                      </p>
                      <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                        <AnimatedNumber value={result.platformFee} />
                      </p>
                    </Card>
                  </motion.div>
                  <motion.div
                    key={`tax-${changeId}`}
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.05 }}
                  >
                    <Card className="p-3 text-center space-y-0.5">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Landmark className="h-3.5 w-3.5" />
                        税费
                        <InfoTip text={`税制: ${taxMode === "simples" ? "Simples Nacional" : taxMode === "mei" ? "MEI 固定月费" : "零税模式"}。计税基数 = 售价 × 开票比例。`} />
                      </p>
                      <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                        <AnimatedNumber value={result.taxAmount} />
                      </p>
                    </Card>
                  </motion.div>
                  <motion.div
                    key={`cost-${changeId}`}
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
                  >
                    <Card className="p-3 text-center space-y-0.5">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <CircleDollarSign className="h-3.5 w-3.5" />
                        总成本
                        <InfoTip text="平台费用 + 税费 + 采购 + 运费 + 所有自定义费用。" />
                      </p>
                      <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                        <AnimatedNumber value={result.totalCost} />
                      </p>
                    </Card>
                  </motion.div>
                  <motion.div
                    key={`profit-${changeId}`}
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.15 }}
                  >
                    <Card className={`p-3 text-center border-2 ${result.netProfit >= 0 ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/10" : "border-red-500/30 bg-red-50/50 dark:bg-red-950/10"}`}>
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        净利润
                        <InfoTip text="售价 − 所有成本，同行显示利润率。" />
                      </p>
                      <p className={`text-lg font-bold tabular-nums flex items-center justify-center gap-1.5 ${result.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        <span>{result.netProfit >= 0 ? "+" : "-"}<AnimatedNumber value={Math.abs(result.netProfit)} /></span>
                        <span className="text-xs font-medium opacity-70">
                          {result.profitMargin >= 0 ? <TrendingUp className="inline h-3 w-3" /> : <TrendingDown className="inline h-3 w-3" />}
                          {fmtPercent(result.profitMargin / 100)}
                        </span>
                      </p>
                    </Card>
                  </motion.div>
                </div>

                {/* 成本占比饼图 独占一行 */}
                <motion.div
                  key={`pie-${changeId}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <CostPieChart
                    platformFee={result.platformFee}
                    taxAmount={result.taxAmount}
                    procVal={result.procVal}
                    shipVal={result.shipVal}
                    otherTotal={result.otherTotal}
                  />
                </motion.div>

                {/* 二级折叠明细 */}
                <TwoLevelDetail categories={detailCategories} summary={detailSummary} price={result.price} />

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
            ) : (
              <div className="lg:sticky lg:top-20">
                <Card className="p-12 text-center space-y-3">
                  <Calculator className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">输入商品售价后自动计算</p>
                </Card>
              </div>
            )}
            </div>
          </div>

        </div>
      </div>
    </TooltipProvider>
  )
}
