# CONTEXT.md — 杠杆工坊 / Leverage Works

## 术语表

- **管理员 (Admin)** — 系统的管理者用户，拥有最高权限，可访问审查面板、运营看板、管理后台、审批流程
- **用户 (User)** — 系统的登录实体，通过 Better Auth 管理。当前仅有 admin 角色，未来扩展为多角色
- **PIN 码** — 旧的认证方式，4-6 位数字，在环境变量 `REVIEW_PIN` 中配置，通过 body/query 参数传递。将被 JWT Session 取代
- **Session** — Better Auth 维护的 httpOnly cookie 会话，服务器端持久化在 Supabase PostgreSQL
- **受保护页面** — 需要 admin 登录才能访问的页面：/internal/admin、/review、/dashboard、/return-workflow、首页软件目录 unlock
- **飞书 OAuth** — 计划中的社交登录方式，通过飞书开放平台授权，允许公司同事免密登录。当前未实现

## 认证方式

| 阶段 | 方式 | 状态 |
|------|------|------|
| 旧 | PIN 码（REVIEW_PIN 环境变量） | 共存中，将被废弃 |
| 当前 (Phase 1) | 用户名+密码 + Session Cookie | 实现中 |
| 未来 (Phase 2+) | 飞书 OAuth / 多角色 | 计划中 |

## 数据存储

- **用户 & Session** — Supabase PostgreSQL，通过 Better Auth 自动建表
- **运营数据** — Supabase PostgreSQL
- **需求审查数据** — 服务器端 JSON 文件 (`server/src/lib/storage.ts`)
