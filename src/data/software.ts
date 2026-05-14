import type { Software } from "@/types/software"

export const softwareList: Software[] = [
  {
    id: "tf-service",
    name: "TF客服值守",
    description: "自动客服值守工具，智能应答与工单处理",
    iconName: "Terminal",
    category: "效率工具",
    versions: [
      {
        version: "3.4.3",
        releaseDate: "2026-05-13",
        isLatest: true,
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
    description: "Web 端退货退款流程处理工具，统一管理退货审批、退款核对与状态追踪",
    iconName: "RefreshCw",
    category: "Web 工具",
    versions: [
      {
        version: "0.1.0",
        releaseDate: "2026-05-13",
        isLatest: true,
        changelog: ["首个开发版本", "退货工作流页面框架搭建"],
        workbenchUrl: "/return-workflow",
      },
    ],
  },
  {
    id: "a-shity-helper",
    name: "A Shity Helper",
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
]
