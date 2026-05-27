---
name: deploy
description: 服务器端构建部署。触发：用户说"部署"、"更新网站"、"发布"、"上传服务器"等。
metadata:
  author: Alan
  version: "3.0.0"
  source: project
---

# 部署 Skill

## 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器IP | `42.193.170.109` |
| 系统 | Ubuntu 24.04 (腾讯云) |
| 登录用户 | `ubuntu` |
| Node.js | v22.22.2 (NodeSource) |
| 包管理器 | pnpm 10.33.4 |
| SSH 密钥 | `~/.ssh/alan_pc.pem` |
| 网站根目录 | `/var/www/software-index/` |

## 架构概览

```
/var/www/software-index/
├── index.html              # 前端 SPA
├── assets/                 # 前端静态资源
├── ppt/                    # PPT 文件
├── downloads/              # 软件安装包
├── server/                 # 后端 API (relay.service · 端口 8765)
│   ├── dist/               # tsc 编译产物
│   └── node_modules/
├── platform/               # 千易ERP 数据中台 (qianyi-scheduler.service)
│   ├── dist/               # tsc 编译产物
│   └── node_modules/
└── tools/
    └── return-workflow/    # 退货工作流 (return-workflow.service · 端口 3002)
        ├── dist/
        ├── data_example/
        └── node_modules/

/var/www/shopee-analyzer/   # Shopee 数据分析 (shopee-analyzer.service · 端口 8000)
├── main.py                 # Python FastAPI 入口
├── .venv/                  # Python 虚拟环境
└── requirements.txt
```

## Systemd 服务

| 服务名 | 进程 | 端口 | 说明 |
|--------|------|------|------|
| `relay` | node server/dist/index.js | 127.0.0.1:8765 | 审查 API + AI 对话 + 内部管理接口 |
| `qianyi-scheduler` | node platform/dist/sync/scheduler.js | — | 千易ERP 数据同步（订单5分钟/商品30分钟）|
| `return-workflow` | node dist/index.js | 127.0.0.1:3002 | 退货工作流 |
| `shopee-analyzer` | uvicorn main:app | 127.0.0.1:8000 | Shopee 数据分析 (Python FastAPI) |

## Nginx 路由

| 路径 | 转发 | 说明 |
|------|------|------|
| `/api/return-workflow/` | `127.0.0.1:3002` | 退货工作流（最长前缀优先匹配） |
| `/api/` | `127.0.0.1:8765` | 审查/内部管理 API |
| `/*` | 静态文件 | SPA fallback 到 index.html |

## 部署方式（只有 2 种）

### 1. 代码部署：`git push deploy main` ★ 唯一方式

```bash
git add . && git commit -m "..." && git push deploy main
```

服务器 `post-receive` hook 自动：检出 → 构建 4 后端 + 前端 → 部署 → 重启全部 systemd 服务 → 验证。

适用：任何代码改动（前端/后端/Python）。

### 环境变量：`bash scripts/sync-env.sh`

```bash
bash scripts/sync-env.sh
```

将本地 `.env` 推送到服务器 `/home/ubuntu/.env`。改完 .env 后执行，然后 `git push deploy main` 使变更生效。

### 2. 二进制上传：`bash scripts/deploy.sh`

```bash
eval $(ssh-agent) && ssh-add ~/.ssh/alan_pc.pem
bash scripts/deploy.sh publish/文件名.zip
```

仅上传文件到 `/var/www/software-index/downloads/`，不触发代码构建。

## 发布新插件/工具版本完整流程

```
1. 更新 src/data/software.ts  — 添加新版本记录（isLatest: true，旧版改 false）
2. 更新 src/data/changelog.ts — 添加更新日志条目
3. bash scripts/deploy.sh publish/xxx.zip  — 上传安装包到服务器
4. git add . && git commit -m "release: xxx vX.Y.Z" && git push origin main
   → GitHub Actions 自动部署前端
```

> **注意**：步骤 3 和 4 无先后依赖，可并行执行。

## 环境变量

路径：项目根目录 `.env`（部署时会复制到服务器 `/var/www/software-index/.env`）

| 变量 | 用途 |
|------|------|
| `SERVER_HOST` / `SERVER_IP` / `SERVER_USER` | SSH 连接信息 |
| `SSH_KEY_PATH` | 私钥路径 |
| `DEEPSEEK_API_KEY` | AI 对话 |
| `REVIEW_PIN` | 审查/看板/内部管理 PIN 码 |
| `API_ENV` | 千易环境（production_asia） |
| `PRODUCTION_ASIA_URL` / `_APP_ID` / `_APP_SECRET` | 千易 API 凭证 |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | ERP 数据读取 |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | 前端看板数据读取（Vite 要求 VITE_ 前缀） |

## 踩坑记录

### 1. Shell `cd` 副作用（导致 3 次部署失败）

**现象**：`cp -r platform/dist $ROOT/platform/` 报 `No such file or directory`

**原因**：远程部署脚本中 `cd $ROOT/server && pnpm install` 切换了当前目录，后面的 `cp -r platform/dist` 变成了相对于 `$ROOT/server/` 而非 `/tmp/dep/`。

**修复**：用子 shell 代替裸 `cd`：
```bash
# ❌ 错误
cd /target && some_command    # 当前目录永久切换

# ✅ 正确
(cd /target && some_command)  # 子 shell 结束后回到原目录
```

这是 shell 脚本的经典陷阱，不是架构问题。

### 2. `.env` 含空格变量名导致 `source` 失败

**现象**: `bash scripts/deploy.sh` 报 `Encrypt: command not found`

**原因**: `.env` 中 `Encrypt Key=601814` 含空格，`source .env` 时 bash 将其解析为执行命令 `Encrypt` 带参数 `Key=601814`。

**修复**: 用 `grep` 逐变量提取替代 `source`：
```bash
env_val() {
    local key="$1"
    local default="$2"
    local val
    val=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)
    val=$(echo "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    echo "${val:-$default}"
}
SERVER_USER="$(env_val SERVER_USER)"
```

### 3. Node.js v20 没有原生 WebSocket

**现象**：`@supabase/supabase-js` 在 Node v20 上报 `No native WebSocket support`

**修复**：将服务器 Node 升到 v22（有原生 WebSocket），一劳永逸，无需 `ws` polyfill。

### 4. `.env` 不应提交到 Git

`.env` 已在 `.gitignore` 中。部署时通过 `scp` 手动上传或服务器上直接编辑。前端需要的 `VITE_SUPABASE_*` 变量要额外在 `.env` 中声明（不提交），Vite build 时会内联到 JS 中。

### 5. PIN 认证复用

看板 (`/dashboard`) 和内部管理 (`/internal/admin`) 复用同一个 PIN 验证流程：
- 前端用 `sessionStorage.getItem("dash_pin")` 保持登录态
- 每次 API 调用在 body 中携带 `pin` 字段
- 后端 `/api/internal/*` 路由验证 PIN 与 `REVIEW_PIN` 是否一致

## 生产操作守则 ★（2026-05-27 Agent 部署反思）

> 以下守则源于一次高危操作：在无备份的情况下直接覆盖 post-receive hook + sed 注入 nginx，同时合并分支推生产。虽然最终没出事故，但违反了多项安全原则。

### 铁律

| # | 原则 | 错误示例 | 正确做法 |
|---|------|---------|---------|
| 1 | **先备份** | 直接覆盖配置文件 | `cp orig backup` → 改动 → 验证 → 保留备份 |
| 2 | **小步验证** | hook 一次改几十行，nginx 用 sed 注入 | diff 式小改 → 语法检查 → 手动触发一次 |
| 3 | **分离变量** | 基础设施 + 代码同时推生产 | 先修基础设施 → 验证所有服务 → 再推代码 |
| 4 | **故障回滚** | 备份放在不明确的位置 | 备份文件名含日期，明确回滚命令 |
| 5 | **敏感文件走 scp** | sed 注入 nginx config | 本地写好完整文件 → scp 上传 → `nginx -t` → reload |

### 操作顺序

```
备份配置文件
  → 单点改动（hook / nginx / systemd 每次只改一个）
    → 语法检查（bash -n / nginx -t）
      → 手动触发验证
        → 确认无误后改动下一个
          → 全部完成后推代码
```

### 关键配置文件路径

| 文件 | 路径 | 备份 |
|------|------|------|
| post-receive hook | `/var/git/software-index.git/hooks/post-receive` | `.bak` |
| nginx site config | `/etc/nginx/sites-enabled/software-index` | `.bak.YYYYMMDD` |
| systemd service | `/etc/systemd/system/langchain-agent.service` | hook 自动安装 |

### 2026-05-27 部署 Agent 时的失误

1. **直接替换 hook** — scp 上传本地写的全新 hook，覆盖 `/var/git/...`。如果语法有误，5 个后端服务全部部署瘫痪
2. **sed 注入 nginx** — 往 `/etc/nginx/sites-enabled/` 里 sed 插入多行，转义复杂易出错
3. **合并+推送同步** — 服务器基础设施（hook/nginx/systemd）和代码合并+推送在同一会话完成，出问题无法隔离归因
4. **没有备份意识** — 事后才补的 nginx 备份

### 服务器服务全景

| 服务 | 端口 | systemd |
|------|------|---------|
| relay (Express) | 127.0.0.1:8765 | `relay` |
| return-workflow | 127.0.0.1:3002 | `return-workflow` |
| shopee-analyzer (Python) | 127.0.0.1:8000 | `shopee-analyzer` |
| langchain-agent ★ | 127.0.0.1:8001 | `langchain-agent` |
| qianyi-scheduler | — | `qianyi-scheduler` |
