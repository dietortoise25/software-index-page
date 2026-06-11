#!/usr/bin/env bash
# healthcheck.sh — 部署健康体检（自发现，不写死服务清单）
#
# 设计原则：只校验与版本无关的"铁律"，让脚本随项目升级自动适应。
#   1. 自动发现本项目的 systemd 服务（按 WorkingDirectory/ExecStart 路径判定归属）
#   2. 校验所有连 DB 的服务，其 DATABASE_URL 指向同一个库且能连通
#   3. 校验不存在「子目录 .env 与 EnvironmentFile 并存」的隐患
#   4. 校验有端口的服务健康检查返回真 200（而非假 000）
#
# 用法：bash scripts/healthcheck.sh
# 退出码：0=全通过，非0=有问题（可挂进部署流程末尾自动拦截）

set -uo pipefail

# ── 服务器连接（从根 .env 读，缺省回落） ──────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
env_val() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }
SERVER_USER="$(env_val SERVER_USER)"; SERVER_USER="${SERVER_USER:-ubuntu}"
SERVER_IP="$(env_val SERVER_IP)"; SERVER_IP="${SERVER_IP:-42.193.170.109}"
SSH="ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP}"

# 本项目根路径特征（自发现归属判定用，新增服务落在这些目录下即自动纳入）
PROJECT_PATHS="software-index|shopee-analyzer"

PASS=0; FAIL=0
ok()   { echo "  [OK]   $1"; PASS=$((PASS+1)); }
bad()  { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
info() { echo "  ---    $1"; }

echo "=== 部署体检 @ ${SERVER_IP} ==="

# ── 在服务器上一次性采集所有事实，本地解析（减少 SSH 往返） ───────────
# 输出格式：每行 "KIND|字段..."，本地按 KIND 解析。
REMOTE=$($SSH "bash -s" <<REMOTE_EOF 2>/dev/null
set -uo pipefail
PROJECT_PATHS='${PROJECT_PATHS}'

# 1. 自发现本项目服务：扫所有 .service，按 WorkingDirectory/ExecStart 路径归属判定
for f in /etc/systemd/system/*.service; do
  n=\$(basename "\$f" .service)
  exec=\$(grep -E '^ExecStart=' "\$f" 2>/dev/null | head -1)
  wd=\$(grep -E '^WorkingDirectory=' "\$f" 2>/dev/null | head -1 | cut -d= -f2)
  echo "\$exec \$wd" | grep -qE "\$PROJECT_PATHS" || continue

  active=\$(systemctl is-active "\$n" 2>/dev/null)
  pid=\$(systemctl show -p MainPID --value "\$n" 2>/dev/null)
  envfile=\$(grep -E '^EnvironmentFile=' "\$f" 2>/dev/null | head -1 | sed 's/^EnvironmentFile=-\?//')
  hardcoded=\$(grep -cE '^Environment=' "\$f" 2>/dev/null)
  echo "SVC|\$n|\$active|\$wd|\$envfile|\$hardcoded"

  # 子目录 .env 与 EnvironmentFile 并存隐患
  if [ -n "\$wd" ] && [ -f "\$wd/.env" ]; then
    echo "SUBENV|\$n|\$wd/.env"
  fi

  # 该进程 environ 里的 DATABASE_URL（取 host:port，不回显密码）
  if [ -n "\$pid" ] && [ "\$pid" != "0" ]; then
    dburl=\$(sudo tr '\0' '\n' < /proc/\$pid/environ 2>/dev/null | grep '^DATABASE_URL=' | head -1 | cut -d= -f2-)
    if [ -n "\$dburl" ]; then
      hostport=\$(echo "\$dburl" | sed -E 's|.*@([^/]+)/.*|\1|')
      echo "DB|\$n|\$hostport"
    fi
  fi
done
REMOTE_EOF
)

if [ -z "$REMOTE" ]; then
  echo "  [FAIL] 无法从服务器采集数据（SSH 连接失败？）"; exit 1
fi

# ── 铁律 1：服务发现 + 全部 active ───────────────────────────────────
echo ""
echo "[1] 服务状态（自发现）"
svc_count=0
while IFS='|' read -r kind name active wd envfile hardcoded; do
  [ "$kind" = "SVC" ] || continue
  svc_count=$((svc_count+1))
  if [ "$active" = "active" ]; then ok "$name 运行中"; else bad "$name 未运行（$active）"; fi
done <<< "$REMOTE"
[ "$svc_count" -gt 0 ] && info "共发现 $svc_count 个本项目服务" || bad "未发现任何本项目服务"

# ── 铁律 2：DATABASE_URL 全体指向同一库 ─────────────────────────────
echo ""
echo "[2] DATABASE_URL 一致性（所有连库服务必须指向同一库）"
db_hosts=$(echo "$REMOTE" | awk -F'|' '$1=="DB"{print $3}' | sort -u)
db_uniq_count=$(echo "$db_hosts" | grep -c .)
if [ "$db_uniq_count" -le 1 ] && [ -n "$db_hosts" ]; then
  ok "所有连库服务指向同一库：$db_hosts"
elif [ "$db_uniq_count" -gt 1 ]; then
  bad "连库服务指向了不同的库（这正是上次踩的坑）："
  echo "$REMOTE" | awk -F'|' '$1=="DB"{printf "         %s -> %s\n",$2,$3}'
else
  info "未发现连库服务"
fi

# ── 铁律 3：无「子目录 .env 与 EnvironmentFile 并存」隐患 ────────────
echo ""
echo "[3] env 单一来源（子目录不应残留 .env，避免 dotenv 覆盖 EnvironmentFile）"
subenv=$(echo "$REMOTE" | awk -F'|' '$1=="SUBENV"')
if [ -z "$subenv" ]; then
  ok "无子目录 .env 残留"
else
  echo "$subenv" | while IFS='|' read -r _ name path; do
    bad "$name 存在子目录 .env：$path（可能覆盖 /home/ubuntu/.env，应删除）"
  done
fi

# ── 铁律 4：连库服务实测能连通 + 健康端点真 200 ─────────────────────
echo ""
echo "[4] DB 实测连通 + 端口健康（真 200，非假 000）"
HEALTH=$($SSH "bash -s" <<'REMOTE_EOF' 2>/dev/null
set -uo pipefail
# 监听端口探测：列出本机 127.0.0.1 上 LISTEN 的端口，逐个试通用健康路径
ports=$(ss -ltnH 2>/dev/null | awk '{print $4}' | grep -oE '[0-9]+$' | sort -un)
for p in $ports; do
  # 只测常见应用端口段，跳过系统端口
  [ "$p" -ge 1024 ] || continue
  for path in /api/agent/health /health / ; do
    code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:$p$path" 2>/dev/null)
    if [ "$code" = "200" ]; then echo "PORT|$p|$path|200"; break; fi
  done
done
# DB 连通：用 /home/ubuntu/.env 的 DATABASE_URL 实测查（在有 pg 模块的服务目录里跑）
if [ -f /home/ubuntu/.env ] && command -v node >/dev/null; then
  dburl=$(grep '^DATABASE_URL=' /home/ubuntu/.env | head -1 | cut -d= -f2-)
  pgdir=""
  for d in /var/www/software-index/agent /var/www/software-index/server; do
    [ -d "$d/node_modules/pg" ] && pgdir="$d" && break
  done
  if [ -n "$pgdir" ]; then
    res=$(cd "$pgdir" && DBU="$dburl" timeout 20 node --input-type=module -e '
import { Pool } from "pg";
const pool=new Pool({connectionString:process.env.DBU,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:12000});
try{ await pool.query("select 1"); console.log("DBOK"); }
catch(e){ console.log("DBERR:"+e.message); } finally{ try{await pool.end()}catch{} }
' 2>/dev/null)
    echo "DBCONN|$res"
  else
    echo "DBCONN|NOPG"
  fi
fi
REMOTE_EOF
)
healthy_ports=$(echo "$HEALTH" | awk -F'|' '$1=="PORT"{print $2}')
if [ -n "$healthy_ports" ]; then
  echo "$HEALTH" | awk -F'|' '$1=="PORT"{printf "         :%s%s -> 200\n",$2,$3}'
  ok "有 $(echo "$healthy_ports" | grep -c .) 个端口返回真 200"
else
  bad "没有任何端口返回 200（可能全挂或健康路径变了）"
fi
dbconn=$(echo "$HEALTH" | awk -F'|' '$1=="DBCONN"{print $2}')
case "$dbconn" in
  DBOK)    ok "DATABASE_URL 实测连通" ;;
  DBERR*)  bad "DATABASE_URL 实测连不上：${dbconn#DBERR:}（上次的根因就是连错库）" ;;
  NOPG)    info "未做 DB 连通测试（服务器无 pg 模块）" ;;
  *)       info "未做 DB 连通测试（无 node 或无 DATABASE_URL）" ;;
esac

# ── 汇总 ─────────────────────────────────────────────────────────────
echo ""
echo "=== 体检结果：$PASS 通过 / $FAIL 失败 ==="
if [ "$FAIL" -gt 0 ]; then
  echo "！有 $FAIL 项未通过，部署可能有问题，请检查上面 [FAIL] 项。"
  exit 1
fi
echo "全部通过。"
exit 0

