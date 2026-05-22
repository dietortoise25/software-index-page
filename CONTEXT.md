# CONTEXT.md — 杠杆工坊 / Leverage Works

## 术语表

- **管理员 (Admin)** — 系统的管理者用户，拥有最高权限，可访问审查面板、运营看板、管理后台、审批流程、权限管理
- **用户 (User)** — 系统的登录实体，通过 Better Auth 管理。两个来源：用户名密码注册（如 `admin`）和飞书 OAuth 登录。角色分为 admin 和 user
- **飞书用户** — 通过飞书 OAuth 登录的用户，使用飞书 open_id 标识。首次登录自动创建账号，角色默认为 user
- **管理员白名单** — `ADMIN_UNION_IDS` 环境变量，逗号分隔的飞书 union_id 列表。匹配的飞书用户自动获得 admin 角色
- **角色 (Role)** — user 表的 `role` 字段，取值为 `admin` 或 `user`。admin 可访问所有页面；user 可访问 dashboard/review/return-workflow，不可访问管理后台和权限管理
- **权限管理** — `/internal/permissions` 页面，管理员查看和修改用户角色的控制台
- **PIN 码** — 旧的认证方式，已被 JWT Session 完全取代。相关代码已删除
- **Session** — Better Auth 维护的 httpOnly cookie 会话（`better-auth.session_token`），服务器端持久化在 Supabase PostgreSQL，有效期 7 天
- **受保护页面** — 需要登录才能访问的页面。按保护级别分为两类：登录即可（/dashboard、/review、/return-workflow）和 admin only（/internal/admin、/internal/permissions）

## 认证方式

| 方式 | 登录途径 | 角色来源 |
|------|---------|---------|
| 用户名+密码 | `/login` 表单 → `signIn.username()` | 手动设置 |
| 飞书 OAuth | `/login` → "飞书账号登录" → 授权回调 | 白名单自动 admin，其余 user |

## 权限矩阵

| 页面 | 登录要求 | 角色要求 |
|------|---------|---------|
| `/dashboard` / `/review` / `/return-workflow` | 是 | 无（登录即可） |
| `/internal/admin` / `/internal/permissions` | 是 | admin |

## 数据存储

- **用户 & Session** — Supabase PostgreSQL，通过 Better Auth 自动建表
- **运营数据** — Supabase PostgreSQL
- **需求审查数据** — 服务器端 JSON 文件 (`server/src/lib/storage.ts`)
