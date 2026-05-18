export interface ChangelogEntry {
  version: string
  date: string
  title: string
  items: Array<{ type: "new" | "fix" | "change"; text: string }>
}

export const changelog: ChangelogEntry[] = [
  {
    version: "v2.0.1",
    date: "2026-05-18",
    title: "代码结构重构 + 鲁棒性修复 + 版本管理规范化",
    items: [
      { type: "fix", text: "存储层修复：Promise链锁缺陷、原子写入(防崩溃)、3级轮转备份(防数据丢失)" },
      { type: "fix", text: "限流器内存泄漏修复：定期清理过期Map条目" },
      { type: "fix", text: "飞书token缓存并发保护：pending Promise去重机制" },
      { type: "change", text: "server入口拆分为pin/quick-form独立路由，添加全局错误处理中间件" },
      { type: "change", text: "前端新建API请求层 + useDashboardFilter筛选状态hook" },
      { type: "change", text: "版本号统一为v2.0.0（constants/changelog/package.json对齐），创建git tag" },
      { type: "change", text: "TS target统一为ES2022，移除sync方法竞态风险" },
    ],
  },
  {
    version: "v2.0.0",
    date: "2026-05-15",
    title: "千易ERP数据中台 + 订单看板 + 运营管理 + 广告费用分析",
    items: [
      { type: "new", text: "千易ERP数据中台：TypeScript SDK + Supabase定时同步 + 系统守护进程" },
      { type: "new", text: "订单看板：日/月GMV对比、渠道分析(平台环形图/柱状图)、运营者排行、订单健康度" },
      { type: "new", text: "内部管理：运营分组/人员/店铺绑定 CRUD + PIN认证" },
      { type: "new", text: "广告费用分析：千易交易报表→广告费汇总表 + 费用率趋势" },
      { type: "new", text: "Excel店铺绑定批量导入 + 14人运营团队seed" },
      { type: "new", text: "一键部署脚本 ./deploy.sh + Node v22升级" },
      { type: "new", text: "数据字典 src/data/metrics-dictionary.ts：22个指标独立维护，看板全指标接入 shadcn Tooltip 气泡提示" },
      { type: "fix", text: "广告费同步修复：正确传参 shopIdList/payoutTime、绝对值、31天分片" },
      { type: "new", text: "dev 模式自动跳过 PIN 认证（import.meta.env.DEV），生产环境正常鉴权" },
      { type: "change", text: "部署脚本端口清理（fuser -k 8765）防止 relay 重启失败" },
      { type: "change", text: "数据库：新增 internal schema（运营管理）+ public.ad_costs（广告费）" },
    ],
  },
  {
    version: "v1.2.0",
    date: "2026-05-12",
    title: "审批闭环 + 日历日程 + 安全加固 + E2E 自动化测试",
    items: [
      { type: "new", text: "审批确认对话框：通过需二次确认，驳回用内联输入框替代浏览器弹窗" },
      { type: "new", text: "审批通过后自动在飞书日历创建开发排期日程（支持多阶段）" },
      { type: "new", text: "飞书通知闭环：提交/审批/驳回均推送飞书消息" },
      { type: "new", text: "审查面板搜索功能 + 审查时间显示" },
      { type: "new", text: "Playwright E2E 自动化测试脚本，27 项覆盖普通用户和管理员双角色旅程" },
      { type: "fix", text: "PIN 安全加固：强制设置、暴力破解限流、不再通过 URL 传递" },
      { type: "fix", text: "审批操作原子性 + JSON 存储互斥锁防止并发覆盖" },
      { type: "fix", text: "AI 聊天提交成功改为手动关闭，不再自动消失" },
      { type: "fix", text: "排期加载 30 秒超时保护 + AI 错误状态处理" },
      { type: "fix", text: "需求列表按时间降序排列 + React hooks 顺序修复" },
      { type: "change", text: "审查面板「锁定」→「退出管理者模式」" },
      { type: "change", text: "飞书日历日程创建在机器人主日历，Alan 已添加为成员可直接编辑" },
    ],
  },
  {
    version: "v1.1.0",
    date: "2026-05-12",
    title: "需求审查面板 + 智能排期 + 移动端优化",
    items: [
      { type: "new", text: "AI 需求助手可读取飞书日历空闲时段，智能生成开发排期" },
      { type: "new", text: "新增 /review 需求审查面板，PIN 码保护，管理员可审批/驳回/重新排期" },
      { type: "new", text: "审批通过后自动在飞书日历创建日程事件" },
      { type: "new", text: "新增 /changelog 更新日志页面" },
      { type: "fix", text: "修复 Header 在手机端不可见的问题，新增汉堡菜单" },
      { type: "fix", text: "AI 对话需求提交改为存入审查面板，Alan 审批后才发送飞书卡片" },
      { type: "fix", text: "快速表单提交的需求同步写入审查面板" },
      { type: "change", text: "飞书需求卡片从纯文本升级为互动卡片格式" },
      { type: "change", text: "浮动按钮添加文字标签（AI 需求助手 / 提交需求）" },
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-05-10",
    title: "初始发布",
    items: [
      { type: "new", text: "软件工具发布站上线，支持工具库浏览和下载" },
      { type: "new", text: "AI 需求助手：4 阶段引导式需求收集" },
      { type: "new", text: "快速需求提交表单" },
      { type: "new", text: "文章系统：支持 Markdown 文章发布" },
      { type: "new", text: "Ocean Breeze 主题，支持暗色模式" },
      { type: "new", text: "首页动态 Hero 区域：计数动画、渐变光晕" },
    ],
  },
]
