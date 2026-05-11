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
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground text-sm transition-all hover:opacity-90 hover:shadow-lg hover:shadow-primary/25"
            >
              浏览工具库
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 font-medium text-sm transition-colors hover:bg-accent"
            >
              了解更多
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center font-bold text-3xl">我们能做什么</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5 transition-colors group-hover:bg-primary/20">
                  <f.icon className="size-5 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-2xl bg-primary/5 p-10 text-center md:p-16">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
            <div className="relative">
              <h2 className="font-bold text-3xl">准备好提升效率了吗？</h2>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                选择一个工具开始，或联系我们定制专属自动化方案
              </p>
              <Link
                to="/catalog"
                className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3.5 font-medium text-primary-foreground text-sm transition-all hover:opacity-90 hover:shadow-xl hover:shadow-primary/30"
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
