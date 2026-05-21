# Git Push 部署方案

## 架构

```
本地 git push deploy main
  → 服务器 bare repo: /var/git/software-index.git
    → post-receive hook 触发
      → 检出到 /var/git/build
      → 复制 .env → pnpm install → pnpm build
      → 部署产物到 /var/www/software-index
      → systemctl restart relay qianyi-scheduler
```

**旧方案保留：** `bash deploy.sh` 仍可用（本地构建 + tarball 上传）。

## 踩坑记录

### 1. Bare repo 初始化：嵌套 .git 目录

**现象：** `git push deploy main` 报 "not a git directory"

**原因：** 用 `tar czf repo-seed.tar.gz .git` 打包本地 `.git` 目录上传到服务器后，在 bare repo 里解压出了 `.git/` 子目录，而非把 objects/refs/HEAD 等直接放在 bare repo 根目录。

**正确做法：**
```bash
# 服务器上创建 bare repo
git init --bare /var/git/software-index.git

# 本地打包（注意 -C 切换目录，打包内容而非目录本身）
tar czf /tmp/git-seed.tar.gz -C .git .

# 服务器解压
tar xzf /tmp/git-seed.tar.gz -C /var/git/software-index.git
git -C /var/git/software-index.git config core.bare true
```

### 2. 文件权限：root vs ubuntu

**现象：** post-receive hook 执行 `rm -rf assets/` 报 Permission denied，部署中断后 `index.html` 被删但新文件没写入，网站 403。

**原因：** 旧 `deploy.sh` 通过 `sudo bash server-deploy.sh` 部署，`/var/www/software-index/assets/` 下的文件属主是 `root`。post-receive hook 以 `ubuntu` 用户运行，无权删除。

**修复：**
```bash
sudo chown -R ubuntu:ubuntu /var/www/software-index
```

**长期：** hook 中删除操作用 `sudo rm -rf`，或首次部署后锁定权限。

### 3. 构建时缺少 .env

**现象：** 浏览器控制台报 `Uncaught Error: 缺少 Supabase 环境变量: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY`

**原因：** Vite 在 `pnpm build` 时读取 `.env` 中的 `VITE_*` 变量内嵌到 JS bundle。服务器构建目录 `/var/git/build` 没有 `.env`（`.gitignore` 排除，不会通过 push 传输）。构建出的 JS 中 Supabase 初始化为空值，浏览器端报错。

**修复：** post-receive hook 在 `pnpm build` 前复制 `.env`：
```bash
cp /home/ubuntu/.env /var/git/build/.env
cp /home/ubuntu/.env /var/git/build/server/.env
```

### 4. 未提交代码无法部署

**现象：** `git push deploy main` 返回 "Everything up-to-date"，但本地有未提交改动。或服务器构建时报 TS 找不到模块。

**原因：** Git push 只传输已 commit 的内容。服务器 bare repo 只有历史提交的快照，本地工作区未暂存/未提交的文件不在其中。

**原则：** 部署前必须先 commit。`deploy.sh` 无此限制（直接读本地文件构建），可作为紧急备用。

### 5. post-receive hook 的 set -e 行为

**现象：** 一个步骤失败（如 rm Permission denied）后，后续 server/platform 部署、服务重启全部跳过。

**原因：** `set -e` 让脚本在任何非零退出码处立即终止。rm 失败退出码非零，后续步骤不执行，导致部分部署状态不一致。

**对策：** 关键清理步骤加 `sudo` 或 `|| true`。验证步骤（curl）失败不应终止部署，已从 `set -e` 流中移除。

### 6. 旧版 Python relay 占端口

**现象：** Node relay 重启后 `/api/verify-pin` 返回 `{"ok": false, "error": "not found"}`，而非 "PIN 码错误"。`systemctl restart relay` 似乎成功了但实际不生效。

**原因：** 服务器上有两个 relay 服务抢 8765 端口：
- `relay.service`（Node.js）— systemd 配置正确，但端口被占起不来
- `requirement-relay.service`（Python）— 旧版中继 `/home/ubuntu/relay_server.py`，先占了 8765

Python 版没有 `/api/verify-pin` 路由，Express 的 404 fallback 返回 "not found"。

**修复：**
```bash
sudo systemctl stop requirement-relay
sudo systemctl disable requirement-relay
sudo rm /home/ubuntu/relay_server.py
sudo rm /etc/systemd/system/requirement-relay.service
sudo systemctl daemon-reload
sudo systemctl restart relay
```

## 部署命令速查

```bash
# 正常部署（推荐）
git add <files> && git commit -m "msg"
git push deploy main

# 紧急备用（未提交代码也能部署）
bash deploy.sh

# 查看服务器部署日志
ssh -i ~/.ssh/alan_pc.pem ubuntu@42.193.170.109 \
  "journalctl -t git-deploy --no-pager -n 20"

# 手动触发 hook（无需 push）
ssh -i ~/.ssh/alan_pc.pem ubuntu@42.193.170.109 \
  "cd /var/git/software-index.git && bash hooks/post-receive <<< 'refs/heads/main old new refs/heads/main'"
```
