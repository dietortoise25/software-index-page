import type { Software } from "@/types/software"

export const softwareList: Software[] = [
  {
    id: "douyin-tool",
    name: "达人私信助手",
    description: "抖音达人私信自动化工具，批量触达 + 智能回复",
    iconName: "Video",
    category: "效率工具",
    requirePin: true,
    versions: [
      {
        version: "1.0.0",
        releaseDate: "2026-05-22",
        isLatest: true,
        changelog: ["首个发布版本", "支持批量私信触达", "智能回复模板"],
        downloads: {
          windows: "http://42.193.170.109/downloads/douyin_tool.zip",
        },
      },
    ],
  },
  {
    id: "tf-service",
    name: "TF客服值守",
    description: "自动客服值守工具，智能应答与工单处理",
    iconName: "Terminal",
    category: "效率工具",
    versions: [
      {
        version: "3.6.1",
        releaseDate: "2026-05-27",
        isLatest: true,
        changelog: ["v3.6.0 小 bug 修复"],
        downloads: {
          windows: "http://42.193.170.109/downloads/TF客服值守v3.6.1.zip",
        },
      },
      {
        version: "3.6.0",
        releaseDate: "2026-05-26",
        isLatest: false,
        changelog: [
          "AI上下文精简：删除客户列表注入，用户消息减少约80%，token消耗大幅降低",
          "人工待处理升级：点击条目直接跳转到对应对话 + 显示客户最后一条消息文本摘要",
          "输入框适配：改用placeholder属性匹配，不再依赖不稳定的hash类名",
          "重试机制修复：AI不用工具时提醒追加到user message末尾，工具调用遵循率更高",
          "物流卡片防护：无订单客户不尝试发送 + 物流卡片失败后自动拦截虚假回复并升级人工",
        ],
        downloads: {
          windows: "http://42.193.170.109/downloads/TF客服值守v3.6.0.zip",
        },
      },
      {
        version: "3.5.0",
        releaseDate: "2026-05-19",
        isLatest: false,
        changelog: [
          "AI回复质量：程序接管回复决策权，AI只管生成文字；AI忘用工具时自动重试；客户只发产品卡片也能识别",
          "人工待处理面板：侧边栏新增红色升级列表，AI判断需人工介入时显示客户名/原因/时间，支持一键解除",
          "Shopee物流卡片：自动识别Shopee专属流程，多步操作自动完成；发了卡片忘写文字程序自动补发",
          "对话识别增强：产品卡片不再漏掉；其他插件自动回复可识别；切换对话按客户名定位不再点错",
          "稳定性大幅提升：热重载不再报错；回复去重存到浏览器存储；对话列表自动刷新；消息区域自动滚动加载",
        ],
        downloads: {
          windows: "http://42.193.170.109/downloads/TF客服值守v3.5.0.zip",
        },
      },
      {
        version: "3.4.3",
        releaseDate: "2026-05-13",
        isLatest: false,
        changelog: [
          "双层日志系统：用户侧边栏显示轻量运行日志，开发者完整日志隐藏在后台，点击「导出调试日志」按钮可下载完整 txt 文件用于排查 bug",
          "非中文界面值守失效修复：每次开始处理前自动检测界面语言，非中文简体时自动切换，确保识别正常",
          "开关状态显示修复：修复未开启 AI 值守时侧边栏开关显示「运行中」的问题",
          "稳定性修复：修复特定情况下导致插件崩溃报错的问题",
        ],
        downloads: {
          windows: "http://42.193.170.109/downloads/TF客服值守v3.4.3.zip",
        },
      },
      {
        version: "3.4.1",
        releaseDate: "2026-05-11",
        isLatest: false,
        changelog: [
          "自动发送物流卡片：客户询问物流时AI自动点击发送物流卡片",
          "防止无效回复：拦截AI的空洞无意义回复，不再发送给客户",
          "非中文界面值守适配：自动检测并切换至中文简体，确保识别正常",
          "开关状态显示修复：开启/关闭状态与侧边栏显示保持一致",
          "日志面板优化：更清晰展示AI操作和拦截记录",
        ],
        downloads: {
          windows: "http://42.193.170.109/downloads/TF客服值守v3.4.1.zip",
        },
      },
      {
        version: "0.1.2",
        releaseDate: "2026-05-09",
        isLatest: false,
        changelog: [
          "首个发布版本",
          "支持自动客服应答",
          "智能工单处理功能",
        ],
        downloads: {
          windows: "http://42.193.170.109/downloads/TF-Service-0.1.2.zip",
        },
      },
    ],
  },
  {
    id: "return-workflow",
    name: "退货工作流",
    description: "Beta · Web 端退货退款流程处理工具，上传退单 Excel 自动分类录入飞书多维表格。ERP 导出建议单次 ≤500 条，图片上传需等待较久。未来版本将通过接口实现完全自动化。",
    iconName: "RefreshCw",
    category: "Web 工具",
    versions: [
      {
        version: "1.3.0-beta",
        releaseDate: "2026-05-14",
        isLatest: true,
        changelog: [
          "Beta 发布：支持 TikTok/Shopee 退单 Excel 自动解析录入",
          "图片自动上传飞书多维表格附件字段",
          "可视化配置面板：飞书连接、表格映射、运行参数",
          "处理进度实时展示：去重计数、待入库数、下载+上传进度",
        ],
        workbenchUrl: "/return-workflow",
      },
    ],
  },
  {
    id: "ecommerce-pricing-calc",
    name: "电商定价计算器",
    description: "电商平台定价计算 Chrome 扩展，支持新规企业定价、达人佣金定价、折扣计算等场景",
    iconName: "Calculator",
    category: "浏览器扩展",
    versions: [
      {
        version: "1.0.0",
        releaseDate: "2026-05-25",
        isLatest: true,
        changelog: [
          "首个发布版本",
          "新规企业定价：根据平台新规自动计算企业定价",
          "达人佣金定价：支持达人合作佣金测算",
          "折扣计算：多种折扣方案快速计算对比",
          "Chrome 扩展形式，弹窗 + 浮动窗口双界面",
        ],
        downloads: {
          windows: "http://42.193.170.109/downloads/电商定价计算器 1.0.0.zip",
        },
      },
    ],
  },
  {
    id: "ai-requirement",
    name: "AI 需求助手",
    description: "AI 驱动的需求收集与排期助手，4 阶段引导式对话 + 飞书日历智能排期 + 审查面板流转",
    iconName: "MessageSquare",
    category: "Web 工具",
    versions: [
      {
        version: "2.0.0",
        releaseDate: "2026-05-12",
        isLatest: true,
        changelog: [
          "AI 流式对话：接入 DeepSeek 大模型，实时打字机效果",
          "4 阶段引导式需求收集：背景 → 目标 → 细节 → 排期",
          "飞书日历智能排期：自动读取空闲时段，生成开发日程",
          "用户上下文注入：根据角色（访客/内部用户/管理员）差异化回复",
          "需求提交 → 审查面板流转：提交后进入审批流程，通过后飞书通知",
          "浮动按钮入口：全站右下角一键唤起对话框",
          "未登录引导：访客点击后跳转登录页，不再直接报错",
        ],
      },
    ],
  },
  {
    id: "ai-copilot",
    name: "AI 经营 Copilot",
    description: "Mock · AI 驱动的电商经营智能助手仪表盘，事件流监控 + ChatBI 问答 + 经营日报 + 可配置分析 Skills",
    iconName: "Brain",
    category: "Web 工具",
    versions: [
      {
        version: "0.1.0-mock",
        releaseDate: "2026-05-19",
        isLatest: true,
        changelog: [
          "前端 Mock 演示版本",
          "事件流面板：业务异常实时监控（ROI/销量/库存/广告/利润），AI 归因分析 + 行动建议",
          "ChatBI 面板：自然语言问答，支持 GMV/利润/库存等多维度查询",
          "经营日报面板：每日 9:00 自动生成，GMV 概览 + Top SKU 利润贡献表",
          "Skills 面板：固化分析能力，支持启用/停用、新增自定义 Skill",
          "设置面板：异常阈值配置 + 推送渠道管理（飞书/邮件）",
          "左侧导航栏：事件流 / ChatBI / 日报 / Skills / 设置五视图切换",
        ],
        workbenchUrl: "/future",
      },
    ],
  },
  {
    id: "brazil-profit-calculator",
    name: "巴西电商利润计算器",
    description: "Shopee & TikTok Shop 巴西站利润成本计算，支持 Simples Nacional 税务 + 多费用项",
    iconName: "Calculator",
    category: "Web 工具",
    versions: [
      {
        version: "1.0.0",
        releaseDate: "2026-06-02",
        isLatest: true,
        changelog: ["Shopee CNPJ 费率（2026.3.1起）", "TikTok Shop 费率", "Simples Nacional 税务计算", "多费用项支持"],
        workbenchUrl: "/brazil-profit-calculator",
      },
    ],
  },
  {
    id: "a-shity-helper",
    name: "淘宝/天猫商品数据采集器",
    description: "淘宝/天猫商品数据采集 Chrome 扩展，支持单品、批量采集与智能反风控",
    iconName: "BarChart3",
    category: "浏览器扩展",
    versions: [
      {
        version: "0.1.3",
        releaseDate: "2026-05-11",
        isLatest: true,
        changelog: [
          "单品采集：商品详情页一键提取标题、价格、SKU、主图、详情图",
          "批量采集：搜索/列表页批量提取，支持自动翻页",
          "智能反风控：零注入架构，模拟人类浏览行为，降低触发验证码风险",
          "SKU面板数据提取：解析淘宝SKU列表（规格、价格、库存）",
          "JSON导出：采集结果导出为schema.json格式，兼容妙手/店八方等模板",
          "多主题：Ocean Breeze + Midnight Bloom 暗色双主题",
          "选项页：自定义反风控参数",
        ],
        downloads: {
          windows: "http://42.193.170.109/downloads/a-shity-helper-0.1.3.zip",
        },
      },
    ],
  },
  {
    id: "shopee-analyzer",
    name: "Shopee 数据分析",
    description: "Shopee 巴西店铺数据 ETL + ROI 诊断工具，上传 Excel/CSV → 指标计算 → 健康评分 → 预算模拟",
    iconName: "Network",
    category: "Web 工具",
    versions: [
      {
        version: "2.1.0",
        releaseDate: "2026-05-25",
        isLatest: true,
        changelog: [
          "多文件诊断：上传店铺统计 Excel + 广告 CSV + 订单明细，一次获取完整报告",
          "8 维度健康评分卡：预算效率/取消率/复购率/店铺转化/商品集中度/新客依赖/广告浪费/广告CTR",
          "可执行问题清单：逐条标注严重等级 + 影响金额 + 操作建议",
          "预算模拟：零转化预算重分配模拟，对比 baseline vs optimized ROAS",
          "诊断规则可配：阈值/开关/严重等级实时调整，即时生效",
          "4 维度明细查阅：销售日趋势/流量漏斗/商品帕累托/用户资产",
          "数据补位策略：订单明细为可信数据源，自动补位聚合行缺失",
        ],
        workbenchUrl: "/shopee",
      },
    ],
  },
]
