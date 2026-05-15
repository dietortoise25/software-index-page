import type { Article } from "@/types/article"
import { markdownToArticle } from "@/lib/markdown"

// ── 硬编码的系统公告 ──
const systemArticles: Article[] = [
  {
    id: "erp-data-hub-v2",
    title: "千易ERP数据中台 v2.0 上线：订单看板 + 广告费用分析 + 运营管理",
    summary: "从零搭建的ERP数据底座正式投产。41,630条订单、2,938个SKU、27家店铺数据实时同步，新增5层交互式看板（营收/渠道/运营者/健康度/广告费），内部运营人员管理与店铺绑定系统上线。",
    date: "2026-05-15",
    author: "Alan",
    tags: ["发布", "数据", "内部"],
    content: `经过两周密集开发，千易ERP数据中台正式投产。核心交付：

**数据层**：TypeScript SDK 封装千易 OpenAPI（14个模块），Supabase 定时同步（订单5分钟/商品30分钟），系统守护进程 7×24 运行。

**看板**（/dashboard）：5层交互式分析——营收总览（日/月 GMV + 趋势曲线）、渠道分析（TikTok vs Shopee 环形图 + 柱状图）、运营者排行（月度 GMV Top 8）、订单健康度（状态分布 + 退货率）、广告费用分析（达人佣金/费用率/趋势）。全部指标支持平台/运营者二级筛选，含数据字典气泡提示。

**内部管理**（/internal/admin）：运营分组、人员管理、店铺绑定 CRUD，数据来自 Excel 导入的14人运营团队。支持 PIN 码鉴权。

**广告费用**：对接千易交易明细报表，自动汇总达人佣金、AMS佣金到 ad_costs 表，每日凌晨2点自动同步。首月 TikTok 达人佣金 BRL 36,455。

**技术栈**：React 19 + TypeScript + Recharts + shadcn/ui（@base-ui）+ Supabase + Node.js 定时调度。<br><br><a href="/dashboard" style="color:#2563eb;font-weight:600;text-decoration:underline">📊 打开订单看板</a>`,
  },
  {
    id: "erp-data-warehouse-proposal",
    title: "内部提案：轻量级ERP数仓，驱动智能体实现数据决策自动化",
    summary: "一份面向管理层的推销报告，提出用 Supabase + 千易ERP 构建低成本数据底座，赋能库存预警、异常订单监控、战报机器人等内部智能体。总投入低于2万元，3周可见首期效果。",
    date: "2026-05-13",
    author: "Alan",
    tags: ["内部", "数据", "提案"],
    content: '我们每天有大量ERP数据在"沉睡"——断货损失、客服低效查询、手工报表消耗运营精力。这份提案提出了一套轻量级方案：用 Supabase（基于PostgreSQL的开源BaaS）作为中转数仓，对接千易ERP API，构建低代码、低成本、可扩展的数据底座。首期聚焦库存预警助手（3周上线），后续按需叠加异常订单监控、每日战报机器人、客服自然语言查询Bot、智能补货建议等5个应用场景。总实施时间约6-7周，首年总成本约2.2万元（含人力），对比传统数仓动辄十几万的投入，第一个月即可回本。<br><br><a href="/ppt/erp-data-warehouse" style="color:#2563eb;font-weight:600;text-decoration:underline">📎 查看完整演示文稿（13页横向翻页PPT）</a>',
  },
  {
    id: "welcome",
    title: "Alan 运营工具发布站正式上线",
    summary: "经过一段时间的筹备，运营自动化工具发布站正式上线，首批工具已开放下载，欢迎同事们试用和提交需求。",
    date: "2026-05-09",
    author: "Alan",
    tags: ["公告"],
    content: "经过一段时间的筹备，运营自动化工具发布站正式上线。站点汇聚了公司内部的各类运营自动化工具，支持下载、在线使用和需求提交。首批上线的工具涵盖客服值守、流程编排、数据分析等场景，后续将持续更新。欢迎同事们通过右下角悬浮按钮提交你的自动化需求。",
  },
  {
    id: "tf-service-v3.4.1",
    title: "TF客服值守 v3.4.1 更新：物流卡片自动发送、无效回复拦截",
    summary: "v3.4.1 正式发布，新增物流卡片自动发送、防止AI无效回复、非中文界面自动适配等多项改进。",
    date: "2026-05-11",
    author: "Alan",
    tags: ["发布", "工具"],
    content: 'TF客服值守 v3.4.1 更新亮点：客户询问物流/快递进度时，AI会自动点击发送物流卡片按钮并回复引导文字，无需人工操作。新增无效回复防护层，AI尝试发送「当前没有需要回复的」「无需操作」等无意义内容时自动拦截。修复了非中文ERP界面下值守失效的问题，现在自动检测并切换至中文简体。修复了开关状态显示错误和若干稳定性问题，日志面板也更清晰地展示AI操作记录。',
  },
  {
    id: "a-shity-helper-v0.1.3",
    title: "A Shity Helper v0.1.3 发布：淘宝/天猫数据采集扩展",
    summary: "首个浏览器扩展工具发布，支持淘宝/天猫商品数据单品及批量采集，内置智能反风控策略。",
    date: "2026-05-11",
    author: "Alan",
    tags: ["发布", "扩展"],
    content: "A Shity Helper 是一款 Chrome 扩展，用于淘宝/天猫的商品数据采集。核心功能包括：单品详情页一键提取标题、价格、SKU、主图和详情图；搜索/列表页批量采集并支持自动翻页；独有的智能反风控系统，采用零注入架构模拟人类浏览行为（随机滚动、延迟、悬停），有效降低触发验证码的风险；支持解析SKU面板数据及JSON导出，兼容妙手、店八方等导入模板；提供 Ocean Breeze 和 Midnight Bloom 暗色双主题，选项页可自定义反风控参数。",
  },
  {
    id: "tf-service-intro",
    title: "TF客服值守 v0.1.2 发布说明",
    summary: "首个自动客服值守工具发布，支持 7×24 智能应答、自动工单处理，有效降低运营人力成本。",
    date: "2026-05-09",
    author: "Alan",
    tags: ["发布", "工具"],
    content: "TF客服值守 v0.1.2 是面向运营团队的自动客服值守工具。核心能力包括：智能识别客户意图并自动应答、自动生成和分派工单、支持多轮对话上下文理解。当前版本为早期测试版，欢迎试用并反馈问题。",
  },
]

// ── 从 posts/ 目录自动加载的 .md 文章 ──
const postModules = import.meta.glob<{ default: string }>("/posts/*.md", {
  query: "?raw",
  eager: true,
})

const postArticles: Article[] = Object.entries(postModules).map(([, mod]) =>
  markdownToArticle(mod.default),
)

// ── 合并并按日期倒序排列 ──
export const articles: Article[] = [...systemArticles, ...postArticles].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
)
