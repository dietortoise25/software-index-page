import type { Article } from "@/types/article"
import { markdownToArticle } from "@/lib/markdown"

// ── 硬编码的系统公告 ──
const systemArticles: Article[] = [
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
  {
    id: "automation-vision",
    title: "运营自动化的思考：为什么我们需要工具化",
    summary: "日常运营中存在大量重复性工作，通过工具化和自动化可以将人力从重复劳动中释放，聚焦高价值决策。",
    date: "2026-05-08",
    author: "Alan",
    tags: ["思考"],
    content: "在日常运营工作中，我们发现了大量的重复性场景：客服应答、数据报表生成、告警响应、流程审批……这些工作占用了运营同学大量时间。我们认为，凡是能被规则描述的工作，最终都应该交给机器完成。这也是建设这个工具发布站的初衷——让自动化能力被更多人发现和使用。",
  },
  {
    id: "roadmap",
    title: "后续规划：更多自动化工具在路上",
    summary: "未来我们将陆续发布数据报表自动生成、多渠道消息推送、智能告警响应等工具，敬请期待。",
    date: "2026-05-07",
    author: "Alan",
    tags: ["规划"],
    content: "根据前期收集到的需求，接下来计划发布的工具包括：数据报表自动生成器（支持飞书/邮件定时推送）、多渠道消息推送平台、智能告警响应引擎、运营 SOP 流程编排工具。如果你有希望被自动化的场景，欢迎提交需求告诉我们。",
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
