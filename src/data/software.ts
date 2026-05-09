import type { Software } from "@/types/software"

export const softwareList: Software[] = [
  {
    id: "data-analyzer",
    name: "Data Analyzer",
    description: "内部数据分析和可视化工具，支持多数据源接入和自动化报表生成",
    iconName: "BarChart3",
    category: "数据分析",
    homepageUrl: "https://git.internal.company.com/data-analyzer",
    versions: [
      {
        version: "2.1.0",
        releaseDate: "2026-05-01",
        isLatest: true,
        changelog: [
          "新增 CSV/Excel 多格式导出功能",
          "优化大数据量下的图表渲染性能",
          "修复筛选条件在页面刷新后重置的问题",
          "数据源连接支持 OAuth2 认证",
        ],
        downloads: {
          windows: "https://cdn.internal.company.com/data-analyzer/data-analyzer-2.1.0-win.exe",
          macos: "https://cdn.internal.company.com/data-analyzer/data-analyzer-2.1.0-mac.dmg",
          linux: "https://cdn.internal.company.com/data-analyzer/data-analyzer-2.1.0-linux.AppImage",
        },
        workbenchUrl: "https://data-analyzer.internal.company.com",
      },
      {
        version: "2.0.0",
        releaseDate: "2026-03-15",
        changelog: [
          "全新仪表盘视图，支持拖拽布局",
          "支持实时数据流接入与监控",
          "UI 全面升级至新设计语言",
          "新增暗色模式支持",
        ],
        downloads: {
          windows: "https://cdn.internal.company.com/data-analyzer/data-analyzer-2.0.0-win.exe",
          macos: "https://cdn.internal.company.com/data-analyzer/data-analyzer-2.0.0-mac.dmg",
        },
      },
      {
        version: "1.5.0",
        releaseDate: "2026-01-10",
        changelog: [
          "修复大数据量导出时内存溢出问题",
          "新增柱状图和饼图类型",
          "优化首次加载速度",
        ],
      },
    ],
  },
  {
    id: "report-generator",
    name: "Report Generator",
    description: "一键生成周报、月报和季度报告，支持自定义模板和自动分发",
    iconName: "FileText",
    category: "效率工具",
    homepageUrl: "https://git.internal.company.com/report-generator",
    versions: [
      {
        version: "1.3.0",
        releaseDate: "2026-04-20",
        isLatest: true,
        changelog: [
          "新增飞书消息推送集成",
          "支持 Markdown 和 HTML 模板",
          "修复邮件发送中文编码问题",
          "新增定时自动生成功能",
        ],
        workbenchUrl: "https://report-gen.internal.company.com",
      },
      {
        version: "1.2.0",
        releaseDate: "2026-02-28",
        changelog: [
          "新增 PDF 导出功能",
          "报告模板市场上线",
          "支持多人协作编辑报告",
        ],
        workbenchUrl: "https://report-gen.internal.company.com",
      },
    ],
  },
  {
    id: "devops-panel",
    name: "DevOps Panel",
    description: "统一的运维管理面板，涵盖部署、监控、日志查询和告警配置",
    iconName: "Terminal",
    category: "运维工具",
    versions: [
      {
        version: "3.0.0",
        releaseDate: "2026-05-05",
        isLatest: true,
        changelog: [
          "全新 Kubernetes 集群管理界面",
          "实时日志流支持全文搜索",
          "告警规则支持表达式语法",
          "新增团队资源配额管理",
        ],
        workbenchUrl: "https://devops-panel.internal.company.com",
      },
      {
        version: "2.5.1",
        releaseDate: "2026-03-01",
        changelog: [
          "修复 WebSocket 断连重连问题",
          "日志查询性能提升 50%",
          "新增 Docker 容器状态概览",
        ],
        downloads: {
          windows: "https://cdn.internal.company.com/devops-panel/devops-panel-2.5.1-win.exe",
          macos: "https://cdn.internal.company.com/devops-panel/devops-panel-2.5.1-mac.dmg",
        },
      },
    ],
  },
  {
    id: "config-center",
    name: "Config Center",
    description: "统一的配置管理中心，支持多环境配置下发和灰度发布",
    iconName: "Settings2",
    category: "基础设施",
    versions: [
      {
        version: "1.0.0",
        releaseDate: "2026-04-10",
        isLatest: true,
        changelog: [
          "首个正式版本发布",
          "支持配置版本管理和回滚",
          "配置变更实时推送至客户端",
          "接入 SSO 统一认证",
        ],
        workbenchUrl: "https://config-center.internal.company.com",
      },
    ],
  },
  {
    id: "api-gateway",
    name: "API Gateway Console",
    description: "API 网关管理后台，管理路由、限流、鉴权和 API 文档发布",
    iconName: "Network",
    category: "基础设施",
    versions: [
      {
        version: "2.3.0",
        releaseDate: "2026-04-28",
        isLatest: true,
        changelog: [
          "新增 API 编排功能（支持请求聚合）",
          "限流策略支持自定义时间段",
          "API 文档自动生成和发布",
          "请求链路追踪集成 OpenTelemetry",
        ],
        workbenchUrl: "https://api-gateway.internal.company.com",
      },
      {
        version: "2.2.0",
        releaseDate: "2026-02-15",
        changelog: [
          "新增 JWT 鉴权插件",
          "路由匹配性能优化",
          "支持 gRPC 协议转发",
        ],
        workbenchUrl: "https://api-gateway.internal.company.com",
      },
    ],
  },
]
