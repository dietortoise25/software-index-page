# ADR-0003: PIN 码认证升级为 Better Auth Session Cookie

**日期**: 2026-05-21  
**状态**: 已通过

## 背景

当前系统使用 PIN 码认证：`REVIEW_PIN` 环境变量存储 4-6 位数字，前端通过 `POST /api/verify-pin` 验证，所有受保护 API 在 body/query 中传递 `pin` 参数。4 个页面（/internal/admin、/review、/dashboard、/return-workflow）和首页软件目录锁使用此机制。

问题：
- PIN 在每次请求中明文传输，无过期机制
- 无用户体系，无法区分操作者
- 无法扩展为多用户/多角色
- 密码存在 systemd 环境变量中，修改需 SSH + systemctl daemon-reload + restart

## 决策

采用 **Better Auth + Session Cookie** 方案，分两阶段实施。

### 选择的方案

| 维度 | 选择 |
|------|------|
| 认证库 | Better Auth（TypeScript 原生，插件化，内置 JWT） |
| 登录方式 | Phase 1: 用户名+密码 / Phase 2+: 飞书 OAuth |
| 会话传递 | httpOnly Session Cookie（Better Auth 默认） |
| 会话存储 | Supabase PostgreSQL |
| 用户体系 | 多用户表结构，首期仅创建 admin 账号 |
| API 迁移 | Express 中间件注入 req.user，fallback 读 req.body.pin |
| 登录 UI | 独立 `/login` 路由 |
| 路由守卫 | `<AuthGuard requireAdmin>` 包裹组件 |

### 否决的方案

- **Bearer JWT 存 localStorage**：XSS 风险更高，前端需手动管理 token，Better Auth 原生偏向 cookie 方案
- **一次性全量替换**：风险过大，停服周期不可控
- **飞书 OAuth 首期上线**：飞书无标准 OIDC，需手写 custom plugin，延迟交付

## 影响

- 新增依赖：`better-auth`、`jose`
- 新增路由：`/login`、`/api/auth/*`
- 新增组件：`AuthGuard`
- 新增数据库表：Better Auth 自动建表（user、session、account）
- 移除依赖（Phase 2）：`PinGate` 组件、`apiPostWithPin` 系列函数、`POST /api/verify-pin` 路由
- 修改文件范围：~15 文件（4 个受保护页面 + API 层 + server/index.ts）

## Phase 1 与旧方案共存

旧 PIN 认证保留不删：
- `POST /api/verify-pin` 继续工作
- API 路由中间件优先读 session cookie，fallback 读 `req.body.pin`
- 确认稳定后进入 Phase 2 清理
