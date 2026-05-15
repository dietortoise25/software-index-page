#!/bin/bash
set -e

# ===== 配置 =====
SERVER_USER="ubuntu"
SERVER_IP="42.193.170.109"
SSH_KEY="$HOME/.ssh/alan_pc.pem"
DEPLOY_ROOT="/var/www/software-index"
SSH="ssh -i $SSH_KEY -o ConnectTimeout=10"
SCP="scp -i $SSH_KEY"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}  OK${NC} $1"; }
fail() { echo -e "${RED}  FAIL${NC} $1"; exit 1; }

cd "$(dirname "$0")"

# ===== Step 1: Build =====
log "构建 platform..."
(cd platform && pnpm build) || fail "platform 构建失败"
ok "platform"

log "构建 server..."
(cd server && pnpm build) || fail "server 构建失败"
ok "server"

log "构建前端..."
pnpm build || fail "前端构建失败"
ok "前端"

# ===== Step 2: Package =====
log "打包部署包..."
tar czf /tmp/deploy.tar.gz \
  dist/ \
  server/dist/ server/package.json server/pnpm-lock.yaml \
  platform/dist/ platform/package.json platform/pnpm-lock.yaml \
  2>/dev/null
ok "打包完成 ($(du -h /tmp/deploy.tar.gz | cut -f1))"

# ===== Step 3: Upload =====
log "上传到服务器..."
$SCP /tmp/deploy.tar.gz $SERVER_USER@$SERVER_IP:/tmp/ || fail "上传失败"
ok "上传完成"

# ===== Step 4: Deploy =====
log "服务器部署中..."
$SCP server-deploy.sh $SERVER_USER@$SERVER_IP:/tmp/ || fail "脚本上传失败"
$SSH $SERVER_USER@$SERVER_IP "sudo bash /tmp/server-deploy.sh" || fail "服务器部署失败"
ok "部署完成"

# ===== Step 5: Restart =====
log "重启服务..."
$SSH $SERVER_USER@$SERVER_IP "
  sudo systemctl restart relay qianyi-scheduler
  sleep 3

  echo '--- relay ---'
  sudo systemctl status relay --no-pager | head -4

  echo '--- scheduler ---'
  sudo systemctl status qianyi-scheduler --no-pager | head -4
"
ok "服务已重启"

# ===== Step 6: Verify =====
log "验证..."
HTTP_CODE=$($SSH $SERVER_USER@$SERVER_IP "curl -s -o /dev/null -w '%{http_code}' http://localhost/" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
  ok "网站 HTTP $HTTP_CODE"
else
  fail "网站 HTTP $HTTP_CODE"
fi

# 等待 scheduler 首轮同步
sleep 5
$SSH $SERVER_USER@$SERVER_IP "sudo journalctl -u qianyi-scheduler --no-pager -n 3" 2>/dev/null

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}  http://$SERVER_IP/${NC}"
echo -e "${GREEN}  http://$SERVER_IP/dashboard${NC}"
echo -e "${GREEN}  http://$SERVER_IP/internal/admin${NC}"
echo -e "${GREEN}========================================${NC}"
