---
name: deploy
description: 将软件包（zip）上传到服务器并更新网站代码。触发：用户说"上传"、"更新插件"、"发布新版本"、"部署"等。
metadata:
  author: Alan
  version: "1.0.0"
  source: project
---

# 软件部署 Skill

## 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器IP | `42.193.170.109` |
| 系统 | Ubuntu (腾讯云) |
| 登录用户 | `ubuntu` |
| SSH 别名 | `software-site` |
| 密钥文件 | `~/.ssh/alan_pc.pem` |
| 密钥对名称 | `skey-4szb8wer`（腾讯云控制台） |
| 网站根目录 | `/var/www/software-index/` |
| 下载目录 | `/var/www/software-index/downloads/` |
| Nginx站点配置 | `/etc/nginx/sites-available/software-index` |

## 部署流程

### 第一步：启动SSH代理（Windows必须）

```bash
eval $(ssh-agent)
ssh-add ~/.ssh/alan_pc.pem
```

### 第二步：上传zip包

```bash
bash scripts/deploy.sh publish/文件名.zip
```

脚本自动：连接检查 → 上传 → 大小校验 → 输出下载链接

### 第三步：更新网站代码

上传后手动更新以下源文件：

1. **`src/data/software.ts`** — 新版本 `isLatest: true`，旧版本改为 `false`
2. **`src/data/articles.ts`** — 添加发布公告（id用 `{软件}-v{版本}` 格式）

### 第四步：构建并部署网站（手动）

```bash
pnpm build
scp -r dist/* ubuntu@42.193.170.109:/var/www/software-index/
```

## 常见问题

- **SSH `type -1`**：Windows下密钥权限问题，必须通过 `ssh-agent` 使用密钥
- **`Permission denied`**：确认腾讯云控制台已将密钥对绑定到此实例
- **用户是 `ubuntu` 不是 `root`**：腾讯云 Ubuntu 系统默认绑定到 `ubuntu` 用户
