# 网站后端服务

基于 Express.js (TypeScript) 的轻量后端。

## 技术栈

- Express.js 4.x
- TypeScript 5.x
- Node.js 18+

## 目录结构

```
server/
├── src/
│   └── index.ts        # 服务入口
├── dist/                # 编译产物 (gitignored)
├── package.json
├── tsconfig.json
└── relay.service        # systemd 服务定义
```

## 本地开发

```bash
cd server
pnpm install
pnpm dev          # tsx watch 热重载
```

## 部署到服务器

```bash
# 1. 构建
cd server && pnpm install && pnpm build

# 2. 上传
scp -r dist package.json ubuntu@42.193.170.109:/var/www/software-index/server/

# 3. 服务端安装依赖
ssh ubuntu@42.193.170.109 "cd /var/www/software-index/server && npm install --production"

# 4. 安装/更新 systemd 服务
scp server/relay.service ubuntu@42.193.170.109:/tmp/
ssh ubuntu@42.193.170.109 "sudo mv /tmp/relay.service /etc/systemd/system/ \
  && sudo systemctl daemon-reload && sudo systemctl restart relay"

# 5. 验证
ssh ubuntu@42.193.170.109 "sudo systemctl status relay"
curl http://42.193.170.109/health
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/requirement` | 提交需求（form-urlencoded），转发飞书消息 |
| GET | `/health` | 健康检查 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `PORT` | 监听端口，默认 8765 |
| `FEISHU_APP_SECRET` | 飞书应用密钥 |
