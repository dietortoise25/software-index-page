import { useRef } from "react"
import { motion, useScroll, useTransform, useInView, type Variants } from "framer-motion"
import { ArrowRight, Lightbulb, Grip, type LucideIcon } from "lucide-react"

/* ── 动效 variants ── */

const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
} satisfies Variants

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
} satisfies Variants

const slowFade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 1.4, ease: "easeOut" as const } },
} satisfies Variants

/* ── 子组件 ── */

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-120px" })
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={fadeIn} className={className}>
      {children}
    </motion.div>
  )
}

function SectionStagger({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-100px" })
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={staggerContainer} className={className}>
      {children}
    </motion.div>
  )
}

function FadeItem({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <motion.div variants={fadeIn} className={className}>{children}</motion.div>
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-10 flex items-center gap-3">
      <span className="font-mono text-sm tracking-widest text-muted-foreground/40">{number}</span>
      <h2 className="font-bold text-2xl sm:text-3xl tracking-tight">{title}</h2>
    </div>
  )
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>
}

function FlowNode({ label, desc, last = false }: { label: string; desc: string; last?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
        <span className="font-bold text-primary text-sm">{label.slice(0, 1)}</span>
      </div>
      <span className="font-semibold text-sm">{label}</span>
      <span className="text-muted-foreground text-xs">{desc}</span>
      {!last && <ArrowRight className="mt-1 size-4 text-muted-foreground/30 rotate-90 sm:rotate-0" />}
    </div>
  )
}

function ThoughtCard({ text }: { text: string }) {
  return (
    <motion.div variants={slowFade} className="group rounded-2xl border border-border/40 bg-muted/10 px-6 py-5 transition-colors hover:bg-muted/20">
      <p className="text-lg sm:text-xl leading-relaxed text-muted-foreground">{text}</p>
    </motion.div>
  )
}

function ProjectItem({ title, desc }: { title: string; desc: string }) {
  return (
    <FadeItem>
      <div className="rounded-2xl border border-border/40 bg-card/40 p-6 transition-colors hover:bg-card">
        <h3 className="mb-2 font-bold text-lg">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
      </div>
    </FadeItem>
  )
}

/* ── 主页面 ── */

export default function AboutPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] })
  const progressBarWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* 顶部渐变光斑 */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-32 h-[600px]"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary) / 0.07), transparent 70%)" }}
      />

      {/* 阅读进度条 */}
      <motion.div className="fixed top-14 left-0 z-40 h-0.5 bg-primary/50" style={{ width: progressBarWidth }} />

      <div className="container mx-auto max-w-3xl px-4 py-24 sm:py-32">
        {/* ══════════ 1. Opening ══════════ */}
        <section className="mb-44 sm:mb-56">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            <FadeItem>
              <h1 className="font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight leading-tight">
                重新定义一个人的
                <br />
                <span className="text-primary">生产力</span>
              </h1>
            </FadeItem>
            <FadeItem>
              <p className="mt-3 font-mono text-base sm:text-lg tracking-wide text-muted-foreground/60">
                Redefining individual leverage
              </p>
            </FadeItem>
            <FadeItem>
              <p className="mt-14 max-w-xl text-lg sm:text-xl leading-relaxed">
                我越来越感觉：旧世界里的很多工作方式，<span className="text-muted-foreground">正在快速失效。</span>
              </p>
            </FadeItem>
            <FadeItem>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
                组织结构、信息流转、协作方式——甚至「一个人能做到什么」的定义，都在被重新改写。
              </p>
            </FadeItem>
            <FadeItem>
              <p className="mt-4 max-w-xl text-base leading-relaxed">
                我现在关注的是：<Highlight>下一代个体，如何建立过去只有组织才能拥有的能力。</Highlight>
              </p>
            </FadeItem>
            <FadeItem>
              <p className="mt-16 font-mono text-muted-foreground/50 text-sm">
                Alan Leung · 梁思骏
              </p>
            </FadeItem>
          </motion.div>
        </section>

        {/* ══════════ 2. 起点 ══════════ */}
        <Section className="mb-40 sm:mb-52">
          <SectionTitle number="01" title="怀疑" />
          <div className="space-y-5 text-base sm:text-lg leading-relaxed">
            <p>
              最早接触真实业务时，我发现很多组织内部真正稀缺的并不是努力。<Highlight>而是信息处理能力。</Highlight>
            </p>
            <p className="text-muted-foreground">
              大量沟通、重复协作、流程传递、经验依赖——正在持续吞噬组织效率。
              当你要同时面对几十个店铺、几百个 SKU、跨平台的营销数据时，直觉已经无法胜任。
            </p>
            <p className="font-semibold text-xl sm:text-2xl leading-relaxed">
              我开始对旧的工作方式产生怀疑。
            </p>
          </div>
        </Section>

        {/* ══════════ 3. 数据 ══════════ */}
        <Section className="mb-40 sm:mb-52">
          <SectionTitle number="02" title="数据" />
          <div className="space-y-5 text-base sm:text-lg leading-relaxed">
            <p>
              后来我开始越来越依赖数据。不是因为喜欢报表——而是因为：
              当业务复杂到一定程度后，<Highlight>「感觉」会失效。</Highlight>
            </p>
            <p className="text-muted-foreground">
              数据真正重要的地方，不是统计。而是帮助人重新理解现实。
              同样的数据，不同的人能读出完全不同的结论——前提是你知道该问什么问题。
            </p>
          </div>
        </Section>

        {/* ══════════ 4. 自动化 ══════════ */}
        <Section className="mb-40 sm:mb-52">
          <SectionTitle number="03" title="自动化" />
          <div className="space-y-5 text-base sm:text-lg leading-relaxed">
            <p>
              后来我又发现：很多所谓的「工作」，本质上只是信息搬运。
            </p>
            <p className="text-muted-foreground">
              订单数据、广告报表、客服消息——它们在不同的系统里，用着不同的格式，需要同一个人手动搬运。
            </p>
            <p className="font-semibold text-xl sm:text-2xl leading-relaxed">
              如果一个人每天都在重复执行流程，<br />
              那么真正被浪费的，不是时间。<br />
              <Highlight>而是认知资源。</Highlight>
            </p>
          </div>
        </Section>

        {/* ══════════ 5. 认知升级 ══════════ */}
        <Section className="mb-40 sm:mb-52">
          <SectionTitle number="04" title="个体能力" />
          <div className="space-y-5 text-base sm:text-lg leading-relaxed">
            <p className="font-semibold text-2xl sm:text-3xl leading-snug">
              过去很多复杂事情，需要依赖组织协作。
            </p>
            <p className="font-semibold text-2xl sm:text-3xl leading-snug text-primary">
              但现在，越来越多能力，开始重新回到个体身上。
            </p>
            <p className="mt-6 text-muted-foreground">
              我不再把 AI 看作工具或兴趣。它正在成为生产力基础设施——帮你阅读、分析、总结、生成，让你把注意力集中在真正需要判断的地方。
            </p>
            <p>
              <Highlight>我越来越关注：下一代个体，如何建立过去只有组织才能拥有的能力。</Highlight>
            </p>
          </div>
        </Section>

        {/* ══════════ 6. 工作方式 ══════════ */}
        <Section className="mb-40 sm:mb-52">
          <SectionTitle number="05" title="新工作方式" />
          <p className="mb-10 text-base sm:text-lg text-muted-foreground leading-relaxed">
            不是技能列表。而是在实践中逐渐形成的一套闭环：
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
            <FlowNode label="理解问题" desc="看清本质" />
            <FlowNode label="建立系统" desc="结构思维" />
            <FlowNode label="降低重复" desc="释放认知" />
            <FlowNode label="个体杠杆" desc="持续放大" last />
          </div>
          <div className="mt-10 rounded-2xl border border-border/30 bg-muted/10 px-6 py-5">
            <p className="text-center text-muted-foreground text-sm">
              能力之间的连接，比单一技能本身重要得多。
            </p>
          </div>
        </Section>

        {/* ══════════ 7. 项目 ══════════ */}
        <section className="mb-40 sm:mb-52">
          <SectionTitle number="06" title="实践" />
          <p className="mb-8 text-base sm:text-lg text-muted-foreground leading-relaxed">
            这些想法后来逐渐变成了一些实际实践。<Highlight>每个项目，都是在试图解决一个具体的旧问题。</Highlight>
          </p>
          <SectionStagger className="grid gap-4 sm:grid-cols-2">
            <ProjectItem
              title="自动化工作流"
              desc="减少重复的信息处理与流程执行，让更多精力重新回到判断与决策本身。"
            />
            <ProjectItem
              title="电商数据分析"
              desc="在复杂业务中建立更稳定的决策依据，让数据成为理解现实的工具而非报表。"
            />
            <ProjectItem
              title="AI 内容工具"
              desc="用结构化 Prompt 与工作流替代重复性内容生产，探索人机协作的新边界。"
            />
            <ProjectItem
              title="运营工具发布站"
              desc="内部工具分发 + AI 需求助手 + 数据看板，一个持续演化的个人实践场。"
            />
          </SectionStagger>
        </section>

        {/* ══════════ 8. Thoughts ══════════ */}
        <section className="mb-40 sm:mb-52">
          <SectionTitle number="07" title="观点" />
          <motion.div initial="hidden" whileInView="visible" variants={staggerContainer} viewport={{ once: true, margin: "-100px" }} className="space-y-4">
            <ThoughtCard text="旧世界的大多数组织结构，建立在信息不对称之上。" />
            <ThoughtCard text="真正重要的，不是工具。而是重新组织现实的能力。" />
            <ThoughtCard text="未来最强的个体，会越来越像过去的小型组织。" />
            <ThoughtCard text="很多团队的问题，本质上是信息处理效率问题。" />
            <ThoughtCard text="真正稀缺的，是把复杂问题重新结构化的人。" />
          </motion.div>
        </section>

        {/* ══════════ 9. Contact ══════════ */}
        <Section>
          <SectionTitle number="08" title="联系" />
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            如果你也在思考类似的问题——<br />
            或者想讨论未来的个体将如何工作——<br />
            <Highlight>欢迎通过飞书联系我。</Highlight>
          </p>
          <p className="mt-4 font-mono text-muted-foreground/50 text-sm">
            Feishu: Alan Leung
          </p>
        </Section>
      </div>
    </div>
  )
}
