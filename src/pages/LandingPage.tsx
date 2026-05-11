import { useEffect, useState, useRef } from "react"
import { Link } from "react-router"
import {
  ArrowRight,
  ArrowDown,
  Zap,
  BarChart3,
  Bot,
  Workflow,
  ShieldCheck,
  Package,
  Terminal,
  Globe,
} from "lucide-react"
import { softwareList } from "@/data/software"

/* ── 动效子组件 ── */

/** 逐字淡入标题 */
function StaggerText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="inline-block opacity-0 animate-[fadeInUp_0.4s_ease-out_forwards]"
          style={{ animationDelay: `${i * 0.04}s` }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  )
}

/** 数字递增计数器 */
function CountUp({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          const step = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - (1 - progress) ** 3 // ease-out
            setCount(Math.round(eased * target))
            if (progress < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.3 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [target, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {count}
      {suffix}
    </span>
  )
}

/** 滚动指示器 */
function ScrollIndicator() {
  return (
    <div className="mt-12 flex justify-center">
      <a
        href="#features"
        className="inline-flex flex-col items-center gap-1.5 text-muted-foreground/50 text-xs transition-colors hover:text-primary/70"
      >
        <span>了解更多</span>
        <ArrowDown className="size-4 animate-bounce" />
      </a>
    </div>
  )
}

/* ── 数据 ── */

const features = [
  { icon: Bot, title: "智能值守", desc: "7×24 自动处理客服、告警、审批，不再遗漏任何工单" },
  { icon: Workflow, title: "流程编排", desc: "拖拽式搭建运营工作流，多系统联动一气呵成" },
  { icon: BarChart3, title: "数据洞察", desc: "实时大盘 + 自动化报表，运营情况一目了然" },
  { icon: ShieldCheck, title: "稳定可靠", desc: "历经线上千万级调用验证，异常自动重试与告警" },
]

const floatingIcons = [
  { Icon: Package, x: "15%", y: "20%", size: 22, delay: "0s", duration: "14s" },
  { Icon: Terminal, x: "80%", y: "30%", size: 18, delay: "2s", duration: "16s" },
  { Icon: Globe, x: "70%", y: "65%", size: 20, delay: "4s", duration: "13s" },
  { Icon: Zap, x: "25%", y: "70%", size: 16, delay: "1s", duration: "15s" },
  { Icon: BarChart3, x: "55%", y: "15%", size: 19, delay: "3s", duration: "17s" },
]

/* ── 页面 ── */

export default function LandingPage() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden">
        {/* 流动渐变光斑 */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute -top-1/4 left-1/4 size-[600px] rounded-full bg-primary/15 blur-[120px] animate-[blobFloat_20s_ease-in-out_infinite]" />
          <div className="absolute top-1/3 -right-1/4 size-[500px] rounded-full bg-emerald-400/10 blur-[100px] animate-[blobFloat_25s_ease-in-out_infinite_reverse]" style={{ animationDelay: "-5s" }} />
          <div className="absolute -bottom-1/4 left-1/3 size-[450px] rounded-full bg-teal-300/8 blur-[100px] animate-[blobFloat_22s_ease-in-out_infinite]" style={{ animationDelay: "-10s" }} />
        </div>

        {/* 浮动图标 */}
        {floatingIcons.map(({ Icon, x, y, size, delay, duration }) => (
          <div
            key={`${x}-${y}`}
            className="absolute pointer-events-none select-none text-primary/15 animate-[iconFloat_linear_infinite]"
            style={{ left: x, top: y, animationDuration: duration, animationDelay: delay }}
          >
            <Icon size={size} />
          </div>
        ))}

        <div className="container mx-auto relative px-4 py-20 text-center">
          {/* Badge */}
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-background/60 backdrop-blur px-4 py-1.5 text-muted-foreground text-sm shadow-sm">
            <Zap className="size-3.5 text-primary" />
            运营自动化服务平台
          </div>

          {/* Title */}
          <h1 className="mx-auto max-w-4xl font-bold text-4xl leading-tight tracking-tight md:text-6xl md:leading-tight">
            <StaggerText text="让机器替你干活" className="block" />
            <br />
            <StaggerText
              text="专注更重要的事"
              className="mt-1 block bg-gradient-to-r from-primary via-emerald-400 to-teal-500 bg-clip-text text-transparent"
            />
          </h1>

          {/* Subtitle */}
          <p
            className="mx-auto mt-6 max-w-xl text-muted-foreground text-lg leading-relaxed opacity-0 animate-[fadeInUp_0.5s_ease-out_forwards]"
            style={{ animationDelay: "1.2s" }}
          >
            面向运营团队的一站式自动化工具箱，覆盖客服应答、数据处理、流程调度、监控告警等场景
          </p>

          {/* Stats Counter */}
          <div
            className="mt-8 flex items-center justify-center gap-8 opacity-0 animate-[fadeInUp_0.5s_ease-out_forwards]"
            style={{ animationDelay: "1.5s" }}
          >
            <div className="text-center">
              <div className="font-bold text-2xl tabular-nums text-primary">
                <CountUp target={softwareList.length} suffix="+" />
              </div>
              <div className="text-muted-foreground text-xs">已发布工具</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="font-bold text-2xl tabular-nums text-primary">
                <CountUp target={softwareList.reduce((acc, s) => acc + s.versions.length, 0)} suffix="+" />
              </div>
              <div className="text-muted-foreground text-xs">版本迭代</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="font-bold text-2xl tabular-nums text-primary">
                <CountUp target={1280} suffix="+" />
              </div>
              <div className="text-muted-foreground text-xs">累计下载</div>
            </div>
          </div>

          {/* Buttons */}
          <div
            className="mt-10 flex items-center justify-center gap-4 opacity-0 animate-[fadeInUp_0.5s_ease-out_forwards]"
            style={{ animationDelay: "1.8s" }}
          >
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground text-sm shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.03] active:scale-[0.98]"
            >
              浏览工具库
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border bg-background/60 backdrop-blur px-6 py-3 font-medium text-sm transition-all duration-300 hover:bg-accent hover:shadow-md active:scale-[0.98]"
            >
              了解更多
            </a>
          </div>

          <div
            className="opacity-0 animate-[fadeInUp_0.5s_ease-out_forwards]"
            style={{ animationDelay: "2.2s" }}
          >
            <ScrollIndicator />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-3 font-bold text-3xl tracking-tight">我们能做什么</h2>
            <p className="text-muted-foreground text-sm">覆盖运营自动化的核心场景</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/5"
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="relative">
                  <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                    <f.icon className="size-5 text-primary transition-transform duration-300" />
                  </div>
                  <h3 className="mb-2 font-semibold text-base">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-accent/40 p-12 text-center shadow-sm md:p-16">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent opacity-60" />
            <div className="relative">
              <h2 className="font-bold text-3xl tracking-tight">准备好提升效率了吗？</h2>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground leading-relaxed">
                选择一个工具开始，或联系我们定制专属自动化方案
              </p>
              <Link
                to="/catalog"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 font-medium text-primary-foreground text-sm shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.03] active:scale-[0.98]"
              >
                立即开始
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
