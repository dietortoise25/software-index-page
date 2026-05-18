import { useRef } from "react"
import { motion, useScroll, useTransform, useInView } from "framer-motion"
import { ArrowRight, Database, Bot, Workflow, MessageSquare, BarChart3, Globe, Terminal, type LucideIcon } from "lucide-react"

/* ── 动画工具 ── */

const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
}

const slowFade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 1.2, ease: "easeOut" } },
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-100px" })
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={fadeIn} className={className}>
      {children}
    </motion.div>
  )
}

function SectionStagger({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={staggerContainer} className={className}>
      {children}
    </motion.div>
  )
}

function FadeItem({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <motion.div variants={fadeIn} className={className}>{children}</motion.div>
}

/* ── 子组件 ── */

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-8 flex items-center gap-3">
      <span className="font-mono text-xs tracking-widest text-muted-foreground/50">{number}</span>
      <h2 className="font-semibold text-xl tracking-tight">{title}</h2>
    </div>
  )
}

function FlowNode({ icon: Icon, label, sub, last = false }: { icon: LucideIcon; label: string; sub: string; last?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <span className="font-semibold text-sm">{label}</span>
      <span className="text-muted-foreground text-xs">{sub}</span>
      {!last && <ArrowRight className="mt-2 size-4 text-muted-foreground/40 rotate-90 sm:rotate-0" />}
    </div>
  )
}

function ProjectCard({ icon: Icon, title, desc, tags }: { icon: LucideIcon; title: string; desc: string; tags: string[] }) {
  return (
    <FadeItem>
      <div className="rounded-2xl border bg-card/50 p-6 transition-colors hover:bg-card">
        <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-[18px] text-primary" />
        </div>
        <h3 className="mb-1 font-semibold text-base">{title}</h3>
        <p className="mb-3 text-muted-foreground text-sm leading-relaxed">{desc}</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="rounded-md bg-muted px-2 py-0.5 font-mono text-muted-foreground text-xs">{t}</span>
          ))}
        </div>
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
    <div ref={containerRef} className="relative">
      {/* 顶部阅读进度条 */}
      <motion.div className="fixed top-14 left-0 z-40 h-0.5 bg-primary/60" style={{ width: progressBarWidth }} />

      <div className="container mx-auto max-w-3xl px-4 py-20 sm:py-28">
        {/* ── 1. Opening ── */}
        <section className="mb-36 sm:mb-48">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            <FadeItem>
              <p className="text-muted-foreground text-sm tracking-widest">ABOUT</p>
            </FadeItem>
            <FadeItem>
              <p className="mt-8 text-lg leading-relaxed sm:text-xl sm:leading-relaxed">
                我越来越发现：很多公司的问题，并不是缺工具。<br />
                <span className="text-muted-foreground">而是没人真正理解问题本身。</span>
              </p>
            </FadeItem>
            <FadeItem>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                现在，我主要关注 AI、数据与自动化如何真正进入业务流程。
              </p>
            </FadeItem>
            <FadeItem>
              <p className="mt-12 font-mono text-muted-foreground/60 text-xs">
                Alan Leung · 梁思骏
              </p>
            </FadeItem>
          </motion.div>
        </section>

        {/* ── 2. 起点 ── */}
        <Section className="mb-36 sm:mb-48">
          <SectionTitle number="01" title="起点" />
          <div className="space-y-5 text-base leading-relaxed">
            <p>
              最早接触业务的时候，很多决策其实依赖经验与感觉。
              在销售和电商的环境里，大家更习惯说「我觉得」「上次就是这样做的」——
              这本身没什么错。
            </p>
            <p className="text-muted-foreground">
              但业务规模一大，感觉会迅速失效。
              当你要同时面对几十个店铺、几百个 SKU、跨平台的营销数据时，直觉已经无法胜任。
            </p>
            <p>
              那段时间我在 Temu 和其他电商平台之间来回切换，大量时间花在了信息搬运上：从一个后台复制数据，到另一个表格里手动整理。我开始想：<span className="text-foreground">有没有更聪明的方式？</span>
            </p>
          </div>
        </Section>

        {/* ── 3. 数据阶段 ── */}
        <Section className="mb-36 sm:mb-48">
          <SectionTitle number="02" title="数据" />
          <div className="space-y-5 text-base leading-relaxed">
            <p>
              于是开始依赖数据。SQL、Excel、报表——不是为了做「数据分析师」，而是为了在混乱中找到确定性。
            </p>
            <p className="text-muted-foreground">
              但后来慢慢发现：数据本身并不会给答案。
              同样的数据，不同的人能读出完全不同的结论。
            </p>
            <p>
              真正重要的，不是你会写多复杂的查询。<span className="text-foreground">而是你是否理解业务问题本身。</span>
              数据只是帮你验证假设的工具——前提是你知道该问什么问题。
            </p>
          </div>
        </Section>

        {/* ── 4. 自动化阶段 ── */}
        <Section className="mb-36 sm:mb-48">
          <SectionTitle number="03" title="自动化" />
          <div className="space-y-5 text-base leading-relaxed">
            <p>
              后来又发现：大量工作其实只是重复的信息搬运。
              订单数据、广告报表、客服消息——它们在不同的系统里，用着不同的格式，需要同一个人手动搬运。
            </p>
            <p className="text-muted-foreground">
              真正浪费的，不是时间。而是人的注意力与认知资源。
              当你的大脑被重复操作占满，就没有空间思考更重要的问题。
            </p>
            <p>
              于是开始研究 workflow、browser automation、API 对接。<span className="text-foreground">让机器做机器该做的事，让人做人该做的事。</span>
            </p>
          </div>
        </Section>

        {/* ── 5. AI 阶段 ── */}
        <Section className="mb-36 sm:mb-48">
          <SectionTitle number="04" title="AI" />
          <div className="space-y-5 text-base leading-relaxed">
            <p>
              开始大量使用 AI 之后，第一次有了一种强烈的感觉：
            </p>
            <p className="font-semibold text-lg">
              很多原本需要多人协作的事情，一个人也能完成。
            </p>
            <p className="text-muted-foreground">
              AI 真正改变的，不是聊天。
              而是信息处理能力——它能帮你阅读、分析、总结、生成，让你把注意力集中在真正需要判断的地方。
            </p>
            <p>
              AI 不是兴趣，也不是工具。<span className="text-foreground">它正在成为生产力基础设施。</span>
              对我来说，AI 不是「偶尔问一下」，而是日常工作中不可分割的一部分。
            </p>
          </div>
        </Section>

        {/* ── 6. 当前工作方式 ── */}
        <Section className="mb-36 sm:mb-48">
          <SectionTitle number="05" title="工作方式" />
          <p className="mb-8 text-muted-foreground leading-relaxed">
            这几年的实践下来，逐渐形成了一套自己的工作闭环：
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
            <FlowNode icon={BarChart3} label="业务问题" sub="理解本质" />
            <FlowNode icon={Database} label="数据定位" sub="量化分析" />
            <FlowNode icon={Bot} label="AI 处理" sub="信息加工" />
            <FlowNode icon={Workflow} label="自动化执行" sub="重复清零" />
          </div>
          <div className="mt-8 rounded-2xl border bg-muted/20 p-6">
            <p className="text-center text-muted-foreground text-sm leading-relaxed">
              能力之间的连接，比单一技能本身重要得多。
            </p>
          </div>
        </Section>

        {/* ── 7. 项目实践 ── */}
        <section className="mb-36 sm:mb-48">
          <SectionTitle number="06" title="项目" />
          <SectionStagger className="grid gap-4 sm:grid-cols-2">
            <ProjectCard
              icon={MessageSquare}
              title="AI 写稿工具"
              desc="结构化 Prompt + 内容工作流，实现批量自动化内容生成"
              tags={["Prompt", "Workflow", "内容生成"]}
            />
            <ProjectCard
              icon={BarChart3}
              title="电商数据分析"
              desc="多平台数据聚合分析，从 GMV 到广告费率的全链路看板"
              tags={["SQL", "数据分析", "可视化"]}
            />
            <ProjectCard
              icon={Terminal}
              title="浏览器自动化工作流"
              desc="模拟人工操作的自动化脚本，降低跨系统的重复劳动"
              tags={["Browser Automation", "Workflow", "降本"]}
            />
            <ProjectCard
              icon={Globe}
              title="运营工具发布站"
              desc="内部工具分发 + AI 需求助手 + 数据看板 + 运营管理一体化站点"
              tags={["React", "AI", "全栈"]}
            />
          </SectionStagger>
        </section>

        {/* ── 8. Thoughts ── */}
        <section className="mb-36 sm:mb-48">
          <SectionTitle number="07" title="Thoughts" />
          <motion.div initial="hidden" whileInView="visible" variants={staggerContainer} viewport={{ once: true, margin: "-80px" }} className="space-y-8">
            {[
              "很多公司不是缺数据。而是缺真正理解业务的人。",
              "AI 不会替代所有人。但会迅速放大高认知个体的能力。",
              "自动化减少的，不是工作量。而是低价值注意力消耗。",
              "最好的工具，是让使用者感觉不到它的存在。",
              "过去几年我学到最重要的一件事：先理解问题，再谈技术方案。",
            ].map((text) => (
              <motion.p key={text} variants={slowFade} className="text-lg leading-relaxed text-muted-foreground">
                {text}
              </motion.p>
            ))}
          </motion.div>
        </section>

        {/* ── 9. Contact ── */}
        <Section>
          <SectionTitle number="08" title="联系" />
          <p className="text-muted-foreground leading-relaxed">
            如果你对 AI、数据、自动化在业务中的应用感兴趣，<br />
            或者想讨论如何让这些技术真正进入你的工作流程——<br />
            <span className="text-foreground">欢迎通过飞书联系我。</span>
          </p>
          <p className="mt-4 font-mono text-muted-foreground/60 text-sm">
            Feishu: Alan Leung
          </p>
        </Section>
      </div>
    </div>
  )
}
