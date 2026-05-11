#!/usr/bin/env bash
#
# deploy.sh — 软件发布站部署脚本
# 用法：
#   bash scripts/deploy.sh <zip文件路径>                  # 上传zip到服务器
#   bash scripts/deploy.sh <zip文件路径> --no-code-update  # 仅上传，不提示代码更新
#
# 前置条件：
#   - .env 文件已配置（参考 .env.example）
#   - SSH 密钥已添加至服务器（腾讯云控制台绑定密钥对）
#   - Windows 下需先启动 ssh-agent： eval $(ssh-agent) && ssh-add <私钥路径>

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERR]${NC}   $*" >&2; exit 1; }

# ── 读取 .env ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    err "找不到 .env 文件，请先创建: cp .env.example .env"
fi

set -a
source "$ENV_FILE"
set +a

# ── 参数 ──
ZIP_FILE="${1:-}"
CODE_UPDATE=true
[ "${2:-}" = "--no-code-update" ] && CODE_UPDATE=false

if [ -z "$ZIP_FILE" ] || [ ! -f "$ZIP_FILE" ]; then
    echo "用法: bash scripts/deploy.sh <zip文件路径> [--no-code-update]"
    echo ""
    echo "示例: bash scripts/deploy.sh publish/TF客服值守v3.4.1.zip"
    echo ""
    echo "前置: 启动 ssh-agent 并加载密钥"
    echo "  eval \$(ssh-agent)"
    echo "  ssh-add ~/.ssh/alan_pc.pem"
    exit 1
fi

# ── 连接检查 ──
SSH_TARGET="${SERVER_USER}@${SERVER_IP}"
SSH_PORT="${SERVER_PORT:-22}"

log "检查连接 $SSH_TARGET..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes -p "$SSH_PORT" "$SSH_TARGET" "echo OK" &>/dev/null; then
    err "无法连接到 $SSH_TARGET:$SSH_PORT"
    warn "请在终端执行: eval \$(ssh-agent) && ssh-add '$SSH_KEY_PATH'"
    exit 1
fi
log "连接成功"

# ── 上传 ──
ZIP_FILENAME="$(basename "$ZIP_FILE")"
DOWNLOADS_DIR="${DOWNLOADS_PATH:-/var/www/software-index/downloads}"
REMOTE_PATH="$DOWNLOADS_DIR/$ZIP_FILENAME"
DOWNLOAD_URL="${DOWNLOADS_BASE_URL:-http://${SERVER_IP}/downloads}/$ZIP_FILENAME"

log "上传 $ZIP_FILENAME ..."
ssh -p "$SSH_PORT" "$SSH_TARGET" "mkdir -p '$DOWNLOADS_DIR'"
scp -P "$SSH_PORT" "$ZIP_FILE" "$SSH_TARGET:$REMOTE_PATH"

# ── 验证 ──
LOCAL_SIZE=$(stat -c%s "$ZIP_FILE" 2>/dev/null || stat -f%z "$ZIP_FILE" 2>/dev/null)
REMOTE_SIZE=$(ssh -p "$SSH_PORT" "$SSH_TARGET" "stat -c%s '$REMOTE_PATH' 2>/dev/null || stat -f%z '$REMOTE_PATH' 2>/dev/null")

if [ "$REMOTE_SIZE" = "$LOCAL_SIZE" ]; then
    log "上传完成，文件校验通过"
else
    err "文件大小不一致 (本地: $LOCAL_SIZE, 远程: $REMOTE_SIZE)，请重试"
fi

echo ""
echo "=============================================="
echo "部署完成"
echo "文件: $ZIP_FILENAME"
echo "链接: $DOWNLOAD_URL"
echo "远程: $REMOTE_PATH"
echo "=============================================="

if [ "$CODE_UPDATE" = false ]; then
    log "跳过代码更新"
else
    echo ""
    warn "请手动更新以下文件以发布新版本："
    warn "  src/data/software.ts — 添加新版本记录"
    warn "  src/data/articles.ts — 添加发布文章"
fi
