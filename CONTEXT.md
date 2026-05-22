# CONTEXT.md — 杠杆工坊 / Leverage Works

## 术语表

- **管理员 (Admin)** — 系统的唯一管理者（Alan），拥有最高权限。通过飞书白名单自动识别
- **公司内部 (Internal)** — 已登录的飞书用户，公司同事。可访问运营看板、工具库、审批流程
- **访客 (Visitor)** — 未登录用户。只能访问公开内容（首页落地页、文章、关于、/future）。管理员可在权限管理界面逐个放行页面
- **飞书用户** — 通过飞书 OAuth 登录的用户。首次登录自动创建账号，角色默认为 `user`
- **管理员白名单** — `ADMIN_UNION_IDS` 环境变量，匹配的飞书用户自动获得 admin 角色
- **角色 (Role)** — `user` 表 `role` 字段。`admin`：唯一管理者，全权限；`user`：公司内部同事，可访问 internal 级页面
- **权限管理** — `/dashboard/permission`，admin 查看/修改用户角色和访客页面放行
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
  └── /permission         权限管理（用户角色/访客放行）
/review                   需求审查（admin only）
/login                    登录页
```

## 数据存储

- **用户 & Session** — Supabase PostgreSQL（Better Auth）
- **运营数据** — Supabase PostgreSQL
- **需求审查数据** — 服务器 JSON 文件
