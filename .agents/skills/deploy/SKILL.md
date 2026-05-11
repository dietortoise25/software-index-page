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

### 第四步：构建并部署网站

网站部署到服务器 `/var/www/software-index/`：

```bash
pnpm build
scp -r dist/* ubuntu@42.193.170.109:/var/www/software-index/
```

## 文章管理（posts/ 目录）

项目支持通过编写 Markdown 文件来发布文章，无需修改 TypeScript 代码。

### 文章文件格式

在 `posts/` 目录下创建 `.md` 文件，格式如下：

```markdown
---
id: my-article-id
title: 文章标题
summary: 文章摘要，显示在列表页
date: 2026-05-11
author: Alan
tags: [标签1, 标签2]
---

## 正文标题

文章正文使用 Markdown 格式书写，支持：

- **粗体**、*斜体*
- 列表、有序列表
- > 引用块
- `行内代码`
- [链接](url)

## 另一个章节

段落之间用空行分隔。

构建时 `import.meta.glob` 会自动扫描 `posts/*.md`，
解析 frontmatter 并渲染 Markdown 为 HTML，合并到文章列表中。
```

### 关键规则

- `id` 必须唯一，用于文章详情页 URL（`/articles/:id`）
- 文件必须是 `.md` 后缀
- frontmatter 用 `---` 包裹，使用 YAML 格式
- 标签用 `[a, b, c]` 数组格式
- 写入新文件后，`pnpm build` 即可生效

### 示例文件

`posts/sample.md` 是一篇完整的示例文章，可作为新建文章的模板。

## 常见问题

- **SSH `type -1`**：Windows下密钥权限问题，必须通过 `ssh-agent` 使用密钥
- **`Permission denied`**：确认腾讯云控制台已将密钥对绑定到此实例
- **用户是 `ubuntu` 不是 `root`**：腾讯云 Ubuntu 系统默认绑定到 `ubuntu` 用户
- **文章没显示**：确认 frontmatter 中 `id` 唯一、日期格式为 `YYYY-MM-DD`
