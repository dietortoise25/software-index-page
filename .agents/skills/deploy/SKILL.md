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
```

## Systemd 服务

| 服务名 | 进程 | 端口 | 说明 |
|--------|------|------|------|
| `relay` | node server/dist/index.js | 127.0.0.1:8765 | 审查 API + AI 对话 + 内部管理接口 |
| `qianyi-scheduler` | node platform/dist/sync/scheduler.js | — | 千易ERP 数据同步（订单5分钟/商品30分钟）|
| `return-workflow` | node dist/index.js | 127.0.0.1:3002 | 退货工作流 |

## Nginx 路由

| 路径 | 转发 | 说明 |
|------|------|------|
| `/api/return-workflow/` | `127.0.0.1:3002` | 退货工作流（最长前缀优先匹配） |
| `/api/` | `127.0.0.1:8765` | 审查/内部管理 API |
| `/*` | 静态文件 | SPA fallback 到 index.html |

## 一键部署

```bash
# 项目根目录
./deploy.sh
```

脚本自动完成：三个项目并行构建 → 打包 tar.gz → scp 上传 → 服务器解压部署 → pnpm install → 重启 systemd → curl 验证 HTTP 200

### 前置条件

```bash
# Windows 必须先启动 SSH 代理
eval $(ssh-agent)
ssh-add ~/.ssh/alan_pc.pem
```

### 部署流程（脚本内部步骤）

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1. 构建 | `pnpm build` ×3 | platform (tsc)、server (tsc)、前端 (vite) |
| 2. 打包 | `tar czf` | 将 dist/ + server/dist/ + platform/dist/ + package.json + lockfile 打成单一压缩包 |
| 3. 上传 | `scp` | 上传到服务器 /tmp/ |
| 4. 部署 | 远程 bash | 解压 → 复制文件 → pnpm install --prod |
| 5. 重启 | `systemctl restart` | relay + qianyi-scheduler |
| 6. 验证 | `curl` | HTTP 200 + 同步日志 |

### 仅上传软件安装包

```bash
bash scripts/deploy.sh publish/文件名.zip
```

## 发布新版本完整流程

1. 更新 `src/data/changelog.ts` — 添加版本记录
2. （可选）更新 `src/data/articles.ts` — 添加发布公告
3. 运行 `./deploy.sh` 一键部署

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

### 2. SSH heredoc 变量展开

**现象**：用 `ssh host "sudo bash -s" << 'ENDSCRIPT'` 传递脚本时，部分变量或特殊字符可能丢失。

**修复**：改为先 scp 上传独立脚本文件，再 ssh 执行：
```bash
scp server-deploy.sh user@host:/tmp/
ssh user@host "sudo bash /tmp/server-deploy.sh"
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
