#!/usr/bin/env bash
# 同步本地 .env 到服务器 /home/ubuntu/.env
# 用法: bash scripts/sync-env.sh
# 前置: eval $(ssh-agent) && ssh-add ~/.ssh/alan_pc.pem
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# 安全解析 .env
env_val() {
    local key="$1"
    local default="${2:-}"
    local val
    val=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)
    val=$(echo "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    echo "${val:-$default}"
}

SERVER_USER="$(env_val SERVER_USER)"
SERVER_IP="$(env_val SERVER_IP)"
SERVER_PORT="$(env_val SERVER_PORT 22)"

echo "同步 .env → $SERVER_USER@$SERVER_IP:/home/ubuntu/.env"
scp -P "$SERVER_PORT" "$ENV_FILE" "$SERVER_USER@$SERVER_IP:/tmp/.env"
ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_IP" "sudo cp /tmp/.env /home/ubuntu/.env && rm /tmp/.env && echo '服务器 .env 已更新'"

echo ""
echo "如需重启服务使变更生效:"
echo "  git push deploy main"
echo "  或: ssh $SERVER_USER@$SERVER_IP 'sudo systemctl restart relay'"
