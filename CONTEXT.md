# CONTEXT.md — 杠杆工坊 / Leverage Works

## 术语表

- **管理员 (Admin)** — 系统的唯一管理者（Alan），拥有最高权限。通过飞书白名单自动识别
- **公司内部 (Internal)** — 已登录的飞书用户，公司同事。可访问运营看板、工具库、审批流程
- **访客 (Visitor)** — 未登录用户。只能访问公开内容（首页落地页、文章、关于、/future）。管理员可在权限管理界面逐个放行页面
- **飞书用户** — 通过飞书 OAuth 登录的用户。首次登录自动创建账号，角色默认为 `user`
- **管理员白名单** — `ADMIN_UNION_IDS` 环境变量，匹配的飞书用户自动获得 admin 角色
- **角色 (Role)** — `user` 表 `role` 字段。`admin`：唯一管理者，全权限；`user`：公司内部同事，可访问 internal 级页面
- **权限管理** — `/dashboard/permission`，admin 管理用户角色（tab1）和访客页面放行（tab2）
- **页面放行 (Page Access)** — `page_access` 数据库表，字段：`user_id, page_path, expires_at, token, granted_by, granted_at`。admin 选择页面+有效期 → 生成 JWT token 访问链接
- **访问令牌 (Access Token)** — Better Auth JWT plugin 签发，内含 `{ userId, pagePath, exp }`。访客通过 URL `?token=xxx` 参数携带，AuthGuard 验证后放行对应页面
- **Session** — Better Auth httpOnly cookie，Supabase PostgreSQL 持久化，7 天有效期

## 认证方式

| 方式 | 登录途径 | 角色来源 |
|------|---------|---------|
| 用户名+密码 | `/login` 表单 | 手动设置 |
| 飞书 OAuth | `/login` → 飞书授权 | 白名单→admin，其余→user |

## 权限矩阵

| 页面 | internal | admin | 说明 |
|------|----------|-------|------|
| `/` `/articles/*` `/about` `/future` `/changelog` `/ppt/*` | 公开 | 公开 | 一切用户 |
| `/catalog` `/return-workflow` | 需登录 | 需登录 | 公司内部 |
| `/dashboard` | 需登录 | 需登录 | 运营看板（侧边栏布局） |
| `/dashboard/admin` | 禁止 | 需登录 | 分组管理 |
| `/dashboard/permission` | 禁止 | 需登录 | 权限管理 |
| `/review` | 禁止 | 需登录 | 需求审查 |

## 路由结构

```
/                         公开落地页
/catalog                  工具库（internal）
/articles /about /future  公开内容
/return-workflow          审批流程（internal）
/dashboard                运营看板 + 侧边栏（internal）
  ├── (默认)              运营数据图表
  ├── /admin              分组/人员/店铺管理
  ├── /permission         权限管理（用户角色/访客放行）
  └── /articles          文章管理（admin only）
/review                   需求审查（admin only，/dashboard/review 别名）
/login                    登录页
```

## 数据存储

- **用户 & Session** — Supabase PostgreSQL（Better Auth）
- **运营数据** — Supabase PostgreSQL
- **文章** — Supabase PostgreSQL（`articles` 表）。图片存储 Supabase Storage
- **需求审查数据** — 服务器 JSON 文件
- **Agent 运行时平台 (Agent Runtime Platform)** — 独立的 LangChain.js 微服务（端口 8001），提供 Agent 运行的通用基础设施。不绑定任何具体 Agent 业务逻辑
- ** Agent / 智能体** — 基于 LLM 的自主对话程序，能使用工具、读取记忆、执行多步推理。每种 Agent 有自己的 system prompt 和工具集
- **会话 (Conversation)** — 用户与 Agent 的一次完整对话，包含全部消息历史。持久化在 `agent.conversations` + `agent.messages` 表中
- **用户记忆 (User Memory)** — 跨会话保留的用户信息（偏好、角色、历史上下文），存储在 `agent.user_memory` 表中。当前采用会话前全量加载策略
- **工具 (Tool)** — Agent 可调用的外部能力（查数据库、调 API 等）。通过 `registerTool()` 注册，Zod schema 定义参数。MVP 阶段工具约定为只读，安全约束渐进升级
- **模型配置 (Model Config)** — 三层可覆盖的 LLM 配置：全局默认（env）→ Agent 级 → 节点级。`getModel(overrides?)` 工厂函数支持 Provider 抽象
## 开发规范

- **API 路由** — RESTful 资源路由为主，非 CRUD 操作（SSE、health）用 RPC 例外。所有端点前缀 `/api/agent/`
- **响应格式** — 统一信封 `{ ok: true, data: T }` 成功 / `{ ok: false, error: string, code?: ErrorCode }` 失败。SSE 流式除外
- **错误码** — 枚举 `UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION_ERROR | RATE_LIMITED | INTERNAL_ERROR`。`code` 字段可选向后兼容
- **文件命名** — `.ts` 文件 kebab-case，React 组件 PascalCase，hooks camelCase
- **TypeScript** — `strict: true`，新项目零容忍
- **测试分层** — CRUD 层 TDD，LangChain 核心层先实现后补测，Agent 行为层 MVP 不做。单元 + 集成测试，不测 LLM 输出文本
- **工具安全** — MVP 约定只读，`registerTool` 预留 `dangerLevel` / `rateLimit` 字段供渐进升级
- **模型配置** — 三层覆盖（全局 env → Agent → 节点），`getModel(overrides?)` 工厂，Provider 抽象
- **可观测性** — MVP 使用 `BaseCallbackHandler` 结构化 console 日志，覆盖 LLM 调用 / 工具执行 / 错误。预留 LangFuse 接口插槽
- **Git 策略** — feature branch (`feat/agent-platform`) + conventional commits (`feat(agent):` / `fix(agent):` / `chore(agent):`)，按 user story 粒度提交，完成后 merge 到 main

- **langchain-agent** — systemd 服务名，对应 `backend/langchain-agent/`，是 Agent 运行时平台的部署单元
- **AI SDK 与 LangChain 边界** — relay server (:8765) 继续使用 Vercel AI SDK；agent 服务 (:8001) 使用 LangChain.js。两者共存、各自维护、互不调用
