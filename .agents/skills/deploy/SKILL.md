---
name: deploy
description: 服务器端构建部署。触发：用户说"部署"、"更新网站"、"发布"、"上传服务器"等。
metadata:
  author: Alan
  version: "4.1.0"
  source: project
---

# 部署 Skill

> **本文档只记录「不变的铁律」和「指针」，不记录会腐烂的清单。**
> 具体有哪些服务、端口、变量——交给 `scripts/healthcheck.sh` 现场探测，不要写死在文档里（写死必过时，这是 3.x 版本踩坑的根源）。

## 服务器

| 项 | 值 |
|----|-----|
| IP | `42.193.170.109` |
| 用户 | `ubuntu`（有 sudo） |
| SSH 密钥 | `~/.ssh/alan_pc.pem` |
| 登录 | `ssh -o StrictHostKeyChecking=no ubuntu@42.193.170.109` |

## 部署前后必做（强制）

**每次执行部署任务，先做这两步，不可跳过：**

1. **核对文档与现实差异**：本文档可能已过时。动手前用 `systemctl list-units --type=service` 和
   `systemctl cat <svc>` 核对真实的服务、端口、env 来源，与你脑中/本文档的假设比对。
   发现不符 → 先报告用户，再继续。**不要基于本文档的旧清单想当然。**
2. **跑体检**：部署完成后必须 `bash scripts/healthcheck.sh`，全绿才算成功。
   `sync-env.sh` 末尾已自动调用（改 env 后）；其他部署方式需手动跑一次。

## 环境变量铁律（最重要，2026-06 重构确立）

env 是这个项目最容易出事的地方，铁律如下：

1. **单一来源**：所有服务的密钥/连接串只住在服务器 `/home/ubuntu/.env` 一处。
2. **统一注入**：所有 systemd 服务用 `EnvironmentFile=-/home/ubuntu/.env` 注入，
   **禁止**在 `.service` 里写 `Environment=KEY=VALUE` 硬编码密钥。
3. **子目录禁放 .env**：服务 WorkingDirectory 下**不准**有 `.env` 文件。
   原因：Node 服务多有 `import "dotenv/config"`，会读子目录 .env 并可能与 EnvironmentFile
   冲突，导致"改了 /home/ubuntu/.env 却不生效"的诡异问题（排查极耗时）。
4. **唯一编辑源**：本地项目根 `.env` 是唯一手工编辑入口，`scripts/sync-env.sh` 同步到
   `/home/ubuntu/.env`。改 env 永远先改本地根 .env 再 sync，不要直接 ssh 上去手改。
5. **所有连库服务必须指向同一个库**。healthcheck 铁律2 会校验这一点。

## 部署方式

> 具体脚本名/参数以 `scripts/` 目录现状为准（核对，别背）。当前已知：

- **唯一真部署通道**：`git push deploy main`。`deploy` 是直连服务器裸仓
  `ubuntu@42.193.170.109:/var/git/software-index.git` 的 remote，其 `hooks/post-receive`
  钩子会全量构建（前端 + server + agent + platform + return-workflow）+ 安装四个 service
  + 重启全部服务。**前端和后端都走这一条，不存在"前端走 GitHub CI"那回事。**
- **ZIP 上传安装包**：`bash scripts/deploy.sh <zip路径>` → 传到 `downloads/`，不动代码。
  （与 git 钩子并存的第二套路径，是潜在漂移源，非必要别用。）
- **改 env**：改本地根 `.env` → `bash scripts/sync-env.sh` → 重启受影响服务。

## Git remote 与流程规范（2026-06 实测确立）

这个项目有**两个 remote，职责完全不同，别混**：

| remote | 指向 | 职责 |
|--------|------|------|
| `deploy` | 服务器裸仓 `ubuntu@42.193.170.109:/var/git/software-index.git` | **唯一真部署通道**。`git push deploy main` 触发 post-receive 全量构建+重启。 |
| `origin` | GitHub `dietortoise25/software-index-page` | **纯备份，不参与部署**（用户嫌 GitHub 慢，刻意不让部署走它）。GitHub **没有** Actions/CI 部署。 |

**关键认知（否则会误判）：**
- **本地工作树是权威主线**。GitHub 上的 main 曾长期脱节——本地领先 origin 282 个提交、
  origin 只有 5 个老分叉提交（早期 chatbox 旧并行版，本地已有更全实现）。
  推 GitHub 时若遇分叉，默认**以本地为准**。
- **推送顺序**：部署用 `git push deploy main`；备份用 `git push origin main`。两者独立，
  改了代码想既上线又备份就两条都推。日常 `git status` 跟踪的是 origin（已设上游）。
- **强推 origin 是允许的**（它只是备份、本地权威）：分叉且确认本地更全时，
  `git push --force-with-lease origin main` 覆盖即可——但**先确认 origin 独有提交的功能
  本地确实已有**（用 `git diff main...origin/main --stat` + 查文件是否存在），别盲推丢东西。
- **强推 deploy 要谨慎**：它连着生产，force 会让钩子按被覆盖后的代码重建。非清理历史别 force。
- **钩子/service 文件是版本库单一来源**：post-receive（`backend/langchain-agent/deploy-files/post-receive`）
  和四个 `.service`（server/relay、platform/qianyi-scheduler、tools/return-workflow、
  backend/langchain-agent）都在版本库里，部署时钩子自动 `cp` 到服务器使其跟随版本库。
  改钩子后要 `scp` 装回服务器裸仓 `hooks/post-receive` 才生效（push 不会自动更新钩子本身）。

**安全红线：**
- **密钥绝不进 git**：`.env` 已 gitignore；`.service` 一律用 EnvironmentFile，不写明文。
  若发现历史里有明文（relay/qianyi 旧 service 曾有），见 [[git-secret-cleanup-history]]，
  清理需 `git filter-repo` 重写 + force 覆盖两个 remote（高危，逐步确认）。
- **大二进制别进 git**：`public/about-bgm.m4a`(59M) 已是单版本可接受上限。再有大文件考虑
  移出 git 或 Git LFS——否则撞 GitHub 50M 推荐上限、拖慢推送。
- 改 systemd / 删服务器文件 / 重启服务属高危，先报告再做。

## 踩坑记录

### A. env 多来源导致连错库（2026-06，排查数小时）
**现象**：agent 接口全 401。**根因**：`DATABASE_URL` 在 4 处各有一份（relay.service 硬编码=对，
其余 .env=指向已废弃的 `ap-southeast-1` 库），靠 systemd 注入顺序+dotenv 隐式规则决定生效值，
agent 连了连不上的废库。**教训**：见上方 env 铁律。**防复发**：healthcheck 铁律2/3。

### B. 假 000 健康检查（每次部署都像失败）
post-receive 钩子重启后 `sleep` 太短就 curl，服务没起完返回 `000`，误报部署失败。
**对策**：healthcheck 用 `-m 5` 超时 + 真 200 判定；钩子里健康检查应轮询重试而非单次。

### C. SSE 长流撞 nginx 60s 读超时
选品分析 SSE 帧间静默 >60s 被 nginx 掐断。**对策**：nginx 对 SSE location 设
`proxy_read_timeout 600s; proxy_buffering off`，应用层加心跳帧兜底。

### D. Shell `cd` 副作用（旧坑，已修）
部署脚本里裸 `cd` 永久改当前目录，后续相对路径错位。用子 shell `(cd x && cmd)` 隔离。

### E. `.env` 含空格变量名 `source` 失败（旧坑）
`Encrypt Key=...` 含空格被 bash 当命令执行。脚本用 `grep|cut` 逐键提取，不要 `source .env`。

### F. Node <22 无原生 WebSocket
`@supabase/supabase-js` 报错。服务器 Node 已升 v22，勿降级。

## 体检脚本说明

`scripts/healthcheck.sh`：**自发现**本项目服务（按 WorkingDirectory 路径归属判定，新增服务
自动纳入，不写死清单），校验 4 条与版本无关的铁律：① 服务全 active ② 连库服务指向同一库
③ 无子目录 .env 残留 ④ DB 实测连通 + 端口真 200。退出码非 0 即有问题，已挂进部署流程。
