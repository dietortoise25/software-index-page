---
name: deploy
description: 服务器端构建部署。触发：用户说"部署"、"更新网站"、"发布"、"上传服务器"等。
metadata:
  author: Alan
  version: "2.0.0"
  source: project
---

# 部署 Skill

## 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器IP | `42.193.170.109` |
| 系统 | Ubuntu 22.04 (腾讯云) |
| 登录用户 | `ubuntu` |
| SSH 密钥 | `~/.ssh/alan_pc.pem` |
| 网站根目录 | `/var/www/software-index/` |
| 下载目录 | `/var/www/software-index/downloads/` |
| Nginx 配置 | `/etc/nginx/sites-enabled/software-index` |

## 架构概览

```
/var/www/software-index/
├── index.html          # 前端 SPA
├── assets/             # 前端静态资源
├── ppt/                # PPT 文件
├── downloads/          # 软件安装包
├── server/             # 审查 API (relay.service)
│   ├── dist/           # 编译后的 JS（端口 8765）
│   └── node_modules/
└── tools/
    └── return-workflow/ # 退货工作流 (return-workflow.service)
        ├── dist/        # 编译后的 JS（端口 3002）
        ├── data_example/
        └── node_modules/
```

## Nginx 路由

| 路径 | 转发 | 说明 |
|------|------|------|
| `/api/return-workflow/` | `127.0.0.1:3002` | 退货工作流（最长前缀优先匹配） |
| `/api/` | `127.0.0.1:8765` | 审查 API |
| `/*` | 静态文件 | SPA fallback 到 index.html |

## 部署命令

### 服务器端构建部署（推荐）

```bash
# 1. 启动 SSH 代理（Windows 必须）
eval $(ssh-agent)
ssh-add ~/.ssh/alan_pc.pem

# 2. 运行部署
bash scripts/deploy-full.sh           # 部署全部（前端+两个后端）
bash scripts/deploy-full.sh --frontend # 仅前端
bash scripts/deploy-full.sh --server   # 仅审查API
bash scripts/deploy-full.sh --rw       # 仅退货工作流
```

脚本自动完成：打包源文件 → 上传 tar.gz → 服务器端 pnpm install + tsc/vite build → 复制 dist 到目标路径 → 重启 systemd 服务 → curl 验证

### 仅上传软件安装包（桌面工具）

```bash
bash scripts/deploy.sh publish/文件名.zip
```

### 手动验证

```bash
curl http://42.193.170.109/api/return-workflow/health
curl http://42.193.170.109/api/verify-pin -X POST \
  -H 'Content-Type: application/json' -d '{"pin":"123456"}'
ssh ubuntu@42.193.170.109 \
  'sudo systemctl status relay return-workflow --no-pager'
```

## 发布新版本完整流程

1. 更新 `src/data/software.ts` — versions 数组最前插入新版本，`isLatest: true`，旧版 `false`
2. 更新 `src/data/articles.ts` — 添加发布公告
3. （可选）在 `posts/` 创建 `.md` 文章
4. 运行 `bash scripts/deploy-full.sh` 一键完成

## 退货工作流 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/return-workflow/health` | GET | 健康检查 |
| `/api/return-workflow/process` | POST | 上传文件处理（multipart, field: files） |
| `/api/return-workflow/task/:id` | GET | 查询任务进度 |
| `/api/return-workflow/tasks` | GET | 最近 20 条任务 |

## 环境变量（退货工作流）

路径：`/var/www/software-index/tools/return-workflow/.env`

| 变量 | 说明 |
|------|------|
| `FEISHU_APP_ID` | 飞书应用 ID |
| `FEISHU_APP_SECRET` | 飞书应用密钥 |
| `FEISHU_BASE_TOKEN` | 多维表格 Base Token |
| `FEISHU_TABLE_WAREHOUSE` | 仓库责任表 ID |
| `FEISHU_TABLE_NON_WAREHOUSE` | 非仓库责任表 ID |

## 注意事项

- **Windows SSH**：必须先 `eval $(ssh-agent) && ssh-add ~/.ssh/alan_pc.pem`
- 服务器使用 npm（非 pnpm），部署脚本已处理安装差异
- 服务端口均为内部（127.0.0.1），仅 Nginx 监听 80 对外
- `/api/return-workflow/` 放在 `/api/` 之前确保优先匹配
