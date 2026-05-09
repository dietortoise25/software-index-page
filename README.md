# 软件发布平台

公司内部软件发布站，展示软件更新信息、提供下载入口和 Web 工作台链接。

## 技术栈

React 19 + Vite 8 + TypeScript 6 + Tailwind CSS v4 + shadcn/ui v4 + react-router v7

## 本地开发

```bash
pnpm install
pnpm dev        # 启动开发服务器 → http://localhost:5173
pnpm build      # 构建生产版本
```

## 发布 / 更新软件

编辑 `src/data/software.ts`，按现有格式添加或修改软件条目即可。

### 数据结构

```typescript
// src/types/software.ts

type Platform = "windows" | "macos" | "linux" | "web"

interface SoftwareVersion {
  version: string                              // 版本号，如 "2.1.0"
  releaseDate: string                          // 发布日期，ISO 格式
  changelog: string[]                          // 更新日志，每项一条
  downloads?: Partial<Record<Platform, string>> // 各平台下载链接
  workbenchUrl?: string                        // Web 工作台地址
  isLatest?: boolean                           // 标记为最新版本
}

interface Software {
  id: string              // 唯一标识，用于 URL（如 "my-tool"）
  name: string            // 软件名称
  description: string     // 简短描述
  iconName: string        // lucide 图标名（可选：BarChart3 / FileText / Terminal / Settings2 / Network）
  category: string        // 分类标签
  versions: SoftwareVersion[]  // 版本历史，最新排最前
  homepageUrl?: string    // 项目主页（可选）
}
```

### 添加新软件示例

在 `softwareList` 数组中新增一条：

```typescript
{
  id: "my-new-tool",
  name: "My New Tool",
  description: "工具简介，一句话说清做什么",
  iconName: "Terminal",
  category: "效率工具",
  versions: [
    {
      version: "1.0.0",
      releaseDate: "2026-05-07",
      isLatest: true,
      changelog: ["首个版本发布", "支持核心功能"],
      downloads: {
        windows: "https://cdn.example.com/tool-1.0.0-win.exe",
        macos: "https://cdn.example.com/tool-1.0.0-mac.dmg",
      },
      workbenchUrl: "https://tool.internal.company.com",
    },
  ],
}
```

### 为已有软件添加新版本

在对应软件的 `versions` 数组**最前面**插入新版本，同时移除旧版本的 `isLatest`：

```typescript
versions: [
  {
    version: "1.1.0",           // ← 新版本
    releaseDate: "2026-05-07",
    isLatest: true,             // ← 标记为最新
    changelog: ["新增XX功能", "修复YY问题"],
    downloads: { /* ... */ },
  },
  {
    version: "1.0.0",           // ← 旧版本，去掉 isLatest
    releaseDate: "2026-04-01",
    changelog: ["首个版本"],
  },
]
```

### 可用图标

数据中的 `iconName` 对应 lucide-react 图标，目前支持的图标名：

| iconName | 图标 | 
|----------|------|
| `BarChart3` | 柱状图 |
| `FileText` | 文档 |
| `Terminal` | 终端 |
| `Settings2` | 齿轮 |
| `Network` | 网络 |

使用新图标时，需要在 `SoftwareCard.tsx` 和 `SoftwareDetailPage.tsx` 的 `iconMap` 中补充对应的 import 和映射。

## 部署

### 服务器环境（一次性）

```bash
# 1. 安装 Nginx
sudo apt update && sudo apt install -y nginx

# 2. 创建站点目录
sudo mkdir -p /var/www/software-index
sudo chown -R $USER:$USER /var/www/software-index

# 3. 配置 Nginx（见下方配置模板）
sudo vim /etc/nginx/sites-available/software-index
sudo ln -s /etc/nginx/sites-available/software-index /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 4. 生成部署专用 SSH 密钥
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github-actions
cat ~/.ssh/github-actions.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github-actions  # 复制私钥，存入 GitHub Secrets → SSH_PRIVATE_KEY
```

### Nginx 配置模板

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/software-index;
    index index.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # gzip 压缩
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;
}
```

### 自动部署

推送 `main` 分支后，GitHub Actions 自动执行：

1. 检出代码
2. `pnpm install && pnpm build`
3. `rsync` 同步到服务器
4. 重载 Nginx

需要在 GitHub 仓库 Settings → Secrets and variables → Actions 配置三个 Secrets：

| Secret | 说明 |
|--------|------|
| `SSH_PRIVATE_KEY` | 部署专用私钥 |
| `SSH_HOST` | 服务器 IP |
| `SSH_USER` | SSH 登录用户名 |

也可在 Actions 页面手动触发部署（`workflow_dispatch`）。
