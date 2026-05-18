import { useRef, useState, useEffect, useCallback } from "react"
import { motion, useScroll, useTransform, useInView, type Variants } from "framer-motion"
import { Volume2, VolumeX, Send, Bot } from "lucide-react"
import ChatDialog from "@/components/chat/ChatDialog"

/* ── 打字机效果 ── */

function Typewriter({ text, className, speed = 80 }: { text: string; className?: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  const startTyping = useCallback(() => {
    if (started) return
    setStarted(true)
    let i = 0
    const typeNext = () => {
      i++
      if (i <= text.length) {
        setDisplayed(text.slice(0, i))
        // 标点后稍长停顿，模拟流式输出节奏
        const ch = text[i - 1]
        const delay = ch === '，' || ch === '。' || ch === '？' || ch === '！' ? speed * 2.5
          : ch === '、' || ch === '；' || ch === '：' ? speed * 1.8
          : speed * (0.7 + Math.random() * 0.6)
        setTimeout(typeNext, delay)
      } else {
        setDone(true)
      }
    }
    typeNext()
  }, [text, speed, started])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) startTyping() }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [startTyping])

  return (
    <span ref={ref} className={className} aria-label={text}>
      {displayed}
      {!done && <span className="animate-pulse text-primary/60">|</span>}
    </span>
  )
}

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

function StaggerWrap({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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

function SectionNum({ n }: { n: string }) {
  return <span className="font-mono text-sm tracking-widest text-muted-foreground/40">{n}</span>
}

function Quote({ text, source }: { text: string; source: string }) {
  return (
    <blockquote className="my-6 border-l-2 border-primary/30 pl-4">
      <p className="text-base sm:text-lg leading-relaxed text-muted-foreground italic">
        「{text}」
      </p>
      <cite className="mt-1 block font-sans text-muted-foreground/50 text-sm not-italic">
        —— {source}
      </cite>
    </blockquote>
  )
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground">{children}</span>
}

/* ── 主页面 ── */

export default function AboutPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [musicOn, setMusicOn] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] })
  const progressBarWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])

  // 默认播放：先试直接播放，被浏览器拦截则等首次交互
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = 0.3
    a.play().then(() => setMusicOn(true)).catch(() => {
      const events = ["click", "scroll", "keydown", "touchstart"] as const
      const tryPlay = () => {
        a.play().then(() => setMusicOn(true)).catch(() => {})
        events.forEach((e) => document.removeEventListener(e, tryPlay))
      }
      events.forEach((e) => document.addEventListener(e, tryPlay, { once: true }))
    })
  }, [])

  const toggleMusic = () => {
    if (!audioRef.current) return
    if (musicOn) { audioRef.current.pause(); setMusicOn(false) }
    else { audioRef.current.play().then(() => setMusicOn(true)).catch(() => setMusicOn(false)) }
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* 顶部渐变光斑 */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-32 h-[600px]"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary) / 0.07), transparent 70%)" }}
      />

      {/* 背景音乐 */}
      <audio ref={audioRef} src="/about-bgm.m4a" loop preload="auto" />

      {/* 音乐开关 */}
      <button
        onClick={toggleMusic}
        className={`group fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur text-muted-foreground transition-all hover:text-foreground hover:border-primary/30 ${musicOn ? "size-10 justify-center border-border/40" : "border-primary/30 px-5 py-2.5 animate-pulse"}`}
        aria-label={musicOn ? "暂停音乐" : "播放音乐"}
        title="塞勒涅之梦 · 古典钢琴"
      >
        {musicOn
          ? <Volume2 className="size-4 shrink-0 text-primary" />
          : <><VolumeX className="size-4 shrink-0" /><span className="text-sm whitespace-nowrap">开启音乐</span></>
        }
        {musicOn && (
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg border border-border/30 bg-background/90 px-3 py-1.5 text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur">
            塞勒涅之梦 · 古典钢琴 —— 这首曲子陪我写下了这一页
          </span>
        )}
      </button>

      {/* 阅读进度条 */}
      <motion.div className="fixed top-14 left-0 z-40 h-0.5 bg-primary/50" style={{ width: progressBarWidth }} />

      <div className="container mx-auto max-w-3xl px-4 py-24 sm:py-32">
        {/* ══════════ Opening ══════════ */}
        <section className="mb-44 sm:mb-56">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            {/* 引言 */}
            <FadeItem>
              <p className="max-w-lg text-base sm:text-lg leading-relaxed text-muted-foreground italic">
                「<Typewriter text="人们高估了短期变化，却低估了长期变革。" />」
              </p>
              <p className="mt-1 text-muted-foreground/50 text-sm">
                —— 《精益创业》
              </p>
            </FadeItem>

            {/* 过渡句 */}
            <FadeItem>
              <p className="mt-8 max-w-xl text-base sm:text-lg leading-relaxed text-muted-foreground">
                而这种长期变革，最安静也最彻底的那一个，正发生在<span className="text-foreground">「一个人能做成什么」</span>这件事上。
              </p>
            </FadeItem>

            {/* 大字报主标题 */}
            <FadeItem>
              <h1 className="mt-12 font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight leading-tight">
                重新定义一个人的
                <br />
                <span className="text-primary">生产力</span>
              </h1>
            </FadeItem>
            <FadeItem>
              <p className="mt-3 font-mono text-base sm:text-lg tracking-wide text-muted-foreground/60">
                <Typewriter text="Redefining individual leverage" speed={90} />
              </p>
            </FadeItem>

            {/* Opening 正文 */}
            <FadeItem>
              <p className="mt-14 max-w-xl text-lg sm:text-xl leading-relaxed">
                <span className="text-muted-foreground">曾经高效的工作方式，正在悄悄失灵。</span>
              </p>
            </FadeItem>
            <FadeItem>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
                会议越来越多，协作越来越复杂，流程越来越长。<br />
                但真正被解决的问题，却没有变多。
              </p>
            </FadeItem>
            <FadeItem>
              <p className="mt-4 max-w-xl text-base leading-relaxed">
                <Highlight>下一代个体，究竟还能拥有多大的能力边界。</Highlight>
              </p>
            </FadeItem>

            <FadeItem>
              <p className="mt-12 max-w-xl text-base leading-relaxed text-muted-foreground">
                这些困惑，把我推向了一个方向——不是更努力地工作，而是重新理解<Highlight>一个人能调动的力量</Highlight>。
              </p>
            </FadeItem>

            <FadeItem>
              <p className="mt-10 font-mono text-muted-foreground/50 text-sm">
                Alan Leung
              </p>
            </FadeItem>
          </motion.div>
        </section>

        {/* ══════════ Part 1：现实业务 ══════════ */}
        <Section className="mb-40 sm:mb-52">
          <div className="mb-10 flex items-center gap-3">
            <SectionNum n="01" />
            <h2 className="font-bold text-2xl sm:text-3xl tracking-tight"><Typewriter text="现实会逼着人重新思考" /></h2>
          </div>

          <div className="space-y-5 text-base sm:text-lg leading-relaxed">
            <p>
              最早接触的，不是技术。<Highlight>是真实业务。</Highlight>
            </p>
            <p className="text-muted-foreground">
              刚接手业务时，最让我困惑的是一张库存表：销售手里一个数字，仓库一个数字，财务又是另一个。<br />
              没有人说谎——只是<span className="text-foreground">信息每流转一次，就失真一次</span>。
            </p>
            <p className="text-muted-foreground">
              很多人的工作，本质上只是：不断复制、确认、同步、转发。
            </p>

            <Quote
              text="人无法一次理解七个以上的信息单位。"
              source="《金字塔原理》"
            />
            <p>
              现实里的组织，<Highlight>每天都在制造远超人脑负荷的信息复杂度。</Highlight>
            </p>
          </div>
        </Section>

        {/* ══════════ Part 2：数据 ══════════ */}
        <Section className="mb-40 sm:mb-52">
          <div className="mb-10 flex items-center gap-3">
            <SectionNum n="02" />
            <h2 className="font-bold text-2xl sm:text-3xl tracking-tight"><Typewriter text="当经验开始失效" /></h2>
          </div>

          <div className="space-y-5 text-base sm:text-lg leading-relaxed">
            <p>
              SKU 越来越多，平台越来越多，广告数据越来越多。
            </p>
            <p className="text-muted-foreground">
              <Highlight>很多过去依赖经验的判断，迅速失效。</Highlight>
            </p>

            <Quote
              text="创业最大的风险，不是构建产品失败。而是构建了没人需要的东西。"
              source="《精益数据分析》"
            />
            <p>
              很多业务问题，本质上也是如此。
            </p>
            <p>
              真正重要的，不是收集更多数据。<Highlight>而是找到真正关键的变量。</Highlight>
            </p>
          </div>
        </Section>

        {/* ══════════ Part 3：系统化 ══════════ */}
        <Section className="mb-40 sm:mb-52">
          <div className="mb-10 flex items-center gap-3">
            <SectionNum n="03" />
            <h2 className="font-bold text-2xl sm:text-3xl tracking-tight"><Typewriter text="迷上「系统」" /></h2>
          </div>

          <div className="space-y-5 text-base sm:text-lg leading-relaxed">
            <p className="font-semibold text-xl sm:text-2xl leading-snug">
              人会疲惫、会波动、会遗忘。<br />
              <Highlight>但系统不会。</Highlight>
            </p>

            <Quote
              text="长期来看，决定结果的不是情绪，而是系统。"
              source="《海龟交易法则》"
            />

            <p className="text-muted-foreground">
              无论是数据、流程、工作流——建立系统，而非依赖记忆与经验。
            </p>
          </div>
        </Section>

        {/* ══════════ Part 4：真正的变化 ══════════ */}
        <Section className="mb-40 sm:mb-52">
          <div className="mb-10 flex items-center gap-3">
            <SectionNum n="04" />
            <h2 className="font-bold text-2xl sm:text-3xl tracking-tight"><Typewriter text="真正让我震撼的，是另一件事" /></h2>
          </div>

          <div className="space-y-5 text-base sm:text-lg leading-relaxed">
            <p className="text-muted-foreground">
              过去很多复杂工作，意味着：多人协作。写内容、分析数据、开发工具、建立流程——往往需要一个小团队。
            </p>
            <p className="font-semibold text-2xl sm:text-3xl leading-snug text-primary">
              但一个人，开始拥有过去「小团队」才能拥有的能力。
            </p>
            <p className="text-muted-foreground">
              这种感受很奇特——像你一直习惯用双手搬重物，忽然有人递给你一台叉车，<span className="text-foreground">却发现周围大多数人还在弯腰</span>。
            </p>

            <Quote
              text="AI 不是工具革命，而是组织革命。"
              source="安克 AI 火箭班"
            />

            <p>
              <Highlight>真正改变的，不是工具本身，而是一个人的<Highlight>能力半径</Highlight>。</Highlight>
            </p>
          </div>
        </Section>

        {/* ══════════ Thoughts ══════════ */}
        <section className="mb-40 sm:mb-52">
          <div className="mb-10 flex items-center gap-3">
            <SectionNum n="05" />
            <h2 className="font-bold text-2xl sm:text-3xl tracking-tight"><Typewriter text="观点" /></h2>
          </div>

          <StaggerWrap className="space-y-4">
            <motion.div variants={slowFade} className="rounded-2xl border border-border/40 bg-muted/10 px-6 py-5">
              <p className="text-lg sm:text-xl leading-relaxed text-muted-foreground italic">
                「如果我有一小时解决问题，我会花 55 分钟理解问题。」
              </p>
              <p className="mt-1 text-muted-foreground/50 text-sm">—— 爱因斯坦</p>
            </motion.div>
            <motion.div variants={slowFade} className="rounded-2xl border border-border/40 bg-muted/10 px-6 py-5">
              <p className="text-lg sm:text-xl leading-relaxed">
                真正重要的，从来不是做更多事。而是重新定义问题。
              </p>
            </motion.div>
            <motion.div variants={slowFade} className="rounded-2xl border border-border/40 bg-muted/10 px-6 py-5">
              <p className="text-lg sm:text-xl leading-relaxed">
                很多团队的问题，本质上是信息处理效率问题。
              </p>
            </motion.div>
            <motion.div variants={slowFade} className="rounded-2xl border border-border/40 bg-muted/10 px-6 py-5">
              <p className="text-lg sm:text-xl leading-relaxed">
                系统最大的价值，是减少低价值重复，释放判断力。
              </p>
            </motion.div>
            <motion.div variants={slowFade} className="rounded-2xl border border-border/40 bg-muted/10 px-6 py-5">
              <p className="text-lg sm:text-xl leading-relaxed">
                未来最强的个体，会越来越像过去的小型组织。
              </p>
            </motion.div>
          </StaggerWrap>
        </section>

        {/* ══════════ Ending ══════════ */}
        <Section>
          <StaggerWrap>
            <FadeItem>
              <p className="text-base sm:text-lg leading-relaxed text-muted-foreground italic">
                「我们无法用制造问题时的思维，去解决问题。」
              </p>
              <p className="mt-1 text-muted-foreground/50 text-sm">
                —— 爱因斯坦
              </p>
            </FadeItem>
            <FadeItem>
              <p className="mt-10 text-lg sm:text-xl leading-relaxed">
                探索还在继续：<Highlight>一个人的能力边界，还能被推多远？</Highlight>
              </p>
            </FadeItem>

            {/* CTA */}
            <FadeItem>
              <div className="mt-12 rounded-2xl border border-primary/20 bg-primary/[0.03] p-6 sm:p-8">
                <p className="font-semibold text-lg">
                  如果你也在思考同样的问题
                </p>
                <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                  项目合作 · 数字化改造 · AI/自动化落地 · 工作流重塑
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="https://www.feishu.cn/invitation/page/add_contact/?token=102j6c0a-8ed3-4a50-b129-89036a174e38&amp;unique_id=hPB8x5jEunvd3Cp-jQ5bAA=="
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-foreground text-sm transition-all hover:opacity-85"
                  >
                    <Send className="size-4" /> 飞书联系我
                  </a>
                  <div className="flex flex-col">
                    <button
                      onClick={() => setChatOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 font-medium text-sm transition-all hover:border-primary/30 hover:text-primary"
                    >
                      <Bot className="size-4" /> 聊聊你的需求
                    </button>
                    <span className="mt-1.5 text-muted-foreground/60 text-xs">还不确定聊什么？先和 AI 助手说说你的情况</span>
                  </div>
                </div>
              </div>
            </FadeItem>
          </StaggerWrap>
        </Section>
      </div>

      <ChatDialog open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}
