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
- **部署**: `./deploy.sh` 一键构建（platform → server → 前端）并上传到 42.193.170.109，server-deploy.sh 在服务器端解包安装。前端由 Nginx 托管，后端 systemd 守护
- **环境变量**: `.env` 文件包含所有密钥配置，`.gitignore` 已排除 `.env`；`.env.example` 为模板
- **PIN保护**: 审查面板通过 PIN 码认证，带 IP 限流（60秒5次），dev 模式自动跳过
- **Tailwind v4**: 使用 `@theme inline` 设计令牌，自定义颜色通过 CSS 变量，禁止硬编码
- **图标**: 使用 lucide-react，不自行创建 SVG
- **包管理**: pnpm
