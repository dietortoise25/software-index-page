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

## 部署方式（3 种，按场景选用）

### 1. Git 推送 → CI/CD（前端日常更新）★ 推荐

```bash
git add . && git commit -m "..." && git push origin main
```

GitHub Actions (`.github/workflows/deploy.yml`) 自动：`pnpm build` → `rsync dist/` 到服务器 → `nginx reload`。

适用：修改了 `src/` 下任何前端代码（包括 `software.ts`、`changelog.ts`）。

### 2. ZIP 上传（发布插件/工具安装包）

```bash
eval $(ssh-agent) && ssh-add ~/.ssh/alan_pc.pem
bash scripts/deploy.sh publish/文件名.zip
```

仅上传文件到 `/var/www/software-index/downloads/`，不触发代码更新。

### 3. 完整服务器端构建（后端 + 退货工作流）

```bash
eval $(ssh-agent) && ssh-add ~/.ssh/alan_pc.pem
bash scripts/deploy-full.sh           # 全部
bash scripts/deploy-full.sh --server   # 仅后端 API
bash scripts/deploy-full.sh --rw       # 仅退货工作流
```

适用：修改了 `server/`、`platform/`、`tools/return-workflow/`。

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
