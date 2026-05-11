import { Link } from "react-router"
import { ArrowRight, Zap, BarChart3, Bot, Workflow, ShieldCheck } from "lucide-react"

const features = [
  {
    icon: Bot,
    title: "智能值守",
    desc: "7×24 自动处理客服、告警、审批，不再遗漏任何工单",
  },
  {
    icon: Workflow,
    title: "流程编排",
    desc: "拖拽式搭建运营工作流，多系统联动一气呵成",
  },
  {
    icon: BarChart3,
    title: "数据洞察",
    desc: "实时大盘 + 自动化报表，运营情况一目了然",
  },
  {
    icon: ShieldCheck,
    title: "稳定可靠",
    desc: "历经线上千万级调用验证，异常自动重试与告警",
  },
]

export default function LandingPage() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative py-20 md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="container mx-auto relative px-4 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-muted-foreground text-sm">
            <Zap className="size-3.5 text-primary" />
            运营自动化服务平台
          </div>
          <h1 className="mx-auto max-w-3xl bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text font-bold text-4xl text-transparent md:text-6xl">
            让机器替你干活
            <br />
            <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text">专注更重要的事</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-muted-foreground text-lg leading-relaxed">
            面向运营团队的一站式自动化工具箱，覆盖客服应答、数据处理、流程调度、监控告警等场景
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground text-sm shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.03] active:scale-[0.98]"
            >
              浏览工具库
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 font-medium text-sm transition-all duration-300 hover:bg-accent hover:shadow-md active:scale-[0.98]"
            >
              了解更多
            </a>
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
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
