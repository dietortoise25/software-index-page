# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

公司内部软件发布站 + 运营数据看板，面向全公司同事。包含工具发布、文章系统、AI需求助手、需求审查面板、订单看板、运营管理等功能。

## 技术栈

- **前端**: React 19 + Vite 8 + TypeScript 6 + Tailwind CSS v4 + shadcn/ui v4 + react-router v7
- **后端**: Express + TypeScript（端口 8765，systemd 服务名 `relay`）
- **数据中台**: 千易ERP SDK + 定时同步调度器（systemd 服务名 `qianyi-scheduler`）
- **数据库**: Supabase（前端直连 + 后端服务端使用）
- **AI**: DeepSeek API（通过 `@ai-sdk/deepseek`）
- **外部集成**: 飞书 API（消息推送、日历日程、审批回调）

## 开发命令

```bash
pnpm dev                    # 前端开发服务器 → http://localhost:5173
cd server && pnpm dev       # 后端开发服务器（tsx watch，端口 8765）
cd platform && pnpm dev     # 数据中台同步调度器（tsx watch）

# 不执行 pnpm build / pnpm tsc -b 等构建命令
```

Vite 代理配置：`/api/*` → `localhost:3001`（实际后端端口 8765，需确认），`/api/return-workflow` → `localhost:3002`。

## 项目结构

```
src/                         # 前端 SPA
├── App.tsx                  # 路由定义（react-router v7 BrowserRouter）
├── components/
│   ├── ui/                  # shadcn/ui 基础组件（button/card/dialog/table 等）
│   ├── layout/              # Header / Footer / Layout（含 Outlet）
│   ├── software/            # 软件卡片/搜索/下载/版本时间线
│   ├── chat/                # AI 需求对话（ChatDialog + MessageBubble + TypingIndicator）
│   ├── dashboard/           # 运营看板（Revenue/Channel/OrderHealth/AdCost/OperatorRanking）
│   ├── review/              # 需求审查面板
│   └── common/              # EmptyState / RequirementDialog
├── pages/                   # 页面级组件
├── hooks/                   # useSoftwareFilter / useDarkMode
├── data/                    # 静态数据源
│   ├── software.ts          # 软件列表（编辑此文件发布新版本）
│   ├── articles.ts          # Markdown 文章
│   ├── changelog.ts         # 版本更新日志（发布新版本后需更新）
│   └── metrics-dictionary.ts # 看板22个指标的数据字典
├── lib/                     # supabase客户端 / markdown渲染 / 工具函数
└── types/                   # TypeScript 类型定义

server/src/                  # Express 后端
├── index.ts                 # 服务入口：路由挂载 + PIN验证 + 快速表单提交
├── routes/                  # 按功能拆分路由
│   ├── chat.ts              # AI 对话（DeepSeek）
│   ├── generate-requirement.ts # AI 结构化需求生成 + 飞书卡片
│   ├── calendar.ts          # 飞书日历排期查询
│   ├── requirements.ts      # 需求 CRUD（JSON文件存储 + 互斥锁）
│   ├── internal.ts          # 运营管理 CRUD
│   └── approval.ts          # 审批流程 + 飞书审批Webhook回调
└── lib/                     # feishu SDK / rate-limit / storage / AI prompts

platform/src/                # 千易ERP数据中台
├── sdk/                     # 千易ERP API 的 TypeScript SDK
└── sync/                    # 定时同步 → Supabase（scheduler / full_sync）
```

## 关键设计决策

- **数据存储**: 需求审查数据使用服务器端 JSON 文件（`server/src/lib/storage.ts`），无数据库依赖；运营数据使用 Supabase
- **路径别名**: `@/` 映射到 `./src/`（前端）；`@/` 可跨项目复用
- **飞书集成**: 消息用 tenant token → open_id 私聊推送；日历日程创建在机器人主日历；审批回调通过 Webhook
- **部署**: Git push → GitHub Actions 自动构建前端 + rsync 部署。插件 ZIP 用 `bash scripts/deploy.sh` 上传。完整后端部署用 `bash scripts/deploy-full.sh`。前端由 Nginx 托管，后端 systemd 守护
- **环境变量**: `.env` 文件包含所有密钥配置，`.gitignore` 已排除 `.env`；`.env.example` 为模板
- **PIN保护**: 审查面板通过 PIN 码认证，带 IP 限流（60秒5次），dev 模式自动跳过
- **Tailwind v4**: 使用 `@theme inline` 设计令牌，自定义颜色通过 CSS 变量，禁止硬编码
- **图标**: 使用 lucide-react，不自行创建 SVG
- **包管理**: pnpm

## 开发规范：TDD（本项目强制执行）

所有功能开发、Bug 修复、重构、行为变更都必须遵循 TDD 铁律：**没有先看到测试失败，绝不写生产代码。**

### 流程（Red-Green-Refactor）

1. **RED** — 先写一个最小的失败测试，描述期望行为
2. **Verify RED** — 运行测试，确认失败且原因正确（功能缺失，而非语法错误）
3. **GREEN** — 写最少代码让测试通过
4. **Verify GREEN** — 运行测试，确认通过且其他测试不挂
5. **REFACTOR** — 清理代码，消除重复，保持测试绿

### 运行测试
```bash
cd server && npx tsc --noEmit    # 后端类型检查
pnpm tsc -b                       # 前端类型检查
node tests/e2e.mjs                # E2E 测试
```

## Skills 使用指南

所有 Skills 通过 `Skill` 工具按需调用，覆盖开发全流程。

### 开发流程（Superpowers）

| Skill | 触发场景 |
|-------|---------|
| `superpowers:brainstorming` | 新功能/创意工作开始前，探索需求与设计 |
| `superpowers:test-driven-development` | 本项目强制执行，所有实现前先写测试 |
| `superpowers:systematic-debugging` | 遇到 Bug、测试失败、非预期行为时 |
| `superpowers:verification-before-completion` | 声称工作完成/修复/通过前，先跑验证 |
| `superpowers:writing-plans` | 有 spec 或需求的多步骤任务，先出计划 |
| `superpowers:executing-plans` | 有书面实现计划的开发任务 |
| `superpowers:requesting-code-review` | 完成任务、实现功能、合并前 |
| `superpowers:finishing-a-development-branch` | 实现完成、测试通过后，决定如何合并 |
| `superpowers:dispatching-parallel-agents` | 2+ 个独立任务可并行执行时 |
| `superpowers:subagent-driven-development` | 当前会话中执行独立步骤的实现计划 |
| `superpowers:using-git-worktrees` | 需要隔离当前工作区的功能开发 |

### 技术栈

| Skill | 适用场景 |
|-------|---------|
| `supabase` | 数据库 Schema/认证/RLS/迁移、supabase-js 使用问题 |
| `shadcn-ui` | 添加/定制 shadcn/ui 组件、查找组件示例 |
| `tailwindcss` | Tailwind v4 样式、响应式设计、设计令牌配置 |
| `ui-ux-pro-max` | UI/UX 设计（看板/卡片/表单）、配色/字体/动效方案 |
| `deploy` | 一键部署（构建 → 上传 → 服务器安装） |

### 业务领域

| Skill | 适用场景 |
|-------|---------|
| `analytics-metrics` | 运营看板数据可视化、KPI 图表、指标仪表盘 |
| `business-metrics-calculator` | 电商指标计算（MRR/CLV/CAC）、行业基准对比 |
| `e-commerce-domain-knowledge` | 电商业务模型、B2C/B2B 需求模式参考 |
| `e-commerce-manager` | 店铺运营优化、转化分析、零售策略 |

### 飞书集成

| Skill | 适用场景 |
|-------|---------|
| `lark-im` | 消息收发、群聊管理 |
| `lark-calendar` | 日程/会议管理、忙闲查询 |
| `lark-approval` | 审批流程（与 server 审批路由配合） |
| `lark-base` | 多维表格操作 |
| `lark-doc` | 云文档创建/编辑 |
| `lark-contact` | 通讯录查询 |
| `lark-whiteboard` | 架构图/流程图（含 DSL 编辑） |

### 质量保障

| Skill | 适用场景 |
|-------|---------|
| `review` | PR 代码审查 |
| `security-review` | 上线前安全审计 |
| `simplify` | 代码重构、质量优化、复用改进 |
| `user-story-audit` | 管理员+普通用户双视角，审查完整交互流程 |

### 项目管理

| Skill | 适用场景 |
|-------|---------|
| `pm-workflow` | 新功能/新模块 4 阶段门控（PRD→用户故事→计划→验收） |
| `grill-with-docs` | 方案审查、需求与领域模型对齐 |
| `guizang-ppt-skill` | 生成网页 PPT（杂志风/瑞士风） |

