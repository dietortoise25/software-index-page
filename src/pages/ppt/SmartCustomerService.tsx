import { SlideDeck, Slide } from '@/components/slide-deck'
import { HeroCover, ActDivider, BigNumbers, HeroQuestion } from '@/components/slide-deck/layouts'
import { useSlideDeck } from '@/components/slide-deck/SlideDeckContext'
import { easeOutExpo } from '@/components/slide-deck/easing'
import { motion } from 'framer-motion'
import { AlertTriangle, Clock, Wrench, ShieldAlert, TrendingUp } from 'lucide-react'

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOutExpo } },
}

function Tag({ children, color }: { children: string; color?: string }) {
  const { colors } = useSlideDeck()
  return (
    <span
      className="inline-block font-mono text-[10px] tracking-[0.2em] px-[14px] py-[5px] border"
      style={{ borderColor: color ?? colors.accent, color: color ?? colors.accent }}
    >
      {children}
    </span>
  )
}

function SectionTitle({ kicker, title, lead }: { kicker?: string; title: string; lead?: string }) {
  const { colors } = useSlideDeck()
  return (
    <>
      {kicker && (
        <motion.div className="font-mono text-[10px] tracking-[0.25em] uppercase mb-[2vh]" style={{ opacity: 0.4 }} variants={item}>
          {kicker}
        </motion.div>
      )}
      <motion.h2 className="font-bold leading-[1.2] mb-[2vh]" style={{ fontSize: '2.6vw', color: colors.accent }} variants={item}>
        {title}
      </motion.h2>
      {lead && (
        <motion.p className="font-light opacity-70 mb-[4vh] leading-relaxed" style={{ fontSize: '1.25vw' }} variants={item}>
          {lead}
        </motion.p>
      )}
    </>
  )
}

function StatCard({ value, label, note, color }: { value: string; label: string; note?: string; color?: string }) {
  const { colors } = useSlideDeck()
  return (
    <motion.div
      className="rounded-lg border border-white/6 p-[2.5vh_2vw]"
      style={{ background: 'rgba(255,255,255,0.04)' }}
      variants={item}
    >
      <div className="font-mono text-[9px] tracking-[0.15em] uppercase" style={{ opacity: 0.4 }}>{label}</div>
      <div className="font-black leading-none my-[0.5vh]" style={{ fontSize: '3vw', color: color ?? colors.accent }}>{value}</div>
      {note && <div className="text-[0.85vw] opacity-65 leading-relaxed">{note}</div>}
    </motion.div>
  )
}

export default function SmartCustomerServicePPT() {
  return (
    <SlideDeck style="swiss" theme="ikb">
      {/* 1. Cover */}
      <Slide kind="hero-dark" chromeLeft="技术汇报 · 2026.05.28" chromeRight="1 / 16"
             footLeft="CONFIDENTIAL" footRight="— 数据/技术团队 —">
        <HeroCover
          kicker="智能客服系统 · 技术汇报"
          title="从RPA救火"
          titleAccent="到商业方案"
          subtitle="TF ERP智能客服对接难点的技术评估与决策建议"
          lead="RPA脚本每周故障1-2次，开发资源持续沉没——这不是技术问题，是生态壁垒问题。"
          stats={[
            { value: '4-6h', label: '每周维护工时' },
            { value: '≤95%', label: 'RPA稳定性' },
            { value: '¥828', label: '年费替代方案' },
          ]}
        />
      </Slide>

      {/* 2. Act Divider — 背景篇 */}
      <Slide kind="hero-dark" chromeLeft="第一幕" chromeRight="2 / 16">
        <ActDivider act="Act I" title="背景" lead="先看清问题，再讨论方案。" />
      </Slide>

      {/* 3. Core Problem */}
      <Slide kind="dark" chromeLeft="背景 · 核心问题" chromeRight="3 / 16"
             footLeft="RPA = Robotic Process Automation 机器人流程自动化" footRight="— · —">
        <SectionTitle
          kicker="BACKGROUND"
          title="RPA：退阶措施，非长久之计"
          lead={'当前智能客服与TF ERP的对接采用的是RPA\u201C模拟人工操作\u201D方案——因无法获得官方API授权而采取的退阶措施。'}
        />
        <div className="grid grid-cols-2 gap-[2vh_3vw] mt-[4vh]">
          <div className="rounded-lg border border-white/6 p-[3vh_2vw]" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <motion.div variants={item}>
              <Wrench className="w-8 h-8 mb-[2vh]" style={{ color: 'var(--color-red-500, #e04a3c)' }} />
              <div className="font-semibold text-[1.2vw] mb-[1vh]">RPA方案本质</div>
              <div className="text-[0.95vw] opacity-70 leading-relaxed">
                训练"数字员工"模拟真人操作ERP后台——点击按钮、填写表单、读取页面数据。依赖DOM/CSS选择器定位元素。
              </div>
            </motion.div>
          </div>
          <div className="rounded-lg border border-white/6 p-[3vh_2vw]" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <motion.div variants={item}>
              <AlertTriangle className="w-8 h-8 mb-[2vh]" style={{ color: 'var(--color-amber-500, #d4a853)' }} />
              <div className="font-semibold text-[1.2vw] mb-[1vh]">核心矛盾</div>
              <div className="text-[0.95vw] opacity-70 leading-relaxed">
                TF ERP前端每周微调→RPA脚本随即失效→人工修复→再失效。这是一个无法通过代码优化终止的恶性循环。
              </div>
            </motion.div>
          </div>
        </div>
      </Slide>

      {/* 4. RPA Pain Data */}
      <Slide kind="dark" chromeLeft="痛点 · 数据" chromeRight="4 / 16"
             footLeft="数据来源：开发团队实际工时统计" footRight="Act I · Data">
        <BigNumbers
          kicker="RPA方案 · 运行现状"
          title="三个数字看问题的严重性"
          stats={[
            { label: '每周故障', value: '1-2', unit: '次', note: 'TF ERP前端每周微调导致' },
            { label: '每周维护', value: '4-6', unit: '小时', note: '单次修复2-3小时' },
            { label: '稳定性', value: '≤95', unit: '%', note: '故障期间客服功能中断' },
          ]}
        />
      </Slide>

      {/* 5. Pain 1 — Stability */}
      <Slide kind="dark" chromeLeft="痛点一" chromeRight="5 / 16"
             footLeft="技术语言 + 自然语言双语说明" footRight="— · —">
        <SectionTitle
          kicker="PAIN #1"
          title="稳定性极低，业务随时可能中断"
        />
        <div className="grid grid-cols-2 gap-[3vh_3vw]">
          <motion.div className="rounded-lg border border-white/6 p-[3vh_2vw]" style={{ background: 'rgba(255,255,255,0.04)' }} variants={item}>
            <div className="font-mono text-[9px] tracking-[0.15em] uppercase mb-[1.5vh]" style={{ opacity: 0.4 }}>技术语言</div>
            <div className="text-[0.95vw] leading-relaxed opacity-80">
              RPA脚本强依赖TF ERP前端DOM结构、CSS选择器、Xpath路径及事件绑定。第三方系统前端迭代频繁且无变更通知，每次改动都可能破坏脚本定位逻辑。
            </div>
          </motion.div>
          <motion.div className="rounded-lg border p-[3vh_2vw]" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }} variants={item}>
            <div className="font-mono text-[9px] tracking-[0.15em] uppercase mb-[1.5vh]" style={{ opacity: 0.4 }}>自然语言</div>
            <div className="text-[0.95vw] leading-relaxed opacity-80">
              "我们训练了一个'数字员工'去操作ERP后台。但TF ERP前端每周都有小改动——按钮挪了位置、布局调了一下——我们的'数字员工'就会立刻'迷路'。"
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* 6. Pain 2 — Maintenance Cost */}
      <Slide kind="dark" chromeLeft="痛点二" chromeRight="6 / 16"
             footLeft="持续性沉没成本，无法通过代码优化消除" footRight="— · —">
        <SectionTitle
          kicker="PAIN #2"
          title="维护成本畸高，持续消耗开发资源"
          lead="每周平均故障1-2次，单次修复2-3小时，保守估算每周维护工时4-6小时。此项投入为持续性沉没成本。"
        />
        <div className="grid grid-cols-3 gap-[2vh_2vw] mt-[3vh]">
          <StatCard value="200-300" label="年化维护工时" note="按开发人天折算约4-8万元隐性成本（单位：小时）" color="#e04a3c" />
          <StatCard value="∞" label="持续性投入" note="只要TF ERP还在迭代，就永远修下去。无法终止。" color="#e04a3c" />
          <StatCard value="0" label="可优化空间" note="这不是代码质量问题——RPA与DOM的耦合是结构性缺陷" color="#e04a3c" />
        </div>
      </Slide>

      {/* 7. Pain 3 — Business Continuity */}
      <Slide kind="dark" chromeLeft="痛点三" chromeRight="7 / 16"
             footLeft="直接影响：询单转化率 + 店铺评分" footRight="— · —">
        <SectionTitle
          kicker="PAIN #3"
          title="业务连续性差，影响客服响应与转化"
        />
        <motion.div className="max-w-[80%]" variants={item}>
          <div className="text-[1.2vw] leading-relaxed opacity-85 pl-[1.5vw] border-l-[3px] mb-[3vh]"
               style={{ borderColor: 'var(--color-amber-500, #d4a853)' }}>
            "脚本一挂，智能客服就'哑了'。客服同学只能手动回复，高峰期根本忙不过来。客户等久了就跑单，差评也来了。"
          </div>
        </motion.div>
        <div className="grid grid-cols-3 gap-[2vh_2vw] mt-[2vh]">
          {[
            { icon: <ShieldAlert className="w-6 h-6" />, title: '故障期服务中断', desc: '自动回复、订单查询、售后处理全部失效' },
            { icon: <Clock className="w-6 h-6" />, title: '响应延迟增加', desc: '客服从自动化转为纯人工，响应慢' },
            { icon: <TrendingUp className="w-6 h-6" />, title: '商业损失', desc: '询单转化率下降，店铺评分受损' },
          ].map((col, i) => (
            <motion.div key={i} className="rounded-lg border border-white/6 p-[2.5vh_1.5vw] text-center"
                        style={{ background: 'rgba(255,255,255,0.03)' }} variants={item}>
              <div className="flex justify-center mb-[1.5vh]" style={{ opacity: 0.6 }}>{col.icon}</div>
              <div className="font-semibold text-[1vw] mb-[0.8vh]">{col.title}</div>
              <div className="text-[0.85vw] opacity-65 leading-relaxed">{col.desc}</div>
            </motion.div>
          ))}
        </div>
      </Slide>

      {/* 8. Act Divider — 分析篇 */}
      <Slide kind="hero-dark" chromeLeft="第二幕" chromeRight="8 / 16">
        <ActDivider act="Act II" title="根因分析" lead="不是技术问题，是生态壁垒问题。" />
      </Slide>

      {/* 9. Root Cause */}
      <Slide kind="dark" chromeLeft="根因分析" chromeRight="9 / 16"
             footLeft="ERP = Enterprise Resource Planning · ISV = Independent Software Vendor" footRight="— · —">
        <SectionTitle
          kicker="ROOT CAUSE"
          title="生态壁垒：ERP与头部ISV深度绑定"
        />
        <div className="grid grid-cols-3 gap-[2vh_2vw] mt-[3vh]">
          <motion.div className="rounded-lg border border-white/6 p-[3vh_2vw]" style={{ background: 'rgba(255,255,255,0.04)' }} variants={item}>
            <div className="text-[2vw] mb-[1.5vh]">🔗</div>
            <div className="font-semibold text-[1vw] mb-[1vh]">商业生态壁垒</div>
            <div className="text-[0.85vw] opacity-65 leading-relaxed">
              TF/千易ERP与乐言科技深度绑定。乐言产品直接嵌入ERP后台作为默认方案，第三方开发者无法获得同等API权限。
            </div>
          </motion.div>
          <motion.div className="rounded-lg border border-white/6 p-[3vh_2vw]" style={{ background: 'rgba(255,255,255,0.04)' }} variants={item}>
            <div className="text-[2vw] mb-[1.5vh]">🚫</div>
            <div className="font-semibold text-[1vw] mb-[1vh]">ISV资质门槛</div>
            <div className="text-[0.85vw] opacity-65 leading-relaxed">
              申请成为官方ISV需要企业资质认证、商业合同、数据安全审计。我司目前不具备快速获取资质的条件。
            </div>
          </motion.div>
          <motion.div className="rounded-lg border border-white/6 p-[3vh_2vw]" style={{ background: 'rgba(255,255,255,0.04)' }} variants={item}>
            <div className="text-[2vw] mb-[1.5vh]">🏰</div>
            <div className="font-semibold text-[1vw] mb-[1vh]">标准占领效应</div>
            <div className="text-[0.85vw] opacity-65 leading-relaxed">
              乐言深耕电商AI八年，已发布"乐言GPT大模型"，全面接入DeepSeek，事实上成为ERP内置默认客服方案。
            </div>
          </motion.div>
        </div>
      </Slide>

      {/* 10. RPA Assessment Table */}
      <Slide kind="dark" chromeLeft="评估" chromeRight="10 / 16"
             footLeft="RPA = Robotic Process Automation" footRight="Act II · Assessment">
        <SectionTitle
          kicker="ASSESSMENT"
          title="当前RPA方案客观评估"
          lead={'结论：RPA方案本质上是\u201C用开发人力换接口权限\u201D，不具备规模化与可持续性。'}
        />
        <motion.div variants={item}>
          <table className="w-full border-collapse text-[0.9vw] mt-[2vh]">
            <thead>
              <tr>
                {['评估维度', '评级', '说明'].map((h, i) => (
                  <th key={i} className="text-left p-[1.2vh_1.5vw] border-b border-white/8 font-mono text-[9px] tracking-[0.15em] opacity-40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['稳定性', '❌ 差', '成功率≤95%，每周故障1-2次'],
                ['维护成本', '❌ 高', '每周4-6小时人力持续投入'],
                ['扩展性', '❌ 差', '单浏览器实例，无法支持高并发'],
                ['数据精度', '❌ 低', '无法获取底层结构化数据'],
                ['合规性', '⚠️ 灰色', '不违反明确条款，但依赖模拟操作'],
                ['技术债务', '❌ 高', '无法通过重构消除，持续性沉没成本'],
              ].map((row, i) => (
                <tr key={i}>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5 font-semibold">{row[0]}</td>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5" style={{ color: row[1].startsWith('❌') ? '#e04a3c' : '#d4a853' }}>{row[1]}</td>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5 opacity-65">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </Slide>

      {/* 11. Act Divider — 方案篇 */}
      <Slide kind="hero-dark" chromeLeft="第三幕" chromeRight="11 / 16">
        <ActDivider act="Act III" title="方案对比" lead="市场价格调研 + 投入产出分析。" />
      </Slide>

      {/* 12. Market Price Reference */}
      <Slide kind="dark" chromeLeft="市场参考" chromeRight="12 / 16"
             footLeft="数据来源：乐言科技官网 + 第三方平台收录" footRight="— · —">
        <SectionTitle
          kicker="MARKET REFERENCE"
          title="乐言Chat+ AI客服 · 公开定价"
          lead="面向跨境电商的轻量AI客服产品，支持GPT/DeepSeek驱动。"
        />
        <motion.div variants={item}>
          <table className="w-full border-collapse text-[0.9vw] mt-[2vh]">
            <thead>
              <tr>
                {['套餐', '月付', '年付', '核心配置'].map((h, i) => (
                  <th key={i} className="text-left p-[1.2vh_1.5vw] border-b border-white/8 font-mono text-[9px] tracking-[0.15em] opacity-40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['初创版', '¥70/月', '¥828/年', '1子账号 · AI回复1000单/月 · GPT/DeepSeek翻译无限'],
                ['基础版', '¥128/月', '¥1,518/年', '2子账号 · AI回复1500单/月'],
                ['进阶版', '¥250/月', '¥2,800/年', '4子账号 · AI回复2000单/月 · 促销机器人'],
                ['高阶版', '¥350/月', '¥4,200/年', '6子账号 · AI回复3000单/月'],
                ['旗舰版', '¥500/月', '¥5,800/年', '9子账号 · AI回复4000单/月'],
                ['企业版', '联系销售', '—', '无限子账号 · AI回复无限 · 私有知识库定制'],
              ].map((row, i) => (
                <tr key={i}>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5 font-semibold">{row[0]}</td>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5">{row[1]}</td>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5 font-semibold" style={{ color: 'var(--color-green-500, #3cb878)' }}>{row[2]}</td>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5 opacity-65">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
        <motion.div className="mt-[2vh] flex gap-[1vw]" variants={item}>
          <Tag>所有套餐支持无限店铺</Tag>
          <Tag color="var(--color-green-500, #3cb878)">GPT/DeepSeek驱动</Tag>
        </motion.div>
      </Slide>

      {/* 13. Cost Comparison */}
      <Slide kind="dark" chromeLeft="对比" chromeRight="13 / 16"
             footLeft="开发人力按市场价折算" footRight="Act III · ROI">
        <SectionTitle
          kicker="ROI ANALYSIS"
          title="投入产出对比"
        />
        <div className="grid grid-cols-2 gap-[3vh_3vw] mt-[3vh]">
          <motion.div className="rounded-lg border p-[3vh_2vw]" style={{ borderColor: 'rgba(224,74,60,0.3)', background: 'rgba(224,74,60,0.06)' }} variants={item}>
            <div className="font-mono text-[9px] tracking-[0.15em] uppercase mb-[2vh]" style={{ color: '#e04a3c' }}>当前RPA方案</div>
            <div className="space-y-[1.5vh] text-[0.95vw] opacity-80">
              <div>· 年化维护：200-300小时</div>
              <div>· 隐性人力成本：¥40,000-80,000/年</div>
              <div>· 稳定性：每周故障</div>
              <div>· 功能：基础问答，无AI大模型</div>
              <div>· 扩展性：难以扩展</div>
              <div>· 技术债务：持续累积</div>
            </div>
          </motion.div>
          <motion.div className="rounded-lg border p-[3vh_2vw]" style={{ borderColor: 'rgba(60,184,120,0.3)', background: 'rgba(60,184,120,0.06)' }} variants={item}>
            <div className="font-mono text-[9px] tracking-[0.15em] uppercase mb-[2vh]" style={{ color: '#3cb878' }}>采购乐言Chat+</div>
            <div className="space-y-[1.5vh] text-[0.95vw] opacity-80">
              <div>· 年费：¥828-5,800/年</div>
              <div>· 直接花费：仅为RPA隐性成本的1/10</div>
              <div>· 稳定性：企业级SLA</div>
              <div>· 功能：GPT/DeepSeek驱动，AI回复+跟单</div>
              <div>· 扩展性：随时升级套餐</div>
              <div>· 技术债务：无</div>
            </div>
          </motion.div>
        </div>
        <motion.div className="text-center mt-[4vh] text-[1.2vw] font-bold" style={{ color: '#3cb878' }} variants={item}>
          年化隐性成本（¥40K-80K）vs 年费（¥828-5,800） — RPA反而更贵
        </motion.div>
      </Slide>

      {/* 14. Four Solutions */}
      <Slide kind="dark" chromeLeft="方案建议" chromeRight="14 / 16"
             footLeft="推荐优先级：路线二 > 路线一 > 路线三 > 路线四" footRight="— · —">
        <SectionTitle
          kicker="SOLUTIONS"
          title="四条解决路线"
        />
        <div className="space-y-[2vh]">
          {[
            {
              num: '01', title: '商务谈判获取API授权', tag: '推荐 · 1-3月', tagColor: '#3cb878',
              desc: '由高管与ERP生态部门正式接洽，以"仅内部集成"为由申请API授权。从根源解决生态壁垒问题。',
            },
            {
              num: '02', title: '采购乐言Chat+', tag: '备选 · 1-2周', tagColor: '#d4a853',
              desc: '¥828-5,800/年，GPT/DeepSeek驱动。快速止血方案，但本质是绕开问题而非解决问题。',
            },
            {
              num: '03', title: '迁移至开放型ERP', tag: '中期 · 2-3月', tagColor: '#d4a853',
              desc: '调研提供开放API/Webhook的ERP系统。一劳永逸摆脱生态锁定，需预留迁移预算。',
            },
            {
              num: '04', title: '继续RPA现状', tag: '不推荐', tagColor: '#e04a3c',
              desc: '开发资源持续沉没，业务稳定性风险累积。仅作为最后备选方案。',
            },
          ].map((sol, i) => (
            <motion.div
              key={i}
              className="flex items-start gap-[1.5vw] rounded-lg border border-white/6 p-[2vh_2vw]"
              style={{ background: 'rgba(255,255,255,0.03)' }}
              variants={item}
            >
              <div className="font-mono font-semibold text-[16px] min-w-[36px]" style={{ color: sol.tagColor }}>{sol.num}</div>
              <div className="flex-1">
                <div className="flex items-center gap-[1vw] mb-[0.5vh]">
                  <span className="font-semibold text-[1.1vw]">{sol.title}</span>
                  <span className="font-mono text-[8px] tracking-[0.15em] px-[10px] py-[3px] border rounded-full"
                        style={{ borderColor: sol.tagColor, color: sol.tagColor }}>{sol.tag}</span>
                </div>
                <div className="text-[0.9vw] opacity-65 leading-relaxed">{sol.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </Slide>

      {/* 15. Summary Table */}
      <Slide kind="dark" chromeLeft="总结" chromeRight="15 / 16"
             footLeft="数据驱动决策" footRight="Act III · Summary">
        <SectionTitle
          kicker="SUMMARY"
          title="方案总结矩阵"
        />
        <motion.div variants={item}>
          <table className="w-full border-collapse text-[0.9vw]">
            <thead>
              <tr>
                {['方案', '短期成本', '长期成本', '稳定性', '推荐度'].map((h, i) => (
                  <th key={i} className="text-left p-[1.2vh_1.5vw] border-b border-white/8 font-mono text-[9px] tracking-[0.15em] opacity-40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['商务谈判API', '中（商务投入）', '低', '⭐⭐⭐⭐⭐', '★★★★☆'],
                ['采购乐言Chat+', '低（¥828-5,800/年）', '极低', '⭐⭐⭐⭐⭐', '★★★☆☆'],
                ['迁移开放ERP', '高（迁移成本）', '低', '⭐⭐⭐⭐', '★★★☆☆'],
                ['继续RPA现状', '低（名义上）', '极高（人力沉没）', '⭐☆☆☆☆', '☆☆☆☆☆'],
              ].map((row, i) => (
                <tr key={i}>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5 font-semibold">{row[0]}</td>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5">{row[1]}</td>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5" style={{ color: row[2] === '极低' || row[2] === '低' ? '#3cb878' : '#e04a3c' }}>{row[2]}</td>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5">{row[3]}</td>
                  <td className="p-[1.2vh_1.5vw] border-b border-white/5">{row[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </Slide>

      {/* 16. CTA */}
      <Slide kind="hero-dark" chromeLeft="建议" chromeRight="16 / 16">
        <HeroQuestion
          kicker="RECOMMENDATION"
          titleLines={[
            'RPA不是技术问题，',
            '是生态壁垒问题。',
            '治本之道：',
            '拿回API主动权。',
          ]}
          lead={'技术建议：优先推进路线二（商务谈判获取API授权），以“仅内部集成”为由争取合法接口。若谈判受阻，评估迁移至开放型ERP，从根本上摆脱生态锁定。'}
        />
      </Slide>
    </SlideDeck>
  )
}
