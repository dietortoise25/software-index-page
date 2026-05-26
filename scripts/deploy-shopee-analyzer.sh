#!/usr/bin/env bash
# 部署 Shopee 数据分析 Python 后端到服务器
# 用法: bash scripts/deploy-shopee-analyzer.sh
# 前置: eval $(ssh-agent) && ssh-add ~/.ssh/alan_pc.pem
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
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
SERVER="${SERVER_USER}@${SERVER_IP}"

REMOTE_DIR="/var/www/shopee-analyzer"
SRC_DIR="$PROJECT_DIR/backend/python/shopee-analyzer"

echo "=== 上传后端代码 ($SRC_DIR → $REMOTE_DIR) ==="
ssh -p "$SERVER_PORT" "$SERVER" "sudo mkdir -p $REMOTE_DIR && sudo chown ubuntu:ubuntu $REMOTE_DIR"
scp -P "$SERVER_PORT" -r \
  "$SRC_DIR/main.py" \
  "$SRC_DIR/analyzer.py" \
  "$SRC_DIR/diagnose.py" \
  "$SRC_DIR/simulate.py" \
  "$SRC_DIR/requirements.txt" \
  "$SRC_DIR/extractors/" \
  "$SRC_DIR/metrics/" \
  "$SRC_DIR/config/" \
  "$SERVER:$REMOTE_DIR/"

echo "=== 安装 Python3-venv + 创建 venv + 安装依赖 ==="
ssh -p "$SERVER_PORT" "$SERVER" "sudo apt install -y python3.12-venv && cd $REMOTE_DIR && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"

echo "=== 创建 systemd 服务 ==="
ssh -p "$SERVER_PORT" "$SERVER" "sudo tee /etc/systemd/system/shopee-analyzer.service" << 'SVC'
[Unit]
Description=Shopee Store Analyzer (FastAPI)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/shopee-analyzer
ExecStart=/var/www/shopee-analyzer/.venv/bin/python3 -m uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SVC

echo "=== 启动服务 ==="
ssh -p "$SERVER_PORT" "$SERVER" "sudo systemctl daemon-reload && sudo systemctl enable shopee-analyzer && sudo systemctl restart shopee-analyzer"

sleep 2
echo "=== 健康检查 ==="
ssh -p "$SERVER_PORT" "$SERVER" "curl -s http://127.0.0.1:8000/api/health"
echo ""
echo "=== 部署完成 ==="
